import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
import { z } from 'zod';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { RiderOpsService } from './rider-ops.service';
import { PrismaService } from '../prisma/prisma.service';
import { Cap } from '../auth/decorators';
import { AuthedRequest } from '../auth/auth.types';
import { parse } from '../common/zod';
import { normalizePhone } from '../customers/phone';

const riderSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().min(7),
  altPhone: z.string().max(40).optional().nullable(),
  email: z.string().email().max(200).optional().nullable().or(z.literal('')),
  password: z.string().min(6).max(100).optional().nullable().or(z.literal('')),
  mustChangePassword: z.boolean().default(true),
});

const staffMemberSchema = z.object({
  fullName: z.string().min(1).max(200),
  photo: z.string().nullable().optional(),
  title: z.string().max(120).optional(),
  roleKey: z.enum(['manager', 'management', 'rider']),
  phone: z.string().min(7),
  altPhone: z.string().optional(),
  branch: z.string().max(120).optional(),
  employmentDate: z.string().optional(),
  notes: z.string().max(2000).optional(),
  userId: z.string().nullable().optional(),
});

const geoActionSchema = z.object({
  action: z.enum(['picked_up', 'out', 'delivered', 'failed', 'transfer_flagged']),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracyM: z.number().min(0).optional(),
  clientTime: z.string().datetime(),
  codCollected: z.number().int().min(0).optional(),
  failureReason: z.string().max(300).optional(),
  customerCaused: z.boolean().optional(),
});

@Controller('staff')
export class StaffMembersController {
  constructor(
    private riderOps: RiderOpsService,
    private prisma: PrismaService,
  ) {}

  @Get('members')
  @Cap('staff.manage')
  members(@Query('roleKey') roleKey?: string) {
    return this.prisma.staffMember.findMany({
      where: roleKey ? { roleKey } : {},
      orderBy: [{ status: 'asc' }, { fullName: 'asc' }],
    });
  }

  @Post('members')
  @Cap('staff.manage')
  async createMember(@Body() body: unknown, @Req() req: AuthedRequest) {
    const data = parse(staffMemberSchema, body);
    return this.prisma.staffMember.create({
      data: {
        ...data,
        phone: normalizePhone(data.phone),
        altPhone: data.altPhone ? normalizePhone(data.altPhone) : null,
        employmentDate: data.employmentDate ? new Date(data.employmentDate) : null,
        createdBy: req.user.id,
      } as never,
    });
  }

  // Add a rider: creates the rider's login (User, role=rider) + directory record in one step.
  @Post('riders')
  @Cap('staff.manage')
  async createRider(@Body() body: unknown, @Req() req: AuthedRequest) {
    const d = parse(riderSchema, body);
    const phone = normalizePhone(d.phone);
    const digits = phone.replace(/\D/g, '');
    const email = d.email && d.email.trim() ? d.email.toLowerCase().trim() : `rider-${digits}@zahrah.local`;

    const clash = await this.prisma.user.findUnique({ where: { email } });
    if (clash) throw new BadRequestException('A login with this email already exists');

    const password = d.password && d.password.trim() ? d.password.trim() : randomBytes(6).toString('base64url');
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

    const user = await this.prisma.user.create({
      data: { name: d.name, email, phone, roleKey: 'rider', status: 'active', passwordHash },
    });
    await this.prisma.$executeRaw`UPDATE users SET must_change_password = ${d.mustChangePassword} WHERE id = ${user.id}`;

    const member = await this.prisma.staffMember.create({
      data: {
        fullName: d.name, roleKey: 'rider', phone,
        altPhone: d.altPhone ? normalizePhone(d.altPhone) : null,
        userId: user.id, createdBy: req.user.id,
      },
    });
    // Password is returned once so staff can relay it to the rider; it is never stored in plain text.
    return { id: member.id, loginEmail: email, password, mustChangePassword: d.mustChangePassword };
  }

  // Remove a rider: deactivates both the directory record and the linked login.
  @Delete('members/:id')
  @Cap('staff.manage')
  async removeMember(@Param('id') id: string) {
    const member = await this.prisma.staffMember.findUnique({ where: { id } });
    if (!member) throw new BadRequestException('Rider not found');
    await this.prisma.staffMember.update({ where: { id }, data: { status: 'inactive' } });
    if (member.userId) {
      await this.prisma.user.update({ where: { id: member.userId }, data: { status: 'deactivated' } });
    }
    return { ok: true };
  }

  @Put('members/:id')
  @Cap('staff.manage')
  async updateMember(@Param('id') id: string, @Body() body: unknown) {
    const data = parse(staffMemberSchema.partial().extend({ status: z.enum(['active', 'inactive']).optional() }), body);
    if (data.phone) data.phone = normalizePhone(data.phone);
    return this.prisma.staffMember.update({
      where: { id },
      data: { ...data, employmentDate: data.employmentDate ? new Date(data.employmentDate) : undefined } as never,
    });
  }

  @Get('members/:id/scorecard')
  @Cap('staff.manage')
  scorecard(@Param('id') id: string) {
    return this.riderOps.riderScorecard(id);
  }

  // ── Dispatch board (FR-DSP) ────────────────────────────────────────────────

  @Get('dispatch/board')
  @Cap('staff.dispatch')
  board() {
    return this.riderOps.board();
  }

  @Post('dispatch/assign')
  @Cap('staff.dispatch')
  assign(@Body() body: unknown, @Req() req: AuthedRequest) {
    const { shipmentIds, riderId } = parse(z.object({ shipmentIds: z.array(z.string()).min(1), riderId: z.string() }), body);
    return this.riderOps.assign(req.user, shipmentIds, riderId);
  }

  @Put('dispatch/sequence')
  @Cap('staff.dispatch')
  sequence(@Body() body: unknown) {
    const { riderId, orderedShipmentIds } = parse(z.object({ riderId: z.string(), orderedShipmentIds: z.array(z.string()) }), body);
    return this.riderOps.setSequence(riderId, orderedShipmentIds);
  }

  // ── Geo review (FR-GEO-04) ─────────────────────────────────────────────────

  @Get('geo/flags')
  @Cap('staff.rider_review')
  flags() {
    return this.riderOps.flaggedEvents();
  }

  @Post('geo/flags/:eventId/disposition')
  @Cap('staff.rider_review')
  disposition(@Param('eventId') eventId: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    const { disposition, fix } = parse(
      z.object({
        disposition: z.enum(['ok', 'address_error', 'unresolved']),
        fix: z.object({ lat: z.number(), lng: z.number() }).optional(),
      }),
      body,
    );
    return this.riderOps.disposition(req.user.id, eventId, disposition, fix);
  }

  @Post('geo/geocode')
  @Cap('staff.dispatch')
  setGeocode(@Body() body: unknown) {
    const { addressText, lat, lng } = parse(z.object({ addressText: z.string().min(3), lat: z.number(), lng: z.number() }), body);
    return this.riderOps.setGeocode(addressText, lat, lng);
  }

  // ── Cash (FR-CSH) ──────────────────────────────────────────────────────────

  @Get('cash/balances')
  @Cap('staff.cash_ledger')
  balances() {
    return this.riderOps.riderBalances();
  }

  @Get('cash/ledger/:riderId')
  @Cap('staff.cash_ledger')
  ledger(@Param('riderId') riderId: string) {
    return this.prisma.riderCashLedger.findMany({
      where: { riderId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  @Post('cash/remittance')
  @Cap('staff.cash_ledger')
  remittance(@Body() body: unknown, @Req() req: AuthedRequest) {
    const { riderId, amount, note } = parse(z.object({ riderId: z.string(), amount: z.number().int().positive(), note: z.string().optional() }), body);
    return this.riderOps.recordRemittance(req.user.id, riderId, amount, note);
  }

  @Post('cash/adjustment')
  @Cap('staff.cash_ledger')
  adjustment(@Body() body: unknown, @Req() req: AuthedRequest) {
    const { riderId, amount, reason } = parse(z.object({ riderId: z.string(), amount: z.number().int(), reason: z.string().min(1) }), body);
    return this.riderOps.recordAdjustment(req.user.id, riderId, amount, reason);
  }

  @Post('cash/day-close')
  @Cap('staff.cash_ledger')
  dayClose(@Body() body: unknown, @Req() req: AuthedRequest) {
    const { riderId, date, resolution } = parse(z.object({ riderId: z.string(), date: z.string(), resolution: z.string().optional() }), body);
    return this.riderOps.dayClose(req.user.id, riderId, date, resolution);
  }
}

/** Rider's own workspace — /rider/* is the only surface the Rider role sees (FR-STF-02). */
@Controller('rider')
export class RiderWorkspaceController {
  constructor(private riderOps: RiderOpsService) {}

  @Get('today')
  @Cap('rider.workspace')
  today(@Req() req: AuthedRequest) {
    return this.riderOps.todayList(req.user.id);
  }

  @Post('shipments/:shipmentId/action')
  @Cap('rider.workspace')
  action(@Param('shipmentId') shipmentId: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    return this.riderOps.riderStatusAction(req.user.id, shipmentId, parse(geoActionSchema, body) as never, req.user);
  }
}
