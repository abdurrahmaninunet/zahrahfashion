import { Controller, Get, Post, Param, Query, Req } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { MetricsService } from './metrics.service';
import { AuthedRequest } from '../auth/auth.types';
import { tryNormalizePhone } from '../customers/phone';

/**
 * Batched dashboard endpoint (FR-CMP-03): one call returns every widget the
 * caller may see; unauthorized widgets are absent, never empty shells (BR-01).
 */
@Controller('dashboard')
export class DashboardController {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
    private metrics: MetricsService,
  ) {}

  @Get()
  async dashboard(
    @Req() req: AuthedRequest,
    @Query('period') periodPreset = 'today',
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const caps = req.user.capabilities;
    const asOf = new Date();
    const { period, compare } = this.metrics.resolvePeriod(periodPreset, from, to);
    const widgets: Record<string, unknown> = {};

    const salesAmounts = await this.settings.get<boolean>('dashboard.sales_staff_amounts');
    const seesRevenue = caps.has('reports.view_sales');
    const seesMargin = caps.has('reports.view_margin');

    const tasks: Promise<void>[] = [];

    if (seesRevenue) {
      tasks.push(
        this.metrics.kpis(period, compare, seesMargin).then((kpis) => {
          widgets.kpi_row = { kpis, asOf };
        }),
        this.metrics.trend(period, false).then((trend) => {
          widgets.revenue_trend = { ...trend, asOf };
        }),
        this.metrics.topProducts(period).then((products) => {
          widgets.top_products = { products, asOf };
        }),
        this.metrics.channelSplit(period).then((channels) => {
          widgets.channel_split = { channels, asOf };
        }),
      );
    }

    if (caps.has('orders.view')) {
      tasks.push(
        this.orderCounts().then((counts) => {
          widgets.orders_status_strip = {
            byStatus: counts.byStatus,
            showAmounts: seesRevenue || salesAmounts,
            asOf,
          };
          if (caps.has('orders.fulfil') || caps.has('reports.view_ops') || seesRevenue) {
            widgets.shipments_today = { ...counts.shipmentsToday, asOf };
          }
        }),
      );
    }

    if (caps.has('inventory.view')) {
      tasks.push(
        this.prisma.stockAlert.groupBy({ by: ['type'], where: { status: 'active' }, _count: true }).then((alerts) => {
          widgets.stock_alerts = {
            counts: Object.fromEntries(alerts.map((a) => [a.type, a._count])),
            asOf,
          };
        }),
      );
    }

    if (caps.has('discounts.view')) {
      tasks.push(
        this.prisma.promotion.findMany({
          where: { status: 'active' },
          select: { id: true, name: true, scope: true, conditions: true },
          take: 10,
        }).then((promos) => {
          // D-49: name, scope, ends-in — no cost figures on the dashboard.
          widgets.active_promotions = {
            promotions: promos.map((p) => ({
              id: p.id,
              name: p.name,
              scope: p.scope,
              endsAt: (p.conditions as { schedule?: { endsAt?: string } }).schedule?.endsAt ?? null,
            })),
            asOf,
          };
        }),
      );
    }

    if (caps.has('content.edit_publish')) {
      tasks.push(
        Promise.all([
          this.prisma.needsAttention.count({ where: { status: 'active' } }),
          this.prisma.contentItem.count({
            where: { status: 'scheduled', startsAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)), lt: new Date(new Date().setHours(24, 0, 0, 0)) } },
          }),
        ]).then(([attention, goingLiveToday]) => {
          widgets.content_attention = { attention, goingLiveToday, asOf };
        }),
      );
    }

    tasks.push(
      this.actionFeed(req).then((feed) => {
        widgets.action_feed = { groups: feed, asOf };
      }),
    );

    await Promise.all(tasks);

    const quickActions = await this.settings.get<Record<string, string[]>>('dashboard.quick_actions');
    widgets.quick_actions = { actions: quickActions[req.user.roleKey] ?? [], asOf };

    return { widgets, period: { preset: periodPreset, from: period.from, to: period.to }, permissionsApplied: true };
  }

  private async orderCounts() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const [byStatus, out, delivered, failed] = await Promise.all([
      this.prisma.order.groupBy({ by: ['status'], _count: true, where: { status: { notIn: ['COMPLETED', 'CANCELLED', 'REFUNDED'] } } }),
      this.prisma.shipment.count({ where: { shippedAt: { gte: startOfDay } } }),
      this.prisma.shipment.count({ where: { deliveredAt: { gte: startOfDay } } }),
      this.prisma.shipment.count({ where: { status: 'failed', createdAt: { gte: startOfDay } } }),
    ]);
    return {
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
      shipmentsToday: { out, delivered, failed },
    };
  }

  /** Action feed (FR-ACT): priority classes, counts, oldest ages, deep links. */
  private async actionFeed(req: AuthedRequest) {
    const caps = req.user.capabilities;
    const agingHours = await this.settings.get<number>('orders.aging_confirmed_hours');

    interface Entry { key: string; label: string; count: number; oldestAt: Date | null; link: string }
    const critical: Entry[] = [];
    const customerWaiting: Entry[] = [];
    const housekeeping: Entry[] = [];

    if (caps.has('orders.view')) {
      const [transfer, pod, failed, aging] = await Promise.all([
        this.prisma.order.aggregate({ where: { status: 'PENDING_PAYMENT', paymentMethod: 'transfer' }, _count: true, _min: { placedAt: true } }),
        this.prisma.order.aggregate({ where: { status: { in: ['DRAFT', 'PENDING_PAYMENT'] }, paymentMethod: 'pod' }, _count: true, _min: { placedAt: true } }),
        this.prisma.order.aggregate({ where: { status: 'DELIVERY_FAILED' }, _count: true, _min: { updatedAt: true } }),
        this.prisma.order.aggregate({ where: { status: 'CONFIRMED', confirmedAt: { lt: new Date(Date.now() - agingHours * 3_600_000) } }, _count: true, _min: { confirmedAt: true } }),
      ]);
      if (caps.has('orders.confirm_transfer') && transfer._count > 0) {
        customerWaiting.push({ key: 'awaiting_transfer', label: 'Transfers awaiting confirmation', count: transfer._count, oldestAt: transfer._min.placedAt, link: '/orders?queue=awaiting_transfer' });
      }
      if (caps.has('orders.confirm_pod') && pod._count > 0) {
        customerWaiting.push({ key: 'pod_to_confirm', label: 'POD orders awaiting confirmation', count: pod._count, oldestAt: pod._min.placedAt, link: '/orders?queue=pod_to_confirm' });
      }
      if (failed._count > 0) {
        customerWaiting.push({ key: 'delivery_failed', label: 'Delivery failures awaiting decision', count: failed._count, oldestAt: failed._min.updatedAt, link: '/orders?queue=delivery_failed' });
      }
      if (aging._count > 0) {
        housekeeping.push({ key: 'aging', label: `Confirmed > ${agingHours}h unshipped`, count: aging._count, oldestAt: aging._min.confirmedAt, link: '/orders?queue=aging' });
      }
    }

    if (caps.has('orders.refund_request')) {
      const [refunds, returns] = await Promise.all([
        this.prisma.refund.aggregate({ where: { status: 'pending' }, _count: true, _min: { createdAt: true } }),
        this.prisma.return.aggregate({ where: { status: 'REQUESTED' }, _count: true, _min: { requestedAt: true } }),
      ]);
      if (refunds._count > 0) {
        customerWaiting.push({ key: 'refunds_pending', label: 'Refunds pending approval', count: refunds._count, oldestAt: refunds._min.createdAt, link: '/orders/refunds' });
      }
      if (returns._count > 0) {
        customerWaiting.push({ key: 'returns_requested', label: 'Return requests', count: returns._count, oldestAt: returns._min.requestedAt, link: '/orders/returns' });
      }
    }

    if (caps.has('inventory.view')) {
      const [out, low] = await Promise.all([
        this.prisma.stockAlert.aggregate({ where: { status: 'active', type: 'out_of_stock' }, _count: true, _min: { createdAt: true } }),
        this.prisma.stockAlert.aggregate({ where: { status: 'active', type: { in: ['low_stock', 'bundle_low'] } }, _count: true, _min: { createdAt: true } }),
      ]);
      if (out._count > 0) {
        critical.push({ key: 'out_of_stock', label: 'Out of stock on active products', count: out._count, oldestAt: out._min.createdAt, link: '/inventory?filter=out' });
      }
      if (low._count > 0) {
        housekeeping.push({ key: 'low_stock', label: 'Low-stock alerts', count: low._count, oldestAt: low._min.createdAt, link: '/inventory?filter=low' });
      }
    }

    if (caps.has('content.edit_publish')) {
      const attention = await this.prisma.needsAttention.aggregate({ where: { status: 'active' }, _count: true, _min: { createdAt: true } });
      if (attention._count > 0) {
        housekeeping.push({ key: 'content_attention', label: 'Content needs attention', count: attention._count, oldestAt: attention._min.createdAt, link: '/content?tab=attention' });
      }
    }

    if (caps.has('settings.view_audit')) {
      const repricing = await this.prisma.order.count({ where: { flags: { path: ['repricingReview'], equals: true } } });
      if (repricing > 0) {
        critical.push({ key: 'repricing_review', label: 'Orders flagged for repricing review', count: repricing, oldestAt: null, link: '/orders?flag=repricing' });
      }
    }

    // A4-FR-03: overdue support follow-ups (Housekeeping class).
    if (caps.has('customers.notes_tags')) {
      const followUps = await this.prisma.supportInteraction.aggregate({
        where: { followUpStatus: 'due', followUpAt: { lte: new Date() } },
        _count: true,
        _min: { followUpAt: true },
      });
      if (followUps._count > 0) {
        housekeeping.push({ key: 'support_followups', label: 'Support follow-ups due', count: followUps._count, oldestAt: followUps._min.followUpAt, link: '/customers?tab=followups' });
      }
    }

    // Ordering per BR-05: class asc, oldest age desc within class.
    const byAge = (a: Entry, b: Entry) => (a.oldestAt?.getTime() ?? Infinity) - (b.oldestAt?.getTime() ?? Infinity);
    return [
      { class: 'critical', label: 'Critical', entries: critical.sort(byAge) },
      { class: 'customer_waiting', label: 'Customer waiting', entries: customerWaiting.sort(byAge) },
      { class: 'housekeeping', label: 'Housekeeping', entries: housekeeping.sort(byAge) },
    ].filter((g) => g.entries.length > 0);
  }

  // ── Global search (FR-SRC) ─────────────────────────────────────────────────

  @Get('search')
  async search(@Req() req: AuthedRequest, @Query('q') q?: string) {
    if (!q || q.trim().length < 2) return { orders: [], products: [], customers: [] };
    const caps = req.user.capabilities;
    const phone = tryNormalizePhone(q);
    const results: { orders: unknown[]; products: unknown[]; customers: unknown[] } = { orders: [], products: [], customers: [] };

    const tasks: Promise<void>[] = [];
    if (caps.has('orders.view')) {
      tasks.push(
        this.prisma.order.findMany({
          where: {
            OR: [
              { orderNumber: { contains: q.toUpperCase() } },
              ...(phone ? [{ customer: { primaryPhone: phone } }] : [{ customer: { fullName: { contains: q, mode: 'insensitive' as const } } }]),
            ],
          },
          select: { id: true, orderNumber: true, status: true, grandTotal: true, customer: { select: { fullName: true } }, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }).then((rows) => {
          results.orders = rows;
        }),
      );
    }
    if (caps.has('products.view')) {
      tasks.push(
        this.prisma.product.findMany({
          where: {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { variants: { some: { sku: { contains: q, mode: 'insensitive' } } } },
            ],
          },
          select: { id: true, name: true, status: true, type: true },
          take: 5,
        }).then((rows) => {
          results.products = rows;
        }),
      );
    }
    if (caps.has('customers.view')) {
      tasks.push(
        this.prisma.customer.findMany({
          where: {
            anonymizedAt: null,
            OR: phone
              ? [{ primaryPhone: phone }, { altPhone: phone }]
              : [{ fullName: { contains: q, mode: 'insensitive' } }, { email: { contains: q.toLowerCase() } }],
          },
          select: { id: true, fullName: true, primaryPhone: true, status: true },
          take: 5,
        }).then((rows) => {
          results.customers = rows;
        }),
      );
    }
    await Promise.all(tasks);
    return results;
  }

  // ── Notifications bell (FR-NTF) ────────────────────────────────────────────

  @Get('notifications')
  async notifications(@Req() req: AuthedRequest) {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const [items, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId: req.user.id, createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.notification.count({ where: { userId: req.user.id, readAt: null, createdAt: { gte: since } } }),
    ]);
    return { items, unread };
  }

  @Post('notifications/:id/read')
  async markRead(@Param('id') id: string, @Req() req: AuthedRequest) {
    await this.prisma.notification.updateMany({
      where: { id, userId: req.user.id },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  @Post('notifications/read-all')
  async markAllRead(@Req() req: AuthedRequest) {
    await this.prisma.notification.updateMany({
      where: { userId: req.user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }
}
