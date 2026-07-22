import { BadRequestException, HttpException, HttpStatus, Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'crypto';
import * as argon2 from 'argon2';
import { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

export const PARTNER_COOKIE = 'zahrah_partner_session';
const PARTNER_SESSION_DAYS = 30;
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

interface PartnerRow {
  id: string; email: string; password_hash: string | null; name: string | null;
  business_name: string | null; phone: string | null; status: string;
}

interface ProductRow {
  id: string; name: string; slug: string; description: string | null;
  wholesale_price: bigint; stock: number; image: string | null; status: string;
  created_at: Date; updated_at: Date;
}
interface ApplicationRow {
  id: string; name: string | null; business_name: string | null; email: string; phone: string | null;
  address: string | null; note: string | null; status: string; created_at: Date; reviewed_at: Date | null;
}
interface StyleRow { id: string; product_id: string; image: string | null; label: string | null; stock: number; sort_order: number }
interface StyleInput { image?: string | null; label?: string | null; stock?: number }

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item';
}

/**
 * Partnership (reseller) subsystem — a wholesale catalogue and partner
 * applications, fully isolated from the storefront's products/customers.
 * Raw SQL tables created on boot (prisma generate is locked on Windows — same
 * pattern as wallet/reviews/newsletter).
 */
@Injectable()
export class PartnershipService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS partner_products (
      id             text PRIMARY KEY,
      name           text NOT NULL,
      slug           text UNIQUE NOT NULL,
      description    text,
      wholesale_price bigint NOT NULL DEFAULT 0,
      stock          integer NOT NULL DEFAULT 0,
      image          text,
      status         text NOT NULL DEFAULT 'active',
      created_at     timestamptz NOT NULL DEFAULT now(),
      updated_at     timestamptz NOT NULL DEFAULT now()
    )`);
    await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS partner_applications (
      id            text PRIMARY KEY,
      name          text,
      business_name text,
      email         text NOT NULL,
      phone         text,
      address       text,
      note          text,
      status        text NOT NULL DEFAULT 'pending',
      created_at    timestamptz NOT NULL DEFAULT now(),
      reviewed_at   timestamptz
    )`);
    // Approved partner accounts (auth is wired in stage 3).
    await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS partners (
      id             text PRIMARY KEY,
      email          text UNIQUE NOT NULL,
      password_hash  text,
      name           text,
      business_name  text,
      phone          text,
      status         text NOT NULL DEFAULT 'active',
      application_id text,
      created_at     timestamptz NOT NULL DEFAULT now()
    )`);
    await this.prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS partner_apps_status_idx ON partner_applications (status, created_at DESC)`);
    await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS partner_sessions (
      id          text PRIMARY KEY,
      partner_id  text NOT NULL,
      expires_at  timestamptz NOT NULL,
      revoked_at  timestamptz,
      created_at  timestamptz NOT NULL DEFAULT now()
    )`);
    await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS partner_orders (
      id           text PRIMARY KEY,
      partner_id   text NOT NULL,
      order_number text NOT NULL,
      status       text NOT NULL DEFAULT 'pending',
      total        bigint NOT NULL DEFAULT 0,
      note         text,
      created_at   timestamptz NOT NULL DEFAULT now(),
      updated_at   timestamptz NOT NULL DEFAULT now()
    )`);
    await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS partner_order_lines (
      id           text PRIMARY KEY,
      order_id     text NOT NULL,
      product_id   text NOT NULL,
      product_name text NOT NULL,
      unit_price   bigint NOT NULL,
      quantity     integer NOT NULL,
      line_total   bigint NOT NULL
    )`);
    await this.prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS partner_orders_partner_idx ON partner_orders (partner_id, created_at DESC)`);
    // Style variations for a wholesale product (same product, different looks) —
    // each carries its own image + stock.
    await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS partner_product_styles (
      id         text PRIMARY KEY,
      product_id text NOT NULL,
      image      text,
      label      text,
      stock      integer NOT NULL DEFAULT 0,
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await this.prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS partner_styles_product_idx ON partner_product_styles (product_id, sort_order)`);
    // Order lines record how styles were chosen (auto-combined or per-style).
    await this.prisma.$executeRawUnsafe(`ALTER TABLE partner_order_lines ADD COLUMN IF NOT EXISTS style_mode text`);
    await this.prisma.$executeRawUnsafe(`ALTER TABLE partner_order_lines ADD COLUMN IF NOT EXISTS styles jsonb`);
    // Orders start as 'awaiting_payment' and only "land" once Paystack confirms.
    await this.prisma.$executeRawUnsafe(`ALTER TABLE partner_orders ADD COLUMN IF NOT EXISTS payment_ref text`);
    await this.prisma.$executeRawUnsafe(`ALTER TABLE partner_orders ADD COLUMN IF NOT EXISTS paid_at timestamptz`);
    // One-time codes for activation / login (2FA) / order / password reset.
    await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS partner_otps (
      email text NOT NULL,
      purpose text NOT NULL,
      code_hash text NOT NULL,
      attempts int NOT NULL DEFAULT 0,
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (email, purpose)
    )`);
    // Order numbers come from an atomic sequence (COUNT(*)+1 could collide under
    // concurrency). Seed it past any existing PW-number and enforce uniqueness.
    await this.prisma.$executeRawUnsafe(`CREATE SEQUENCE IF NOT EXISTS partner_order_number_seq`);
    await this.prisma.$executeRawUnsafe(`SELECT setval('partner_order_number_seq',
      GREATEST(
        (SELECT COALESCE(MAX(NULLIF(regexp_replace(order_number, '[^0-9]', '', 'g'), ''))::bigint, 0) FROM partner_orders),
        (SELECT last_value FROM partner_order_number_seq)
      ),
      (SELECT EXISTS (SELECT 1 FROM partner_orders)))`);
    await this.prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS partner_orders_number_uq ON partner_orders (order_number)`);
  }

  // ── Basic in-memory rate limiting (single instance; sliding window) ──────────
  private readonly rl = new Map<string, number[]>();
  private assertRate(key: string, max: number, windowMs: number) {
    const now = Date.now();
    const hits = (this.rl.get(key) ?? []).filter((t) => now - t < windowMs);
    if (hits.length >= max) throw new HttpException('Too many attempts — please wait a few minutes and try again.', HttpStatus.TOO_MANY_REQUESTS);
    hits.push(now);
    this.rl.set(key, hits);
  }

  // ── Products ────────────────────────────────────────────────────────────────
  private mapProduct = (r: ProductRow) => ({
    id: r.id, name: r.name, slug: r.slug, description: r.description,
    wholesalePrice: Number(r.wholesale_price), stock: r.stock, image: r.image,
    status: r.status, createdAt: r.created_at, updatedAt: r.updated_at,
  });

  private mapStyle = (s: StyleRow) => ({ id: s.id, image: s.image, label: s.label, stock: s.stock });

  private async stylesFor(productIds: string[]) {
    const map = new Map<string, ReturnType<typeof this.mapStyle>[]>();
    if (!productIds.length) return map;
    const rows = await this.prisma.$queryRaw<StyleRow[]>`SELECT * FROM partner_product_styles WHERE product_id = ANY(${productIds}::text[]) ORDER BY sort_order, created_at`;
    for (const r of rows) { const arr = map.get(r.product_id) ?? []; arr.push(this.mapStyle(r)); map.set(r.product_id, arr); }
    return map;
  }

  /** Attach styles; the product's image falls back to its first style, and for
   *  style products the orderable stock is the sum of the styles. */
  private async withStyles<T extends { id: string; stock: number; image: string | null }>(products: T[]) {
    const styles = await this.stylesFor(products.map((p) => p.id));
    return products.map((p) => {
      const s = styles.get(p.id) ?? [];
      return {
        ...p,
        styles: s,
        hasStyles: s.length > 0,
        image: p.image || (s[0]?.image ?? null),
        stock: s.length ? s.reduce((n, x) => n + x.stock, 0) : p.stock,
      };
    });
  }

  /** Replace a product's style variations. */
  async setStyles(productId: string, styles: StyleInput[]) {
    await this.prisma.$executeRaw`DELETE FROM partner_product_styles WHERE product_id = ${productId}`;
    let i = 0;
    for (const st of styles) {
      await this.prisma.$executeRaw`
        INSERT INTO partner_product_styles (id, product_id, image, label, stock, sort_order, created_at)
        VALUES (${randomUUID()}, ${productId}, ${st.image ?? null}, ${st.label ?? null}, ${Math.max(0, Math.round(st.stock ?? 0))}, ${i}, now())`;
      i++;
    }
  }

  async listProducts() {
    const rows = await this.prisma.$queryRaw<ProductRow[]>`SELECT * FROM partner_products ORDER BY created_at DESC`;
    return this.withStyles(rows.map(this.mapProduct));
  }

  async createProduct(data: { name: string; description?: string; wholesalePrice: number; stock?: number; image?: string | null; status?: string; styles?: StyleInput[] }) {
    const id = randomUUID();
    const slug = await this.uniqueSlug(slugify(data.name));
    await this.prisma.$executeRaw`
      INSERT INTO partner_products (id, name, slug, description, wholesale_price, stock, image, status, created_at, updated_at)
      VALUES (${id}, ${data.name}, ${slug}, ${data.description ?? null}, ${BigInt(Math.round(data.wholesalePrice))}, ${Math.round(data.stock ?? 0)}, ${data.image ?? null}, ${data.status ?? 'active'}, now(), now())`;
    if (data.styles) await this.setStyles(id, data.styles);
    return { id, slug };
  }

  async updateProduct(id: string, data: { name?: string; description?: string; wholesalePrice?: number; stock?: number; image?: string | null; status?: string; styles?: StyleInput[] }) {
    const rows = await this.prisma.$queryRaw<ProductRow[]>`SELECT * FROM partner_products WHERE id = ${id} LIMIT 1`;
    const cur = rows[0];
    if (!cur) throw new BadRequestException('Product not found');
    const name = data.name ?? cur.name;
    const description = data.description ?? cur.description;
    const wholesale = data.wholesalePrice != null ? BigInt(Math.round(data.wholesalePrice)) : cur.wholesale_price;
    const stock = data.stock != null ? Math.round(data.stock) : cur.stock;
    const image = data.image !== undefined ? data.image : cur.image;
    const status = data.status ?? cur.status;
    await this.prisma.$executeRaw`
      UPDATE partner_products SET name = ${name}, description = ${description}, wholesale_price = ${wholesale},
        stock = ${stock}, image = ${image}, status = ${status}, updated_at = now() WHERE id = ${id}`;
    if (data.styles !== undefined) await this.setStyles(id, data.styles);
    return { ok: true };
  }

  async removeProduct(id: string) {
    await this.prisma.$executeRaw`DELETE FROM partner_products WHERE id = ${id}`;
    return { ok: true };
  }

  private async uniqueSlug(base: string): Promise<string> {
    for (let i = 0; i < 20; i++) {
      const slug = i === 0 ? base : `${base}-${i + 1}`;
      const exists = await this.prisma.$queryRaw<{ x: number }[]>`SELECT 1 AS x FROM partner_products WHERE slug = ${slug} LIMIT 1`;
      if (!exists.length) return slug;
    }
    return `${base}-${Date.now().toString(36)}`;
  }

  // ── Applications ────────────────────────────────────────────────────────────
  private mapApp = (r: ApplicationRow) => ({
    id: r.id, name: r.name, businessName: r.business_name, email: r.email, phone: r.phone,
    address: r.address, note: r.note, status: r.status, createdAt: r.created_at, reviewedAt: r.reviewed_at,
  });

  /** Public — a would-be partner applies from the portal. Idempotent-ish: a new
   *  pending row per submission; duplicates are harmless to review. */
  async apply(data: { name?: string; businessName?: string; email: string; phone?: string; address?: string; note?: string }) {
    const id = randomUUID();
    await this.prisma.$executeRaw`
      INSERT INTO partner_applications (id, name, business_name, email, phone, address, note, status, created_at)
      VALUES (${id}, ${data.name ?? null}, ${data.businessName ?? null}, ${data.email.toLowerCase().trim()}, ${data.phone ?? null}, ${data.address ?? null}, ${data.note ?? null}, 'pending', now())`;
    return { id };
  }

  async listApplications(status?: string) {
    const filter = status === 'pending' || status === 'approved' || status === 'rejected' ? status : null;
    const rows = filter
      ? await this.prisma.$queryRaw<ApplicationRow[]>`SELECT * FROM partner_applications WHERE status = ${filter} ORDER BY created_at DESC LIMIT 100`
      : await this.prisma.$queryRaw<ApplicationRow[]>`SELECT * FROM partner_applications ORDER BY created_at DESC LIMIT 100`;
    const totals = await this.prisma.$queryRaw<{ pending: bigint }[]>`SELECT COUNT(*) FILTER (WHERE status='pending')::bigint AS pending FROM partner_applications`;
    // Attach the partner account (created on approval) so admins can suspend/remove.
    const partners = await this.prisma.$queryRaw<{ id: string; email: string; status: string }[]>`SELECT id, email, status FROM partners`;
    const byEmail = new Map(partners.map((p) => [p.email, p]));
    return {
      pending: Number(totals[0]?.pending ?? 0),
      rows: rows.map((r) => {
        const partner = byEmail.get(r.email);
        return { ...this.mapApp(r), partnerId: partner?.id ?? null, partnerStatus: partner?.status ?? null };
      }),
    };
  }

  /** Suspend (blocks login + kills sessions) or reactivate an approved partner. */
  async setPartnerStatus(id: string, action: 'suspend' | 'activate') {
    const status = action === 'suspend' ? 'suspended' : 'active';
    await this.prisma.$executeRaw`UPDATE partners SET status = ${status} WHERE id = ${id}`;
    if (action === 'suspend') {
      await this.prisma.$executeRaw`UPDATE partner_sessions SET revoked_at = now() WHERE partner_id = ${id} AND revoked_at IS NULL`;
    }
    return { ok: true };
  }

  /** Permanently remove a partner account (revokes their sessions first). */
  async removePartner(id: string) {
    await this.prisma.$executeRaw`UPDATE partner_sessions SET revoked_at = now() WHERE partner_id = ${id}`;
    await this.prisma.$executeRaw`DELETE FROM partners WHERE id = ${id}`;
    return { ok: true };
  }

  /** Approve → create the partner account (password set on first portal login).
   *  Reject → mark rejected. */
  async reviewApplication(id: string, action: 'approve' | 'reject') {
    const rows = await this.prisma.$queryRaw<ApplicationRow[]>`SELECT * FROM partner_applications WHERE id = ${id} LIMIT 1`;
    const app = rows[0];
    if (!app) throw new BadRequestException('Application not found');

    if (action === 'approve') {
      const existing = await this.prisma.$queryRaw<{ id: string }[]>`SELECT id FROM partners WHERE email = ${app.email} LIMIT 1`;
      if (!existing.length) {
        await this.prisma.$executeRaw`
          INSERT INTO partners (id, email, name, business_name, phone, status, application_id, created_at)
          VALUES (${randomUUID()}, ${app.email}, ${app.name}, ${app.business_name}, ${app.phone}, 'active', ${app.id}, now())`;
      }
    }
    await this.prisma.$executeRaw`UPDATE partner_applications SET status = ${action === 'approve' ? 'approved' : 'rejected'}, reviewed_at = now() WHERE id = ${id}`;
    return { ok: true };
  }

  // ── Partner auth (portal) ────────────────────────────────────────────────────
  private async createSession(partnerId: string, res: Response) {
    const token = randomBytes(32).toString('hex');
    await this.prisma.$executeRaw`
      INSERT INTO partner_sessions (id, partner_id, expires_at, created_at)
      VALUES (${sha256(token)}, ${partnerId}, ${new Date(Date.now() + PARTNER_SESSION_DAYS * 86_400_000)}, now())`;
    res.cookie(PARTNER_COOKIE, token, {
      httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
      maxAge: PARTNER_SESSION_DAYS * 86_400_000, path: '/',
    });
  }

  // ── One-time codes (email OTP) ────────────────────────────────────────────
  private static readonly OTP_TTL_MS = 10 * 60_000;

  /** Send an email via Resend. Returns false (dev) when unconfigured so callers
   *  can surface a dev code. A rejection never crashes the auth flow. */
  private async sendEmail(to: string, subject: string, html: string, text: string): Promise<boolean> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL ?? 'Zahrah Fashion Hub <onboarding@resend.dev>';
    if (!apiKey) { console.warn(`[partner-email] to ${to}: "${subject}" (RESEND_API_KEY not set; not sent)`); return false; }
    const body = JSON.stringify({ from, to: [to], subject, html, text });
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body });
        if (res.ok) return true;
        console.error(`[partner-email] Resend rejected (${res.status}): ${await res.text().catch(() => '')}`);
        return false;
      } catch (err) {
        console.error(`[partner-email] attempt ${attempt}/3 failed:`, (err as Error)?.message ?? err);
        if (attempt < 3) { await new Promise((r) => setTimeout(r, 300 * attempt)); continue; }
        return false;
      }
    }
    return false;
  }

  private otpEmail(heading: string, intro: string, code: string) {
    return `<div style="font-family:Arial,sans-serif;max-width:440px;margin:auto">
      <h2 style="font-weight:700">${heading}</h2>
      <p style="color:#555">${intro}</p>
      <p style="font-size:30px;font-weight:700;letter-spacing:8px;margin:16px 0">${code}</p>
      <p style="color:#999;font-size:13px">This code expires in 10 minutes. If you didn't request it, ignore this email.</p>
    </div>`;
  }

  private readonly otpCopy: Record<string, { subject: string; heading: string; intro: string }> = {
    activate: { subject: 'Activate your partner account', heading: 'Activate your account', intro: 'Use this code to finish setting up your Zahrah Fashion Hub partner account:' },
    login: { subject: 'Your partner sign-in code', heading: 'Sign in', intro: 'Use this code to finish signing in to the partner portal:' },
    order: { subject: 'Confirm your wholesale order', heading: 'Confirm your order', intro: 'Use this code to authorise your wholesale order before payment:' },
    reset: { subject: 'Reset your partner password', heading: 'Reset your password', intro: 'Use this code to set a new password on your partner account:' },
  };

  /** Generate, store and email a fresh 6-digit code for (email, purpose). */
  private async issueOtp(email: string, purpose: 'activate' | 'login' | 'order' | 'reset') {
    const addr = email.toLowerCase().trim();
    const code = String(Math.floor(100_000 + Math.random() * 900_000));
    const expires = new Date(Date.now() + PartnershipService.OTP_TTL_MS);
    await this.prisma.$executeRaw`
      INSERT INTO partner_otps (email, purpose, code_hash, attempts, expires_at, created_at)
      VALUES (${addr}, ${purpose}, ${sha256(code)}, 0, ${expires}, now())
      ON CONFLICT (email, purpose) DO UPDATE SET code_hash = ${sha256(code)}, attempts = 0, expires_at = ${expires}, created_at = now()`;
    const copy = this.otpCopy[purpose];
    const sent = await this.sendEmail(addr, copy.subject, this.otpEmail(copy.heading, copy.intro, code), `${copy.intro} ${code} (expires in 10 minutes).`);
    const devCode = !sent && process.env.NODE_ENV !== 'production' ? code : undefined;
    return { sent, ...(devCode ? { devCode } : {}) };
  }

  /** Verify and consume a code; throws on missing / expired / wrong / too many tries. */
  private async checkOtp(email: string, purpose: 'activate' | 'login' | 'order' | 'reset', code: string) {
    const addr = email.toLowerCase().trim();
    const rows = await this.prisma.$queryRaw<{ code_hash: string; attempts: number; expires_at: Date }[]>`
      SELECT code_hash, attempts, expires_at FROM partner_otps WHERE email = ${addr} AND purpose = ${purpose} LIMIT 1`;
    const row = rows[0];
    if (!row || row.expires_at < new Date()) {
      await this.prisma.$executeRaw`DELETE FROM partner_otps WHERE email = ${addr} AND purpose = ${purpose}`;
      throw new BadRequestException('That code has expired — request a new one');
    }
    if (row.attempts >= 5) {
      await this.prisma.$executeRaw`DELETE FROM partner_otps WHERE email = ${addr} AND purpose = ${purpose}`;
      throw new BadRequestException('Too many attempts — request a new code');
    }
    if (row.code_hash !== sha256(String(code).trim())) {
      await this.prisma.$executeRaw`UPDATE partner_otps SET attempts = attempts + 1 WHERE email = ${addr} AND purpose = ${purpose}`;
      throw new BadRequestException('Incorrect code');
    }
    await this.prisma.$executeRaw`DELETE FROM partner_otps WHERE email = ${addr} AND purpose = ${purpose}`;
  }

  private async findPartner(email: string): Promise<PartnerRow | undefined> {
    const rows = await this.prisma.$queryRaw<PartnerRow[]>`SELECT id, email, password_hash, name, business_name, phone, status FROM partners WHERE email = ${email.toLowerCase().trim()} LIMIT 1`;
    return rows[0];
  }

  /** Resolve the partner from the session cookie; null for guests. */
  async resolve(req: Request): Promise<PartnerRow | null> {
    const token = (req as never as { cookies?: Record<string, string> }).cookies?.[PARTNER_COOKIE];
    if (!token) return null;
    const rows = await this.prisma.$queryRaw<{ partner_id: string; expires_at: Date; revoked_at: Date | null }[]>`
      SELECT partner_id, expires_at, revoked_at FROM partner_sessions WHERE id = ${sha256(token)} LIMIT 1`;
    const s = rows[0];
    if (!s || s.revoked_at || s.expires_at < new Date()) return null;
    const p = await this.prisma.$queryRaw<PartnerRow[]>`SELECT id, email, password_hash, name, business_name, phone, status FROM partners WHERE id = ${s.partner_id} LIMIT 1`;
    if (!p[0] || p[0].status !== 'active') return null;
    return p[0];
  }

  async requirePartner(req: Request): Promise<PartnerRow> {
    const p = await this.resolve(req);
    if (!p) throw new UnauthorizedException('Sign in to continue');
    return p;
  }

  private view(p: PartnerRow) {
    return { id: p.id, email: p.email, name: p.name, businessName: p.business_name, phone: p.phone };
  }

  async me(req: Request) {
    const p = await this.resolve(req);
    return { partner: p ? this.view(p) : null };
  }

  /** Partner updates their own profile (name / business / phone). */
  async updateProfile(id: string, data: { name?: string; businessName?: string; phone?: string }) {
    const rows = await this.prisma.$queryRaw<PartnerRow[]>`SELECT * FROM partners WHERE id = ${id} LIMIT 1`;
    const cur = rows[0];
    if (!cur) throw new BadRequestException('Account not found');
    const name = data.name ?? cur.name;
    const businessName = data.businessName ?? cur.business_name;
    const phone = data.phone ?? cur.phone;
    await this.prisma.$executeRaw`UPDATE partners SET name = ${name}, business_name = ${businessName}, phone = ${phone} WHERE id = ${id}`;
    return { ok: true };
  }

  /** Partner changes their own password (verifies the current one). */
  async changePassword(id: string, current: string, next: string) {
    if (next.length < 8) throw new BadRequestException('New password must be at least 8 characters');
    const rows = await this.prisma.$queryRaw<{ password_hash: string | null }[]>`SELECT password_hash FROM partners WHERE id = ${id} LIMIT 1`;
    const hash = rows[0]?.password_hash;
    if (!hash) throw new BadRequestException('No password is set on this account');
    if (!(await argon2.verify(hash, current))) throw new BadRequestException('Your current password is incorrect');
    await this.prisma.$executeRaw`UPDATE partners SET password_hash = ${await argon2.hash(next, { type: argon2.argon2id })} WHERE id = ${id}`;
    return { ok: true };
  }

  /** Step 1 of activation — email a code to an approved, not-yet-set-up partner.
   *  Neutral: never reveals whether the email is a known/eligible partner. */
  async requestActivationOtp(email: string) {
    const addr = email.toLowerCase().trim();
    this.assertRate(`otp:activate:${addr}`, 5, 15 * 60_000);
    const p = await this.findPartner(email);
    if (p && p.status === 'active' && !p.password_hash) return this.issueOtp(email, 'activate');
    return { sent: false as const };
  }

  /** Step 2 of activation — verify the code first (so ineligible emails can't be
   *  probed), then set the first password and sign in. */
  async activate(email: string, password: string, code: string, res: Response) {
    if (password.length < 8) throw new BadRequestException('Password must be at least 8 characters');
    await this.checkOtp(email, 'activate', code);
    const p = await this.findPartner(email);
    if (!p || p.status !== 'active' || p.password_hash) throw new BadRequestException('Could not activate this account.');
    await this.prisma.$executeRaw`UPDATE partners SET password_hash = ${await argon2.hash(password, { type: argon2.argon2id })} WHERE id = ${p.id}`;
    await this.createSession(p.id, res);
    return { partner: this.view(p) };
  }

  /** Step 1 of sign-in — check the password, then email a 2FA code (no session yet).
   *  Rate-limited per email to blunt brute-force / enumeration. */
  async login(email: string, password: string) {
    const addr = email.toLowerCase().trim();
    this.assertRate(`login:${addr}`, 10, 15 * 60_000);
    const p = await this.findPartner(email);
    if (!p || p.status !== 'active') throw new UnauthorizedException('Invalid login details');
    if (!p.password_hash) throw new BadRequestException({ message: 'Set a password to activate your account.', code: 'NEEDS_ACTIVATION' });
    if (!(await argon2.verify(p.password_hash, password))) throw new UnauthorizedException('Invalid login details');
    const otp = await this.issueOtp(email, 'login');
    return { otpRequired: true as const, ...otp };
  }

  /** Step 2 of sign-in — verify the 2FA code, create the session. */
  async loginVerify(email: string, code: string, res: Response) {
    const p = await this.findPartner(email);
    if (!p || p.status !== 'active') throw new UnauthorizedException('Invalid login details');
    await this.checkOtp(email, 'login', code);
    await this.createSession(p.id, res);
    return { partner: this.view(p) };
  }

  /** Step 1 of reset — email a code to a set-up partner (neutral response). */
  async requestReset(email: string) {
    const addr = email.toLowerCase().trim();
    this.assertRate(`otp:reset:${addr}`, 5, 15 * 60_000);
    const p = await this.findPartner(email);
    if (p && p.status === 'active' && p.password_hash) return this.issueOtp(email, 'reset');
    // Don't reveal whether the account exists.
    return { sent: false as const };
  }

  /** Step 2 of reset — verify the code, set a new password, revoke sessions. */
  async resetPassword(email: string, code: string, newPassword: string) {
    if (newPassword.length < 8) throw new BadRequestException('New password must be at least 8 characters');
    const p = await this.findPartner(email);
    if (!p || p.status !== 'active') throw new BadRequestException('No partner account for that email');
    await this.checkOtp(email, 'reset', code);
    await this.prisma.$executeRaw`UPDATE partners SET password_hash = ${await argon2.hash(newPassword, { type: argon2.argon2id })} WHERE id = ${p.id}`;
    await this.prisma.$executeRaw`UPDATE partner_sessions SET revoked_at = now() WHERE partner_id = ${p.id} AND revoked_at IS NULL`;
    return { ok: true };
  }

  async logout(req: Request, res: Response) {
    const token = (req as never as { cookies?: Record<string, string> }).cookies?.[PARTNER_COOKIE];
    if (token) await this.prisma.$executeRaw`UPDATE partner_sessions SET revoked_at = now() WHERE id = ${sha256(token)}`;
    res.clearCookie(PARTNER_COOKIE, { path: '/' });
    return { ok: true };
  }

  /** Partner-visible wholesale catalogue (active products only). */
  async catalog() {
    const rows = await this.prisma.$queryRaw<ProductRow[]>`SELECT * FROM partner_products WHERE status = 'active' ORDER BY created_at DESC`;
    return this.withStyles(rows.map(this.mapProduct));
  }

  /** A single active catalogue product (partner-facing detail page). */
  async catalogProduct(id: string) {
    const rows = await this.prisma.$queryRaw<ProductRow[]>`SELECT * FROM partner_products WHERE id = ${id} AND status = 'active' LIMIT 1`;
    if (!rows[0]) throw new BadRequestException('Product not found');
    return (await this.withStyles([this.mapProduct(rows[0])]))[0];
  }

  // ── Wholesale orders ──────────────────────────────────────────────────────
  private async nextOrderNumber(): Promise<string> {
    const rows = await this.prisma.$queryRaw<{ n: bigint }[]>`SELECT nextval('partner_order_number_seq') AS n`;
    return `PW-${String(Number(rows[0].n)).padStart(6, '0')}`;
  }

  /** Wholesale stock TTL: an unpaid order holds its reserved units this long,
   *  then the reservation is released so the stock isn't stuck forever. */
  private static readonly RESERVATION_TTL = "30 minutes";

  /** Release stock held by unpaid orders older than the reservation window.
   *  Best-effort; never blocks a new order. Idempotent via a status compare-and-swap. */
  private async releaseStaleReservations() {
    const stale = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM partner_orders WHERE status = 'awaiting_payment' AND created_at < now() - ${PartnershipService.RESERVATION_TTL}::interval`;
    for (const s of stale) {
      const claimed = await this.prisma.$executeRaw`UPDATE partner_orders SET status = 'expired', updated_at = now() WHERE id = ${s.id} AND status = 'awaiting_payment'`;
      if (!claimed) continue; // another path already resolved this order
      const lines = await this.prisma.$queryRaw<{ product_id: string; quantity: number; styles: unknown }[]>`SELECT product_id, quantity, styles FROM partner_order_lines WHERE order_id = ${s.id}`;
      for (const l of lines) {
        const breakdown = l.styles as { styleId: string; qty: number }[] | null;
        if (breakdown?.length) {
          for (const b of breakdown) await this.prisma.$executeRaw`UPDATE partner_product_styles SET stock = stock + ${b.qty} WHERE id = ${b.styleId}`;
        } else {
          await this.prisma.$executeRaw`UPDATE partner_products SET stock = stock + ${l.quantity}, updated_at = now() WHERE id = ${l.product_id}`;
        }
      }
    }
  }

  /** A partner places a wholesale order. For style products, quantities are
   *  either combined automatically across styles or chosen per style; stock is
   *  decremented on the styles (or the product, for single-style items). */
  async createOrder(
    partnerId: string,
    items: { productId: string; quantity?: number; styleMode?: 'auto' | 'manual'; styleQtys?: Record<string, number> }[],
    note?: string,
  ) {
    if (!items.length) throw new BadRequestException('Your order is empty');
    // Free up any stock held by long-abandoned unpaid orders before we read/reserve.
    await this.releaseStaleReservations().catch((e) => console.error('[partner] reservation sweep failed', e));
    const ids = [...new Set(items.map((i) => i.productId))];
    const products = await this.prisma.$queryRaw<ProductRow[]>`SELECT * FROM partner_products WHERE id = ANY(${ids}::text[])`;
    const byId = new Map(products.map((p) => [p.id, p]));
    const stylesMap = await this.stylesFor(ids);

    type Breakdown = { styleId: string; image: string | null; label: string | null; qty: number };
    const lines: { productId: string; name: string; unitPrice: number; qty: number; lineTotal: number; styleMode: string | null; breakdown: Breakdown[] | null }[] = [];
    let total = 0;

    for (const it of items) {
      const p = byId.get(it.productId);
      if (!p || p.status !== 'active') throw new BadRequestException('One of the products is no longer available');
      const unitPrice = Number(p.wholesale_price);
      const styles = stylesMap.get(it.productId) ?? [];
      let qty: number;
      let styleMode: string | null = null;
      let breakdown: Breakdown[] | null = null;

      if (styles.length) {
        if (it.styleMode === 'manual' && it.styleQtys) {
          breakdown = [];
          for (const st of styles) {
            const q = Math.max(0, Math.round(it.styleQtys[st.id] ?? 0));
            if (q <= 0) continue;
            if (q > st.stock) throw new BadRequestException(`Only ${st.stock} of "${st.label ?? p.name}" left`);
            breakdown.push({ styleId: st.id, image: st.image, label: st.label, qty: q });
          }
          qty = breakdown.reduce((s, b) => s + b.qty, 0);
          if (qty <= 0) throw new BadRequestException('Choose a quantity for at least one style');
          styleMode = 'manual';
        } else {
          qty = Math.max(1, Math.round(it.quantity ?? 0));
          const avail = styles.reduce((s, st) => s + st.stock, 0);
          if (qty > avail) throw new BadRequestException(`Only ${avail} available across styles for "${p.name}"`);
          // Greedy auto-combine: fill from the styles with the most stock first.
          const sorted = [...styles].sort((a, b) => b.stock - a.stock);
          let remaining = qty;
          breakdown = [];
          for (const st of sorted) {
            if (remaining <= 0) break;
            const take = Math.min(st.stock, remaining);
            if (take <= 0) continue;
            breakdown.push({ styleId: st.id, image: st.image, label: st.label, qty: take });
            remaining -= take;
          }
          styleMode = 'auto';
        }
      } else {
        qty = Math.max(1, Math.round(it.quantity ?? 0));
        if (p.stock < qty) throw new BadRequestException(`Only ${p.stock} of "${p.name}" left in stock`);
      }

      const lineTotal = unitPrice * qty;
      total += lineTotal;
      lines.push({ productId: p.id, name: p.name, unitPrice, qty, lineTotal, styleMode, breakdown });
    }

    // Reserve stock atomically so two orders can't claim the same units (the
    // conditional `stock >= qty` guard is the enforcement; the earlier checks are
    // just for friendlier messages). Roll back on any shortfall.
    const applied: { style: boolean; id: string; qty: number }[] = [];
    const rollback = async () => {
      for (const a of applied) {
        if (a.style) await this.prisma.$executeRaw`UPDATE partner_product_styles SET stock = stock + ${a.qty} WHERE id = ${a.id}`;
        else await this.prisma.$executeRaw`UPDATE partner_products SET stock = stock + ${a.qty}, updated_at = now() WHERE id = ${a.id}`;
      }
    };
    for (const l of lines) {
      if (l.breakdown) {
        for (const b of l.breakdown) {
          const n = await this.prisma.$executeRaw`UPDATE partner_product_styles SET stock = stock - ${b.qty} WHERE id = ${b.styleId} AND stock >= ${b.qty}`;
          if (!n) { await rollback(); throw new BadRequestException(`"${b.label ?? l.name}" just sold out — please review your cart`); }
          applied.push({ style: true, id: b.styleId, qty: b.qty });
        }
      } else {
        const n = await this.prisma.$executeRaw`UPDATE partner_products SET stock = stock - ${l.qty}, updated_at = now() WHERE id = ${l.productId} AND stock >= ${l.qty}`;
        if (!n) { await rollback(); throw new BadRequestException(`"${l.name}" just sold out — please review your cart`); }
        applied.push({ style: false, id: l.productId, qty: l.qty });
      }
    }

    const orderId = randomUUID();
    const orderNumber = await this.nextOrderNumber();
    // Order is created unpaid + hidden; the stock above is reserved and released
    // again if payment is never completed (releaseStaleReservations).
    try {
      await this.prisma.$executeRaw`
        INSERT INTO partner_orders (id, partner_id, order_number, status, total, note, created_at, updated_at)
        VALUES (${orderId}, ${partnerId}, ${orderNumber}, 'awaiting_payment', ${BigInt(total)}, ${note ?? null}, now(), now())`;
      for (const l of lines) {
        await this.prisma.$executeRaw`
          INSERT INTO partner_order_lines (id, order_id, product_id, product_name, unit_price, quantity, line_total, style_mode, styles)
          VALUES (${randomUUID()}, ${orderId}, ${l.productId}, ${l.name}, ${BigInt(l.unitPrice)}, ${l.qty}, ${BigInt(l.lineTotal)}, ${l.styleMode}, ${l.breakdown ? JSON.stringify(l.breakdown) : null}::jsonb)`;
      }
    } catch (e) {
      await rollback(); // don't leak the reservation if the insert fails
      throw e;
    }
    return { id: orderId, orderNumber, total };
  }

  // ── Payment (Paystack) ───────────────────────────────────────────────────────
  /** Email a code the partner must confirm before an order can be placed. */
  async requestOrderOtp(email: string) {
    this.assertRate(`otp:order:${email.toLowerCase().trim()}`, 10, 15 * 60_000);
    return this.issueOtp(email, 'order');
  }

  /** Verify the order code, create the (unpaid) order and start a Paystack payment. */
  async placeAndPay(partnerId: string, email: string, origin: string, items: Parameters<PartnershipService['createOrder']>[1], note: string | undefined, code: string) {
    await this.checkOtp(email, 'order', code);
    const { id: orderId, orderNumber, total } = await this.createOrder(partnerId, items, note);
    const reference = `zfp_${orderId}_${Date.now().toString(36)}`;
    await this.prisma.$executeRaw`UPDATE partner_orders SET payment_ref = ${reference} WHERE id = ${orderId}`;

    const key = process.env.PAYSTACK_SECRET_KEY;
    if (!key) return { orderId, orderNumber, reference, simulated: true as const };

    const res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: total, email: email || `${reference}@zahrah.local`, reference, currency: 'NGN',
        callback_url: `${origin}/orders?ref=${reference}`, metadata: { kind: 'partner_order', orderId },
      }),
    }).catch((e) => { console.error('[partner-pay] init failed', e); return null; });
    const data = (await res?.json().catch(() => null)) as { status?: boolean; data?: { authorization_url: string; reference: string } } | null;
    if (!res?.ok || !data?.status || !data.data) throw new BadRequestException('Could not start the payment — please try again');
    return { orderId, orderNumber, reference, authorizationUrl: data.data.authorization_url };
  }

  /** Confirm a payment (Paystack verify or dev simulate) → decrement stock, mark paid.
   *  Scoped to the calling partner so one partner can't confirm another's order. */
  async confirmPayment(reference: string, partnerId: string, simulate = false) {
    const rows = await this.prisma.$queryRaw<{ id: string; status: string }[]>`SELECT id, status FROM partner_orders WHERE payment_ref = ${reference} AND partner_id = ${partnerId} LIMIT 1`;
    const o = rows[0];
    if (!o) throw new BadRequestException('Order not found for that payment');
    if (o.status !== 'awaiting_payment') return { orderId: o.id, status: 'paid' as const }; // idempotent

    let paid: boolean;
    if (simulate) {
      if (process.env.NODE_ENV === 'production') throw new BadRequestException('Not available');
      paid = true;
    } else {
      const key = process.env.PAYSTACK_SECRET_KEY;
      if (!key) throw new BadRequestException('Online payment is not configured');
      const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${key}` } }).catch(() => null);
      const data = (await res?.json().catch(() => null)) as { status?: boolean; data?: { status: string } } | null;
      paid = !!(res?.ok && data?.status && data.data?.status === 'success');
    }
    if (!paid) return { orderId: o.id, status: 'awaiting_payment' as const };

    // Stock was already reserved at order creation, so confirmation just flips the
    // status. The compare-and-swap makes concurrent verify calls idempotent.
    await this.prisma.$executeRaw`UPDATE partner_orders SET status = 'pending', paid_at = now(), updated_at = now() WHERE id = ${o.id} AND status = 'awaiting_payment'`;
    return { orderId: o.id, status: 'paid' as const };
  }

  private async orderLines(orderIds: string[]) {
    type Line = { productName: string; unitPrice: number; quantity: number; lineTotal: number; styleMode: string | null; styles: { label: string | null; image: string | null; qty: number }[] | null };
    if (!orderIds.length) return new Map<string, Line[]>();
    const rows = await this.prisma.$queryRaw<{ order_id: string; product_name: string; unit_price: bigint; quantity: number; line_total: bigint; style_mode: string | null; styles: unknown }[]>`
      SELECT order_id, product_name, unit_price, quantity, line_total, style_mode, styles FROM partner_order_lines WHERE order_id = ANY(${orderIds}::text[])`;
    const map = new Map<string, Line[]>();
    for (const r of rows) {
      const arr = map.get(r.order_id) ?? [];
      arr.push({
        productName: r.product_name, unitPrice: Number(r.unit_price), quantity: r.quantity, lineTotal: Number(r.line_total),
        styleMode: r.style_mode,
        styles: (r.styles as { label: string | null; image: string | null; qty: number }[] | null) ?? null,
      });
      map.set(r.order_id, arr);
    }
    return map;
  }

  /** A partner's own orders. */
  async listPartnerOrders(partnerId: string) {
    const orders = await this.prisma.$queryRaw<{ id: string; order_number: string; status: string; total: bigint; note: string | null; created_at: Date }[]>`
      SELECT id, order_number, status, total, note, created_at FROM partner_orders WHERE partner_id = ${partnerId} AND status NOT IN ('awaiting_payment', 'expired') ORDER BY created_at DESC LIMIT 100`;
    const lines = await this.orderLines(orders.map((o) => o.id));
    return orders.map((o) => ({ id: o.id, orderNumber: o.order_number, status: o.status, total: Number(o.total), note: o.note, createdAt: o.created_at, lines: lines.get(o.id) ?? [] }));
  }

  /** Admin — all partner orders with the partner attached. */
  async listAllOrders(status?: string) {
    const filter = ['pending', 'confirmed', 'fulfilled', 'cancelled'].includes(status ?? '') ? status! : null;
    const orders = filter
      ? await this.prisma.$queryRaw<{ id: string; partner_id: string; order_number: string; status: string; total: bigint; note: string | null; created_at: Date }[]>`SELECT * FROM partner_orders WHERE status = ${filter} ORDER BY created_at DESC LIMIT 200`
      : await this.prisma.$queryRaw<{ id: string; partner_id: string; order_number: string; status: string; total: bigint; note: string | null; created_at: Date }[]>`SELECT * FROM partner_orders WHERE status NOT IN ('awaiting_payment', 'expired') ORDER BY created_at DESC LIMIT 200`;
    const lines = await this.orderLines(orders.map((o) => o.id));
    const partners = await this.prisma.$queryRaw<{ id: string; email: string; business_name: string | null; name: string | null }[]>`SELECT id, email, business_name, name FROM partners`;
    const byId = new Map(partners.map((p) => [p.id, p]));
    return orders.map((o) => {
      const p = byId.get(o.partner_id);
      return {
        id: o.id, orderNumber: o.order_number, status: o.status, total: Number(o.total), note: o.note, createdAt: o.created_at,
        partner: p ? { businessName: p.business_name, name: p.name, email: p.email } : null,
        lines: lines.get(o.id) ?? [],
      };
    });
  }

  async updateOrderStatus(id: string, status: 'pending' | 'confirmed' | 'fulfilled' | 'cancelled') {
    await this.prisma.$executeRaw`UPDATE partner_orders SET status = ${status}, updated_at = now() WHERE id = ${id}`;
    return { ok: true };
  }
}
