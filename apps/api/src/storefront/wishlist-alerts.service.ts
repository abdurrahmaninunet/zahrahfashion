import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StoreCatalogService } from './store-catalog.service';

const RESEND_FROM_DEFAULT = 'Zahrah Fashion Hub <onboarding@resend.dev>';
const SEND_COOLDOWN_MS = 12 * 60 * 60 * 1000; // don't re-notify the same item within 12h

interface AlertRow {
  customer_id: string;
  product_id: string;
  notify_price: boolean;
  notify_stock: boolean;
  base_price: bigint | null;
  was_soldout: boolean | null;
  last_sent_at: Date | null;
}

/**
 * Wishlist price / back-in-stock alerts. Customers opt in from the wishlist
 * (Price Monitor toggles + per-item "notify when back in stock"); an hourly job
 * snapshots each watched product's price/stock and emails the customer when a
 * price drops or a sold-out item returns. Raw SQL table (prisma generate is
 * locked on Windows — same pattern as wallet/reviews).
 */
@Injectable()
export class WishlistAlertsService implements OnModuleInit {
  constructor(private prisma: PrismaService, private catalog: StoreCatalogService) {}

  async onModuleInit() {
    await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS wishlist_alerts (
      customer_id  text NOT NULL,
      product_id   text NOT NULL,
      notify_price boolean NOT NULL DEFAULT false,
      notify_stock boolean NOT NULL DEFAULT false,
      base_price   bigint,
      was_soldout  boolean,
      last_sent_at timestamptz,
      updated_at   timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (customer_id, product_id)
    )`);
  }

  /** Current opt-ins for a customer, so the UI can reflect toggle state. */
  async list(customerId: string) {
    const rows = await this.prisma.$queryRaw<{ product_id: string; notify_price: boolean; notify_stock: boolean }[]>`
      SELECT product_id, notify_price, notify_stock FROM wishlist_alerts
      WHERE customer_id = ${customerId} AND (notify_price OR notify_stock)`;
    return { items: rows.map((r) => ({ productId: r.product_id, notifyPrice: r.notify_price, notifyStock: r.notify_stock })) };
  }

  /**
   * Apply an alert patch to a set of products. Snapshots each product's current
   * price / sold-out state so drops and restocks are measured from "now". A row
   * with both flags off is removed. `productIds` is typically the customer's
   * whole wishlist (Price Monitor) or a single product (back-in-stock button).
   */
  async set(customerId: string, productIds: string[], patch: { notifyPrice?: boolean; notifyStock?: boolean }) {
    const ids = [...new Set(productIds)].slice(0, 200);
    if (!ids.length) return { ok: true };

    const { products } = await this.catalog.listing({ filters: {}, ids });
    const byId = new Map(products.map((p) => [p.id, p]));

    for (const productId of ids) {
      const card = byId.get(productId);
      const basePrice = card ? card.price : null;
      const wasSoldOut = card ? card.soldOut : null;

      const existing = await this.prisma.$queryRaw<AlertRow[]>`
        SELECT customer_id, product_id, notify_price, notify_stock, base_price, was_soldout, last_sent_at
        FROM wishlist_alerts WHERE customer_id = ${customerId} AND product_id = ${productId} LIMIT 1`;
      const cur = existing[0];
      const notifyPrice = patch.notifyPrice ?? cur?.notify_price ?? false;
      const notifyStock = patch.notifyStock ?? cur?.notify_stock ?? false;

      if (!notifyPrice && !notifyStock) {
        await this.prisma.$executeRaw`DELETE FROM wishlist_alerts WHERE customer_id = ${customerId} AND product_id = ${productId}`;
        continue;
      }

      await this.prisma.$executeRaw`
        INSERT INTO wishlist_alerts (customer_id, product_id, notify_price, notify_stock, base_price, was_soldout, updated_at)
        VALUES (${customerId}, ${productId}, ${notifyPrice}, ${notifyStock}, ${basePrice}, ${wasSoldOut}, now())
        ON CONFLICT (customer_id, product_id) DO UPDATE SET
          notify_price = ${notifyPrice},
          notify_stock = ${notifyStock},
          base_price = COALESCE(wishlist_alerts.base_price, ${basePrice}),
          was_soldout = COALESCE(${wasSoldOut}, wishlist_alerts.was_soldout),
          updated_at = now()`;
    }
    return { ok: true };
  }

  // ── Hourly scan ────────────────────────────────────────────────────────────

  @Cron('7 * * * *') // every hour at :07
  async scan() {
    const rows = await this.prisma.$queryRaw<AlertRow[]>`
      SELECT customer_id, product_id, notify_price, notify_stock, base_price, was_soldout, last_sent_at
      FROM wishlist_alerts WHERE notify_price OR notify_stock`;
    if (!rows.length) return { scanned: 0, sent: 0 };

    const ids = [...new Set(rows.map((r) => r.product_id))];
    const { products } = await this.catalog.listing({ filters: {}, ids });
    const byId = new Map(products.map((p) => [p.id, p]));

    let sent = 0;
    for (const row of rows) {
      const card = byId.get(row.product_id);
      if (!card) continue;

      const priceDropped = row.notify_price && row.base_price != null && card.price < Number(row.base_price);
      const backInStock = row.notify_stock && row.was_soldout === true && !card.soldOut;
      const cooledDown = !row.last_sent_at || Date.now() - new Date(row.last_sent_at).getTime() > SEND_COOLDOWN_MS;

      if ((priceDropped || backInStock) && cooledDown) {
        const customer = await this.prisma.customer.findUnique({ where: { id: row.customer_id }, select: { email: true, fullName: true } });
        if (customer?.email) {
          const kind = priceDropped ? 'price' : 'stock';
          await this.sendAlert(customer.email, kind, {
            name: card.name,
            slug: card.slug,
            price: card.price,
            wasPrice: row.base_price != null ? Number(row.base_price) : card.price,
          });
          await this.prisma.$executeRaw`UPDATE wishlist_alerts SET last_sent_at = now() WHERE customer_id = ${row.customer_id} AND product_id = ${row.product_id}`;
          sent++;
        }
      }

      // Re-baseline so each change notifies once (measure future drops from now).
      await this.prisma.$executeRaw`
        UPDATE wishlist_alerts SET base_price = ${card.price}, was_soldout = ${card.soldOut}
        WHERE customer_id = ${row.customer_id} AND product_id = ${row.product_id}`;
    }
    if (sent) console.log(`[wishlist-alerts] sent ${sent} notification(s)`);
    return { scanned: rows.length, sent };
  }

  private async sendAlert(to: string, kind: 'price' | 'stock', p: { name: string; slug: string; price: number; wasPrice: number }) {
    const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString('en-NG')}`;
    const base = process.env.STOREFRONT_URL ?? 'https://zahrahfashion.com';
    const link = `${base}/p/${p.slug}`;
    const heading = kind === 'price' ? 'Good news — a price drop!' : `${p.name} is back in stock`;
    const line = kind === 'price'
      ? `The price of <b>${escapeHtml(p.name)}</b> just dropped from ${naira(p.wasPrice)} to <b>${naira(p.price)}</b>.`
      : `<b>${escapeHtml(p.name)}</b> from your wishlist is available again — grab it before it sells out.`;
    const subject = kind === 'price' ? `Price drop: ${p.name}` : `Back in stock: ${p.name}`;
    const html = `<div style="font-family:Arial,sans-serif;max-width:480px;color:#222">
      <h2 style="font-weight:700">${heading}</h2>
      <p style="color:#555;line-height:1.6">${line}</p>
      <p style="margin:20px 0"><a href="${link}" style="background:#1c1917;color:#fff;text-decoration:none;padding:11px 20px;border-radius:999px;font-weight:600">View item</a></p>
      <p style="color:#999;font-size:12px">You're receiving this because you turned on wishlist alerts at Zahrah Fashion Hub. Manage them any time from your wishlist.</p>
    </div>`;
    const text = `${heading}\n\n${line.replace(/<[^>]+>/g, '')}\n\n${link}`;
    await this.sendEmail(to, subject, html, text);
  }

  /** Send via Resend REST API; a no-op (logged) when unconfigured. */
  private async sendEmail(to: string, subject: string, html: string, text: string) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL ?? RESEND_FROM_DEFAULT;
    if (!apiKey) { console.warn(`[wishlist-alerts] email to ${to}: "${subject}" (RESEND_API_KEY not set; not sent)`); return; }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [to], subject, html, text }),
      });
      if (!res.ok) console.error(`[wishlist-alerts] Resend rejected (${res.status})`);
    } catch (e) {
      console.error('[wishlist-alerts] email send failed:', (e as Error)?.message ?? e);
    }
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
