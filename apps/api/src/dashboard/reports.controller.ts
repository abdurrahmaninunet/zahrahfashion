import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { MetricsService, METRIC_DEFINITIONS } from './metrics.service';
import { Cap } from '../auth/decorators';
import { AuthedRequest } from '../auth/auth.types';

const CONFIRMED = ['CONFIRMED', 'PROCESSING', 'PARTIALLY_SHIPPED', 'SHIPPED', 'DELIVERED', 'COMPLETED'];

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
}

@Controller('reports')
export class ReportsController {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
    private metrics: MetricsService,
  ) {}

  @Get('metric-definitions')
  definitions() {
    return METRIC_DEFINITIONS;
  }

  /** Sales over time (Reports FR-SLS). */
  @Get('sales')
  @Cap('reports.view_sales')
  async sales(@Query('period') period = 'last30', @Query('from') from?: string, @Query('to') to?: string) {
    const { period: p, compare } = this.metrics.resolvePeriod(period, from, to);
    const [kpis, trend, channels, top] = await Promise.all([
      this.metrics.kpis(p, compare, false),
      this.metrics.trend(p, true),
      this.metrics.channelSplit(p),
      this.metrics.topProducts(p, 20),
    ]);
    return { kpis, trend, channels, topProducts: top, period: p };
  }

  /** Financial summary (D-35: shipping its own line; VAT toggle off at launch). */
  @Get('financial-summary')
  @Cap('reports.view_margin')
  async financialSummary(@Query('period') period = 'this_month', @Query('from') from?: string, @Query('to') to?: string) {
    const { period: p } = this.metrics.resolvePeriod(period, from, to);
    const kpis = await this.metrics.kpis(p, p, true);
    const orders = await this.prisma.order.aggregate({
      where: { status: { in: CONFIRMED as never }, confirmedAt: { gte: p.from, lt: p.to } },
      _sum: { subtotal: true, discountTotal: true, shippingFee: true, grandTotal: true },
    });
    const refunds = await this.prisma.refund.aggregate({
      where: { status: 'processed', processedAt: { gte: p.from, lt: p.to } },
      _sum: { amount: true },
    });
    const manualDiscounts = await this.prisma.manualDiscount.aggregate({
      where: { createdAt: { gte: p.from, lt: p.to } },
      _sum: { amount: true },
    });
    return {
      period: p,
      lines: {
        productRevenue: (orders._sum.subtotal ?? 0) - (orders._sum.discountTotal ?? 0),
        discounts: orders._sum.discountTotal ?? 0,
        manualDiscounts: manualDiscounts._sum.amount ?? 0,
        shippingCollected: orders._sum.shippingFee ?? 0, // separate line per D-35
        refunds: refunds._sum.amount ?? 0,
        cogs: kpis.gross_margin ? ((orders._sum.subtotal ?? 0) - (orders._sum.discountTotal ?? 0)) - kpis.gross_margin.value : null,
        grossMargin: kpis.gross_margin?.value ?? null,
        vat: null, // D-35: toggle OFF pending VAT registration confirmation
      },
    };
  }

  /** Product & inventory analytics: dead stock (D-37) + valuation. */
  @Get('dead-stock')
  @Cap('reports.view_products')
  async deadStock() {
    const defaultDays = await this.settings.get<number>('inventory.dead_stock_days');
    const rows = await this.prisma.$queryRaw<{ variant_id: string; sku: string; name: string; category: string; dead_days: number; on_hand: string; cost_value: string | null; last_sale: Date | null }[]>`
      SELECT v.id AS variant_id, v.sku, p.name, c.name AS category,
             COALESCE(c.dead_stock_days, ${defaultDays}) AS dead_days,
             sl.on_hand,
             sl.on_hand * COALESCE(v.cost_price, 0) AS cost_value,
             (SELECT MAX(o.confirmed_at) FROM order_lines ol JOIN orders o ON o.id = ol.order_id
              WHERE ol.variant_id = v.id AND o.status::text = ANY(${CONFIRMED}::text[])) AS last_sale
      FROM stock_levels sl
      JOIN variants v ON v.id = sl.variant_id
      JOIN products p ON p.id = v.product_id
      JOIN categories c ON c.id = p.category_id
      WHERE sl.on_hand > 0
      ORDER BY last_sale ASC NULLS FIRST
      LIMIT 200`;
    const now = Date.now();
    return rows
      .filter((r) => {
        const lastSale = r.last_sale ? new Date(r.last_sale).getTime() : 0;
        return now - lastSale > Number(r.dead_days) * 86_400_000;
      })
      .map((r) => ({
        variantId: r.variant_id,
        sku: r.sku,
        name: r.name,
        category: r.category,
        onHand: Number(r.on_hand),
        costValue: Number(r.cost_value ?? 0),
        lastSale: r.last_sale,
        threshold: Number(r.dead_days),
      }));
  }

  /** Shrinkage report (Inventory FR-RPT-04). */
  @Get('shrinkage')
  @Cap('reports.view_margin')
  async shrinkage(@Query('period') period = 'this_month', @Query('from') from?: string, @Query('to') to?: string) {
    const { period: p } = this.metrics.resolvePeriod(period, from, to);
    const rows = await this.prisma.stockMovement.groupBy({
      by: ['reasonCode'],
      where: { type: 'WRITE_OFF', createdAt: { gte: p.from, lt: p.to } },
      _count: true,
    });
    const detail = await this.prisma.$queryRaw<{ reason_code: string | null; qty: string; cost_value: string }[]>`
      SELECT reason_code, SUM(ABS(quantity)) AS qty, SUM(ABS(quantity) * COALESCE(unit_cost, 0)) AS cost_value
      FROM stock_movements
      WHERE type = 'WRITE_OFF' AND created_at >= ${p.from} AND created_at < ${p.to}
      GROUP BY reason_code`;
    return detail.map((d) => ({
      reason: d.reason_code ?? 'unspecified',
      count: rows.find((r) => r.reasonCode === d.reason_code)?._count ?? 0,
      quantity: Number(d.qty),
      costValue: Number(d.cost_value),
    }));
  }

  /** Customer analytics — aggregates for Marketing (D-34); named lists gated. */
  @Get('customers')
  async customerReport(@Req() req: AuthedRequest, @Query('period') period = 'last30', @Query('from') from?: string, @Query('to') to?: string) {
    const caps = req.user.capabilities;
    const aggregatesOnly = !caps.has('reports.view_customers');
    if (aggregatesOnly && !caps.has('reports.view_customers_aggregate')) {
      return { error: 'forbidden' };
    }
    const { period: p } = this.metrics.resolvePeriod(period, from, to);

    const newVsReturning = await this.prisma.$queryRaw<{ kind: string; count: string }[]>`
      SELECT CASE WHEN prior.cnt > 0 THEN 'returning' ELSE 'new' END AS kind, COUNT(*) AS count
      FROM orders o
      CROSS JOIN LATERAL (
        SELECT COUNT(*) AS cnt FROM orders p2
        WHERE p2.customer_id = o.customer_id AND p2.confirmed_at < o.confirmed_at
          AND p2.status::text = ANY(${CONFIRMED}::text[])
      ) prior
      WHERE o.status::text = ANY(${CONFIRMED}::text[]) AND o.confirmed_at >= ${p.from} AND o.confirmed_at < ${p.to}
      GROUP BY 1`;

    const byZone = await this.prisma.order.groupBy({
      by: ['deliveryZoneId'],
      where: { status: { in: CONFIRMED as never }, confirmedAt: { gte: p.from, lt: p.to } },
      _count: true,
    });
    const zones = await this.prisma.zone.findMany({ select: { id: true, name: true } });
    const zmap = new Map(zones.map((z) => [z.id, z.name]));

    const result: Record<string, unknown> = {
      period: p,
      newVsReturning: Object.fromEntries(newVsReturning.map((r) => [r.kind, Number(r.count)])),
      byZone: byZone.map((z) => ({ zone: z.deliveryZoneId ? zmap.get(z.deliveryZoneId) : 'No zone', orders: z._count })),
    };

    if (!aggregatesOnly) {
      const top = await this.prisma.$queryRaw<{ id: string; full_name: string; spend: string; orders: string }[]>`
        SELECT c.id, c.full_name, SUM(o.grand_total) AS spend, COUNT(*) AS orders
        FROM orders o JOIN customers c ON c.id = o.customer_id
        WHERE o.status::text = ANY(${CONFIRMED}::text[]) AND o.confirmed_at >= ${p.from} AND o.confirmed_at < ${p.to}
        GROUP BY c.id, c.full_name ORDER BY spend DESC LIMIT 20`;
      result.topCustomers = top.map((t) => ({ id: t.id, name: t.full_name, spend: Number(t.spend), orders: Number(t.orders) }));
    }
    return result;
  }

  /** Operations: aging (D-36), POD success, fulfilment times. */
  @Get('operations')
  @Cap('reports.view_ops')
  async operations(@Query('period') period = 'last30', @Query('from') from?: string, @Query('to') to?: string) {
    const { period: p } = this.metrics.resolvePeriod(period, from, to);
    const [agingConfirmed, podStats, fulfilment] = await Promise.all([
      this.prisma.order.count({
        where: { status: 'CONFIRMED', confirmedAt: { lt: new Date(Date.now() - (await this.settings.get<number>('orders.aging_confirmed_hours')) * 3_600_000) } },
      }),
      this.prisma.$queryRaw<{ status: string; count: string }[]>`
        SELECT s.status, COUNT(*) AS count FROM shipments s
        JOIN orders o ON o.id = s.order_id
        WHERE o.payment_method = 'pod' AND s.created_at >= ${p.from} AND s.created_at < ${p.to}
        GROUP BY s.status`,
      this.prisma.$queryRaw<{ avg_hours: string | null }[]>`
        SELECT AVG(EXTRACT(EPOCH FROM (shipped_at - confirmed_at)) / 3600) AS avg_hours
        FROM orders WHERE shipped_at IS NOT NULL AND confirmed_at IS NOT NULL
          AND confirmed_at >= ${p.from} AND confirmed_at < ${p.to}`,
    ]);
    const pod = Object.fromEntries(podStats.map((r) => [r.status, Number(r.count)]));
    const podTotal = (pod.delivered ?? 0) + (pod.failed ?? 0);
    return {
      period: p,
      agingConfirmed,
      pod: { ...pod, successRate: podTotal > 0 ? Math.round(((pod.delivered ?? 0) / podTotal) * 1000) / 10 : null },
      avgConfirmToShipHours: fulfilment[0]?.avg_hours ? Math.round(Number(fulfilment[0].avg_hours) * 10) / 10 : null,
    };
  }

  /** CSV export with logging (Reports FR-EXP, NFR-06). */
  @Get('export')
  @Cap('reports.export')
  async export(
    @Req() req: AuthedRequest,
    @Res() res: Response,
    @Query('report') report = 'sales',
    @Query('period') period = 'last30',
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const { period: p } = this.metrics.resolvePeriod(period, from, to);
    let rows: Record<string, unknown>[] = [];

    if (report === 'sales') {
      if (!req.user.capabilities.has('reports.view_sales')) {
        res.status(403).json({ message: 'Missing permission' });
        return;
      }
      const orders = await this.prisma.order.findMany({
        where: { status: { in: CONFIRMED as never }, confirmedAt: { gte: p.from, lt: p.to } },
        include: { customer: { select: { fullName: true } }, deliveryZone: { select: { name: true } } },
        orderBy: { confirmedAt: 'asc' },
      });
      rows = orders.map((o) => ({
        orderNumber: o.orderNumber,
        confirmedAt: o.confirmedAt?.toISOString(),
        customer: o.customer?.fullName,
        channel: o.channel,
        zone: o.deliveryZone?.name,
        status: o.status,
        subtotalNaira: o.subtotal / 100,
        discountNaira: o.discountTotal / 100,
        shippingNaira: o.shippingFee / 100,
        totalNaira: o.grandTotal / 100,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
      }));
    } else if (report === 'stock') {
      if (!req.user.capabilities.has('reports.view_stock') && !req.user.capabilities.has('reports.view_products')) {
        res.status(403).json({ message: 'Missing permission' });
        return;
      }
      const canCosts = req.user.capabilities.has('inventory.view_costs');
      const levels = await this.prisma.stockLevel.findMany({
        include: { variant: { include: { product: { select: { name: true, category: { select: { name: true } } } } } } },
      });
      rows = levels.map((l) => ({
        sku: l.variant.sku,
        product: l.variant.product.name,
        category: l.variant.product.category.name,
        onHand: Number(l.onHand),
        reserved: Number(l.reserved),
        available: Number(l.onHand) - Number(l.reserved),
        ...(canCosts ? { costValueNaira: (Number(l.onHand) * (l.variant.costPrice ?? 0)) / 100 } : {}),
      }));
    } else {
      res.status(400).json({ message: `Unknown report: ${report}` });
      return;
    }

    await this.prisma.exportLog.create({
      data: { userId: req.user.id, report, filters: { period, from, to } as never, rows: rows.length },
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${report}-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(toCsv(rows));
  }

  @Get('export-log')
  @Cap('reports.view_export_log')
  exportLog() {
    return this.prisma.exportLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  }
}
