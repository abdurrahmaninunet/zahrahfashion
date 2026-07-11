import { BadRequestException, Body, Controller, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { DiscountsService } from './discounts.service';
import { PrismaService } from '../prisma/prisma.service';
import { Cap } from '../auth/decorators';
import { AuthedRequest } from '../auth/auth.types';
import { parse } from '../common/zod';

const promotionSchema = z.object({
  name: z.string().min(1).max(200),
  internalNote: z.string().max(1000).optional(),
  mechanism: z.enum(['code', 'automatic']),
  valueType: z.enum(['percent', 'fixed', 'free_shipping', 'fixed_price', 'bxgy']),
  valueAmount: z.number().min(0).nullable().optional(),
  scope: z.enum(['order', 'products', 'categories', 'shipping']),
  conditions: z.object({
    schedule: z.object({ startsAt: z.string().datetime().optional(), endsAt: z.string().datetime().optional() }).optional(),
    minSpend: z.number().int().min(0).optional(),
    minQty: z.number().min(0).optional(),
    firstOrderOnly: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
    channels: z.array(z.string()).optional(),
    zones: z.array(z.string()).optional(),
    paymentMethods: z.array(z.string()).optional(),
  }).default({}),
  limits: z.object({
    totalUses: z.number().int().positive().nullable().optional(),
    perCustomerUses: z.number().int().positive().nullable().optional(),
  }).default({}),
  combination: z.object({
    withProduct: z.boolean().optional(),
    withOrder: z.boolean().optional(),
    withShipping: z.boolean().optional(),
    exclusive: z.boolean().optional(),
  }).default({}),
  allowBelowCost: z.boolean().default(false),
  priority: z.number().int().default(0),
  scopeItems: z.array(z.object({
    kind: z.enum(['variant', 'product', 'category', 'category_excl', 'product_excl']),
    refId: z.string(),
  })).default([]),
  code: z.string().regex(/^[A-Za-z0-9-]{3,20}$/).optional(),
});

const CODE_CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // non-ambiguous (FR-COD-02)

@Controller('promotions')
export class DiscountsController {
  constructor(
    private discounts: DiscountsService,
    private prisma: PrismaService,
  ) {}

  @Get()
  @Cap('discounts.view')
  async list(@Query('status') status?: string, @Query('q') q?: string) {
    const promotions = await this.prisma.promotion.findMany({
      where: {
        ...(status ? { status: status as never } : { status: { not: 'archived' } }),
        ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { codes: { some: { code: { contains: q.toUpperCase() } } } }] } : {}),
      },
      include: { codes: true, _count: { select: { redemptions: { where: { status: 'confirmed' } } } } },
      orderBy: { createdAt: 'desc' },
    });
    // FR-ADM-04: discount cost to date.
    const costs = await this.prisma.redemption.groupBy({
      by: ['promotionId'],
      where: { status: 'confirmed' },
      _sum: { amount: true },
    });
    const costMap = new Map(costs.map((c) => [c.promotionId, c._sum.amount ?? 0]));
    return promotions.map((p) => ({ ...p, discountCost: costMap.get(p.id) ?? 0 }));
  }

  @Get(':id')
  @Cap('discounts.view')
  async detail(@Param('id') id: string) {
    const promo = await this.prisma.promotion.findUnique({
      where: { id },
      include: { codes: { take: 50 }, scopeItems: true },
    });
    if (!promo) throw new BadRequestException('Promotion not found');
    const [redemptions, events] = await Promise.all([
      this.prisma.redemption.findMany({ where: { promotionId: id }, orderBy: { createdAt: 'desc' }, take: 100 }),
      this.prisma.promotionEvent.findMany({ where: { promotionId: id }, orderBy: { createdAt: 'desc' }, take: 50 }),
    ]);
    const stats = await this.prisma.redemption.aggregate({
      where: { promotionId: id, status: 'confirmed' },
      _sum: { amount: true },
      _count: true,
    });
    return { ...promo, redemptions, events, stats: { redemptions: stats._count, discountCost: stats._sum.amount ?? 0 } };
  }

  @Post()
  @Cap('discounts.create_edit')
  async create(@Body() body: unknown, @Req() req: AuthedRequest) {
    const data = parse(promotionSchema, body);
    if (data.allowBelowCost && !req.user.capabilities.has('discounts.allow_below_cost')) {
      throw new BadRequestException('Only Owner/Manager may allow below-cost promotions');
    }
    if (data.valueType === 'percent' && (!data.valueAmount || data.valueAmount < 1 || data.valueAmount > 100)) {
      throw new BadRequestException('Percent value must be 1–100 (Validation 1)');
    }
    if (['products', 'categories'].includes(data.scope) && !data.scopeItems?.some((i) => !i.kind.endsWith('_excl'))) {
      throw new BadRequestException('Scope must include at least one product/category (Validation 4)');
    }
    if (data.mechanism === 'code' && !data.code) {
      throw new BadRequestException('A code is required for code promotions');
    }

    return this.prisma.$transaction(async (tx) => {
      const promo = await tx.promotion.create({
        data: {
          name: data.name,
          internalNote: data.internalNote,
          mechanism: data.mechanism,
          valueType: data.valueType,
          valueAmount: data.valueAmount,
          scope: data.scope,
          conditions: data.conditions as never,
          limits: data.limits as never,
          combination: data.combination as never,
          allowBelowCost: data.allowBelowCost,
          priority: data.priority,
          createdBy: req.user.id,
          scopeItems: { create: data.scopeItems },
        },
      });
      if (data.code) {
        const folded = data.code.toUpperCase();
        const clash = await tx.promoCode.findUnique({ where: { code: folded } });
        if (clash) throw new BadRequestException(`Code "${folded}" is already in use (Validation 3)`);
        await tx.promoCode.create({ data: { promotionId: promo.id, code: folded, kind: 'shared' } });
      }
      await tx.promotionEvent.create({ data: { promotionId: promo.id, type: 'created', actorId: req.user.id } });
      return promo;
    });
  }

  /** FR-ADM-03: draft fully editable; active limited to end date + limits. */
  @Put(':id')
  @Cap('discounts.create_edit')
  async update(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    const promo = await this.prisma.promotion.findUnique({ where: { id } });
    if (!promo) throw new BadRequestException('Promotion not found');

    if (promo.status === 'draft') {
      const data = parse(promotionSchema.partial(), body);
      return this.prisma.$transaction(async (tx) => {
        if (data.scopeItems) {
          await tx.promotionScopeItem.deleteMany({ where: { promotionId: id } });
          await tx.promotion.update({ where: { id }, data: { scopeItems: { create: data.scopeItems } } });
        }
        const { scopeItems: _s, code: _c, ...rest } = data;
        const updated = await tx.promotion.update({ where: { id }, data: rest as never });
        await tx.promotionEvent.create({ data: { promotionId: id, type: 'updated', actorId: req.user.id, payload: rest as never } });
        return updated;
      });
    }

    // Active/scheduled: only end date extension/shortening + usage-limit increase.
    const limited = parse(
      z.object({
        endsAt: z.string().datetime().optional(),
        totalUses: z.number().int().positive().optional(),
      }),
      body,
    );
    const conditions = promo.conditions as { schedule?: { startsAt?: string; endsAt?: string } };
    const limits = promo.limits as { totalUses?: number };
    if (limited.totalUses != null && limits.totalUses != null && limited.totalUses < limits.totalUses) {
      throw new BadRequestException('Usage limits may only be increased on an active promotion');
    }
    const updated = await this.prisma.promotion.update({
      where: { id },
      data: {
        conditions: { ...conditions, schedule: { ...conditions.schedule, ...(limited.endsAt ? { endsAt: limited.endsAt } : {}) } } as never,
        limits: { ...limits, ...(limited.totalUses ? { totalUses: limited.totalUses } : {}) } as never,
      },
    });
    await this.prisma.promotionEvent.create({ data: { promotionId: id, type: 'updated_limited', actorId: req.user.id, payload: limited as never } });
    return updated;
  }

  @Post(':id/:action')
  @Cap('discounts.view')
  transition(@Param('id') id: string, @Param('action') action: string, @Req() req: AuthedRequest) {
    const valid = ['schedule', 'activate', 'pause', 'resume', 'end', 'archive'];
    if (!valid.includes(action)) throw new BadRequestException('Unknown action');
    return this.discounts.transition(req.user.id, req.user, id, action as never);
  }

  /** FR-COD-02: bulk unique codes. */
  @Post(':id/codes/batch')
  @Cap('discounts.generate_codes')
  async generateBatch(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    const { prefix, quantity } = parse(
      z.object({ prefix: z.string().regex(/^[A-Za-z0-9]{2,10}$/), quantity: z.number().int().min(1).max(10_000) }),
      body,
    );
    const batchId = randomBytes(8).toString('hex');
    const codes: string[] = [];
    const seen = new Set<string>();
    while (codes.length < quantity) {
      let suffix = '';
      for (let i = 0; i < 5; i++) suffix += CODE_CHARSET[randomBytes(1)[0] % CODE_CHARSET.length];
      const code = `${prefix.toUpperCase()}-${suffix}`;
      if (!seen.has(code)) {
        seen.add(code);
        codes.push(code);
      }
    }
    await this.prisma.promoCode.createMany({
      data: codes.map((code) => ({ promotionId: id, code, kind: 'unique', maxUses: 1, batchId })),
      skipDuplicates: true,
    });
    await this.prisma.promotionEvent.create({
      data: { promotionId: id, type: 'batch_generated', actorId: req.user.id, payload: { batchId, quantity } as never },
    });
    return { batchId, codes };
  }

  /** Manual-discount oversight report (FR-RPT-03). */
  @Get('reports/manual-discounts')
  @Cap('discounts.view_reports')
  async manualDiscountReport(@Query('from') from?: string, @Query('to') to?: string) {
    const rows = await this.prisma.manualDiscount.groupBy({
      by: ['userId'],
      where: {
        createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) },
      },
      _count: true,
      _sum: { amount: true },
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: rows.map((r) => r.userId) } },
      select: { id: true, name: true, roleKey: true },
    });
    const umap = new Map(users.map((u) => [u.id, u]));
    return rows.map((r) => ({
      user: umap.get(r.userId) ?? { id: r.userId, name: 'Unknown' },
      count: r._count,
      totalValue: r._sum.amount ?? 0,
    }));
  }
}
