import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { createHash, createHmac, randomBytes } from 'crypto';
import { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';
import { CustomersService } from '../customers/customers.service';
import { EphemeralStore } from '../redis/ephemeral-store.service';
import { normalizePhone, tryNormalizePhone } from '../customers/phone';

export const CUSTOMER_COOKIE = 'zahrah_customer_session';
const SESSION_DAYS = 30;
const OTP_TTL_MS = 10 * 60_000; // 10 minutes

// Email is sent via Resend's REST API (https://resend.com) — no SDK needed.
// IMPORTANT: env vars are read at *call time*, not at module load. ConfigModule
// populates process.env during app bootstrap, which runs AFTER this module is
// first imported — a top-level `const x = process.env.X` would capture undefined.
const RESEND_FROM_DEFAULT = 'Zahrah Fashion <onboarding@resend.dev>';

/** Pending email-OTP registration, held in memory until the code is verified. */
interface PendingRegistration {
  email: string;
  phone: string;
  name?: string;
  passwordHash: string;
  code: string;
  expiresAt: number;
  attempts: number;
}

function sha256(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

/** Escape user-supplied text before embedding it in an HTML email. */
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/** S-D-09: unguessable, order-scoped guest tracking token. */
export function trackingToken(orderId: string): string {
  const secret = process.env.TRACKING_SECRET ?? 'zahrah-dev-tracking-secret';
  return createHmac('sha256', secret).update(orderId).digest('hex').slice(0, 32);
}

const regKey = (t: string) => `cust-register:${t}`;
const resetKey = (t: string) => `cust-reset:${t}`;
const changeKey = (t: string) => `cust-pwchange:${t}`;

@Injectable()
export class CustomerAuthService {
  constructor(
    private prisma: PrismaService,
    private customers: CustomersService,
    private store: EphemeralStore,
  ) {}

  private async createSession(customerId: string, res: Response) {
    const token = randomBytes(32).toString('hex');
    await this.prisma.customerSession.create({
      data: {
        id: sha256(token),
        customerId,
        expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000),
      },
    });
    res.cookie(CUSTOMER_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_DAYS * 86_400_000,
      path: '/',
    });
  }

  /** FR-ACC-01 + claim (FR-ACC-04): registering with a known phone/email upgrades the guest record in place. */
  async register(data: { name?: string; phone: string; email: string; password: string }, res: Response) {
    if (data.password.length < 8) throw new BadRequestException('Password must be at least 8 characters');
    const email = data.email.toLowerCase().trim();

    const { customerId } = await this.customers.findOrCreate({
      phone: data.phone,
      email,
      name: data.name,
      source: 'web',
    });

    const existing = await this.prisma.customerCredential.findUnique({ where: { customerId } });
    if (existing) throw new BadRequestException('An account already exists for this phone — sign in instead');

    await this.prisma.$transaction([
      this.prisma.customerCredential.create({
        data: {
          customerId,
          emailOrPhone: email,
          passwordHash: await argon2.hash(data.password, { type: argon2.argon2id }),
          verifiedAt: new Date(), // email-verification link is a production integration
        },
      }),
      this.prisma.customer.update({
        where: { id: customerId },
        data: { type: 'registered', email, ...(data.name ? { fullName: data.name } : {}) },
      }),
    ]);
    await this.createSession(customerId, res);
    return { customerId };
  }

  async login(identifier: string, password: string, res: Response) {
    const generic = () => new UnauthorizedException('Invalid login details');
    const phone = tryNormalizePhone(identifier);
    const customer = phone
      ? await this.prisma.customer.findUnique({ where: { primaryPhone: phone } })
      : await this.prisma.customer.findUnique({ where: { email: identifier.toLowerCase().trim() } });
    if (!customer) throw generic();

    const credential = await this.prisma.customerCredential.findUnique({ where: { customerId: customer.id } });
    if (!credential) throw generic();
    if (credential.lockedUntil && credential.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account temporarily locked — try again shortly');
    }
    if (!(await argon2.verify(credential.passwordHash, password))) {
      const fails = credential.failedAttempts + 1;
      await this.prisma.customerCredential.update({
        where: { customerId: customer.id },
        data: {
          failedAttempts: fails >= 5 ? 0 : fails,
          lockedUntil: fails >= 5 ? new Date(Date.now() + 15 * 60_000) : null,
        },
      });
      throw generic();
    }

    await this.prisma.customerCredential.update({
      where: { customerId: customer.id },
      data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    await this.createSession(customer.id, res);
    return { customerId: customer.id };
  }

  async logout(req: Request, res: Response) {
    const token = (req as never as { cookies?: Record<string, string> }).cookies?.[CUSTOMER_COOKIE];
    if (token) {
      await this.prisma.customerSession.updateMany({
        where: { id: sha256(token) },
        data: { revokedAt: new Date() },
      });
    }
    res.clearCookie(CUSTOMER_COOKIE, { path: '/' });
  }

  /** Resolve the customer session; returns null for guests. */
  async resolve(req: Request) {
    const token = (req as never as { cookies?: Record<string, string> }).cookies?.[CUSTOMER_COOKIE];
    if (!token) return null;
    const session = await this.prisma.customerSession.findUnique({ where: { id: sha256(token) } });
    if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
    const customer = await this.prisma.customer.findUnique({ where: { id: session.customerId } });
    if (!customer || customer.anonymizedAt || customer.status === 'blocked') return null;
    return customer;
  }

  async requireCustomer(req: Request) {
    const customer = await this.resolve(req);
    if (!customer) throw new UnauthorizedException('Sign in to continue');
    return customer;
  }

  // ── Email-OTP registration ─────────────────────────────────────────────────

  /** Send an email via Resend's REST API. Returns false (dev fallback) when no
   *  API key is set, so callers can surface a dev code instead. Throws if the
   *  send genuinely fails while configured. */
  private async sendEmail(to: string, subject: string, html: string, text: string, replyTo?: string): Promise<boolean> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL ?? RESEND_FROM_DEFAULT;
    if (!apiKey) {
      console.warn(`[email] to ${to}: "${subject}" (RESEND_API_KEY not set; not sent)`);
      return false;
    }
    const body = JSON.stringify({ from, to: [to], subject, html, text, ...(replyTo ? { reply_to: replyTo } : {}) });
    // Retry transient network failures — the first request after the process is
    // idle often hits a stale/cold TLS connection that resets (ECONNRESET). A
    // Resend rejection (non-2xx) is a real error and is surfaced immediately.
    const ATTEMPTS = 3;
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body,
        });
        if (res.ok) return true;
        const detail = await res.text().catch(() => '');
        console.error(`[email] Resend rejected (${res.status}): ${detail}`);
        throw new BadRequestException('Could not send the email — please check the sender/domain and try again');
      } catch (err) {
        if (err instanceof BadRequestException) throw err; // real rejection — don't retry
        console.error(`[email] send attempt ${attempt}/${ATTEMPTS} failed:`, (err as Error)?.message ?? err);
        if (attempt < ATTEMPTS) { await new Promise((r) => setTimeout(r, 300 * attempt)); continue; }
        throw new BadRequestException('Could not reach the email service — please try again');
      }
    }
    return false; // unreachable
  }

  private otpEmailHtml(heading: string, intro: string, code: string) {
    return `<div style="font-family:Arial,sans-serif;max-width:440px;margin:auto">
      <h2 style="font-weight:700">${heading}</h2>
      <p style="color:#555">${intro}</p>
      <p style="font-size:30px;font-weight:700;letter-spacing:8px;margin:16px 0">${code}</p>
      <p style="color:#999;font-size:13px">This code expires in 10 minutes. If you didn't request it, you can safely ignore this email.</p>
    </div>`;
  }

  private sendOtpEmail(email: string, code: string): Promise<boolean> {
    return this.sendEmail(
      email,
      'Your Zahrah Fashion verification code',
      this.otpEmailHtml('Verify your email', 'Use this code to finish creating your Zahrah Fashion account:', code),
      `Your Zahrah Fashion verification code is ${code}. It expires in 10 minutes.`,
    );
  }

  /** Contact-form message → emailed to the store, reply-to the sender. */
  async sendContactMessage(data: { name?: string; email: string; phone?: string; subject?: string; message: string }) {
    const to = process.env.SUPPORT_EMAIL ?? 'hello@zahrahfashion.com';
    const who = `${escapeHtml(data.name || 'Customer')} (${escapeHtml(data.email)}${data.phone ? `, ${escapeHtml(data.phone)}` : ''})`;
    const html = `<div style="font-family:Arial,sans-serif;max-width:520px">
      <h2 style="font-weight:700">New contact message</h2>
      <p style="color:#555"><b>From:</b> ${who}</p>
      ${data.subject ? `<p style="color:#555"><b>Subject:</b> ${escapeHtml(data.subject)}</p>` : ''}
      <p style="white-space:pre-wrap;color:#222">${escapeHtml(data.message)}</p>
    </div>`;
    const text = `From: ${data.name || 'Customer'} (${data.email}${data.phone ? ', ' + data.phone : ''})\n${data.subject ? 'Subject: ' + data.subject + '\n' : ''}\n${data.message}`;
    const sent = await this.sendEmail(to, `Contact: ${data.subject?.trim() || 'New message from ' + (data.name || 'a customer')}`, html, text, data.email);
    return { ok: true, delivered: sent };
  }

  /** Step 1: validate details, email a 6-digit code, hold the registration. */
  async startRegistration(data: { name?: string; phone: string; email: string; password: string }) {
    if (data.password.length < 8) throw new BadRequestException('Password must be at least 8 characters');
    const email = data.email.toLowerCase().trim();
    const phone = tryNormalizePhone(data.phone);
    if (!phone) throw new BadRequestException('Enter a valid phone number');

    for (const where of [{ primaryPhone: phone }, { email }] as const) {
      const customer = await this.prisma.customer.findUnique({ where });
      if (customer) {
        const cred = await this.prisma.customerCredential.findUnique({ where: { customerId: customer.id } });
        if (cred) throw new BadRequestException('An account already exists — sign in instead');
      }
    }

    const code = String(Math.floor(100_000 + Math.random() * 900_000));
    const pendingToken = randomBytes(24).toString('hex');
    await this.store.set(regKey(pendingToken), {
      email,
      phone,
      name: data.name,
      passwordHash: await argon2.hash(data.password, { type: argon2.argon2id }),
      code,
      expiresAt: Date.now() + OTP_TTL_MS,
      attempts: 0,
    } satisfies PendingRegistration, OTP_TTL_MS / 1000);
    const sent = await this.sendOtpEmail(email, code);
    // Dev convenience: when email isn't configured (and never in production),
    // return the code so the flow is testable without SendGrid.
    const devCode = !sent && process.env.NODE_ENV !== 'production' ? code : undefined;
    return { pendingToken, ...(devCode ? { devCode } : {}) };
  }

  /** Step 2: verify the code, then create the account + session. */
  async verifyRegistration(pendingToken: string, code: string, res: Response) {
    const key = regKey(pendingToken);
    const p = await this.store.get<PendingRegistration>(key);
    if (!p || p.expiresAt < Date.now()) {
      await this.store.del(key);
      throw new BadRequestException('Code expired — please start again');
    }
    if (p.attempts >= 5) {
      await this.store.del(key);
      throw new BadRequestException('Too many attempts — please start again');
    }
    if (code !== p.code) {
      const remaining = Math.max(1, (p.expiresAt - Date.now()) / 1000);
      await this.store.set(key, { ...p, attempts: p.attempts + 1 }, remaining);
      throw new BadRequestException('Incorrect code');
    }
    await this.store.del(key);

    const { customerId } = await this.customers.findOrCreate({ phone: p.phone, email: p.email, name: p.name, source: 'web' });
    const existing = await this.prisma.customerCredential.findUnique({ where: { customerId } });
    if (existing) throw new BadRequestException('An account already exists — sign in instead');

    await this.prisma.$transaction([
      this.prisma.customerCredential.create({
        data: { customerId, emailOrPhone: p.email, passwordHash: p.passwordHash, verifiedAt: new Date() },
      }),
      this.prisma.customer.update({
        where: { id: customerId },
        data: { type: 'registered', email: p.email, ...(p.name ? { fullName: p.name } : {}) },
      }),
    ]);
    await this.createSession(customerId, res);
    return { customerId };
  }

  // ── Password reset (recovery) ──────────────────────────────────────────────

  /** Step 1: email a reset code. Never reveals whether an account exists. */
  async startPasswordReset(identifier: string) {
    const fakeToken = randomBytes(24).toString('hex');
    const phone = tryNormalizePhone(identifier);
    const customer = phone
      ? await this.prisma.customer.findUnique({ where: { primaryPhone: phone } })
      : await this.prisma.customer.findUnique({ where: { email: identifier.toLowerCase().trim() } });
    if (!customer || !customer.email) return { pendingToken: fakeToken };
    const cred = await this.prisma.customerCredential.findUnique({ where: { customerId: customer.id } });
    if (!cred) return { pendingToken: fakeToken };

    const now = Date.now();
    const code = String(Math.floor(100_000 + Math.random() * 900_000));
    const pendingToken = randomBytes(24).toString('hex');
    await this.store.set(resetKey(pendingToken), { customerId: customer.id, code, expiresAt: now + OTP_TTL_MS, attempts: 0 }, OTP_TTL_MS / 1000);
    const sent = await this.sendEmail(
      customer.email,
      'Reset your Zahrah Fashion password',
      this.otpEmailHtml('Reset your password', 'Use this code to set a new password for your account:', code),
      `Your Zahrah Fashion password reset code is ${code}. It expires in 10 minutes.`,
    );
    const devCode = !sent && process.env.NODE_ENV !== 'production' ? code : undefined;
    return { pendingToken, ...(devCode ? { devCode } : {}) };
  }

  /** Step 2: verify the code, set the new password, and sign the customer in. */
  async verifyPasswordReset(pendingToken: string, code: string, newPassword: string, res: Response) {
    if (newPassword.length < 8) throw new BadRequestException('Password must be at least 8 characters');
    const key = resetKey(pendingToken);
    const p = await this.store.get<{ customerId: string; code: string; expiresAt: number; attempts: number }>(key);
    if (!p || p.expiresAt < Date.now()) {
      await this.store.del(key);
      throw new BadRequestException('Code expired — please start again');
    }
    if (p.attempts >= 5) {
      await this.store.del(key);
      throw new BadRequestException('Too many attempts — please start again');
    }
    if (code !== p.code) {
      const remaining = Math.max(1, (p.expiresAt - Date.now()) / 1000);
      await this.store.set(key, { ...p, attempts: p.attempts + 1 }, remaining);
      throw new BadRequestException('Incorrect code');
    }
    await this.store.del(key);
    await this.prisma.customerCredential.update({
      where: { customerId: p.customerId },
      data: { passwordHash: await argon2.hash(newPassword, { type: argon2.argon2id }), failedAttempts: 0, lockedUntil: null },
    });
    await this.createSession(p.customerId, res);
    return { customerId: p.customerId };
  }

  // ── Password change (signed-in, old password + email OTP) ──────────────────

  /** True when the customer signs in with a password (vs Google-only). */
  async hasPassword(customerId: string): Promise<boolean> {
    const cred = await this.prisma.customerCredential.findUnique({ where: { customerId } });
    return !!cred;
  }

  /**
   * Step 1: verify the current password, then email a 6-digit code and hold the
   * new password until the code is confirmed. The password only changes once the
   * OTP is verified in step 2.
   */
  async startPasswordChange(customerId: string, oldPassword: string, newPassword: string) {
    if (newPassword.length < 8) throw new BadRequestException('New password must be at least 8 characters');
    const cred = await this.prisma.customerCredential.findUnique({ where: { customerId } });
    if (!cred) throw new BadRequestException('Password change is only available for email & password accounts');
    if (!(await argon2.verify(cred.passwordHash, oldPassword))) throw new BadRequestException('Your current password is incorrect');
    if (await argon2.verify(cred.passwordHash, newPassword)) throw new BadRequestException('Your new password must be different from your current one');

    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer?.email) throw new BadRequestException('No email on file to send a verification code');

    const now = Date.now();
    const code = String(Math.floor(100_000 + Math.random() * 900_000));
    const pendingToken = randomBytes(24).toString('hex');
    await this.store.set(changeKey(pendingToken), {
      customerId,
      code,
      newPasswordHash: await argon2.hash(newPassword, { type: argon2.argon2id }),
      expiresAt: now + OTP_TTL_MS,
      attempts: 0,
    }, OTP_TTL_MS / 1000);
    const sent = await this.sendEmail(
      customer.email,
      'Confirm your Zahrah Fashion password change',
      this.otpEmailHtml('Confirm password change', 'Use this code to confirm the new password on your account:', code),
      `Your Zahrah Fashion password-change code is ${code}. It expires in 10 minutes. If you didn't request this, your password has not changed.`,
    );
    const devCode = !sent && process.env.NODE_ENV !== 'production' ? code : undefined;
    return { pendingToken, ...(devCode ? { devCode } : {}) };
  }

  /** Step 2: verify the code and apply the new password. */
  async verifyPasswordChange(customerId: string, pendingToken: string, code: string) {
    const key = changeKey(pendingToken);
    const p = await this.store.get<{ customerId: string; code: string; newPasswordHash: string; expiresAt: number; attempts: number }>(key);
    if (!p || p.customerId !== customerId || p.expiresAt < Date.now()) {
      await this.store.del(key);
      throw new BadRequestException('Code expired — please start again');
    }
    if (p.attempts >= 5) {
      await this.store.del(key);
      throw new BadRequestException('Too many attempts — please start again');
    }
    if (code !== p.code) {
      const remaining = Math.max(1, (p.expiresAt - Date.now()) / 1000);
      await this.store.set(key, { ...p, attempts: p.attempts + 1 }, remaining);
      throw new BadRequestException('Incorrect code');
    }
    await this.store.del(key);
    await this.prisma.customerCredential.update({
      where: { customerId },
      data: { passwordHash: p.newPasswordHash, failedAttempts: 0, lockedUntil: null },
    });
    return { ok: true };
  }

  // ── Google sign-in ─────────────────────────────────────────────────────────

  async googleSignIn(credential: string, res: Response) {
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    if (!googleClientId) throw new BadRequestException('Google sign-in is not configured');
    let payload: { email?: string; email_verified?: boolean; name?: string; sub?: string } | undefined;
    try {
      const client = new OAuth2Client(googleClientId);
      const ticket = await client.verifyIdToken({ idToken: credential, audience: googleClientId });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Could not verify Google sign-in');
    }
    if (!payload?.email || !payload.email_verified) throw new UnauthorizedException('Google account email is not verified');
    const email = payload.email.toLowerCase().trim();

    let customer = await this.prisma.customer.findUnique({ where: { email } });
    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          fullName: payload.name?.trim() || 'Customer',
          primaryPhone: `g_${payload.sub}`, // placeholder; Google users add a phone at checkout
          email,
          type: 'registered',
        },
      });
    }
    await this.createSession(customer.id, res);
    return { customerId: customer.id };
  }
}
