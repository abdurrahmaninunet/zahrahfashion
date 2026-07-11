import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
import { z } from 'zod';
import { CustomersService } from './customers.service';
import { PrismaService } from '../prisma/prisma.service';
import { Cap } from '../auth/decorators';
import { AuthedRequest } from '../auth/auth.types';
import { parse } from '../common/zod';

const createSchema = z.object({
  fullName: z.string().min(1).max(200),
  phone: z.string().min(7),
  altPhone: z.string().optional(),
  email: z.string().email().nullable().optional(),
  gender: z.string().optional(),
  preferredChannel: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const addressSchema = z.object({
  label: z.string().max(60).optional(),
  addressLine: z.string().min(3).max(500),
  area: z.string().max(120).optional(),
  city: z.string().max(120).optional(),
  zoneId: z.string().nullable().optional(),
  isDefault: z.boolean().default(false),
});

@Controller('customers')
export class CustomersController {
  constructor(
    private customers: CustomersService,
    private prisma: PrismaService,
  ) {}

  @Get()
  async list(
    @Req() req: AuthedRequest,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('tag') tag?: string,
    @Query('page') page?: string,
  ) {
    const caps = req.user.capabilities;
    if (!caps.has('customers.view') && !caps.has('customers.view_limited') && !caps.has('customers.view_summary')) {
      throw new BadRequestException('Missing permission: customers.view');
    }
    const result = await this.customers.search({ q, status, tag, page: Number(page) || 1 });
    if (!caps.has('customers.view')) {
      // Limited/summary views: strip contact detail to what the role needs.
      result.rows = result.rows.map((c) => ({
        ...c,
        email: null,
        metrics: caps.has('customers.view_summary') ? c.metrics : null,
      })) as never;
    }
    return result;
  }

  @Get('duplicates')
  @Cap('customers.merge')
  duplicates() {
    return this.customers.duplicateCandidates();
  }

  @Get('tags')
  @Cap('customers.view')
  async tags() {
    const tags = await this.prisma.customerTag.groupBy({ by: ['tag'], _count: true, orderBy: { tag: 'asc' } });
    return tags.map((t) => ({ tag: t.tag, count: t._count }));
  }

  @Get(':id')
  async profile(@Param('id') id: string, @Req() req: AuthedRequest) {
    const caps = req.user.capabilities;
    if (!caps.has('customers.view') && !caps.has('customers.view_limited')) {
      throw new BadRequestException('Missing permission: customers.view');
    }
    const profile = await this.customers.profile(id);
    // FR-PRV-04: full profile views are logged.
    if (caps.has('customers.view')) await this.customers.logAccess(req.user.id, 'view_profile', id);
    if (!caps.has('customers.view')) {
      // Fulfilment: address/flags only (Customer §4).
      return {
        id: profile.id,
        fullName: profile.fullName,
        primaryPhone: profile.primaryPhone,
        status: profile.status,
        statusReason: profile.statusReason,
        addresses: profile.addresses,
        failedPodCount: profile.failedPodCount,
      };
    }
    return profile;
  }

  @Post()
  @Cap('customers.create_edit')
  create(@Body() body: unknown) {
    return this.customers.create(parse(createSchema, body) as never);
  }

  @Put(':id')
  @Cap('customers.create_edit')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.customers.update(id, body as Record<string, unknown>);
  }

  @Put(':id/status')
  @Cap('customers.flags')
  setStatus(@Param('id') id: string, @Body() body: unknown) {
    const { status, reason } = parse(
      z.object({ status: z.enum(['active', 'watch', 'pod_blocked', 'blocked']), reason: z.string().max(500).optional() }),
      body,
    );
    return this.customers.setStatus(id, status, reason);
  }

  // ── Addresses (FR-CUS-05) ──────────────────────────────────────────────────

  @Post(':id/addresses')
  @Cap('customers.create_edit')
  async addAddress(@Param('id') id: string, @Body() body: unknown) {
    const data = parse(addressSchema, body);
    return this.prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.customerAddress.updateMany({ where: { customerId: id }, data: { isDefault: false } });
      }
      return tx.customerAddress.create({ data: { ...data, customerId: id } as never });
    });
  }

  @Put(':id/addresses/:addressId')
  @Cap('customers.create_edit')
  async updateAddress(@Param('id') id: string, @Param('addressId') addressId: string, @Body() body: unknown) {
    const data = parse(addressSchema.partial(), body);
    return this.prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.customerAddress.updateMany({ where: { customerId: id }, data: { isDefault: false } });
      }
      return tx.customerAddress.update({ where: { id: addressId }, data: data as never });
    });
  }

  @Delete(':id/addresses/:addressId')
  @Cap('customers.create_edit')
  removeAddress(@Param('addressId') addressId: string) {
    return this.prisma.customerAddress.update({ where: { id: addressId }, data: { status: 'archived' } });
  }

  // ── Notes & tags (FR-PRF-03/04) ────────────────────────────────────────────

  @Post(':id/notes')
  @Cap('customers.notes_tags')
  addNote(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    const { note } = parse(z.object({ note: z.string().min(1).max(2000) }), body);
    return this.prisma.customerNote.create({ data: { customerId: id, note, userId: req.user.id } });
  }

  @Put(':id/tags')
  @Cap('customers.notes_tags')
  async setTags(@Param('id') id: string, @Body() body: unknown) {
    const { tags } = parse(z.object({ tags: z.array(z.string().min(1).max(60)) }), body);
    await this.prisma.$transaction(async (tx) => {
      await tx.customerTag.deleteMany({ where: { customerId: id } });
      for (const tag of new Set(tags)) {
        await tx.customerTag.create({ data: { customerId: id, tag: tag.toLowerCase().trim() } });
      }
    });
    return this.prisma.customerTag.findMany({ where: { customerId: id } });
  }

  // ── Consents (FR-PRV-01) ───────────────────────────────────────────────────

  @Post(':id/consents')
  @Cap('customers.create_edit')
  recordConsent(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    const data = parse(
      z.object({
        type: z.enum(['marketing_email', 'marketing_sms', 'marketing_whatsapp']),
        status: z.enum(['granted', 'revoked']),
        note: z.string().max(500).optional(),
      }),
      body,
    );
    return this.prisma.consent.create({
      data: { customerId: id, type: data.type, status: data.status, source: 'staff', actor: req.user.id, note: data.note },
    });
  }

  // ── Merge / NDPA ───────────────────────────────────────────────────────────

  @Post('merge')
  @Cap('customers.merge')
  merge(@Body() body: unknown, @Req() req: AuthedRequest) {
    const { survivorId, mergedId } = parse(z.object({ survivorId: z.string(), mergedId: z.string() }), body);
    return this.customers.merge(req.user.id, survivorId, mergedId);
  }

  @Get(':id/ndpa-export')
  @Cap('customers.ndpa')
  ndpaExport(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.customers.subjectAccessExport(req.user.id, id);
  }

  @Post(':id/anonymize')
  @Cap('customers.ndpa')
  requestAnonymization(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.customers.requestAnonymization(req.user.id, id);
  }

  @Delete('anonymization/:requestId')
  @Cap('customers.ndpa')
  cancelAnonymization(@Param('requestId') requestId: string, @Req() req: AuthedRequest) {
    return this.customers.cancelAnonymization(req.user.id, requestId);
  }

  @Get(':id/anonymization')
  @Cap('customers.ndpa')
  anonymizationStatus(@Param('id') id: string) {
    return this.prisma.anonymizationRequest.findFirst({
      where: { customerId: id, executedAt: null, cancelledAt: null },
    });
  }

  @Get('access-log/all')
  @Cap('customers.view_access_logs')
  accessLog(@Query('customerId') customerId?: string, @Query('page') page?: string) {
    return this.prisma.customerAccessLog.findMany({
      where: customerId ? { customerId } : {},
      orderBy: { createdAt: 'desc' },
      skip: (Math.max(1, Number(page) || 1) - 1) * 50,
      take: 50,
    });
  }
}
