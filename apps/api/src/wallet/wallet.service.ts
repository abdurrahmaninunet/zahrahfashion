import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';

const MIN_KOBO = 100_00;          // ₦100 floor
const MAX_KOBO = 5_000_000_00;    // ₦5,000,000 ceiling (sanity)

interface PaystackTx { status: string; reference: string; amount?: number; metadata?: { kind?: string; giftCardId?: string } }

/** Gift cards + store balance. Raw `gift_cards` / `customer_balances` /
 *  `balance_ledger` / `wallet_topups` tables (prisma generate is locked → raw
 *  SQL, same pattern as reviews/anko). Purchases + top-ups go through Paystack;
 *  gift cards can be shared (emailed) or added to the buyer's own balance. */
@Injectable()
export class WalletService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS gift_cards (
      id            text PRIMARY KEY,
      code          text UNIQUE,
      password_hash text,
      amount        bigint NOT NULL,
      purchaser_id  text NOT NULL,
      status        text NOT NULL DEFAULT 'pending',
      reference     text,
      shared_to     text,
      claimed_by    text,
      claimed_at    timestamptz,
      created_at    timestamptz NOT NULL DEFAULT now()
    )`);
    await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS customer_balances (
      customer_id text PRIMARY KEY,
      balance     bigint NOT NULL DEFAULT 0,
      updated_at  timestamptz NOT NULL DEFAULT now()
    )`);
    await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS balance_ledger (
      id          text PRIMARY KEY,
      customer_id text NOT NULL,
      amount      bigint NOT NULL,
      type        text NOT NULL,
      ref         text NOT NULL,
      created_at  timestamptz NOT NULL DEFAULT now()
    )`);
    await this.prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS balance_ledger_ref_uq ON balance_ledger (ref)`);
    await this.prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS balance_ledger_cust_idx ON balance_ledger (customer_id)`);
    await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS wallet_topups (
      reference   text PRIMARY KEY,
      customer_id text NOT NULL,
      amount      bigint NOT NULL,
      status      text NOT NULL DEFAULT 'pending',
      created_at  timestamptz NOT NULL DEFAULT now()
    )`);
  }

  // ── Gift cards ────────────────────────────────────────────────────────────
  async purchaseGiftCard(customer: { id: string; email: string | null }, amountKobo: number, origin?: string) {
    this.assertAmount(amountKobo);
    const id = randomUUID();
    await this.prisma.$executeRaw`INSERT INTO gift_cards (id, amount, purchaser_id, status, created_at) VALUES (${id}, ${amountKobo}, ${customer.id}, 'pending', now())`;
    const reference = `zfgc_${id}_${Date.now().toString(36)}`;
    const init = await this.paystackInit({ reference, amountKobo, email: customer.email, callbackUrl: `${origin ?? ''}/gift-card`, metadata: { kind: 'giftcard', giftCardId: id } });
    await this.prisma.$executeRaw`UPDATE gift_cards SET reference = ${init.reference} WHERE id = ${id}`;
    return { ...init, giftCardId: id };
  }

  async listGiftCards(customerId: string) {
    const rows = await this.prisma.$queryRaw<{ id: string; code: string | null; amount: bigint; status: string; shared_to: string | null; created_at: Date }[]>`
      SELECT id, code, amount, status, shared_to, created_at FROM gift_cards
      WHERE purchaser_id = ${customerId} AND status IN ('active', 'claimed') ORDER BY created_at DESC`;
    return {
      cards: rows.map((r) => ({ id: r.id, code: r.code, amount: Number(r.amount), status: r.status, sharedTo: r.shared_to, createdAt: r.created_at })),
    };
  }

  /** Share a gift card by email — generates a claim password and mails it. */
  async shareGiftCard(customerId: string, giftCardId: string, email: string, phone?: string, message?: string) {
    const gc = await this.ownedActive(customerId, giftCardId);
    const password = generatePassword();
    const hash = await argon2.hash(password);
    await this.prisma.$executeRaw`UPDATE gift_cards SET password_hash = ${hash}, shared_to = ${email} WHERE id = ${giftCardId}`;
    await this.sendGiftEmail(email, { amount: Number(gc.amount), code: gc.code!, password, phone, message });
    return { ok: true };
  }

  /** Add a gift card's value to the buyer's own balance. */
  async useGiftCard(customerId: string, giftCardId: string) {
    const gc = await this.ownedActive(customerId, giftCardId);
    const upd = await this.prisma.$executeRaw`UPDATE gift_cards SET status = 'claimed', claimed_by = ${customerId}, claimed_at = now() WHERE id = ${giftCardId} AND status = 'active'`;
    if (upd === 0) throw new BadRequestException('This gift card has already been used');
    await this.credit(customerId, Number(gc.amount), 'gift_use', giftCardId);
    return { ok: true, amount: Number(gc.amount) };
  }

  private async ownedActive(customerId: string, giftCardId: string) {
    const rows = await this.prisma.$queryRaw<{ id: string; code: string | null; amount: bigint; status: string; purchaser_id: string }[]>`
      SELECT id, code, amount, status, purchaser_id FROM gift_cards WHERE id = ${giftCardId} LIMIT 1`;
    const gc = rows[0];
    if (!gc || gc.purchaser_id !== customerId) throw new BadRequestException('Gift card not found');
    if (gc.status !== 'active') throw new BadRequestException('This gift card is no longer available');
    return gc;
  }

  // ── Balance ───────────────────────────────────────────────────────────────
  async getBalance(customerId: string) {
    const b = await this.prisma.$queryRaw<{ balance: bigint }[]>`SELECT balance FROM customer_balances WHERE customer_id = ${customerId}`;
    const ledger = await this.prisma.$queryRaw<{ amount: bigint; type: string; created_at: Date }[]>`
      SELECT amount, type, created_at FROM balance_ledger WHERE customer_id = ${customerId} ORDER BY created_at DESC LIMIT 50`;
    return {
      balance: Number(b[0]?.balance ?? 0),
      ledger: ledger.map((l) => ({ amount: Number(l.amount), type: l.type, createdAt: l.created_at })),
    };
  }

  async topupBalance(customer: { id: string; email: string | null }, amountKobo: number, origin?: string) {
    this.assertAmount(amountKobo);
    const reference = `zfbal_${customer.id}_${Date.now().toString(36)}`;
    await this.prisma.$executeRaw`INSERT INTO wallet_topups (reference, customer_id, amount, status, created_at) VALUES (${reference}, ${customer.id}, ${amountKobo}, 'pending', now())`;
    return this.paystackInit({ reference, amountKobo, email: customer.email, callbackUrl: `${origin ?? ''}/balance`, metadata: { kind: 'balance' } });
  }

  /** Claim a gift card (16-digit code + emailed password) into your balance. */
  async claimGiftCard(customerId: string, code: string, password: string) {
    const clean = code.replace(/\s+/g, '');
    const rows = await this.prisma.$queryRaw<{ id: string; amount: bigint; status: string; password_hash: string | null }[]>`
      SELECT id, amount, status, password_hash FROM gift_cards WHERE code = ${clean} LIMIT 1`;
    const gc = rows[0];
    if (!gc) throw new BadRequestException('Invalid gift card number');
    if (gc.status !== 'active') throw new BadRequestException('This gift card has already been used');
    if (!gc.password_hash || !(await argon2.verify(gc.password_hash, password).catch(() => false))) {
      throw new BadRequestException('Incorrect gift card password');
    }
    const upd = await this.prisma.$executeRaw`UPDATE gift_cards SET status = 'claimed', claimed_by = ${customerId}, claimed_at = now() WHERE id = ${gc.id} AND status = 'active'`;
    if (upd === 0) throw new BadRequestException('This gift card has already been used');
    await this.credit(customerId, Number(gc.amount), 'gift_claim', gc.id);
    return { ok: true, amount: Number(gc.amount) };
  }

  /** Idempotent credit — ledger `ref` is unique, so a repeat settle is a no-op. */
  private async credit(customerId: string, amount: number, type: string, ref: string): Promise<boolean> {
    const inserted = await this.prisma.$executeRaw`
      INSERT INTO balance_ledger (id, customer_id, amount, type, ref, created_at)
      VALUES (${randomUUID()}, ${customerId}, ${amount}, ${type}, ${ref}, now())
      ON CONFLICT (ref) DO NOTHING`;
    if (inserted === 0) return false; // already credited
    await this.prisma.$executeRaw`
      INSERT INTO customer_balances (customer_id, balance, updated_at) VALUES (${customerId}, ${amount}, now())
      ON CONFLICT (customer_id) DO UPDATE SET balance = customer_balances.balance + ${amount}, updated_at = now()`;
    return true;
  }

  // ── Paystack settlement (called by store-checkout verify + webhook) ────────
  async settle(kind: string, tx: PaystackTx) {
    if (tx.status !== 'success') return { status: tx.status, kind };
    if (kind === 'giftcard') {
      const gcId = tx.metadata?.giftCardId;
      if (gcId) {
        const rows = await this.prisma.$queryRaw<{ status: string }[]>`SELECT status FROM gift_cards WHERE id = ${gcId} LIMIT 1`;
        if (rows[0]?.status === 'pending') {
          const code = await this.generateUniqueCode();
          await this.prisma.$executeRaw`UPDATE gift_cards SET status = 'active', code = ${code} WHERE id = ${gcId} AND status = 'pending'`;
        }
      }
      return { status: 'success' as const, kind: 'giftcard' };
    }
    if (kind === 'balance') {
      const rows = await this.prisma.$queryRaw<{ customer_id: string; amount: bigint; status: string }[]>`SELECT customer_id, amount, status FROM wallet_topups WHERE reference = ${tx.reference} LIMIT 1`;
      const t = rows[0];
      if (t && t.status === 'pending') {
        await this.credit(t.customer_id, Number(t.amount), 'topup', tx.reference);
        await this.prisma.$executeRaw`UPDATE wallet_topups SET status = 'settled' WHERE reference = ${tx.reference}`;
      }
      return { status: 'success' as const, kind: 'balance' };
    }
    return { status: tx.status, kind };
  }

  /** Dev/local settle without a real Paystack round-trip (non-production only). */
  async simulate(reference: string) {
    if (process.env.NODE_ENV === 'production') throw new BadRequestException('Not available');
    if (reference.startsWith('zfgc_')) return this.settle('giftcard', { status: 'success', reference, metadata: { kind: 'giftcard', giftCardId: reference.split('_')[1] } });
    if (reference.startsWith('zfbal_')) return this.settle('balance', { status: 'success', reference });
    throw new BadRequestException('Unknown reference');
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  private assertAmount(amountKobo: number) {
    if (!Number.isFinite(amountKobo) || amountKobo < MIN_KOBO) throw new BadRequestException('Minimum amount is ₦100');
    if (amountKobo > MAX_KOBO) throw new BadRequestException('Amount is too large');
  }

  private async generateUniqueCode(): Promise<string> {
    for (let i = 0; i < 12; i++) {
      const code = Array.from({ length: 16 }, () => Math.floor(Math.random() * 10)).join('');
      const exists = await this.prisma.$queryRaw<{ x: number }[]>`SELECT 1 AS x FROM gift_cards WHERE code = ${code} LIMIT 1`;
      if (!exists.length) return code;
    }
    throw new BadRequestException('Could not generate a gift card number — please try again');
  }

  private async paystackInit(params: { reference: string; amountKobo: number; email: string | null; callbackUrl: string; metadata: Record<string, unknown> }) {
    const key = process.env.PAYSTACK_SECRET_KEY;
    if (!key) return { simulated: true as const, reference: params.reference };
    const email = params.email || `${params.reference}@zahrah.local`;
    const res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: params.amountKobo, email, reference: params.reference, currency: 'NGN', callback_url: params.callbackUrl || undefined, metadata: params.metadata }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { status?: boolean; data?: { authorization_url: string; reference: string } } | null;
    if (!res?.ok || !data?.status || !data.data) throw new BadRequestException('Could not start the payment — please try again');
    return { authorizationUrl: data.data.authorization_url, reference: data.data.reference };
  }

  private async sendGiftEmail(to: string, gift: { amount: number; code: string; password: string; phone?: string; message?: string }) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL ?? 'Zahrah Fashion <onboarding@resend.dev>';
    const amountStr = `₦${(gift.amount / 100).toLocaleString('en-NG')}`;
    const formatted = (gift.code.match(/.{1,4}/g) ?? [gift.code]).join(' ');
    const subject = `You've received a ${amountStr} Zahrah gift card 🎁`;
    const note = gift.message?.trim();
    const noteHtml = note
      ? `<div style="border-left:3px solid #8a6d1f;background:#faf5e6;border-radius:0 8px 8px 0;padding:14px 16px;margin:16px 0">
        <p style="margin:0 0 6px;color:#6f571a;font-size:12px;letter-spacing:.08em;text-transform:uppercase">A message for you</p>
        <p style="margin:0;font-size:15px;line-height:1.6;color:#333;font-style:italic;white-space:pre-wrap">${escapeHtml(note)}</p>
      </div>`
      : '';
    const html = `<div style="font-family:Arial,sans-serif;max-width:520px;color:#222">
      <h2 style="font-weight:700">You've received a gift card!</h2>
      <p>Someone sent you a <b>${amountStr}</b> Zahrah Fashion gift card.</p>
      ${noteHtml}
      <div style="border:1px solid #e7e5e4;border-radius:12px;padding:16px;margin:16px 0;background:#faf5e6">
        <p style="margin:0;color:#6f571a;font-size:12px;letter-spacing:.08em;text-transform:uppercase">Gift card number</p>
        <p style="margin:4px 0 12px;font-size:20px;font-weight:700;letter-spacing:.12em">${formatted}</p>
        <p style="margin:0;color:#6f571a;font-size:12px;letter-spacing:.08em;text-transform:uppercase">Claim password</p>
        <p style="margin:4px 0 0;font-size:18px;font-weight:700;letter-spacing:.2em">${gift.password}</p>
      </div>
      <p style="font-weight:600">How to claim</p>
      <ol style="color:#555;padding-left:18px">
        <li>Sign in (or create an account) at Zahrah Fashion.</li>
        <li>Go to <b>Your Account → Balance → Claim a gift card</b>.</li>
        <li>Enter the gift card number and password above — the ${amountStr} is added to your store balance.</li>
      </ol>
      <p style="color:#999;font-size:12px">Keep this password private — anyone with the number and password can claim it.</p>
    </div>`;
    const text = `You've received a ${amountStr} Zahrah Fashion gift card.\n${note ? `\nA message for you:\n"${note}"\n` : ''}\nGift card number: ${formatted}\nClaim password: ${gift.password}\n\nHow to claim: sign in → Balance → Claim a gift card → enter the number and password. The ${amountStr} is added to your store balance.`;
    if (!apiKey) { console.warn(`[gift] email to ${to} (RESEND_API_KEY not set; not sent)`); return; }
    const body = JSON.stringify({ from, to: [to], subject, html, text });
    // Retry transient network failures — the first request after the process is
    // idle often hits a stale/cold TLS connection that resets (ECONNRESET).
    const ATTEMPTS = 3;
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body,
        });
        if (res.ok) return;
        console.error(`[gift] Resend rejected (${res.status})`);
        return; // real rejection — don't retry
      } catch (e) {
        console.error(`[gift] email send attempt ${attempt}/${ATTEMPTS} failed:`, (e as Error)?.message ?? e);
        if (attempt < ATTEMPTS) await new Promise((r) => setTimeout(r, 300 * attempt));
      }
    }
  }
}

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
