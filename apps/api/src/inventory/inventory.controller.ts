import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { z } from 'zod';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { Cap } from '../auth/decorators';
import { AuthedRequest } from '../auth/auth.types';
import { parse } from '../common/zod';

const receiptSchema = z.object({
  supplierId: z.string().nullable().optional(),
  note: z.string().max(500).optional(),
  lines: z.array(z.object({
    variantId: z.string(),
    quantity: z.number().positive(),
    unitCost: z.number().int().min(0).nullable().optional(),
  })).min(1),
});

const adjustSchema = z.object({
  variantId: z.string(),
  quantity: z.number().positive(),
  direction: z.enum(['up', 'down']),
  reasonCode: z.enum(['recount', 'damage', 'theft_loss', 'promo_gift', 'correction', 'expiry', 'other']),
  note: z.string().max(500).optional(),
});

@Controller('inventory')
export class InventoryController {
  constructor(
    private inventory: InventoryService,
    private prisma: PrismaService,
    private settings: SettingsService,
  ) {}

  /** Stock overview with on-hand/reserved/available (FR-RPT-01 basis). */
  @Get('stock')
  @Cap('inventory.view')
  async stock(
    @Req() req: AuthedRequest,
    @Query('q') q?: string,
    @Query('categoryId') categoryId?: string,
    @Query('filter') filter?: 'low' | 'out' | 'remnant',
    @Query('page') page?: string,
  ) {
    const pageNum = Math.max(1, Number(page) || 1);
    const pageSize = 50;
    const canSeeCosts = req.user.capabilities.has('inventory.view_costs');

    const variants = await this.prisma.variant.findMany({
      where: {
        status: 'active',
        ...(q ? { OR: [{ sku: { contains: q, mode: 'insensitive' } }, { product: { name: { contains: q, mode: 'insensitive' } } }] } : {}),
        ...(categoryId ? { product: { categoryId } } : {}),
      },
      include: {
        product: { select: { id: true, name: true, categoryId: true, minOrderQty: true, sellUnitId: true, category: { select: { name: true } } } },
        stockLevels: true,
      },
      orderBy: { sku: 'asc' },
    });

    const defaultThreshold = await this.settings.get<number>('inventory.default_low_stock_threshold');
    let rows = variants.map((v) => {
      const onHand = v.stockLevels.reduce((s, l) => s + Number(l.onHand), 0);
      const reserved = v.stockLevels.reduce((s, l) => s + Number(l.reserved), 0);
      const available = onHand - reserved;
      const threshold = v.stockLevels[0]?.lowStockThreshold != null ? Number(v.stockLevels[0].lowStockThreshold) : defaultThreshold;
      return {
        variantId: v.id,
        sku: v.sku,
        product: v.product.name,
        productId: v.product.id,
        category: v.product.category.name,
        optionValues: v.optionValues,
        onHand,
        reserved,
        available,
        threshold,
        allowBackorder: v.stockLevels[0]?.allowBackorder ?? false,
        costPrice: canSeeCosts ? v.costPrice : null,
        costValue: canSeeCosts && v.costPrice != null ? Math.round(onHand * v.costPrice) : null,
        minOrderQty: Number(v.product.minOrderQty ?? 1),
        low: available > 0 && available <= threshold,
        out: available <= 0,
        remnant: available > 0 && available < Number(v.product.minOrderQty ?? 1), // D-04
      };
    });

    if (filter === 'low') rows = rows.filter((r) => r.low);
    if (filter === 'out') rows = rows.filter((r) => r.out);
    if (filter === 'remnant') rows = rows.filter((r) => r.remnant);

    return {
      total: rows.length,
      page: pageNum,
      rows: rows.slice((pageNum - 1) * pageSize, pageNum * pageSize),
    };
  }

  /** Movement ledger for one SKU (FR-LED-04). */
  @Get('movements')
  @Cap('inventory.view')
  async movements(
    @Query('variantId') variantId?: string,
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
  ) {
    const pageNum = Math.max(1, Number(page) || 1);
    const where = {
      ...(variantId ? { variantId } : {}),
      ...(type ? { type: type as never } : {}),
      createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) },
    };
    const [total, rows] = await Promise.all([
      this.prisma.stockMovement.count({ where }),
      this.prisma.stockMovement.findMany({
        where,
        include: { variant: { select: { sku: true, product: { select: { name: true } } } } },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * 50,
        take: 50,
      }),
    ]);
    return { total, page: pageNum, rows };
  }

  @Post('receipts')
  @Cap('inventory.receive')
  receive(@Body() body: unknown, @Req() req: AuthedRequest) {
    return this.inventory.postReceipt(req.user.id, parse(receiptSchema, body) as never);
  }

  @Get('receipts')
  @Cap('inventory.view')
  receipts(@Query('page') page?: string) {
    return this.prisma.receipt.findMany({
      include: { lines: { include: {} } },
      orderBy: { createdAt: 'desc' },
      skip: (Math.max(1, Number(page) || 1) - 1) * 25,
      take: 25,
    });
  }

  @Post('adjust')
  async adjust(@Body() body: unknown, @Req() req: AuthedRequest) {
    const canAll = req.user.capabilities.has('inventory.adjust');
    const canRecount = req.user.capabilities.has('inventory.adjust_recount');
    if (!canAll && !canRecount) throw new BadRequestException('Missing permission: inventory.adjust');
    const data = parse(adjustSchema, body);
    if (['damage', 'theft_loss', 'expiry'].includes(data.reasonCode) && data.direction === 'down' && !req.user.capabilities.has('inventory.write_off') && !canAll) {
      throw new BadRequestException('Write-offs require Manager/Owner permission');
    }
    return this.inventory.adjust(req.user.id, data, !canAll);
  }

  // ── Stocktakes ─────────────────────────────────────────────────────────────

  @Post('stocktakes')
  @Cap('inventory.stocktake_count')
  createStocktake(@Body() body: unknown, @Req() req: AuthedRequest) {
    const { scopeCategoryId, blind } = parse(
      z.object({ scopeCategoryId: z.string().nullable().optional(), blind: z.boolean().default(false) }),
      body,
    );
    return this.inventory.createStocktake(req.user.id, scopeCategoryId ?? null, blind ?? false);
  }

  @Get('stocktakes')
  @Cap('inventory.view')
  stocktakes() {
    return this.prisma.stocktake.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { lines: true } } },
      take: 50,
    });
  }

  @Get('stocktakes/:id')
  @Cap('inventory.view')
  async stocktake(@Param('id') id: string) {
    const stocktake = await this.prisma.stocktake.findUnique({
      where: { id },
      include: { lines: { include: { } } },
    });
    if (!stocktake) throw new BadRequestException('Stocktake not found');
    const variantIds = stocktake.lines.map((l) => l.variantId);
    const variants = await this.prisma.variant.findMany({
      where: { id: { in: variantIds } },
      select: { id: true, sku: true, product: { select: { name: true } } },
    });
    const vmap = new Map(variants.map((v) => [v.id, v]));
    return {
      ...stocktake,
      lines: stocktake.lines.map((l) => ({
        ...l,
        // FR-STK-01 blind count: hide system qty while counting.
        systemQty: stocktake.blind && stocktake.status === 'counting' ? null : l.systemQty,
        sku: vmap.get(l.variantId)?.sku,
        product: vmap.get(l.variantId)?.product.name,
      })),
    };
  }

  @Post('stocktakes/:id/counts')
  @Cap('inventory.stocktake_count')
  enterCounts(@Param('id') id: string, @Body() body: unknown) {
    const { counts } = parse(z.object({ counts: z.array(z.object({ lineId: z.string(), countedQty: z.number().min(0) })) }), body);
    return this.inventory.enterCounts(id, counts);
  }

  @Post('stocktakes/:id/approve')
  @Cap('inventory.approve')
  approveStocktake(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.inventory.approveStocktake(req.user.id, id);
  }

  // ── Alerts ─────────────────────────────────────────────────────────────────

  @Get('alerts')
  @Cap('inventory.view')
  async alerts(@Query('status') status?: string) {
    const alerts = await this.prisma.stockAlert.findMany({
      where: { status: (status as never) ?? 'active' },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const variantIds = alerts.map((a) => a.variantId).filter(Boolean) as string[];
    const variants = await this.prisma.variant.findMany({
      where: { id: { in: variantIds } },
      select: { id: true, sku: true, product: { select: { name: true } } },
    });
    const vmap = new Map(variants.map((v) => [v.id, v]));
    return alerts.map((a) => ({
      ...a,
      sku: a.variantId ? vmap.get(a.variantId)?.sku : null,
      product: a.variantId ? vmap.get(a.variantId)?.product.name : null,
    }));
  }

  /** Valuation summary (FR-RPT-06) — cost-gated. */
  @Get('valuation')
  @Cap('inventory.view_costs')
  async valuation() {
    const rows = await this.prisma.$queryRaw<{ category: string; total_qty: string; total_value: string }[]>`
      SELECT c.name AS category,
             SUM(sl.on_hand) AS total_qty,
             SUM(sl.on_hand * COALESCE(v.cost_price, 0)) AS total_value
      FROM stock_levels sl
      JOIN variants v ON v.id = sl.variant_id
      JOIN products p ON p.id = v.product_id
      JOIN categories c ON c.id = p.category_id
      GROUP BY c.name ORDER BY total_value DESC`;
    return rows.map((r) => ({ category: r.category, totalQty: Number(r.total_qty), totalValue: Number(r.total_value) }));
  }
}
