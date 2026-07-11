import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { AccountEventsService } from '../auth/account-events.service';
import { PermissionsService } from '../auth/permissions.service';
import { AuthedUser } from '../auth/auth.types';
import { ROLE_SEED } from '../auth/capabilities';

function sha256(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

/** Roles at Manager level and above — only Owner manages these (BR-09). */
const MANAGER_PLUS = ['owner', 'manager', 'management'];

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private auth: AuthService,
    private events: AccountEventsService,
    private permissions: PermissionsService,
  ) {}

  private assertCanManageRole(actor: AuthedUser, targetRoleKey: string) {
    if (MANAGER_PLUS.includes(targetRoleKey) && !actor.capabilities.has('settings.staff_manage_managers')) {
      throw new ForbiddenException('Only the Owner may manage Manager-level accounts');
    }
  }

  async list() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, name: true, email: true, phone: true, roleKey: true, status: true,
        totpEnabled: true, lastLoginAt: true, createdAt: true,
        role: { select: { name: true } },
      },
    });
    const invites = await this.prisma.invite.findMany({
      where: { usedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, email: true, name: true, roleKey: true, expiresAt: true, createdAt: true },
    });
    return { users, pendingInvites: invites };
  }

  async detail(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, email: true, phone: true, roleKey: true, status: true,
        totpEnabled: true, lastLoginAt: true, createdAt: true,
        overrides: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * Add a staff member: creates an active account immediately with the full-access
   * `staff` role and a generated temporary password, emailed to them. They must
   * change it on first login (must_change_password). Role is fixed — no picker.
   */
  async invite(actor: AuthedUser, data: { name: string; email: string; phone?: string }) {
    const email = data.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestException('A user with this email already exists');

    const password = randomBytes(9).toString('base64url'); // ~12-char temporary password
    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        email,
        phone: data.phone,
        roleKey: 'staff',
        status: 'active',
        passwordHash: await this.auth.hashPassword(password),
      },
    });
    await this.prisma.$executeRaw`UPDATE users SET must_change_password = true WHERE id = ${user.id}`;
    await this.events.log({ userId: user.id, type: 'activated', detail: { via: 'staff_created', roleKey: 'staff' }, actorId: actor.id });

    const adminUrl = (process.env.ADMIN_URL ?? '').replace(/\/$/, '');
    const emailed = await this.auth.sendStaffWelcomeEmail(email, data.name, password, adminUrl ? `${adminUrl}/login` : '');
    // Dev: when email isn't configured, return the password so the flow is testable.
    const devPassword = !emailed && process.env.NODE_ENV !== 'production' ? password : undefined;
    return { ok: true, userId: user.id, email, emailed, ...(devPassword ? { devPassword } : {}) };
  }

  /** Invite acceptance — public route; sets password and activates. */
  async acceptInvite(token: string, password: string) {
    const invite = await this.prisma.invite.findUnique({ where: { tokenHash: sha256(token) } });
    if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
      throw new BadRequestException('This invite link is invalid or has expired');
    }
    this.auth.assertPasswordPolicy(password);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: invite.name,
          email: invite.email,
          phone: invite.phone,
          roleKey: invite.roleKey,
          status: 'active',
          passwordHash: await this.auth.hashPassword(password),
        },
      });
      await tx.invite.update({ where: { id: invite.id }, data: { usedAt: new Date() } });
      return created;
    });
    await this.events.log({ userId: user.id, type: 'activated', detail: { via: 'invite' } });
    return { ok: true };
  }

  /** Permanently remove a staff account (Owner/Manager can't be removed, nor
   *  yourself). Clears sessions + overrides + auth events, then deletes the user. */
  async removeUser(actor: AuthedUser, userId: string) {
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new NotFoundException('User not found');
    if (target.roleKey === 'owner') throw new ForbiddenException('The Manager account cannot be removed');
    if (target.id === actor.id) throw new BadRequestException('You cannot remove your own account');

    await this.auth.revokeAllSessions(userId);
    await this.prisma.userPermissionOverride.deleteMany({ where: { userId } });
    await this.prisma.session.deleteMany({ where: { userId } });
    await this.prisma.$executeRaw`DELETE FROM account_events WHERE user_id = ${userId}`;
    await this.prisma.user.delete({ where: { id: userId } });
    this.permissions.invalidate(userId);
    await this.events.log({ type: 'user_removed', detail: { email: target.email, name: target.name }, actorId: actor.id });
    return { ok: true };
  }

  async revokeInvite(actor: AuthedUser, inviteId: string) {
    const invite = await this.prisma.invite.findUnique({ where: { id: inviteId } });
    if (!invite) throw new NotFoundException('Invite not found');
    await this.prisma.invite.update({ where: { id: inviteId }, data: { expiresAt: new Date() } });
    await this.events.log({ type: 'invite_revoked', detail: { email: invite.email }, actorId: actor.id });
  }

  /** BR-09/BR-10: deactivation with last-Owner protection + instant session kill. */
  async setStatus(actor: AuthedUser, userId: string, status: 'active' | 'deactivated') {
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new NotFoundException('User not found');
    this.assertCanManageRole(actor, target.roleKey);

    if (status === 'deactivated' && target.roleKey === 'owner') {
      const activeOwners = await this.prisma.user.count({ where: { roleKey: 'owner', status: 'active' } });
      if (activeOwners <= 1) {
        throw new ForbiddenException(
          'The last active Owner cannot be deactivated — see the owner-recovery/succession procedure (D-43)',
        );
      }
    }

    await this.prisma.user.update({ where: { id: userId }, data: { status } });
    if (status === 'deactivated') {
      await this.auth.revokeAllSessions(userId);
    }
    this.permissions.invalidate(userId);
    await this.events.log({
      userId,
      type: status === 'deactivated' ? 'deactivated' : 'activated',
      actorId: actor.id,
    });
  }

  async changeRole(actor: AuthedUser, userId: string, roleKey: string) {
    if (!ROLE_SEED[roleKey]) throw new BadRequestException('Unknown role');
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new NotFoundException('User not found');
    // Owner gate applies to both the current and the new role level.
    this.assertCanManageRole(actor, target.roleKey);
    this.assertCanManageRole(actor, roleKey);

    if (target.roleKey === 'owner' && roleKey !== 'owner') {
      const activeOwners = await this.prisma.user.count({ where: { roleKey: 'owner', status: 'active' } });
      if (activeOwners <= 1) {
        throw new ForbiddenException('The last active Owner cannot be demoted (Business Rule 3)');
      }
    }

    await this.prisma.user.update({ where: { id: userId }, data: { roleKey } });
    this.permissions.invalidate(userId);
    await this.events.log({
      userId,
      type: 'role_changed',
      detail: { from: target.roleKey, to: roleKey },
      actorId: actor.id,
    });
  }

  /** FR-RBAC-02: per-user grant/revoke with note + optional expiry. */
  async addOverride(
    actor: AuthedUser,
    userId: string,
    data: { capability: string; mode: 'grant' | 'revoke'; note?: string; expiresAt?: string | null },
  ) {
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new NotFoundException('User not found');
    if (MANAGER_PLUS.includes(target.roleKey) && !actor.capabilities.has('settings.staff_manage_managers')) {
      throw new ForbiddenException('Only the Owner may override Manager-level accounts');
    }

    const override = await this.prisma.userPermissionOverride.create({
      data: {
        userId,
        capability: data.capability,
        mode: data.mode,
        note: data.note,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        createdBy: actor.id,
      },
    });
    this.permissions.invalidate(userId);
    await this.events.log({
      userId,
      type: `override_${data.mode}`,
      detail: { capability: data.capability, note: data.note },
      actorId: actor.id,
    });
    return override;
  }

  async removeOverride(actor: AuthedUser, userId: string, overrideId: string) {
    await this.prisma.userPermissionOverride.deleteMany({ where: { id: overrideId, userId } });
    this.permissions.invalidate(userId);
    await this.events.log({ userId, type: 'override_removed', detail: { overrideId }, actorId: actor.id });
  }

  /** Owner-only 2FA reset for another user (FR-USR-04). */
  async reset2fa(actor: AuthedUser, userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecret: null, totpEnabled: false, recoveryCodes: undefined },
    });
    await this.auth.revokeAllSessions(userId);
    await this.events.log({ userId, type: '2fa_reset', actorId: actor.id });
  }
}
