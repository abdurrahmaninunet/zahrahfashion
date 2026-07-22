import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { authenticator } from 'otplib';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { AccountEventsService } from './account-events.service';
import { PermissionsService } from './permissions.service';
import { EphemeralStore } from '../redis/ephemeral-store.service';
import { ROLE_SEED } from './capabilities';

const LOCKOUT_FAILS = 5;
const LOCKOUT_MINUTES = 15; // FR-AUTH-01 defaults
const STEP_UP_MINUTES = 10;
const PENDING_2FA_TTL_MS = 5 * 60_000;
const LOGIN_OTP_TTL_MS = 10 * 60_000; // email login code lifetime
const RESEND_FROM_DEFAULT = 'Zahrah Fashion Hub <onboarding@resend.dev>';

// Minimal common-password screen (FR-AUTH-04's breach check is an online
// service in production; locally we block the obvious offenders).
const COMMON_PASSWORDS = new Set([
  'password12', 'password123', '1234567890', 'qwertyuiop', 'iloveyou12',
  'admin12345', 'welcome123', 'zahrah1234', 'letmein123', 'password!1',
]);

function sha256(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

interface Pending2fa {
  userId: string;
  at: number;
}

interface PendingOtp { userId: string; code: string; expiresAt: number; attempts: number }
const otpKey = (token: string) => `admin-login-otp:${token}`;

@Injectable()
export class AuthService implements OnModuleInit {
  private pending2fa = new Map<string, Pending2fa>();

  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
    private events: AccountEventsService,
    private permissions: PermissionsService,
    private store: EphemeralStore,
  ) {}

  /** Keep the DB Role table in sync with the code's role definitions on boot,
   *  so new roles (e.g. `staff`) and capability changes are always present. */
  async onModuleInit() {
    try {
      for (const [key, role] of Object.entries(ROLE_SEED)) {
        await this.prisma.role.upsert({
          where: { key },
          create: { key, name: role.name, capabilities: role.capabilities as never },
          update: { name: role.name, capabilities: role.capabilities as never },
        });
      }
    } catch (err) {
      console.error('[auth] role sync failed', err);
    }
  }

  // ── Password policy (FR-AUTH-04) ──────────────────────────────────────────

  assertPasswordPolicy(password: string) {
    if (password.length < 10) {
      throw new BadRequestException('Password must be at least 10 characters');
    }
    if (COMMON_PASSWORDS.has(password.toLowerCase())) {
      throw new BadRequestException('That password is too common — choose another');
    }
  }

  hashPassword(password: string) {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  // ── Login (FR-AUTH-01/02) ─────────────────────────────────────────────────

  async login(email: string, password: string, ip: string | null, userAgent: string | null) {
    const generic = () => new UnauthorizedException('Invalid email or password');
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

    if (!user || user.status !== 'active' || !user.passwordHash) {
      await this.events.log({ userId: user?.id, type: 'login_failed', ip, detail: { reason: 'unknown_or_inactive' } });
      throw generic();
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.events.log({ userId: user.id, type: 'login_failed', ip, detail: { reason: 'locked' } });
      throw new UnauthorizedException('Account temporarily locked — try again later');
    }

    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) {
      const fails = user.failedAttempts + 1;
      const lock = fails >= LOCKOUT_FAILS;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedAttempts: lock ? 0 : fails,
          lockedUntil: lock ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : undefined,
        },
      });
      await this.events.log({ userId: user.id, type: lock ? 'lockout' : 'login_failed', ip });
      throw generic();
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts: 0, lockedUntil: null },
    });

    // Second factor: email a one-time code (D-41). Every admin login requires it
    // — no authenticator app to set up. The session is only created after the
    // code is confirmed in completeLoginOtp().
    const code = String(Math.floor(100_000 + Math.random() * 900_000));
    const pendingToken = randomBytes(24).toString('hex');
    const now = Date.now();
    await this.store.set(otpKey(pendingToken), { userId: user.id, code, expiresAt: now + LOGIN_OTP_TTL_MS, attempts: 0 }, LOGIN_OTP_TTL_MS / 1000);
    const sent = await this.deliverLoginOtp(user.email, code);
    await this.events.log({ userId: user.id, type: 'login_otp_sent', ip });
    return { otpRequired: true as const, pendingToken, emailSent: sent, ...this.devCode(code) };
  }

  /** In development only, expose the code to the client so it can be shown on the
   *  login screen (no mailbox needed). Never returned in production. */
  private devCode(code: string) {
    return process.env.NODE_ENV !== 'production' ? { devCode: code } : {};
  }

  /** Email the login code. If it fails in a non-prod environment, also print it
   *  to the SERVER console (never the client) so a developer isn't locked out. */
  private async deliverLoginOtp(email: string, code: string): Promise<boolean> {
    const sent = await this.sendLoginOtpEmail(email, code);
    if (!sent && process.env.NODE_ENV !== 'production') {
      console.warn(`[dev] Admin login code for ${email}: ${code} (email could not be sent)`);
    }
    return sent;
  }

  /** Resend the login code for a pending sign-in (fresh code, reset attempts). */
  async resendLoginOtp(pendingToken: string) {
    const key = otpKey(pendingToken);
    const pending = await this.store.get<PendingOtp>(key);
    if (!pending) throw new UnauthorizedException('Login expired — start again');
    const user = await this.prisma.user.findUnique({ where: { id: pending.userId } });
    if (!user || user.status !== 'active') throw new UnauthorizedException('Login expired — start again');
    const code = String(Math.floor(100_000 + Math.random() * 900_000));
    await this.store.set(key, { ...pending, code, expiresAt: Date.now() + LOGIN_OTP_TTL_MS, attempts: 0 }, LOGIN_OTP_TTL_MS / 1000);
    const sent = await this.deliverLoginOtp(user.email, code);
    return { ok: true, emailSent: sent, ...this.devCode(code) };
  }

  /** Verify the emailed login code → create the session. */
  async completeLoginOtp(pendingToken: string, code: string, ip: string | null, userAgent: string | null) {
    const key = otpKey(pendingToken);
    const pending = await this.store.get<PendingOtp>(key);
    if (!pending || pending.expiresAt < Date.now()) {
      await this.store.del(key);
      throw new UnauthorizedException('Login code expired — start again');
    }
    if (pending.attempts >= 5) {
      await this.store.del(key);
      throw new UnauthorizedException('Too many attempts — start again');
    }
    if (code !== pending.code) {
      const remaining = Math.max(1, (pending.expiresAt - Date.now()) / 1000);
      await this.store.set(key, { ...pending, attempts: pending.attempts + 1 }, remaining);
      await this.events.log({ userId: pending.userId, type: '2fa_failed', ip });
      throw new UnauthorizedException('Invalid code');
    }
    await this.store.del(key);

    const user = await this.prisma.user.findUnique({ where: { id: pending.userId } });
    if (!user || user.status !== 'active') throw new UnauthorizedException('Login expired — start again');

    const session = await this.createSession(user.id, user.roleKey, ip, userAgent);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.events.log({ userId: user.id, type: 'login', ip, detail: { via: 'email_otp' } });
    const flag = await this.prisma.$queryRaw<{ must: boolean }[]>`SELECT must_change_password AS must FROM users WHERE id = ${user.id}`;
    return { session, mustChangePassword: flag[0]?.must ?? false };
  }

  /** First-login password set (must_change_password). No current password needed —
   *  the user has already proven identity via password + email OTP this session. */
  async setInitialPassword(userId: string, newPassword: string) {
    const flag = await this.prisma.$queryRaw<{ must: boolean }[]>`SELECT must_change_password AS must FROM users WHERE id = ${userId}`;
    if (!flag[0]?.must) throw new ForbiddenException('Password change is not required for this account');
    this.assertPasswordPolicy(newPassword);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await this.hashPassword(newPassword) } });
    await this.prisma.$executeRaw`UPDATE users SET must_change_password = false WHERE id = ${userId}`;
    await this.events.log({ userId, type: 'password_changed', detail: { firstLogin: true } });
    return { ok: true };
  }

  // ── Email (Resend REST; env read at call time) ────────────────────────────

  private async sendEmail(to: string, subject: string, html: string, text: string): Promise<boolean> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL ?? RESEND_FROM_DEFAULT;
    if (!apiKey) {
      console.warn(`[auth email] to ${to}: "${subject}" (RESEND_API_KEY not set; not sent)`);
      return false;
    }
    const body = JSON.stringify({ from, to: [to], subject, html, text });
    // Retry transient network failures. The FIRST request after the process has
    // been idle often hits a stale/cold TLS connection that resets (ECONNRESET) —
    // without a retry that would surface as "couldn't send" and force a manual
    // Resend. A Resend rejection (non-2xx) is a real error and is NOT retried.
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
        console.error(`[auth email] Resend rejected (${res.status}): ${detail}`);
        return false;
      } catch (err) {
        console.error(`[auth email] send attempt ${attempt}/${ATTEMPTS} failed:`, (err as Error)?.message ?? err);
        if (attempt < ATTEMPTS) await new Promise((r) => setTimeout(r, 300 * attempt));
      }
    }
    return false;
  }

  private sendLoginOtpEmail(email: string, code: string) {
    const html = `<div style="font-family:Arial,sans-serif;max-width:440px;margin:auto">
      <h2 style="font-weight:700">Your Zahrah Admin login code</h2>
      <p style="color:#555">Enter this code to finish signing in:</p>
      <p style="font-size:30px;font-weight:700;letter-spacing:8px;margin:16px 0">${code}</p>
      <p style="color:#999;font-size:13px">This code expires in 10 minutes. If you didn't try to sign in, change your password.</p>
    </div>`;
    return this.sendEmail(email, 'Your Zahrah Admin login code', html, `Your Zahrah Admin login code is ${code}. It expires in 10 minutes.`);
  }

  /** Welcome email for a newly-created staff account: their login + generated
   *  password (which they must change on first sign-in). Returns whether sent. */
  async sendStaffWelcomeEmail(email: string, name: string, password: string, adminUrl: string) {
    const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
      <h2 style="font-weight:700">Welcome to Zahrah, ${name.replace(/[<>&]/g, '')}</h2>
      <p style="color:#555">A staff account has been created for you. Sign in with:</p>
      <div style="border:1px solid #e7e5e4;border-radius:12px;padding:16px;margin:16px 0;background:#faf5e6">
        <p style="margin:0;color:#6f571a;font-size:12px;letter-spacing:.06em;text-transform:uppercase">Email</p>
        <p style="margin:4px 0 12px;font-size:15px;font-weight:600">${email}</p>
        <p style="margin:0;color:#6f571a;font-size:12px;letter-spacing:.06em;text-transform:uppercase">Temporary password</p>
        <p style="margin:4px 0 0;font-size:20px;font-weight:700;letter-spacing:1px">${password}</p>
      </div>
      <p style="color:#555">On your first sign-in we'll email you a one-time code, then ask you to set a new password.</p>
      ${adminUrl ? `<p><a href="${adminUrl}" style="display:inline-block;background:#1c1917;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Sign in</a></p>` : ''}
      <p style="color:#999;font-size:12px">Keep this password private. You'll change it as soon as you sign in.</p>
    </div>`;
    const text = `Welcome to Zahrah.\nEmail: ${email}\nTemporary password: ${password}\nOn first sign-in you'll get a one-time code by email, then set a new password.${adminUrl ? '\nSign in: ' + adminUrl : ''}`;
    return this.sendEmail(email, 'Your Zahrah staff account', html, text);
  }

  async complete2fa(pendingToken: string, code: string, ip: string | null, userAgent: string | null) {
    const pending = this.pending2fa.get(pendingToken);
    if (!pending || Date.now() - pending.at > PENDING_2FA_TTL_MS) {
      throw new UnauthorizedException('Login expired — start again');
    }
    const user = await this.prisma.user.findUnique({ where: { id: pending.userId } });
    if (!user || user.status !== 'active' || !user.totpSecret) throw new UnauthorizedException('Login expired — start again');

    const valid = authenticator.verify({ token: code, secret: user.totpSecret }) || (await this.consumeRecoveryCode(user.id, code));
    if (!valid) {
      await this.events.log({ userId: user.id, type: '2fa_failed', ip });
      throw new UnauthorizedException('Invalid code');
    }

    this.pending2fa.delete(pendingToken);
    const session = await this.createSession(user.id, user.roleKey, ip, userAgent);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.events.log({ userId: user.id, type: 'login', ip, detail: { twofa: true } });
    return { session };
  }

  private async consumeRecoveryCode(userId: string, code: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const hashes = (user?.recoveryCodes as string[] | null) ?? [];
    const hash = sha256(code.replace(/\s/g, '').toLowerCase());
    if (!hashes.includes(hash)) return false;
    await this.prisma.user.update({
      where: { id: userId },
      data: { recoveryCodes: hashes.filter((h) => h !== hash) as never },
    });
    await this.events.log({ userId, type: '2fa_recovery_used' });
    return true;
  }

  // ── Sessions (FR-AUTH-03, D-42) ───────────────────────────────────────────

  async createSession(userId: string, roleKey: string, ip: string | null, userAgent: string | null) {
    const idleMinutes =
      roleKey === 'fulfilment'
        ? (await this.settings.get<number>('security.fulfilment_idle_hours')) * 60
        : await this.settings.get<number>('security.session_idle_minutes');
    const absoluteHours = await this.settings.get<number>('security.session_absolute_hours');

    const token = randomBytes(32).toString('hex');
    const id = sha256(token);
    const now = Date.now();
    await this.prisma.session.create({
      data: {
        id,
        userId,
        idleExpiresAt: new Date(now + idleMinutes * 60_000),
        absoluteExpiresAt: new Date(now + absoluteHours * 3_600_000),
        ip,
        userAgent,
      },
    });
    return { token, idleMinutes };
  }

  /** Resolve a cookie token to a live session + user, sliding idle expiry. */
  async resolveSession(token: string) {
    const id = sha256(token);
    const session = await this.prisma.session.findUnique({
      where: { id },
      include: { user: true },
    });
    const now = new Date();
    if (
      !session ||
      session.revokedAt ||
      session.idleExpiresAt < now ||
      session.absoluteExpiresAt < now ||
      session.user.status !== 'active'
    ) {
      return null;
    }

    // Slide idle expiry, throttled to once a minute to avoid write storms.
    if (now.getTime() - session.lastSeenAt.getTime() > 60_000) {
      const idleMinutes =
        session.user.roleKey === 'fulfilment'
          ? (await this.settings.get<number>('security.fulfilment_idle_hours')) * 60
          : await this.settings.get<number>('security.session_idle_minutes');
      await this.prisma.session.update({
        where: { id },
        data: { lastSeenAt: now, idleExpiresAt: new Date(now.getTime() + idleMinutes * 60_000) },
      });
    }
    return session;
  }

  async revokeSession(token: string) {
    const id = sha256(token);
    await this.prisma.session.updateMany({ where: { id }, data: { revokedAt: new Date() } });
  }

  async revokeAllSessions(userId: string, exceptSessionId?: string) {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
      data: { revokedAt: new Date() },
    });
  }

  // ── Step-up (FR-SET-05) ───────────────────────────────────────────────────

  async stepUp(sessionId: string, userId: string, password?: string, totpCode?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    let ok = false;
    if (totpCode && user.totpSecret) {
      ok = authenticator.verify({ token: totpCode, secret: user.totpSecret });
    } else if (password && user.passwordHash) {
      ok = await argon2.verify(user.passwordHash, password);
    }
    if (!ok) {
      await this.events.log({ userId, type: 'step_up_failed' });
      throw new ForbiddenException('Confirmation failed');
    }

    const until = new Date(Date.now() + STEP_UP_MINUTES * 60_000);
    await this.prisma.session.update({ where: { id: sessionId }, data: { stepUpUntil: until } });
    await this.events.log({ userId, type: 'step_up' });
    return { stepUpUntil: until };
  }

  // ── 2FA enrollment (FR-AUTH-02) ───────────────────────────────────────────

  async begin2faEnrollment(userId: string, email: string) {
    const secret = authenticator.generateSecret();
    // Stored immediately but only flagged enabled after verification.
    await this.prisma.user.update({ where: { id: userId }, data: { totpSecret: secret, totpEnabled: false } });
    const otpauth = authenticator.keyuri(email, 'Zahrah Admin', secret);
    return { secret, otpauth };
  }

  async confirm2faEnrollment(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.totpSecret) throw new BadRequestException('Enrollment not started');
    if (!authenticator.verify({ token: code, secret: user.totpSecret })) {
      throw new BadRequestException('Invalid code — check your authenticator app');
    }
    const recovery = Array.from({ length: 8 }, () => randomBytes(5).toString('hex'));
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: true, recoveryCodes: recovery.map((c) => sha256(c)) as never },
    });
    await this.events.log({ userId, type: '2fa_enabled' });
    return { recoveryCodes: recovery };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, currentPassword))) {
      throw new ForbiddenException('Current password is incorrect');
    }
    this.assertPasswordPolicy(newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await this.hashPassword(newPassword) },
    });
    // Clear the "must change on first login" flag (column not in the generated client yet).
    await this.prisma.$executeRaw`UPDATE users SET must_change_password = false WHERE id = ${userId}`;
    await this.events.log({ userId, type: 'password_changed' });
  }
}
