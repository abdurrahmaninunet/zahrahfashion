import { Body, Controller, Delete, Get, Param, Post, Req, Res } from '@nestjs/common';
import { Response } from 'express';
import { z } from 'zod';
import { AuthService } from './auth.service';
import { AuthedRequest } from './auth.types';
import { Public } from './decorators';
import { parse } from '../common/zod';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

const COOKIE = process.env.SESSION_COOKIE_NAME ?? 'zahrah_admin_session';

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const twoFaSchema = z.object({ pendingToken: z.string(), code: z.string().min(6) });
const stepUpSchema = z.object({ password: z.string().optional(), totpCode: z.string().optional() });
const changePasswordSchema = z.object({ currentPassword: z.string(), newPassword: z.string() });

function setSessionCookie(res: Response, token: string) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}

@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private prisma: PrismaService,
    private settings: SettingsService,
  ) {}

  /** Step 1: verify email + password → email a one-time code (2nd factor). */
  @Public()
  @Post('login')
  async login(@Body() body: unknown, @Req() req: AuthedRequest) {
    const { email, password } = parse(loginSchema, body);
    const result = await this.auth.login(email, password, req.ip ?? null, req.headers['user-agent'] ?? null);
    return { otpRequired: true, pendingToken: result.pendingToken, emailSent: result.emailSent, ...('devCode' in result ? { devCode: result.devCode } : {}) };
  }

  /** Resend the login code to the same pending sign-in. */
  @Public()
  @Post('login/resend')
  async loginResend(@Body() body: unknown) {
    const { pendingToken } = parse(z.object({ pendingToken: z.string() }), body);
    return this.auth.resendLoginOtp(pendingToken);
  }

  /** Step 2: confirm the emailed code → create the session. */
  @Public()
  @Post('login/otp')
  async loginOtp(@Body() body: unknown, @Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response) {
    const { pendingToken, code } = parse(twoFaSchema, body);
    const { session, mustChangePassword } = await this.auth.completeLoginOtp(
      pendingToken, code, req.ip ?? null, req.headers['user-agent'] ?? null,
    );
    setSessionCookie(res, session.token);
    return { ok: true, mustChangePassword };
  }

  /** First-login forced password set (no current password required). */
  @Post('password/initial')
  async setInitialPassword(@Body() body: unknown, @Req() req: AuthedRequest) {
    const { newPassword } = parse(z.object({ newPassword: z.string() }), body);
    return this.auth.setInitialPassword(req.user.id, newPassword);
  }

  /** Legacy authenticator-app 2FA (kept for backward compatibility). */
  @Public()
  @Post('2fa')
  async twoFa(@Body() body: unknown, @Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response) {
    const { pendingToken, code } = parse(twoFaSchema, body);
    const { session } = await this.auth.complete2fa(pendingToken, code, req.ip ?? null, req.headers['user-agent'] ?? null);
    setSessionCookie(res, session.token);
    return { ok: true };
  }

  @Post('logout')
  async logout(@Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response) {
    const token = (req as never as { cookies?: Record<string, string> }).cookies?.[COOKIE];
    if (token) await this.auth.revokeSession(token);
    res.clearCookie(COOKIE, { path: '/' });
    return { ok: true };
  }

  /** Session + effective permissions + shell context for the admin app. */
  @Get('me')
  async me(@Req() req: AuthedRequest) {
    const gatewayMode = await this.settings.get<string>('payments.gateway_mode');
    const quickActions = await this.settings.get<Record<string, string[]>>('dashboard.quick_actions');
    // Read the must-change flag directly (column not yet in the generated Prisma client).
    const flag = await this.prisma.$queryRaw<{ must: boolean }[]>`SELECT must_change_password AS must FROM users WHERE id = ${req.user.id}`;
    return {
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        roleKey: req.user.roleKey,
        totpEnabled: req.user.totpEnabled,
      },
      capabilities: Array.from(req.user.capabilities),
      stepUpUntil: req.stepUpUntil,
      testMode: gatewayMode === 'test',
      // Email OTP is the second factor now — no authenticator-app enrollment nag.
      mustEnroll2fa: false,
      mustChangePassword: flag[0]?.must ?? false,
      quickActions: quickActions[req.user.roleKey] ?? [],
    };
  }

  @Post('step-up')
  async stepUp(@Body() body: unknown, @Req() req: AuthedRequest) {
    const { password, totpCode } = parse(stepUpSchema, body);
    return this.auth.stepUp(req.sessionId, req.user.id, password, totpCode);
  }

  @Post('password')
  async changePassword(@Body() body: unknown, @Req() req: AuthedRequest) {
    const { currentPassword, newPassword } = parse(changePasswordSchema, body);
    await this.auth.changePassword(req.user.id, currentPassword, newPassword);
    return { ok: true };
  }

  @Post('2fa/enroll')
  async enroll2fa(@Req() req: AuthedRequest) {
    return this.auth.begin2faEnrollment(req.user.id, req.user.email);
  }

  @Post('2fa/confirm')
  async confirm2fa(@Body() body: unknown, @Req() req: AuthedRequest) {
    const { code } = parse(z.object({ code: z.string().min(6) }), body);
    return this.auth.confirm2faEnrollment(req.user.id, code);
  }

  @Get('sessions')
  async sessions(@Req() req: AuthedRequest) {
    const sessions = await this.prisma.session.findMany({
      where: { userId: req.user.id, revokedAt: null, absoluteExpiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: 'desc' },
      select: { id: true, createdAt: true, lastSeenAt: true, ip: true, userAgent: true },
    });
    return sessions.map((s) => ({ ...s, current: s.id === req.sessionId }));
  }

  @Delete('sessions/others')
  async revokeOthers(@Req() req: AuthedRequest) {
    await this.auth.revokeAllSessions(req.user.id, req.sessionId);
    return { ok: true };
  }

  @Delete('sessions/:id')
  async revokeOne(@Param('id') id: string, @Req() req: AuthedRequest) {
    await this.prisma.session.updateMany({
      where: { id, userId: req.user.id },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }
}
