import { Body, Controller, Delete, Get, Param, Post, Put, Req } from '@nestjs/common';
import { z } from 'zod';
import { UsersService } from './users.service';
import { Cap, Public } from '../auth/decorators';
import { AuthedRequest } from '../auth/auth.types';
import { parse } from '../common/zod';
import { PrismaService } from '../prisma/prisma.service';
import { ALL_CAPABILITIES, CAPABILITIES, ROLE_SEED } from '../auth/capabilities';

const inviteSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  phone: z.string().max(20).optional(),
});

const overrideSchema = z.object({
  capability: z.enum(ALL_CAPABILITIES as [string, ...string[]]),
  mode: z.enum(['grant', 'revoke']),
  note: z.string().max(500).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

@Controller('users')
export class UsersController {
  constructor(
    private users: UsersService,
    private prisma: PrismaService,
  ) {}

  @Get()
  @Cap('settings.staff_manage')
  list() {
    return this.users.list();
  }

  @Get('roles')
  @Cap('settings.staff_manage')
  roles() {
    // Only the roles actually in use: Owner, Staff (full access) and Rider.
    // Legacy predefined roles (Manager, Sales, Fulfilment, …) are hidden.
    const ACTIVE_ROLES = ['owner', 'staff', 'rider'];
    return Object.entries(ROLE_SEED)
      .filter(([key]) => ACTIVE_ROLES.includes(key))
      .map(([key, r]) => ({ key, name: r.name, capabilities: r.capabilities }));
  }

  @Get('capabilities')
  @Cap('settings.staff_manage')
  capabilities() {
    return Object.entries(CAPABILITIES).map(([key, description]) => ({ key, description }));
  }

  @Get(':id')
  @Cap('settings.staff_manage')
  detail(@Param('id') id: string) {
    return this.users.detail(id);
  }

  @Post('invite')
  @Cap('settings.staff_manage')
  invite(@Body() body: unknown, @Req() req: AuthedRequest) {
    return this.users.invite(req.user, parse(inviteSchema, body));
  }

  @Public()
  @Post('accept-invite')
  acceptInvite(@Body() body: unknown) {
    const { token, password } = parse(z.object({ token: z.string(), password: z.string() }), body);
    return this.users.acceptInvite(token, password);
  }

  @Delete('invites/:id')
  @Cap('settings.staff_manage')
  revokeInvite(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.users.revokeInvite(req.user, id);
  }

  @Delete(':id')
  @Cap('settings.staff_manage')
  removeUser(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.users.removeUser(req.user, id);
  }

  @Put(':id/status')
  @Cap('settings.staff_manage')
  setStatus(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    const { status } = parse(z.object({ status: z.enum(['active', 'deactivated']) }), body);
    return this.users.setStatus(req.user, id, status);
  }

  @Put(':id/role')
  @Cap('settings.staff_manage')
  changeRole(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    const { roleKey } = parse(z.object({ roleKey: z.string() }), body);
    return this.users.changeRole(req.user, id, roleKey);
  }

  @Post(':id/overrides')
  @Cap('settings.overrides')
  addOverride(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    return this.users.addOverride(req.user, id, parse(overrideSchema, body) as never);
  }

  @Delete(':id/overrides/:overrideId')
  @Cap('settings.overrides')
  removeOverride(@Param('id') id: string, @Param('overrideId') overrideId: string, @Req() req: AuthedRequest) {
    return this.users.removeOverride(req.user, id, overrideId);
  }

  @Post(':id/reset-2fa')
  @Cap('settings.reset_2fa')
  reset2fa(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.users.reset2fa(req.user, id);
  }

  /** FR-RBAC-05: who holds a capability. */
  @Get('capability/:capability/holders')
  @Cap('settings.staff_manage')
  async holders(@Param('capability') capability: string) {
    const roles = Object.entries(ROLE_SEED)
      .filter(([, r]) => (r.capabilities as string[]).includes(capability))
      .map(([key, r]) => ({ key, name: r.name }));
    const overrides = await this.prisma.userPermissionOverride.findMany({
      where: { capability, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      include: { user: { select: { id: true, name: true, roleKey: true } } },
    });
    return { roles, overrides };
  }
}
