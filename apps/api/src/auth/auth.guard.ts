import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';
import { PermissionsService } from './permissions.service';
import { Capability } from './capabilities';
import { AuthedRequest } from './auth.types';
import { IS_PUBLIC, REQUIRED_CAPABILITY } from './decorators';

const COOKIE = process.env.SESSION_COOKIE_NAME ?? 'zahrah_admin_session';

/**
 * Global guard: authenticates the session cookie, resolves effective
 * capabilities, and enforces @Cap() metadata. Deny-by-default (FR-RBAC-03) —
 * every non-@Public route requires a session; routes declaring capabilities
 * require them all.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private auth: AuthService,
    private permissions: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token = (req as never as { cookies?: Record<string, string> }).cookies?.[COOKIE];
    if (!token) throw new UnauthorizedException('Not signed in');

    const session = await this.auth.resolveSession(token);
    if (!session) throw new UnauthorizedException('Session expired');

    const caps = await this.permissions.effectiveCapabilities(session.user.id, session.user.roleKey);
    req.user = {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      roleKey: session.user.roleKey,
      status: session.user.status,
      totpEnabled: session.user.totpEnabled,
      capabilities: caps,
    };
    req.sessionId = session.id;
    req.stepUpUntil = session.stepUpUntil;

    const required = this.reflector.getAllAndOverride<Capability[] | undefined>(REQUIRED_CAPABILITY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (required?.length) {
      const missing = required.filter((c) => !caps.has(c));
      if (missing.length) {
        throw new ForbiddenException(`Missing permission: ${missing.join(', ')}`);
      }
    }
    return true;
  }
}
