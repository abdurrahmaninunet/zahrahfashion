import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Metric service — Reports FR-MET / Dashboard Business Rule 4 ("one number,
 * one truth"): every ₦ figure on the dashboard and in reports comes from here.
 *
 * Metric definitions (FR-MET-02):
 * - gross_revenue: sum of grand totals of orders confirmed in the period
 *   (status ≥ CONFIRMED at read time, excluding CANCELLED).
 * - orders: count of those orders. aov = gross_revenue / orders.
 * - net_sales: gross_revenue − processed refunds in period.
 * - gross_margin: net line revenue − COGS from cost snapshots.
 */

export interface Period {
  from: Date;
  to: Date;
}

export const METRIC_DEFINITIONS: Record<string, string> = {
  gross_revenue: 'Sum of order totals (goods + shipping − discounts) for orders confirmed in the period. Unpaid and cancelled orders are excluded.',
  orders: 'Number of orders confirmed in the period.',
  aov: 'Average order value: gross revenue ÷ orders.',
  net_sales: 'Gross revenue minus refunds processed in the period.',
  gross_margin: 'Product revenue minus cost of goods sold (from cost snapshots at sale time). Excludes shipping.',
  shipping_collected: 'Delivery fees collected on confirmed orders — reported as its own line, outside product revenue (D-35).',
};

const CONFIRMED_STATUSES = ['CONFIRMED', 'PROCESSING', 'PARTIALLY_SHIPPED', 'SHIPPED', 'DELIVERED', 'COMPLETED'] as const;

@Injectable()
export class MetricsService {
  constructor(private prisma: PrismaService) {}

  resolvePeriod(preset: string, customFrom?: string, customTo?: string): { period: Period; compare: Period } {
    const now = new Date();
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const days = (n: number) => n * 86_400_000;

    let from: Date;
    let to: Date = now;
    switch (preset) {
      case 'yesterday': {
        const today = startOfDay(now);
        from = new Date(today.getTime() - days(1));
        to = today;
        break;
      }
      case 'last7':
        from = new Date(startOfDay(now).getTime() - days(6));
        break;
      case 'last30':
        from = new Date(startOfDay(now).getTime() - days(29));
        break;
      case 'this_month':
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'custom':
        from = customFrom ? new Date(customFrom) : startOfDay(now);
        to = customTo ? new Date(customTo) : now;
        break;
      case 'today':
      default:
        from = startOfDay(now);
    }

    const length = to.getTime() - from.getTime();
    // "today" compares to the same weekday last week (Dashboard BR-02).
    const compareShift = preset === 'today' || preset === 'yesterday' ? days(7) : length;
    return {
      period: { from, to },
      compare: { from: new Date(from.getTime() - compareShift), to: new Date(to.getTime() - compareShift) },
    };
  }

  private async coreNumbers(period: Period) {
    const orders = await this.prisma.order.aggregate({
      where: { status: { in: CONFIRMED_STATUSES as never }, confirmedAt: { gte: period.from, lt: period.to } },
      _sum: { grandTotal: true, shippingFee: true, discountTotal: true },
      _count: true,
    });
    const refunds = await this.prisma.refund.aggregate({
      where: { status: 'processed', processedAt: { gte: period.from, lt: period.to } },
      _sum: { amount: true },
    });
    const cogs = await this.prisma.$queryRaw<{ revenue: string | null; cogs: string | null }[]>`
      SELECT SUM(ol.line_total) AS revenue,
             SUM(COALESCE(ol.cost_snapshot, 0) * ol.quantity) AS cogs
      FROM order_lines ol
      JOIN orders o ON o.id = ol.order_id
      WHERE o.status::text = ANY(${CONFIRMED_STATUSES as never}::text[])
        AND o.confirmed_at >= ${period.from} AND o.confirmed_at < ${period.to}`;

    const gross = orders._sum.grandTotal ?? 0;
    const count = orders._count;
    const lineRevenue = Number(cogs[0]?.revenue ?? 0);
    const lineCogs = Number(cogs[0]?.cogs ?? 0);
    return {
      gross_revenue: gross,
      orders: count,
      aov: count > 0 ? Math.round(gross / count) : 0,
      net_sales: gross - (refunds._sum.amount ?? 0),
      refunds: refunds._sum.amount ?? 0,
      shipping_collected: orders._sum.shippingFee ?? 0,
      discounts: orders._sum.discountTotal ?? 0,
      gross_margin: lineRevenue - lineCogs,
      cogs: lineCogs,
    };
  }

  async kpis(period: Period, compare: Period, includeMargin: boolean) {
    const [current, previous] = await Promise.all([this.coreNumbers(period), this.coreNumbers(compare)]);
    const delta = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : null);
    const result: Record<string, { value: number; delta: number | null; definition: string }> = {
      gross_revenue: { value: current.gross_revenue, delta: delta(current.gross_revenue, previous.gross_revenue), definition: METRIC_DEFINITIONS.gross_revenue },
      orders: { value: current.orders, delta: delta(current.orders, previous.orders), definition: METRIC_DEFINITIONS.orders },
      aov: { value: current.aov, delta: delta(current.aov, previous.aov), definition: METRIC_DEFINITIONS.aov },
      net_sales: { value: current.net_sales, delta: delta(current.net_sales, previous.net_sales), definition: METRIC_DEFINITIONS.net_sales },
    };
    if (includeMargin) {
      result.gross_margin = { value: current.gross_margin, delta: delta(current.gross_margin, previous.gross_margin), definition: METRIC_DEFINITIONS.gross_margin };
    }
    return result;
  }

  /** Hourly bars for a single day; daily otherwise (FR-KPI-04). */
  async trend(period: Period, channelSplit: boolean) {
    const singleDay = period.to.getTime() - period.from.getTime() <= 86_400_000 + 60_000;
    const bucket = singleDay ? 'hour' : 'day';
    const rows = await this.prisma.$queryRawUnsafe<{ bucket: Date; channel: string; revenue: string; orders: string }[]>(
      `SELECT date_trunc('${bucket}', confirmed_at) AS bucket, channel::text AS channel,
              SUM(grand_total) AS revenue, COUNT(*) AS orders
       FROM orders
       WHERE status::text = ANY($1::text[]) AND confirmed_at >= $2 AND confirmed_at < $3
       GROUP BY 1, 2 ORDER BY 1`,
      CONFIRMED_STATUSES,
      period.from,
      period.to,
    );
    if (!channelSplit) {
      const merged = new Map<string, { bucket: string; revenue: number; orders: number }>();
      for (const r of rows) {
        const key = r.bucket.toISOString();
        const entry = merged.get(key) ?? { bucket: key, revenue: 0, orders: 0 };
        entry.revenue += Number(r.revenue);
        entry.orders += Number(r.orders);
        merged.set(key, entry);
      }
      return { granularity: bucket, series: Array.from(merged.values()) };
    }
    return {
      granularity: bucket,
      series: rows.map((r) => ({ bucket: r.bucket.toISOString(), channel: r.channel, revenue: Number(r.revenue), orders: Number(r.orders) })),
    };
  }

  async topProducts(period: Period, limit = 5) {
    const rows = await this.prisma.$queryRaw<{ name: string; sku: string; revenue: string; units: string }[]>`
      SELECT ol.product_name_snapshot AS name, ol.sku_snapshot AS sku,
             SUM(ol.line_total) AS revenue, SUM(ol.quantity) AS units
      FROM order_lines ol
      JOIN orders o ON o.id = ol.order_id
      WHERE o.status::text = ANY(${CONFIRMED_STATUSES as never}::text[])
        AND o.confirmed_at >= ${period.from} AND o.confirmed_at < ${period.to}
      GROUP BY 1, 2 ORDER BY revenue DESC LIMIT ${limit}`;
    return rows.map((r) => ({ name: r.name, sku: r.sku, revenue: Number(r.revenue), units: Number(r.units) }));
  }

  async channelSplit(period: Period) {
    const rows = await this.prisma.order.groupBy({
      by: ['channel'],
      where: { status: { in: CONFIRMED_STATUSES as never }, confirmedAt: { gte: period.from, lt: period.to } },
      _sum: { grandTotal: true },
      _count: true,
    });
    return rows.map((r) => ({ channel: r.channel, revenue: r._sum.grandTotal ?? 0, orders: r._count }));
  }
}
