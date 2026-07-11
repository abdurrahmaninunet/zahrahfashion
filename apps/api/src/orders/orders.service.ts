import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OrderStatus, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { InventoryService } from '../inventory/inventory.service';
import { CustomersService } from '../customers/customers.service';
import { DiscountsService } from '../discounts/discounts.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthedUser } from '../auth/auth.types';
import { canTransition } from './order-machine';
import { CartLineInput } from '../discounts/discounts.types';

const ORDER_INCLUDE = {
  lines: true,
  payments: true,
  customer: { select: { id: true, fullName: true, primaryPhone: true, email: true, status: true, metrics: true } },
  deliveryZone: true,
  shipments: { include: { lines: true } },
  refunds: { include: { lines: true } },
  returns: { include: { lines: true } },
  notes: { orderBy: { createdAt: 'desc' as const } },
  events: { orderBy: { createdAt: 'desc' as const }, take: 100 },
} satisfies Prisma.OrderInclude;

export interface ManualOrderInput {
  customerId?: string;
  customer?: { phone: string; name?: string; email?: string | null };
  channel: 'whatsapp' | 'instagram' | 'phone' | 'in_store' | 'web';
  lines: { variantId?: string; bundleProductId?: string; formatId?: string; personalization?: { mode: 'solo' | 'names' | 'design'; text?: string; names?: string[]; previewUrl?: string; spec?: unknown }; anko?: boolean; quantity: number }[];
  addressId?: string;
  address?: { addressLine: string; area?: string; city?: string };
  zoneId?: string | null;
  deliveryMethod?: 'rider' | '3pl' | 'pickup';
  paymentMethod?: 'gateway' | 'transfer' | 'pod';
  code?: string | null;
  manualDiscount?: { valueType: 'percent' | 'fixed'; value: number; reason: string };
  noteInternal?: string;
}

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
    private inventory: InventoryService,
    private customers: CustomersService,
    private discounts: DiscountsService,
    private notifications: NotificationsService,
  ) {}

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Order tax (D-tax): a store-wide percentage applied to the net product
   * subtotal (after discounts, before delivery). Shown as "Tax" at checkout and
   * added on top of the goods — never part of the product price. 0 disables it.
   */
  private async taxFor(goodsNet: number): Promise<number> {
    const rate = Number(await this.settings.get<number>('tax.rate_percent')) || 0;
    if (rate <= 0 || goodsNet <= 0) return 0;
    return Math.round((goodsNet * rate) / 100);
  }

  private async generateOrderNumber(): Promise<string> {
    // D-10: ORD-{YYMM}-{random5}
    const now = new Date();
    const yymm = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const charset = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    for (let attempt = 0; attempt < 5; attempt++) {
      let rand = '';
      for (let i = 0; i < 5; i++) rand += charset[randomBytes(1)[0] % charset.length];
      const orderNumber = `ORD-${yymm}-${rand}`;
      const clash = await this.prisma.order.findUnique({ where: { orderNumber } });
      if (!clash) return orderNumber;
    }
    throw new Error('Could not generate a unique order number');
  }

  async addEvent(
    orderId: string,
    type: string,
    payload?: Record<string, unknown>,
    actor?: { type: 'user' | 'system' | 'webhook'; id?: string | null },
  ) {
    await this.prisma.orderEvent.create({
      data: {
        orderId,
        type,
        payload: payload as never,
        actorType: actor?.type ?? 'system',
        actorId: actor?.id ?? null,
      },
    });
  }

  private async setStatus(orderId: string, from: OrderStatus, to: OrderStatus, actor?: { type: 'user' | 'system' | 'webhook'; id?: string | null }, extra?: Prisma.OrderUpdateInput) {
    if (!canTransition(from, to)) {
      throw new BadRequestException(`Invalid transition ${from} → ${to} (Order SRS §2.3)`);
    }
    await this.prisma.order.update({ where: { id: orderId }, data: { status: to, ...extra } });
    await this.addEvent(orderId, 'status_changed', { from, to }, actor);
  }

  detail(id: string) {
    return this.prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
  }

  private async requireOrder(id: string) {
    const order = await this.detail(id);
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  /** Build engine cart lines + resolve bundle explosion (A1 FR-BOR-01). */
  private async buildCart(lines: ManualOrderInput['lines']) {
    const cart: (CartLineInput & {
      name: string;
      sku: string;
      unitName: string;
      lineKind: 'standard' | 'bundle';
      bundleSnapshot?: unknown;
      componentRequirements?: { variantId: string; quantity: number }[];
    })[] = [];

    for (const line of lines) {
      if (line.bundleProductId) {
        const bundle = await this.prisma.product.findUnique({
          where: { id: line.bundleProductId },
          include: {
            bundleConfig: true,
            bundleComponents: { include: { variant: { include: { product: { select: { name: true } } } } } },
          },
        });
        if (!bundle || bundle.type === 'standard' || !bundle.bundleConfig) {
          throw new BadRequestException('Invalid bundle product');
        }
        const componentSum = bundle.bundleComponents.reduce(
          (s, c) => s + Math.round(c.variant.price * Number(c.quantity)),
          0,
        );
        const cfg = bundle.bundleConfig;
        const price = cfg.pricingMode === 'fixed'
          ? cfg.fixedPrice ?? 0
          : Math.round(componentSum * (1 - Number(cfg.percentOff ?? 0) / 100));
        const costSum = bundle.bundleComponents.reduce(
          (s, c) => s + Math.round((c.variant.costPrice ?? 0) * Number(c.quantity)),
          0,
        );
        cart.push({
          variantId: `bundle:${bundle.id}`,
          productId: bundle.id,
          categoryId: bundle.categoryId,
          categoryPath: [bundle.categoryId],
          quantity: line.quantity,
          unitPrice: price,
          costPrice: costSum,
          isBundle: true,
          bundleEligibleForPromotions: cfg.eligibleForPromotions,
          name: bundle.name,
          sku: `BNDL-${bundle.slug.toUpperCase().slice(0, 12)}`,
          unitName: 'package',
          lineKind: 'bundle',
          bundleSnapshot: bundle.bundleComponents.map((c) => ({
            variantId: c.variantId,
            sku: c.variant.sku,
            name: c.variant.product.name,
            qty: Number(c.quantity),
            unitCost: c.variant.costPrice,
          })),
          componentRequirements: bundle.bundleComponents.map((c) => ({
            variantId: c.variantId,
            quantity: Number(c.quantity) * line.quantity,
          })),
        });
        continue;
      }

      if (!line.variantId) throw new BadRequestException('Each line needs a variant or bundle');
      const variant = await this.prisma.variant.findUnique({
        where: { id: line.variantId },
        include: { product: { include: { category: true } } },
      });
      if (!variant || variant.status !== 'active') throw new BadRequestException(`Variant unavailable: ${line.variantId}`);
      await this.inventory.assertQuantityValid(line.variantId, line.quantity);

      // Category path (ancestors) for promo scope matching.
      const path: string[] = [variant.product.categoryId];
      let parent = variant.product.category.parentId;
      while (parent) {
        path.push(parent);
        const cat = await this.prisma.category.findUnique({ where: { id: parent }, select: { parentId: true } });
        parent = cat?.parentId ?? null;
      }

      const unit = variant.product.sellUnitId
        ? await this.prisma.unit.findUnique({ where: { id: variant.product.sellUnitId } })
        : null;

      // Pricing (mirror the storefront engine so the order matches the quoted
      // cart): a chosen sell format wins, else wholesale-by-quantity, else the
      // variant price. A format line consumes `baseQty` base units per unit —
      // recorded so reservation/shipping deduct from the shared base-unit pool.
      const attrVals = variant.product.attributeValues as {
        _sellFormats?: { id: string; label: string; price: number; baseQty?: number }[];
        _wholesale?: { enabled?: boolean; increment?: number; unitPrice?: number };
        _anko?: { enabled?: boolean; increment?: number; unitPrice?: number };
        _mimPrintPrice?: number;
      } | null;
      const formats = Array.isArray(attrVals?._sellFormats) ? attrVals!._sellFormats : [];
      const format = line.formatId ? formats.find((f) => f.id === line.formatId) : undefined;
      let unitPrice = variant.price;
      if (format && Number(format.price) > 0) {
        unitPrice = Number(format.price);
      } else if (line.anko && attrVals?._anko?.enabled && Number(attrVals._anko.increment) > 0 && Number(attrVals._anko.unitPrice) > 0) {
        unitPrice = Math.round(Number(attrVals._anko.unitPrice) / Number(attrVals._anko.increment));
      } else {
        const w = attrVals?._wholesale;
        // `unitPrice` is the price for one lot of `increment` units → per-unit
        // price is that divided by the increment.
        if (w?.enabled && Number(w.increment) > 0 && Number(w.unitPrice) > 0) {
          const perUnit = Math.round(Number(w.unitPrice) / Number(w.increment));
          if (Number(line.quantity) >= Number(w.increment) && perUnit < variant.price) {
            unitPrice = perUnit;
          }
        }
      }
      const baseQty = format && Number(format.baseQty) > 0 ? Number(format.baseQty) : 1;

      // MIM personalization — the text/names to print. Summarised in the line
      // name and snapshotted (structured) so fulfilment sees exactly what to print.
      const per = line.personalization;
      const perSummary = per
        ? per.mode === 'names'
          ? ` — ${(per.names ?? []).length} names`
          : per.mode === 'design'
            ? (per.text ? ` — custom design (${per.text})` : ' — custom design')
            : per.text ? ` — “${per.text}”` : ''
        : '';
      // MIM printing surcharge — added per unit when the line is personalised.
      if (per && Number(attrVals?._mimPrintPrice) > 0) {
        unitPrice += Math.round(Number(attrVals!._mimPrintPrice));
      }

      cart.push({
        variantId: variant.id,
        productId: variant.productId,
        categoryId: variant.product.categoryId,
        categoryPath: path,
        quantity: line.quantity,
        unitPrice,
        costPrice: variant.costPrice,
        name: variant.product.name + (format ? ` — ${format.label}` : '') + perSummary,
        sku: variant.sku,
        unitName: format ? format.label : (unit?.name ?? 'piece'),
        lineKind: 'standard',
        // Snapshot: format base-unit consumption (array) OR MIM personalization
        // (object). A line is one or the other; both live in bundleComponentsSnapshot.
        ...(format && baseQty !== 1
          ? { bundleSnapshot: [{ variantId: variant.id, sku: variant.sku, name: variant.product.name, qty: baseQty, unitCost: variant.costPrice }] }
          : per
            ? { bundleSnapshot: { personalization: per } }
            : {}),
      });
    }
    return cart;
  }

  /** Inventory line requirements: standard lines + exploded bundle components. */
  private inventoryLines(order: { lines: { variantId: string | null; lineKind: string; quantity: unknown; bundleComponentsSnapshot: unknown }[] }) {
    const req = new Map<string, number>();
    for (const line of order.lines) {
      // A stock-consumption breakdown (bundle components, or a sell-format line's
      // base-unit requirement) takes precedence; otherwise reserve the line qty.
      // (MIM personalization snapshots are objects, not arrays — ignored here.)
      const snap = line.bundleComponentsSnapshot;
      const components = Array.isArray(snap) ? (snap as { variantId: string; qty: number }[]) : [];
      if (components.length) {
        for (const c of components) {
          req.set(c.variantId, (req.get(c.variantId) ?? 0) + c.qty * Number(line.quantity));
        }
      } else if (line.variantId) {
        req.set(line.variantId, (req.get(line.variantId) ?? 0) + Number(line.quantity));
      }
    }
    return Array.from(req.entries()).map(([variantId, quantity]) => ({ variantId, quantity }));
  }

  // ── Intake (FR-INT) ────────────────────────────────────────────────────────

  async createManualOrder(user: AuthedUser, input: ManualOrderInput) {
    // Customer
    let customerId = input.customerId ?? null;
    if (!customerId && input.customer) {
      const result = await this.customers.findOrCreate({
        phone: input.customer.phone,
        email: input.customer.email,
        name: input.customer.name,
        source: 'manual_order',
      });
      customerId = result.customerId;
    }
    if (!customerId) throw new BadRequestException('A customer is required');

    // risk_check (FR-CUS-06)
    const risk = await this.customers.riskCheck({ customerId });
    if (risk.status === 'blocked') throw new BadRequestException(`Customer is blocked: ${risk.reason ?? 'no reason recorded'}`);

    const cart = await this.buildCart(input.lines);
    const customer = await this.prisma.customer.findUniqueOrThrow({
      where: { id: customerId },
      include: { tags: true, addresses: true },
    });
    const metrics = (customer.metrics as { orders?: number } | null) ?? {};

    // Zone + shipping fee
    let zone = input.zoneId ? await this.prisma.zone.findUnique({ where: { id: input.zoneId } }) : null;
    let addressSnapshot: Record<string, unknown> | null = null;
    if (input.addressId) {
      const addr = customer.addresses.find((a) => a.id === input.addressId);
      if (!addr) throw new BadRequestException('Address not found on customer');
      if (!zone && addr.zoneId) zone = await this.prisma.zone.findUnique({ where: { id: addr.zoneId } });
      addressSnapshot = { label: addr.label, line: addr.addressLine, area: addr.area, city: addr.city, zoneName: zone?.name };
    } else if (input.address) {
      addressSnapshot = { ...input.address, zoneName: zone?.name };
    }
    const shippingFee = input.deliveryMethod === 'pickup' ? 0 : zone?.deliveryFee ?? 0;

    // Promotion evaluation (FR-RED-01) — authoritative server-side pricing.
    const evaluation = await this.discounts.evaluate({
      lines: cart,
      customer: { customerId, tags: customer.tags.map((t) => t.tag), firstOrder: !(metrics.orders && metrics.orders > 0) },
      channel: input.channel,
      zoneId: zone?.id ?? null,
      paymentMethod: input.paymentMethod ?? null,
      shippingFee,
      code: input.code,
    });
    if (input.code && evaluation.codeError) {
      throw new BadRequestException({ message: evaluation.codeError.message, code: 'CODE_INVALID', reason: evaluation.codeError.reason });
    }

    // Manual staff discount (FR-RED-04, D-20) applied after promos.
    const afterPromos = evaluation.subtotal - evaluation.lines.reduce((s, l) => s + l.discount, 0) - evaluation.orderDiscount;
    let manualDiscountAmount = 0;
    if (input.manualDiscount) {
      manualDiscountAmount = await this.discounts.assertManualDiscountAllowed(
        user,
        afterPromos,
        input.manualDiscount.valueType,
        input.manualDiscount.valueType === 'percent' ? input.manualDiscount.value : input.manualDiscount.value,
      );
    }

    const discountTotal = evaluation.discountTotal + manualDiscountAmount;
    const effectiveShipping = shippingFee - evaluation.shippingDiscount;
    const goodsNet = Math.max(0, evaluation.subtotal - (evaluation.discountTotal - evaluation.shippingDiscount) - manualDiscountAmount);
    const taxTotal = await this.taxFor(goodsNet);
    const grandTotal = goodsNet + taxTotal + effectiveShipping;

    const orderNumber = await this.generateOrderNumber();
    const order = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber,
          channel: input.channel,
          customerId,
          status: 'DRAFT',
          paymentStatus: 'UNPAID',
          deliveryMethod: input.deliveryMethod,
          deliveryZoneId: zone?.id ?? null,
          address: addressSnapshot as never,
          paymentMethod: input.paymentMethod,
          subtotal: evaluation.subtotal,
          discountTotal,
          shippingFee: effectiveShipping,
          taxTotal,
          grandTotal,
          promoBreakdown: {
            applied: evaluation.appliedPromotions,
            manualDiscount: input.manualDiscount ? { ...input.manualDiscount, amount: manualDiscountAmount, userId: user.id } : null,
          } as never,
          placedAt: new Date(),
          createdBy: user.id,
        },
      });

      for (const [i, line] of cart.entries()) {
        const evalLine = evaluation.lines[i];
        await tx.orderLine.create({
          data: {
            orderId: order.id,
            variantId: line.lineKind === 'bundle' ? null : line.variantId,
            lineKind: line.lineKind,
            productNameSnapshot: line.name,
            skuSnapshot: line.sku,
            unitSnapshot: line.unitName,
            unitPriceSnapshot: line.unitPrice,
            quantity: line.quantity,
            lineTotal: evalLine.lineTotal,
            discountAmount: evalLine.discount,
            costSnapshot: line.costPrice,
            categoryPathSnapshot: line.categoryPath.join('/'),
            bundleComponentsSnapshot: line.bundleSnapshot as never,
          },
        });
      }

      if (input.manualDiscount && manualDiscountAmount > 0) {
        await tx.manualDiscount.create({
          data: {
            orderId: order.id,
            level: 'order',
            valueType: input.manualDiscount.valueType,
            percentValue: input.manualDiscount.valueType === 'percent' ? input.manualDiscount.value : null,
            amount: manualDiscountAmount,
            reason: input.manualDiscount.reason,
            userId: user.id,
          },
        });
      }

      if (input.noteInternal) {
        await tx.orderNote.create({ data: { orderId: order.id, note: input.noteInternal, userId: user.id } });
      }
      return order;
    });

    await this.addEvent(order.id, 'created', { channel: input.channel, manual: true }, { type: 'user', id: user.id });
    return this.detail(order.id);
  }

  /**
   * Replace the line items of a DRAFT order and re-price it. Drafts hold no stock
   * reservation (that happens on confirm), so items can be swapped freely. Automatic
   * promos re-apply from the new cart; any existing staff discount is preserved.
   */
  async editDraftLines(user: AuthedUser, id: string, lines: ManualOrderInput['lines']) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: { customer: { include: { tags: true } } } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== 'DRAFT') throw new BadRequestException('Only draft orders can have their items edited');
    if (!order.customerId || !order.customer) throw new BadRequestException('Order has no customer');

    const cart = await this.buildCart(lines);
    const metrics = (order.customer.metrics as { orders?: number } | null) ?? {};
    const zone = order.deliveryZoneId ? await this.prisma.zone.findUnique({ where: { id: order.deliveryZoneId } }) : null;
    const shippingFee = order.deliveryMethod === 'pickup' ? 0 : zone?.deliveryFee ?? 0;

    const evaluation = await this.discounts.evaluate({
      lines: cart,
      customer: { customerId: order.customerId, tags: order.customer.tags.map((t) => t.tag), firstOrder: !(metrics.orders && metrics.orders > 0) },
      channel: order.channel,
      zoneId: zone?.id ?? null,
      paymentMethod: order.paymentMethod,
      shippingFee,
      code: null,
    });

    // Preserve the existing staff discount, recomputing its amount against the new subtotal.
    const savedMd = (order.promoBreakdown as { manualDiscount?: { valueType: 'percent' | 'fixed'; value: number } | null } | null)?.manualDiscount ?? null;
    const afterPromos = evaluation.subtotal - evaluation.lines.reduce((s, l) => s + l.discount, 0) - evaluation.orderDiscount;
    const manualDiscountAmount = savedMd
      ? savedMd.valueType === 'percent'
        ? Math.round((afterPromos * Number(savedMd.value)) / 100)
        : Math.min(Number(savedMd.value), afterPromos)
      : 0;

    const discountTotal = evaluation.discountTotal + manualDiscountAmount;
    const effectiveShipping = shippingFee - evaluation.shippingDiscount;
    const goodsNet = Math.max(0, evaluation.subtotal - (evaluation.discountTotal - evaluation.shippingDiscount) - manualDiscountAmount);
    const taxTotal = await this.taxFor(goodsNet);
    const grandTotal = goodsNet + taxTotal + effectiveShipping;

    await this.prisma.$transaction(async (tx) => {
      await tx.orderLine.deleteMany({ where: { orderId: id } });
      for (const [i, line] of cart.entries()) {
        const evalLine = evaluation.lines[i];
        await tx.orderLine.create({
          data: {
            orderId: id,
            variantId: line.lineKind === 'bundle' ? null : line.variantId,
            lineKind: line.lineKind,
            productNameSnapshot: line.name,
            skuSnapshot: line.sku,
            unitSnapshot: line.unitName,
            unitPriceSnapshot: line.unitPrice,
            quantity: line.quantity,
            lineTotal: evalLine.lineTotal,
            discountAmount: evalLine.discount,
            costSnapshot: line.costPrice,
            categoryPathSnapshot: line.categoryPath.join('/'),
            bundleComponentsSnapshot: line.bundleSnapshot as never,
          },
        });
      }
      if (savedMd) {
        await tx.manualDiscount.updateMany({ where: { orderId: id, level: 'order' }, data: { amount: manualDiscountAmount } });
      }
      await tx.order.update({
        where: { id },
        data: {
          subtotal: evaluation.subtotal,
          discountTotal,
          shippingFee: effectiveShipping,
          taxTotal,
          grandTotal,
          promoBreakdown: { applied: evaluation.appliedPromotions, manualDiscount: savedMd ? { ...savedMd, amount: manualDiscountAmount } : null } as never,
        },
      });
    });

    await this.addEvent(id, 'items_edited', { lineCount: cart.length, grandTotal }, { type: 'user', id: user.id });
    return this.detail(id);
  }

  /** DRAFT → PENDING_PAYMENT (transfer/gateway) or CONFIRMED (POD, gated). */
  async confirmDraft(user: AuthedUser, orderId: string) {
    const order = await this.requireOrder(orderId);
    if (order.status !== 'DRAFT') throw new BadRequestException('Only draft orders can be confirmed');

    // Availability check at intake (FR-INT-03).
    const availability = await this.inventory.checkAvailability(this.inventoryLines(order));
    if (!availability.ok) {
      throw new BadRequestException({ message: 'Insufficient stock', lines: availability.lines.filter((l) => !l.ok) });
    }

    if (order.paymentMethod === 'pod') {
      await this.confirmPod(user, orderId);
      return this.detail(orderId);
    }

    const trigger = await this.settings.get<Record<string, string>>('orders.reservation_trigger');
    await this.setStatus(orderId, 'DRAFT', 'PENDING_PAYMENT', { type: 'user', id: user.id });
    // D-01: gateway orders reserve at placement.
    if (order.paymentMethod === 'gateway' && trigger.gateway === 'placement') {
      await this.inventory.reserve(orderId, this.inventoryLines(order), user.id);
      await this.addEvent(orderId, 'stock_reserved', { at: 'placement' });
    }
    return this.detail(orderId);
  }

  /** POD gate (FR-PAY-04, D-07, D-16). */
  async confirmPod(user: AuthedUser, orderId: string) {
    const order = await this.requireOrder(orderId);
    if (!['DRAFT', 'PENDING_PAYMENT'].includes(order.status)) {
      throw new BadRequestException('Order is not awaiting POD confirmation');
    }
    if (order.paymentMethod !== 'pod') throw new BadRequestException('Not a POD order');

    const zone = order.deliveryZone;
    if (!zone?.podAllowed) throw new BadRequestException('POD is not available for this delivery zone (D-07)');
    const risk = await this.customers.riskCheck({ customerId: order.customerId ?? undefined });
    if (risk.status !== 'ok') {
      throw new BadRequestException(`POD blocked: customer is ${risk.status}${risk.reason ? ` (${risk.reason})` : ''}`);
    }

    const defaultCap = await this.settings.get<number>('orders.pod_default_cap');
    const firstTimeCap = await this.settings.get<number>('orders.pod_first_time_cap');
    const zoneCap = zone.podMaxValue ?? defaultCap;
    const metrics = (order.customer?.metrics as { orders?: number } | null) ?? {};
    const cap = metrics.orders && metrics.orders > 0 ? zoneCap : Math.min(zoneCap, firstTimeCap);
    if (order.grandTotal > cap) {
      throw new BadRequestException(`Order exceeds the POD cap of ₦${(cap / 100).toLocaleString()} (D-07)`);
    }

    await this.confirmOrder(order.id, { type: 'user', id: user.id }, 'pod_confirmed');
    return this.detail(orderId);
  }

  /** FR-PAY-03: bank transfer confirmation from the awaiting-transfer queue. */
  async confirmTransfer(user: AuthedUser, orderId: string, payment: { payerName: string; reference?: string; amount?: number }) {
    const order = await this.requireOrder(orderId);
    if (order.status !== 'PENDING_PAYMENT') throw new BadRequestException('Order is not awaiting payment');

    await this.prisma.payment.create({
      data: {
        orderId,
        method: 'transfer',
        payerName: payment.payerName,
        reference: payment.reference,
        amount: payment.amount ?? order.grandTotal,
        status: 'confirmed',
        recordedBy: user.id,
      },
    });
    await this.prisma.order.update({ where: { id: orderId }, data: { paymentStatus: 'PAID' } });
    await this.addEvent(orderId, 'payment_recorded', { method: 'transfer', payerName: payment.payerName, amount: payment.amount ?? order.grandTotal }, { type: 'user', id: user.id });
    await this.confirmOrder(orderId, { type: 'user', id: user.id }, 'transfer_confirmed');
    return this.detail(orderId);
  }

  /** Webhook-style gateway confirmation (Paystack in production; simulated locally). */
  async confirmGatewayPayment(orderId: string, reference: string) {
    const order = await this.requireOrder(orderId);
    if (order.status !== 'PENDING_PAYMENT') return this.detail(orderId); // idempotent
    const existing = await this.prisma.payment.findFirst({ where: { orderId, reference } });
    if (!existing) {
      await this.prisma.payment.create({
        data: { orderId, method: 'gateway', gateway: 'paystack', reference, amount: order.grandTotal, status: 'confirmed', recordedBy: 'webhook' },
      });
    }
    await this.prisma.order.update({ where: { id: orderId }, data: { paymentStatus: 'PAID' } });
    await this.addEvent(orderId, 'payment_recorded', { method: 'gateway', reference }, { type: 'webhook' });
    await this.confirmOrder(orderId, { type: 'webhook' }, 'gateway_confirmed');
    return this.detail(orderId);
  }

  /** Shared CONFIRMED entry: reserve stock, redeem promos, bundle counters, big-order bell. */
  private async confirmOrder(orderId: string, actor: { type: 'user' | 'system' | 'webhook'; id?: string | null }, reason: string) {
    const order = await this.requireOrder(orderId);
    await this.setStatus(orderId, order.status, 'CONFIRMED', actor, { confirmedAt: new Date() });

    // RESERVE on entry (SRS §2.1) — idempotent; skips if reserved at placement.
    await this.inventory.reserve(orderId, this.inventoryLines(order), actor.id ?? null);
    await this.addEvent(orderId, 'stock_reserved', { reason });

    // Promo redemption (FR-RED-02).
    const breakdown = order.promoBreakdown as { applied?: { promotionId: string; codeId: string | null; amount: number; name: string; valueType: string; scope: string }[] } | null;
    if (breakdown?.applied?.length) {
      try {
        await this.discounts.redeem(orderId, order.customerId, breakdown.applied as never);
      } catch {
        await this.prisma.order.update({ where: { id: orderId }, data: { flags: { repricingReview: true } as never } });
        await this.addEvent(orderId, 'promo_cap_exceeded', { note: 'flagged for repricing review (FR-RED-02)' });
      }
    }

    // A1 FR-BOR-01: bundle sold_count increments at CONFIRMED.
    for (const line of order.lines) {
      if (line.lineKind === 'bundle') {
        const bundle = await this.prisma.product.findFirst({
          where: { slug: { not: '' }, bundleConfig: { isNot: null }, name: line.productNameSnapshot },
          include: { bundleConfig: true },
        });
        if (bundle?.bundleConfig?.maxSellable != null) {
          await this.prisma.$executeRaw`
            UPDATE bundle_config SET sold_count = sold_count + ${Number(line.quantity)}
            WHERE bundle_product_id = ${bundle.id}`;
        }
      }
    }

    // D-46: large-order bell.
    const threshold = await this.settings.get<number>('dashboard.large_order_threshold');
    if (order.grandTotal >= threshold) {
      await this.notifications.notify({
        type: 'large_order',
        sourceEventId: `large-order-${orderId}`,
        payload: { orderNumber: order.orderNumber, total: order.grandTotal },
        link: `/orders/${orderId}`,
        roleKeys: ['owner', 'manager'],
      });
    }

    // Customer metric refresh (async semantics acceptable).
    if (order.customerId) await this.customers.recomputeMetrics(order.customerId);
  }

  // ── Fulfilment (FR-FUL) ────────────────────────────────────────────────────

  async startProcessing(user: AuthedUser, orderId: string) {
    const order = await this.requireOrder(orderId);
    await this.setStatus(orderId, order.status, 'PROCESSING', { type: 'user', id: user.id });
    return this.detail(orderId);
  }

  async ship(
    user: AuthedUser,
    orderId: string,
    data: {
      method: 'rider' | '3pl' | 'pickup';
      carrier?: string;
      trackingRef?: string;
      riderName?: string;
      riderPhone?: string;
      riderId?: string;
      lines: { orderLineId: string; quantity: number }[];
    },
  ) {
    const order = await this.requireOrder(orderId);
    if (!['PROCESSING', 'PARTIALLY_SHIPPED'].includes(order.status)) {
      throw new BadRequestException('Order must be in processing to ship');
    }
    if (!data.lines.length) throw new BadRequestException('Select at least one line to ship');

    // Validation 3: shipment quantities ≤ outstanding per line.
    const deductLines: { variantId: string; quantity: number }[] = [];
    for (const shipLine of data.lines) {
      const line = order.lines.find((l) => l.id === shipLine.orderLineId);
      if (!line) throw new BadRequestException('Unknown order line');
      const outstanding = Number(line.quantity) - Number(line.qtyShipped);
      if (shipLine.quantity > outstanding + 1e-9) {
        throw new BadRequestException(`Cannot ship more than the outstanding ${outstanding} for ${line.skuSnapshot}`);
      }
      const components = (line.bundleComponentsSnapshot as { variantId: string; qty: number }[] | null) ?? [];
      if (components.length) {
        for (const c of components) deductLines.push({ variantId: c.variantId, quantity: c.qty * shipLine.quantity });
      } else if (line.variantId) {
        deductLines.push({ variantId: line.variantId, quantity: shipLine.quantity });
      }
    }

    const podExpected = order.paymentMethod === 'pod' && order.paymentStatus !== 'PAID' ? order.grandTotal : null;
    const shipment = await this.prisma.shipment.create({
      data: {
        orderId,
        method: data.method,
        carrier: data.carrier,
        trackingRef: data.trackingRef,
        riderName: data.riderName,
        riderPhone: data.riderPhone,
        riderId: data.riderId,
        codExpected: podExpected,
        status: 'out',
        shippedAt: new Date(),
        lines: { create: data.lines.map((l) => ({ orderLineId: l.orderLineId, quantity: l.quantity })) },
      },
    });

    // DEDUCT (never fire-and-forget — Validation 6).
    await this.inventory.deductForShipment(orderId, shipment.id, deductLines, user.id);

    for (const shipLine of data.lines) {
      await this.prisma.orderLine.update({
        where: { id: shipLine.orderLineId },
        data: { qtyShipped: { increment: shipLine.quantity } },
      });
    }

    const refreshed = await this.requireOrder(orderId);
    const allShipped = refreshed.lines.every((l) => Number(l.qtyShipped) >= Number(l.quantity) - 1e-9);
    await this.setStatus(orderId, refreshed.status, allShipped ? 'SHIPPED' : 'PARTIALLY_SHIPPED', { type: 'user', id: user.id }, allShipped ? { shippedAt: new Date() } : {});
    await this.addEvent(orderId, 'shipment_created', { shipmentId: shipment.id, method: data.method, lines: data.lines }, { type: 'user', id: user.id });
    return this.detail(orderId);
  }

  /** FR-PAY-04 + Scenario 3: DELIVERED (+ POD payment in one action). */
  async recordDelivery(
    user: AuthedUser,
    orderId: string,
    shipmentId: string,
    pod?: { method: 'pod_cash' | 'pod_transfer'; amount: number; collector?: string },
  ) {
    const order = await this.requireOrder(orderId);
    if (!['SHIPPED', 'PARTIALLY_SHIPPED'].includes(order.status)) throw new BadRequestException('Order is not out for delivery');

    await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: { status: 'delivered', deliveredAt: new Date(), codAmount: pod?.amount ?? null },
    });

    if (pod) {
      // D-12: payment recording is the staff member's action.
      await this.prisma.payment.create({
        data: { orderId, method: pod.method, amount: pod.amount, status: 'confirmed', recordedBy: user.id, payerName: pod.collector },
      });
      const paid = (await this.prisma.payment.aggregate({ where: { orderId, status: 'confirmed' }, _sum: { amount: true } }))._sum.amount ?? 0;
      await this.prisma.order.update({
        where: { id: orderId },
        data: { paymentStatus: paid >= order.grandTotal ? 'PAID' : 'PARTIALLY_PAID' },
      });
      await this.addEvent(orderId, 'payment_recorded', { method: pod.method, amount: pod.amount }, { type: 'user', id: user.id });
    }

    await this.setStatus(orderId, order.status, 'DELIVERED', { type: 'user', id: user.id }, { deliveredAt: new Date() });
    return this.detail(orderId);
  }

  async deliveryFailed(user: AuthedUser, orderId: string, shipmentId: string, reason: string, customerCaused: boolean) {
    const order = await this.requireOrder(orderId);
    await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: { status: 'failed', failureReason: reason },
    });
    await this.setStatus(orderId, order.status, 'DELIVERY_FAILED', { type: 'user', id: user.id });
    await this.addEvent(orderId, 'delivery_failed', { reason, customerCaused }, { type: 'user', id: user.id });

    // D-16: only customer-caused failures count toward auto-block.
    if (customerCaused && order.customerId && order.paymentMethod === 'pod') {
      await this.customers.recordPodFailure(order.customerId);
    }
    return this.detail(orderId);
  }

  async reattemptDelivery(user: AuthedUser, orderId: string) {
    const order = await this.requireOrder(orderId);
    if (order.status !== 'DELIVERY_FAILED') throw new BadRequestException('No failed delivery to reattempt');
    const lastShipment = order.shipments[order.shipments.length - 1];
    await this.prisma.shipment.update({ where: { id: lastShipment.id }, data: { status: 'out', failureReason: null } });
    await this.setStatus(orderId, 'DELIVERY_FAILED', 'SHIPPED', { type: 'user', id: user.id });
    return this.detail(orderId);
  }

  // ── Cancellation ───────────────────────────────────────────────────────────

  async cancel(user: AuthedUser, orderId: string, reason: string) {
    const order = await this.requireOrder(orderId);
    // Sales staff: pre-payment only.
    if (!user.capabilities.has('orders.cancel')) {
      if (!user.capabilities.has('orders.cancel_prepayment')) throw new ForbiddenException('Missing permission');
      if (order.paymentStatus !== 'UNPAID') {
        throw new ForbiddenException('You may only cancel unpaid orders — ask a Manager');
      }
    }
    await this.setStatus(orderId, order.status, 'CANCELLED', { type: 'user', id: user.id }, { cancellationReason: reason });
    await this.inventory.release(orderId, `cancelled: ${reason}`, user.id);
    await this.discounts.release(orderId);
    await this.addEvent(orderId, 'cancelled', { reason }, { type: 'user', id: user.id });

    // Bundle cap counters release (A1).
    for (const line of order.lines) {
      if (line.lineKind === 'bundle') {
        const bundle = await this.prisma.product.findFirst({
          where: { name: line.productNameSnapshot, bundleConfig: { isNot: null } },
          include: { bundleConfig: true },
        });
        if (bundle?.bundleConfig?.maxSellable != null) {
          await this.prisma.$executeRaw`
            UPDATE bundle_config SET sold_count = GREATEST(0, sold_count - ${Number(line.quantity)})
            WHERE bundle_product_id = ${bundle.id}`;
        }
      }
    }

    if (order.paymentStatus !== 'UNPAID') {
      await this.addEvent(orderId, 'refund_needed', { note: 'Paid order cancelled — start refund flow' });
    }
    if (order.customerId) await this.customers.recomputeMetrics(order.customerId);
    return this.detail(orderId);
  }

  // ── Refunds (FR-RFD, D-08) ─────────────────────────────────────────────────

  async requestRefund(
    user: AuthedUser,
    orderId: string,
    data: { scope: 'full' | 'partial' | 'per_line'; amount: number; reasonCode: string; note?: string; method: 'gateway_reversal' | 'manual_transfer'; lines?: { orderLineId: string; quantity: number; amount: number }[] },
  ) {
    const order = await this.requireOrder(orderId);
    const captured = order.payments.filter((p) => p.status === 'confirmed').reduce((s, p) => s + p.amount, 0);
    const alreadyRefunded = order.refunds.filter((r) => r.status === 'processed').reduce((s, r) => s + r.amount, 0);
    if (data.amount <= 0 || data.amount > captured - alreadyRefunded) {
      throw new BadRequestException('Refund exceeds captured payments (Validation 4)');
    }

    const threshold = await this.settings.get<number>('orders.refund_approval_threshold');
    const needsApproval = data.amount > threshold && !user.capabilities.has('orders.refund_approve');

    const refund = await this.prisma.refund.create({
      data: {
        orderId,
        scope: data.scope,
        amount: data.amount,
        reasonCode: data.reasonCode,
        note: data.note,
        method: data.method,
        status: needsApproval ? 'pending' : 'approved',
        requestedBy: user.id,
        approvedBy: needsApproval ? null : user.id,
        lines: data.lines ? { create: data.lines } : undefined,
      },
    });
    await this.prisma.order.update({ where: { id: orderId }, data: { paymentStatus: 'REFUND_PENDING' } });
    await this.addEvent(orderId, 'refund_requested', { refundId: refund.id, amount: data.amount, needsApproval }, { type: 'user', id: user.id });

    if (needsApproval) {
      await this.notifications.notify({
        type: 'refund_approval_needed',
        sourceEventId: `refund-approval-${refund.id}`,
        payload: { orderNumber: order.orderNumber, amount: data.amount },
        link: `/orders/${orderId}`,
        roleKeys: ['owner', 'manager'],
      });
    }
    return refund;
  }

  async decideRefund(user: AuthedUser, refundId: string, decision: 'approve' | 'reject') {
    const refund = await this.prisma.refund.findUnique({ where: { id: refundId }, include: { order: true } });
    if (!refund) throw new NotFoundException('Refund not found');
    if (refund.status !== 'pending') throw new BadRequestException('Refund is not pending approval');

    await this.prisma.refund.update({
      where: { id: refundId },
      data: { status: decision === 'approve' ? 'approved' : 'rejected', approvedBy: user.id },
    });
    if (decision === 'reject') {
      await this.prisma.order.update({
        where: { id: refund.orderId },
        data: { paymentStatus: refund.order.paymentStatus === 'REFUND_PENDING' ? 'PAID' : refund.order.paymentStatus },
      });
    }
    await this.addEvent(refund.orderId, `refund_${decision}d`, { refundId }, { type: 'user', id: user.id });
    await this.notifications.notify({
      type: 'refund_outcome',
      sourceEventId: `refund-outcome-${refundId}`,
      payload: { refundId, decision, orderNumber: refund.order.orderNumber },
      link: `/orders/${refund.orderId}`,
      userIds: [refund.requestedBy],
    });
    return this.prisma.refund.findUnique({ where: { id: refundId } });
  }

  async processRefund(user: AuthedUser, refundId: string, gatewayRef?: string) {
    const refund = await this.prisma.refund.findUnique({ where: { id: refundId }, include: { order: { include: { payments: true, refunds: true, lines: true } } } });
    if (!refund) throw new NotFoundException('Refund not found');
    if (refund.status !== 'approved') throw new BadRequestException('Refund must be approved first');

    await this.prisma.refund.update({
      where: { id: refundId },
      data: { status: 'processed', processedAt: new Date(), gatewayRef },
    });

    const order = refund.order;
    const captured = order.payments.filter((p) => p.status === 'confirmed').reduce((s, p) => s + p.amount, 0);
    const totalRefunded = order.refunds
      .filter((r) => r.status === 'processed' || r.id === refundId)
      .reduce((s, r) => s + r.amount, 0);
    await this.prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: totalRefunded >= captured ? 'REFUNDED' : 'PARTIALLY_REFUNDED' },
    });
    const refundLines = await this.prisma.refundLine.findMany({ where: { refundId } });
    for (const line of refundLines) {
      await this.prisma.orderLine.update({ where: { id: line.orderLineId }, data: { qtyRefunded: { increment: Number(line.quantity) } } });
    }
    await this.addEvent(order.id, 'refund_processed', { refundId, amount: refund.amount }, { type: 'user', id: user.id });
    if (order.customerId) await this.customers.recomputeMetrics(order.customerId);
    return this.prisma.refund.findUnique({ where: { id: refundId } });
  }

  // ── Returns (FR-RTN, D-09) ─────────────────────────────────────────────────

  async requestReturn(
    user: AuthedUser,
    orderId: string,
    data: { reasonCode: string; lines: { orderLineId: string; quantity: number }[]; storeError?: boolean },
  ) {
    const order = await this.requireOrder(orderId);
    if (!order.deliveredAt) throw new BadRequestException('Returns start after delivery');

    const windowDays = await this.settings.get<number>('orders.return_window_days');
    const deadline = new Date(order.deliveredAt.getTime() + windowDays * 86_400_000);
    if (new Date() > deadline && !data.storeError) {
      throw new BadRequestException(`The ${windowDays}-day return window has closed (D-09)`);
    }

    for (const returnLine of data.lines) {
      const line = order.lines.find((l) => l.id === returnLine.orderLineId);
      if (!line) throw new BadRequestException('Unknown order line');
      const eligible = Number(line.qtyShipped) - Number(line.qtyReturned);
      if (returnLine.quantity > eligible + 1e-9) {
        throw new BadRequestException(`Return quantity exceeds delivered quantity for ${line.skuSnapshot}`);
      }
      // D-09 category-level exclusions (cut fabric / opened perfumes) unless store error.
      if (!data.storeError && line.variantId) {
        const variant = await this.prisma.variant.findUnique({
          where: { id: line.variantId },
          include: { product: { include: { category: true } } },
        });
        if (variant && !variant.product.category.returnEligible) {
          throw new BadRequestException(`${line.productNameSnapshot} is non-returnable (${variant.product.category.name} policy, D-09)`);
        }
      }
    }

    const ret = await this.prisma.return.create({
      data: {
        orderId,
        reasonCode: data.reasonCode,
        status: 'REQUESTED',
        lines: { create: data.lines.map((l) => ({ orderLineId: l.orderLineId, quantity: l.quantity })) },
      },
    });
    await this.addEvent(orderId, 'return_requested', { returnId: ret.id, storeError: data.storeError ?? false }, { type: 'user', id: user.id });
    return ret;
  }

  async decideReturn(user: AuthedUser, returnId: string, decision: 'approve' | 'reject') {
    const ret = await this.prisma.return.findUnique({ where: { id: returnId } });
    if (!ret || ret.status !== 'REQUESTED') throw new BadRequestException('Return is not awaiting decision');
    await this.prisma.return.update({
      where: { id: returnId },
      data: { status: decision === 'approve' ? 'APPROVED' : 'REJECTED', approvedBy: user.id },
    });
    await this.addEvent(ret.orderId, `return_${decision}d`, { returnId }, { type: 'user', id: user.id });
    return this.prisma.return.findUnique({ where: { id: returnId } });
  }

  /** Goods received back: restock or write off per line condition. */
  async receiveReturn(user: AuthedUser, returnId: string, conditions: { returnLineId: string; condition: 'restockable' | 'damaged' }[]) {
    const ret = await this.prisma.return.findUnique({ where: { id: returnId }, include: { lines: true, order: { include: { lines: true } } } });
    if (!ret || ret.status !== 'APPROVED') throw new BadRequestException('Return must be approved first');

    const restockLines: { variantId: string; quantity: number; condition: 'restockable' | 'damaged' }[] = [];
    for (const line of ret.lines) {
      const cond = conditions.find((c) => c.returnLineId === line.id)?.condition ?? 'restockable';
      await this.prisma.returnLine.update({ where: { id: line.id }, data: { condition: cond } });
      const orderLine = ret.order.lines.find((l) => l.id === line.orderLineId);
      // Restock the base-unit consumption when present (sell-format lines and
      // D-57 whole-package bundle returns), otherwise the line's own variant.
      const components = (orderLine?.bundleComponentsSnapshot as { variantId: string; qty: number }[] | null) ?? [];
      if (components.length) {
        for (const c of components) {
          restockLines.push({ variantId: c.variantId, quantity: c.qty * Number(line.quantity), condition: cond });
        }
      } else if (orderLine?.variantId) {
        restockLines.push({ variantId: orderLine.variantId, quantity: Number(line.quantity), condition: cond });
      }
      await this.prisma.orderLine.update({ where: { id: line.orderLineId }, data: { qtyReturned: { increment: Number(line.quantity) } } });
    }

    await this.inventory.restockReturn(returnId, ret.orderId, restockLines, user.id);
    await this.prisma.return.update({ where: { id: returnId }, data: { status: 'RECEIVED', receivedAt: new Date() } });
    await this.addEvent(ret.orderId, 'return_received', { returnId }, { type: 'user', id: user.id });
    return this.prisma.return.findUnique({ where: { id: returnId }, include: { lines: true } });
  }

  async resolveReturn(user: AuthedUser, returnId: string, resolution: 'refund' | 'exchange') {
    const ret = await this.prisma.return.findUnique({ where: { id: returnId } });
    if (!ret || ret.status !== 'RECEIVED') throw new BadRequestException('Return must be received first');
    await this.prisma.return.update({ where: { id: returnId }, data: { status: 'RESOLVED', resolution } });
    await this.addEvent(ret.orderId, 'return_resolved', { returnId, resolution }, { type: 'user', id: user.id });
    return this.prisma.return.findUnique({ where: { id: returnId } });
  }

  // ── Scheduled jobs ─────────────────────────────────────────────────────────

  /** D-02/D-06: unpaid orders auto-cancel after TTL, releasing stock. */
  @Cron('*/10 * * * *')
  async expireUnpaidOrders() {
    const ttlHours = await this.settings.get<number>('orders.unpaid_ttl_hours');
    const cutoff = new Date(Date.now() - ttlHours * 3_600_000);
    const stale = await this.prisma.order.findMany({
      where: { status: 'PENDING_PAYMENT', placedAt: { lt: cutoff } },
      select: { id: true },
      take: 100,
    });
    for (const { id } of stale) {
      await this.prisma.order.update({
        where: { id },
        data: { status: 'CANCELLED', cancellationReason: 'reservation expired' },
      });
      await this.inventory.release(id, 'reservation expired', null);
      await this.discounts.release(id);
      await this.addEvent(id, 'auto_cancelled', { reason: 'unpaid TTL elapsed (D-02)' });
    }
    return stale.length;
  }

  /** FR-FUL-07: DELIVERED → COMPLETED after the configured window, if no open return. */
  @Cron('0 * * * *')
  async completeDeliveredOrders() {
    const days = await this.settings.get<number>('orders.completed_after_days');
    const cutoff = new Date(Date.now() - days * 86_400_000);
    const due = await this.prisma.order.findMany({
      where: {
        status: 'DELIVERED',
        deliveredAt: { lt: cutoff },
        returns: { none: { status: { in: ['REQUESTED', 'APPROVED', 'RECEIVED'] } } },
      },
      select: { id: true },
      take: 200,
    });
    for (const { id } of due) {
      await this.prisma.order.update({ where: { id }, data: { status: 'COMPLETED', completedAt: new Date() } });
      await this.addEvent(id, 'auto_completed', {});
    }
    return due.length;
  }
}
