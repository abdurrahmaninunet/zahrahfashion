import { BadRequestException, Body, Controller, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { Cap, Public } from '../auth/decorators';
import { AuthedRequest } from '../auth/auth.types';
import { parse } from '../common/zod';
import { tryNormalizePhone } from '../customers/phone';

const manualOrderSchema = z.object({
  customerId: z.string().optional(),
  customer: z.object({ phone: z.string(), name: z.string().optional(), email: z.string().email().nullable().optional() }).optional(),
  channel: z.enum(['whatsapp', 'instagram', 'phone', 'in_store', 'web']),
  lines: z.array(z.object({
    variantId: z.string().optional(),
    bundleProductId: z.string().optional(),
    quantity: z.number().positive(),
  })).min(1),
  addressId: z.string().optional(),
  address: z.object({ addressLine: z.string(), area: z.string().optional(), city: z.string().optional() }).optional(),
  zoneId: z.string().nullable().optional(),
  deliveryMethod: z.enum(['rider', '3pl', 'pickup']).optional(),
  paymentMethod: z.enum(['gateway', 'transfer', 'pod']).optional(),
  code: z.string().nullable().optional(),
  manualDiscount: z.object({
    valueType: z.enum(['percent', 'fixed']),
    value: z.number().positive(),
    reason: z.string().min(1).max(300),
  }).optional(),
  noteInternal: z.string().max(2000).optional(),
});

const shipSchema = z.object({
  method: z.enum(['rider', '3pl', 'pickup']),
  carrier: z.string().optional(),
  trackingRef: z.string().optional(),
  riderName: z.string().optional(),
  riderPhone: z.string().optional(),
  riderId: z.string().optional(),
  lines: z.array(z.object({ orderLineId: z.string(), quantity: z.number().positive() })).min(1),
});

const refundSchema = z.object({
  scope: z.enum(['full', 'partial', 'per_line']),
  amount: z.number().int().positive(),
  reasonCode: z.string().min(1),
  note: z.string().max(1000).optional(),
  method: z.enum(['gateway_reversal', 'manual_transfer']),
  lines: z.array(z.object({ orderLineId: z.string(), quantity: z.number().positive(), amount: z.number().int().min(0) })).optional(),
});

@Controller('orders')
export class OrdersController {
  constructor(
    private orders: OrdersService,
    private prisma: PrismaService,
    private settings: SettingsService,
  ) {}

  // ── List, queues, counts (FR-LST, BR-14) ───────────────────────────────────

  @Get()
  @Cap('orders.view')
  async list(
    @Req() req: AuthedRequest,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('channel') channel?: string,
    @Query('zoneId') zoneId?: string,
    @Query('queue') queue?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('store') store?: string,
    @Query('page') page?: string,
  ) {
    const pageNum = Math.max(1, Number(page) || 1);
    const pageSize = 25;

    let where: Prisma.OrderWhereInput = {
      ...(status ? { status: status as never } : {}),
      ...(paymentStatus ? { paymentStatus: paymentStatus as never } : {}),
      ...(channel ? { channel: channel as never } : {}),
      ...(zoneId ? { deliveryZoneId: zoneId } : {}),
      // MIM store: orders that contain at least one MIM (custom-printing) item.
      ...(store === 'mim' ? { lines: { some: { variant: { product: { flags: { path: ['mim'], equals: true } } } } } } : {}),
      createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) },
    };

    // Saved queues (BR-14 / Dashboard action feed deep links).
    const agingConfirmedHours = await this.settings.get<number>('orders.aging_confirmed_hours');
    switch (queue) {
      case 'awaiting_transfer':
        where = { ...where, status: 'PENDING_PAYMENT', paymentMethod: 'transfer' };
        break;
      case 'pod_to_confirm':
        where = { ...where, status: { in: ['DRAFT', 'PENDING_PAYMENT'] }, paymentMethod: 'pod' };
        break;
      case 'ready_to_process':
        where = { ...where, status: 'CONFIRMED' };
        break;
      case 'ready_to_ship':
        where = { ...where, status: { in: ['PROCESSING', 'PARTIALLY_SHIPPED'] } };
        break;
      case 'out_today':
        where = { ...where, status: { in: ['SHIPPED', 'PARTIALLY_SHIPPED'] } };
        break;
      case 'delivery_failed':
        where = { ...where, status: 'DELIVERY_FAILED' };
        break;
      case 'aging':
        where = { ...where, status: 'CONFIRMED', confirmedAt: { lt: new Date(Date.now() - agingConfirmedHours * 3_600_000) } };
        break;
      case 'drafts':
        where = { ...where, status: 'DRAFT' };
        break;
    }

    if (q) {
      const phone = tryNormalizePhone(q);
      where = {
        ...where,
        OR: [
          { orderNumber: { contains: q.toUpperCase() } },
          { customer: phone ? { primaryPhone: phone } : { fullName: { contains: q, mode: 'insensitive' } } },
          { lines: { some: { skuSnapshot: { contains: q, mode: 'insensitive' } } } },
        ],
      };
    }

    const [total, rows] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: {
          customer: { select: { id: true, fullName: true, primaryPhone: true } },
          deliveryZone: { select: { name: true } },
          lines: { select: { productNameSnapshot: true, quantity: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    // D-33/D-45: Sales staff see counts without ₦ unless the setting relaxes it.
    const showAmounts =
      req.user.capabilities.has('reports.view_amounts') ||
      req.user.capabilities.has('reports.view_sales') ||
      (await this.settings.get<boolean>('dashboard.sales_staff_amounts'));

    return {
      total,
      page: pageNum,
      pageSize,
      rows: rows.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        createdAt: o.createdAt,
        customer: o.customer,
        channel: o.channel,
        itemsSummary: o.lines.map((l) => `${Number(l.quantity)}× ${l.productNameSnapshot}`).slice(0, 3).join(', '),
        lineCount: o.lines.length,
        grandTotal: showAmounts ? o.grandTotal : null,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        status: o.status,
        zone: o.deliveryZone?.name ?? null,
        flags: o.flags,
      })),
    };
  }

  /** Queue counts for dashboard strips and the action feed aggregator. */
  @Get('counts')
  @Cap('orders.view')
  async counts() {
    const agingConfirmedHours = await this.settings.get<number>('orders.aging_confirmed_hours');
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [byStatus, awaitingTransfer, podToConfirm, refundsPending, returnsRequested, deliveryFailed, aging, shippedToday, deliveredToday, failedToday] = await Promise.all([
      this.prisma.order.groupBy({ by: ['status'], _count: true, where: { status: { notIn: ['COMPLETED', 'CANCELLED', 'REFUNDED'] } } }),
      this.prisma.order.aggregate({ where: { status: 'PENDING_PAYMENT', paymentMethod: 'transfer' }, _count: true, _min: { placedAt: true } }),
      this.prisma.order.aggregate({ where: { status: { in: ['DRAFT', 'PENDING_PAYMENT'] }, paymentMethod: 'pod' }, _count: true, _min: { placedAt: true } }),
      this.prisma.refund.aggregate({ where: { status: 'pending' }, _count: true, _min: { createdAt: true } }),
      this.prisma.return.aggregate({ where: { status: 'REQUESTED' }, _count: true, _min: { requestedAt: true } }),
      this.prisma.order.aggregate({ where: { status: 'DELIVERY_FAILED' }, _count: true, _min: { updatedAt: true } }),
      this.prisma.order.aggregate({ where: { status: 'CONFIRMED', confirmedAt: { lt: new Date(Date.now() - agingConfirmedHours * 3_600_000) } }, _count: true, _min: { confirmedAt: true } }),
      this.prisma.shipment.count({ where: { shippedAt: { gte: startOfDay } } }),
      this.prisma.shipment.count({ where: { deliveredAt: { gte: startOfDay } } }),
      this.prisma.shipment.count({ where: { status: 'failed', createdAt: { gte: startOfDay } } }),
    ]);

    return {
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
      queues: {
        awaiting_transfer: { count: awaitingTransfer._count, oldestAt: awaitingTransfer._min.placedAt },
        pod_to_confirm: { count: podToConfirm._count, oldestAt: podToConfirm._min.placedAt },
        refunds_pending: { count: refundsPending._count, oldestAt: refundsPending._min.createdAt },
        returns_requested: { count: returnsRequested._count, oldestAt: returnsRequested._min.requestedAt },
        delivery_failed: { count: deliveryFailed._count, oldestAt: deliveryFailed._min.updatedAt },
        aging: { count: aging._count, oldestAt: aging._min.confirmedAt },
      },
      shipmentsToday: { out: shippedToday, delivered: deliveredToday, failed: failedToday },
    };
  }

  @Get('refunds/pending')
  @Cap('orders.view')
  pendingRefunds() {
    return this.prisma.refund.findMany({
      where: { status: 'pending' },
      include: { order: { select: { id: true, orderNumber: true, grandTotal: true, customer: { select: { fullName: true } } } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  @Get(':id')
  @Cap('orders.view')
  async detail(@Param('id') id: string, @Req() req: AuthedRequest) {
    const order = await this.orders.detail(id);
    if (!order) throw new BadRequestException('Order not found');
    const manualDiscounts = await this.prisma.manualDiscount.findMany({ where: { orderId: id } });
    return { ...order, manualDiscounts };
  }

  /** Invoice/receipt data (FR-DOC-01) — rendered printable by the admin app. */
  @Get(':id/invoice')
  @Cap('orders.view')
  async invoice(@Param('id') id: string) {
    const order = await this.orders.detail(id);
    if (!order) throw new BadRequestException('Order not found');
    if (['DRAFT'].includes(order.status)) throw new BadRequestException('Invoices are available from confirmation onward');
    const store = await this.settings.getMany(['store.name', 'store.address', 'store.phone', 'store.email', 'store.logo_url']);
    // No bank details on the invoice: web pays via Paystack; other channels get payment
    // details relayed manually over that chat, then staff confirm the transfer in the portal.
    return { store, order };
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  @Post()
  @Cap('orders.create_manual')
  create(@Body() body: unknown, @Req() req: AuthedRequest) {
    return this.orders.createManualOrder(req.user, parse(manualOrderSchema, body) as never);
  }

  @Post(':id/confirm-draft')
  @Cap('orders.create_manual')
  confirmDraft(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.orders.confirmDraft(req.user, id);
  }

  @Post(':id/confirm-transfer')
  @Cap('orders.confirm_transfer')
  confirmTransfer(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    const data = parse(z.object({ payerName: z.string().min(1), reference: z.string().optional(), amount: z.number().int().positive().optional() }), body);
    return this.orders.confirmTransfer(req.user, id, data);
  }

  @Post(':id/confirm-pod')
  @Cap('orders.confirm_pod')
  confirmPod(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.orders.confirmPod(req.user, id);
  }

  /** Local stand-in for the Paystack webhook (signature-verified in production). */
  @Public()
  @Post('webhook/paystack')
  async paystackWebhook(@Body() body: unknown) {
    const { orderId, reference } = parse(z.object({ orderId: z.string(), reference: z.string() }), body);
    return this.orders.confirmGatewayPayment(orderId, reference);
  }

  @Post(':id/process')
  @Cap('orders.fulfil')
  process(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.orders.startProcessing(req.user, id);
  }

  @Post(':id/ship')
  @Cap('orders.fulfil')
  ship(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    return this.orders.ship(req.user, id, parse(shipSchema, body) as never);
  }

  @Post(':id/shipments/:shipmentId/delivered')
  @Cap('orders.record_delivery')
  delivered(@Param('id') id: string, @Param('shipmentId') shipmentId: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    const { pod } = parse(
      z.object({
        pod: z.object({
          method: z.enum(['pod_cash', 'pod_transfer']),
          amount: z.number().int().positive(),
          collector: z.string().optional(),
        }).optional(),
      }),
      body,
    );
    return this.orders.recordDelivery(req.user, id, shipmentId, pod);
  }

  @Post(':id/shipments/:shipmentId/failed')
  @Cap('orders.record_delivery')
  failed(@Param('id') id: string, @Param('shipmentId') shipmentId: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    const { reason, customerCaused } = parse(z.object({ reason: z.string().min(1), customerCaused: z.boolean().default(false) }), body);
    return this.orders.deliveryFailed(req.user, id, shipmentId, reason, customerCaused ?? false);
  }

  @Post(':id/reattempt')
  @Cap('orders.fulfil')
  reattempt(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.orders.reattemptDelivery(req.user, id);
  }

  @Post(':id/cancel')
  async cancel(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    if (!req.user.capabilities.has('orders.cancel') && !req.user.capabilities.has('orders.cancel_prepayment')) {
      throw new BadRequestException('Missing permission: orders.cancel');
    }
    const { reason } = parse(z.object({ reason: z.string().min(1).max(500) }), body);
    return this.orders.cancel(req.user, id, reason);
  }

  /** FR-EDT: pre-shipment edits (Sales: address/notes only). */
  @Put(':id')
  async edit(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    const full = req.user.capabilities.has('orders.edit');
    const limited = req.user.capabilities.has('orders.edit_limited');
    if (!full && !limited) throw new BadRequestException('Missing permission: orders.edit');

    const order = await this.orders.detail(id);
    if (!order) throw new BadRequestException('Order not found');
    if (['SHIPPED', 'PARTIALLY_SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'REFUNDED'].includes(order.status)) {
      throw new BadRequestException('Orders cannot be edited after shipment');
    }

    const schema = z.object({
      address: z.object({ addressLine: z.string(), area: z.string().optional(), city: z.string().optional() }).optional(),
      zoneId: z.string().nullable().optional(),
      deliveryMethod: z.enum(['rider', '3pl', 'pickup']).optional(),
    });
    const data = parse(schema, body);
    const raw = await this.prisma.order.findUniqueOrThrow({ where: { id } });
    const before = { address: order.address, zoneId: order.deliveryZoneId, deliveryMethod: order.deliveryMethod, shippingFee: raw.shippingFee, grandTotal: raw.grandTotal };

    // Effective delivery method + zone after this edit.
    const method = data.deliveryMethod ?? raw.deliveryMethod;
    const zoneId = data.zoneId !== undefined ? data.zoneId : raw.deliveryZoneId;
    const zone = zoneId ? await this.prisma.zone.findUnique({ where: { id: zoneId } }) : null;

    // Recompute shipping + grand total so the money stays consistent (D-19: fee snapshots on the order).
    const shippingFee = method === 'pickup' ? 0 : zone?.deliveryFee ?? 0;
    const grandTotal = raw.subtotal - raw.discountTotal + shippingFee;

    // Keep the address snapshot's zone label in sync with the chosen zone.
    const addressSnapshot = data.address
      ? { ...data.address, zoneName: zone?.name }
      : raw.address
        ? { ...(raw.address as Record<string, unknown>), zoneName: zone?.name }
        : undefined;

    await this.prisma.order.update({
      where: { id },
      data: {
        ...(addressSnapshot ? { address: addressSnapshot as never } : {}),
        ...(data.zoneId !== undefined ? { deliveryZoneId: data.zoneId } : {}),
        ...(data.deliveryMethod ? { deliveryMethod: data.deliveryMethod } : {}),
        shippingFee,
        grandTotal,
      },
    });
    await this.orders.addEvent(id, 'edited', { before, after: { ...data, shippingFee, grandTotal } }, { type: 'user', id: req.user.id });
    return this.orders.detail(id);
  }

  @Put(':id/lines')
  async editLines(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    if (!req.user.capabilities.has('orders.edit') && !req.user.capabilities.has('orders.edit_limited')) {
      throw new BadRequestException('Missing permission: orders.edit');
    }
    const { lines } = parse(
      z.object({
        lines: z.array(z.object({
          variantId: z.string().optional(),
          bundleProductId: z.string().optional(),
          quantity: z.number().positive(),
        })).min(1),
      }),
      body,
    );
    return this.orders.editDraftLines(req.user, id, lines);
  }

  @Post(':id/notes')
  @Cap('orders.view')
  async addNote(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    const { note } = parse(z.object({ note: z.string().min(1).max(2000) }), body);
    return this.prisma.orderNote.create({ data: { orderId: id, note, userId: req.user.id } });
  }

  // ── Refunds & returns ──────────────────────────────────────────────────────

  @Post(':id/refunds')
  @Cap('orders.refund_request')
  requestRefund(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    return this.orders.requestRefund(req.user, id, parse(refundSchema, body) as never);
  }

  @Post('refunds/:refundId/approve')
  @Cap('orders.refund_approve')
  approveRefund(@Param('refundId') refundId: string, @Req() req: AuthedRequest) {
    return this.orders.decideRefund(req.user, refundId, 'approve');
  }

  @Post('refunds/:refundId/reject')
  @Cap('orders.refund_approve')
  rejectRefund(@Param('refundId') refundId: string, @Req() req: AuthedRequest) {
    return this.orders.decideRefund(req.user, refundId, 'reject');
  }

  @Post('refunds/:refundId/process')
  @Cap('orders.refund_request')
  processRefund(@Param('refundId') refundId: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    const { gatewayRef } = parse(z.object({ gatewayRef: z.string().optional() }), body);
    return this.orders.processRefund(req.user, refundId, gatewayRef);
  }

  @Post(':id/returns')
  @Cap('orders.refund_request')
  requestReturn(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    const data = parse(
      z.object({
        reasonCode: z.string().min(1),
        storeError: z.boolean().optional(),
        lines: z.array(z.object({ orderLineId: z.string(), quantity: z.number().positive() })).min(1),
      }),
      body,
    );
    return this.orders.requestReturn(req.user, id, data as never);
  }

  @Post('returns/:returnId/approve')
  @Cap('orders.refund_approve')
  approveReturn(@Param('returnId') returnId: string, @Req() req: AuthedRequest) {
    return this.orders.decideReturn(req.user, returnId, 'approve');
  }

  @Post('returns/:returnId/reject')
  @Cap('orders.refund_approve')
  rejectReturn(@Param('returnId') returnId: string, @Req() req: AuthedRequest) {
    return this.orders.decideReturn(req.user, returnId, 'reject');
  }

  @Post('returns/:returnId/receive')
  @Cap('inventory.return_restock')
  receiveReturn(@Param('returnId') returnId: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    const { conditions } = parse(
      z.object({ conditions: z.array(z.object({ returnLineId: z.string(), condition: z.enum(['restockable', 'damaged']) })) }),
      body,
    );
    return this.orders.receiveReturn(req.user, returnId, conditions);
  }

  @Post('returns/:returnId/resolve')
  @Cap('orders.refund_request')
  resolveReturn(@Param('returnId') returnId: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    const { resolution } = parse(z.object({ resolution: z.enum(['refund', 'exchange']) }), body);
    return this.orders.resolveReturn(req.user, returnId, resolution);
  }
}
