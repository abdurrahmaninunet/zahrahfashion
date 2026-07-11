import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface AnkoConfig { enabled?: boolean; increment?: number; unitPrice?: number; exclusivityDays?: number; note?: string }
interface RawLock { product_id: string; customer_id: string; locked_until: Date }

/** Anko = group/event (aso-ebi) bulk fabric at the lowest price, with an
 *  exclusivity lock: buying it reserves that fabric's bulk to the buyer for a
 *  period so competitors can't buy it in bulk. Locks live in a raw `anko_locks`
 *  table (prisma generate is locked → raw SQL). */
@Injectable()
export class AnkoService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS anko_locks (
      product_id   text PRIMARY KEY,
      customer_id  text NOT NULL,
      locked_until timestamptz NOT NULL,
      created_at   timestamptz NOT NULL DEFAULT now()
    )`);
  }

  /** The active lock on a product (locked_until in the future), or null. */
  async activeLock(productId: string): Promise<{ customerId: string; lockedUntil: Date } | null> {
    const rows = await this.prisma.$queryRaw<RawLock[]>`
      SELECT customer_id, locked_until FROM anko_locks WHERE product_id = ${productId} AND locked_until > now() LIMIT 1`;
    return rows[0] ? { customerId: rows[0].customer_id, lockedUntil: rows[0].locked_until } : null;
  }

  async lockedProductIds(): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ product_id: string }[]>`SELECT product_id FROM anko_locks WHERE locked_until > now()`;
    return rows.map((r) => r.product_id);
  }

  /** Anko-enabled, active, visible products. */
  async ankoEnabledIds(): Promise<string[]> {
    const rows = await this.prisma.product.findMany({
      where: { status: 'active', visibility: 'visible', attributeValues: { path: ['_anko', 'enabled'], equals: true } },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  /** Anko fabrics available to buy right now (enabled and not locked). */
  async availableProductIds(): Promise<string[]> {
    const [enabled, locked] = await Promise.all([this.ankoEnabledIds(), this.lockedProductIds()]);
    const lockedSet = new Set(locked);
    return enabled.filter((id) => !lockedSet.has(id));
  }

  async heldBy(productId: string, customerId: string | null): Promise<boolean> {
    if (!customerId) return false;
    const lock = await this.activeLock(productId);
    return !!lock && lock.customerId === customerId;
  }

  /** Reject an anko purchase if the fabric is locked to a different buyer. */
  async assertBuyable(productId: string, buyerCustomerId: string | null): Promise<void> {
    const lock = await this.activeLock(productId);
    if (lock && lock.customerId !== buyerCustomerId) {
      const until = lock.lockedUntil.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
      throw new BadRequestException(`This anko is currently exclusive to another buyer until ${until}. Please check back after then.`);
    }
  }

  /** Lock a fabric's bulk to a buyer for its configured exclusivity period. */
  async lockForProduct(productId: string, customerId: string): Promise<void> {
    const p = await this.prisma.product.findUnique({ where: { id: productId }, select: { attributeValues: true } });
    const cfg = (p?.attributeValues as { _anko?: AnkoConfig } | null)?._anko;
    const days = Number(cfg?.exclusivityDays) > 0 ? Number(cfg!.exclusivityDays) : 60;
    const until = new Date(Date.now() + days * 86_400_000);
    await this.prisma.$executeRaw`
      INSERT INTO anko_locks (product_id, customer_id, locked_until, created_at)
      VALUES (${productId}, ${customerId}, ${until}, now())
      ON CONFLICT (product_id) DO UPDATE SET customer_id = EXCLUDED.customer_id, locked_until = EXCLUDED.locked_until, created_at = now()`;
  }

  // ── Admin ─────────────────────────────────────────────────────────────────
  async listLocks() {
    const rows = await this.prisma.$queryRaw<RawLock[]>`SELECT product_id, customer_id, locked_until FROM anko_locks WHERE locked_until > now() ORDER BY locked_until ASC`;
    const productIds = [...new Set(rows.map((r) => r.product_id))];
    const custIds = [...new Set(rows.map((r) => r.customer_id))];
    const [products, customers] = await Promise.all([
      productIds.length ? this.prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, slug: true } }) : [],
      custIds.length ? this.prisma.customer.findMany({ where: { id: { in: custIds } }, select: { id: true, fullName: true, email: true, primaryPhone: true } }) : [],
    ]);
    const pById = new Map(products.map((p) => [p.id, p]));
    const cById = new Map(customers.map((c) => [c.id, c]));
    return {
      rows: rows.map((r) => {
        const p = pById.get(r.product_id);
        const c = cById.get(r.customer_id);
        return {
          productId: r.product_id, lockedUntil: r.locked_until,
          product: p ? { name: p.name, slug: p.slug } : null,
          customer: c ? { name: c.fullName, email: c.email, phone: c.primaryPhone } : null,
        };
      }),
    };
  }

  async release(productId: string) {
    await this.prisma.$executeRaw`DELETE FROM anko_locks WHERE product_id = ${productId}`;
    return { released: true };
  }
}
