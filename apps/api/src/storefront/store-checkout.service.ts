import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { DiscountsService } from '../discounts/discounts.service';
import { CustomersService } from '../customers/customers.service';
import { OrdersService } from '../orders/orders.service';
import { AnkoService } from '../anko/anko.service';
import { WalletService } from '../wallet/wallet.service';
import { AuthedUser } from '../auth/auth.types';
import { CartLineInput } from '../discounts/discounts.types';
import { trackingToken } from './customer-auth.service';

/** Synthetic actor for storefront-originated order operations. */
const STOREFRONT_ACTOR: AuthedUser = {
  id: 'storefront',
  name: 'Storefront',
  email: 'storefront@system',
  roleKey: 'system',
  status: 'active',
  totpEnabled: false,
  capabilities: new Set(),
};

export interface Personalization {
  mode: 'solo' | 'names' | 'design';
  text?: string;
  names?: string[];
  previewUrl?: string;
  spec?: unknown;
}

export interface StoreCartLine {
  variantId?: string;
  bundleProductId?: string;
  formatId?: string;
  personalization?: Personalization;
  /** Anko (group/event) bulk line — priced at the anko rate + locks the fabric. */
  anko?: boolean;
  quantity: number;
}

/** Customer-language status mapping (S-BR-14). */
export function customerStatus(status: string, paymentMethod: string | null): { label: string; step: number } {
  switch (status) {
    case 'DRAFT':
      return paymentMethod === 'pod'
        ? { label: 'Order received — awaiting confirmation call', step: 0 }
        : { label: 'Order received', step: 0 };
    case 'PENDING_PAYMENT':
      // Online (gateway) orders reach here only when the payment wasn't
      // completed; "awaiting your payment" is reserved for transfer/POD.
      return paymentMethod === 'gateway'
        ? { label: 'Payment not completed', step: 0 }
        : { label: 'Awaiting your payment', step: 0 };
    case 'CONFIRMED':
      return { label: 'Payment confirmed', step: 1 };
    case 'PROCESSING':
      return { label: 'Being prepared', step: 2 };
    case 'PARTIALLY_SHIPPED':
    case 'SHIPPED':
      return { label: 'Out for delivery', step: 3 };
    case 'DELIVERY_FAILED':
      return { label: 'Delivery attempted — we will retry', step: 3 };
    case 'DELIVERED':
      return { label: 'Delivered', step: 4 };
    case 'COMPLETED':
      return { label: 'Delivered', step: 4 };
    case 'CANCELLED':
      return { label: 'Cancelled', step: -1 };
    case 'REFUNDED':
      return { label: 'Refunded', step: -1 };
    default:
      return { label: status, step: 0 };
  }
}

@Injectable()
export class StoreCheckoutService {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
    private discounts: DiscountsService,
    private customers: CustomersService,
    private orders: OrdersService,
    private anko: AnkoService,
    private wallet: WalletService,
  ) {}

  /** Build engine lines from a client cart — server prices only (Rule 1). */
  private async engineLines(lines: StoreCartLine[]): Promise<(CartLineInput & { name: string; unitName: string })[]> {
    const out: (CartLineInput & { name: string; unitName: string })[] = [];
    for (const line of lines) {
      if (line.bundleProductId) {
        const bundle = await this.prisma.product.findUnique({
          where: { id: line.bundleProductId },
          include: { bundleConfig: true, bundleComponents: { include: { variant: true } } },
        });
        if (!bundle?.bundleConfig || bundle.status !== 'active') throw new BadRequestException('A package in your cart is no longer available');
        const componentSum = bundle.bundleComponents.reduce((s, c) => s + Math.round(c.variant.price * Number(c.quantity)), 0);
        const price = bundle.bundleConfig.pricingMode === 'fixed'
          ? bundle.bundleConfig.fixedPrice ?? 0
          : Math.round(componentSum * (1 - Number(bundle.bundleConfig.percentOff ?? 0) / 100));
        out.push({
          variantId: `bundle:${bundle.id}`,
          productId: bundle.id,
          categoryId: bundle.categoryId,
          categoryPath: [bundle.categoryId],
          quantity: line.quantity,
          unitPrice: price,
          costPrice: null,
          isBundle: true,
          bundleEligibleForPromotions: bundle.bundleConfig.eligibleForPromotions,
          name: bundle.name,
          unitName: 'package',
        });
        continue;
      }
      if (!line.variantId) throw new BadRequestException('Invalid cart line');
      const variant = await this.prisma.variant.findUnique({
        where: { id: line.variantId },
        include: { product: { include: { category: { include: { parent: true } } } } },
      });
      if (!variant || variant.status !== 'active' || variant.product.status !== 'active') {
        throw new BadRequestException(`"${variant?.product.name ?? 'An item'}" is no longer available`);
      }
      const path = [variant.product.categoryId];
      if (variant.product.category.parentId) path.push(variant.product.category.parentId);
      const attrVals = variant.product.attributeValues as {
        _sellFormats?: { id: string; label: string; price: number }[];
        _wholesale?: { enabled?: boolean; increment?: number; unitPrice?: number };
        _anko?: { enabled?: boolean; increment?: number; unitPrice?: number };
        _mimPrintPrice?: number;
      } | null;
      // Pricing (Rule 1 — priced server-side). A chosen sell format wins; else an
      // anko line uses the anko rate; else wholesale kicks in by quantity.
      let unitPrice = variant.price;
      const formats = Array.isArray(attrVals?._sellFormats) ? attrVals!._sellFormats : [];
      const format = line.formatId ? formats.find((f) => f.id === line.formatId) : undefined;
      if (format && Number(format.price) > 0) {
        unitPrice = Number(format.price);
      } else if (line.anko) {
        const anko = attrVals?._anko;
        if (!anko?.enabled || !(Number(anko.increment) > 0) || !(Number(anko.unitPrice) > 0)) {
          throw new BadRequestException(`Anko isn't available for "${variant.product.name}"`);
        }
        unitPrice = Math.round(Number(anko.unitPrice) / Number(anko.increment)); // per-unit anko rate
      } else {
        const wholesale = attrVals?._wholesale;
        // `unitPrice` here is the price for one lot of `increment` units → the
        // effective per-unit price is that divided by the increment.
        if (wholesale?.enabled && Number(wholesale.increment) > 0 && Number(wholesale.unitPrice) > 0) {
          const perUnit = Math.round(Number(wholesale.unitPrice) / Number(wholesale.increment));
          if (Number(line.quantity) >= Number(wholesale.increment) && perUnit < variant.price) {
            unitPrice = perUnit;
          }
        }
      }
      // MIM printing surcharge — added per unit when the line is personalised.
      if (line.personalization && Number(attrVals?._mimPrintPrice) > 0) {
        unitPrice += Math.round(Number(attrVals!._mimPrintPrice));
      }
      out.push({
        variantId: variant.id,
        productId: variant.productId,
        categoryId: variant.product.categoryId,
        categoryPath: path,
        quantity: line.quantity,
        unitPrice,
        costPrice: variant.costPrice,
        name: variant.product.name + (format ? ` — ${format.label}` : ''),
        unitName: 'unit',
      });
    }
    return out;
  }

  private async customerCtx(phone?: string | null, customerId?: string | null) {
    let customer = null;
    if (customerId) customer = await this.prisma.customer.findUnique({ where: { id: customerId }, include: { tags: true } });
    else if (phone) {
      const { tryNormalizePhone } = await import('../customers/phone');
      const normalized = tryNormalizePhone(phone);
      if (normalized) customer = await this.prisma.customer.findUnique({ where: { primaryPhone: normalized }, include: { tags: true } });
    }
    const metrics = (customer?.metrics as { orders?: number } | null) ?? {};
    return {
      customerId: customer?.id ?? null,
      tags: customer?.tags.map((t) => t.tag) ?? [],
      firstOrder: !(metrics.orders && metrics.orders > 0),
    };
  }

  /** FR-SF-CRT-02: advisory cart evaluation. */
  async evaluateCart(input: { lines: StoreCartLine[]; code?: string | null; zoneId?: string | null; phone?: string | null; customerId?: string | null }) {
    if (!input.lines.length) return { lines: [], subtotal: 0, discountTotal: 0, shippingFee: 0, taxTotal: 0, taxRate: 0, grandTotal: 0, appliedPromotions: [], codeError: null };
    const engineLines = await this.engineLines(input.lines);
    const zone = input.zoneId ? await this.prisma.zone.findUnique({ where: { id: input.zoneId } }) : null;
    const shippingFee = zone?.deliveryFee ?? 0;
    const customer = await this.customerCtx(input.phone, input.customerId);

    const evaluation = await this.discounts.evaluate({
      lines: engineLines,
      customer,
      channel: 'web',
      zoneId: zone?.id ?? null,
      paymentMethod: null,
      shippingFee,
      code: input.code,
    });

    const effectiveShipping = shippingFee - evaluation.shippingDiscount;
    const goodsNet = Math.max(0, evaluation.subtotal - (evaluation.discountTotal - evaluation.shippingDiscount));
    const taxRate = Number(await this.settings.get<number>('tax.rate_percent')) || 0;
    const taxTotal = taxRate > 0 ? Math.round((goodsNet * taxRate) / 100) : 0;
    return {
      lines: evaluation.lines.map((l, i) => ({
        ...input.lines[i],
        name: engineLines[i].name,
        unitPrice: l.unitPrice,
        discount: l.discount,
        lineTotal: l.lineTotal,
      })),
      subtotal: evaluation.subtotal,
      discountTotal: evaluation.discountTotal,
      orderDiscount: evaluation.orderDiscount,
      shippingFee: effectiveShipping,
      shippingBase: shippingFee,
      taxTotal,
      taxRate,
      grandTotal: goodsNet + taxTotal + effectiveShipping,
      appliedPromotions: evaluation.appliedPromotions.map((p) => ({ name: p.name, amount: p.amount })),
      codeError: evaluation.codeError ?? null,
    };
  }

  /** FR-SF-CHK-03: payment methods resolved server-side; POD absence is silent. */
  async paymentMethods(input: { zoneId?: string | null; total: number; phone?: string | null; customerId?: string | null }) {
    // Web is Paystack-only by policy — every online payment must clear through the gateway
    // (card / USSD / Paystack's own bank transfer) so it auto-confirms. The standalone
    // direct bank-transfer option is intentionally NOT offered on the web; uncomment to
    // restore it. (Staff-entered manual/WhatsApp orders keep bank transfer separately.)
    const methods: { key: string; label: string; promise: string }[] = [
      { key: 'gateway', label: 'Pay now (card / bank / USSD)', promise: 'Instant confirmation via Paystack' },
      // { key: 'transfer', label: 'Bank transfer', promise: 'We confirm within a few hours of your transfer' },
    ];

    if (input.zoneId) {
      const zone = await this.prisma.zone.findUnique({ where: { id: input.zoneId } });
      if (zone?.podAllowed && zone.status === 'active') {
        const defaultCap = await this.settings.get<number>('orders.pod_default_cap');
        const firstTimeCap = await this.settings.get<number>('orders.pod_first_time_cap');
        const ctx = await this.customerCtx(input.phone, input.customerId);
        const cap = ctx.firstOrder ? Math.min(zone.podMaxValue ?? defaultCap, firstTimeCap) : zone.podMaxValue ?? defaultCap;
        const risk = ctx.customerId ? await this.customers.riskCheck({ customerId: ctx.customerId }) : { status: 'ok' as const };
        if (input.total <= cap && risk.status === 'ok') {
          methods.push({ key: 'pod', label: 'Pay on delivery', promise: 'Pay cash or transfer when your order arrives' });
        }
      }
    }
    return methods;
  }

  /** FR-SF-CHK-04: place order — authoritative evaluate inside Order intake. */
  async placeOrder(input: {
    contact: { phone: string; name?: string; email?: string | null };
    delivery: { pickup?: boolean; zoneId?: string | null; addressLine?: string; area?: string; city?: string; landmark?: string; addressId?: string };
    paymentMethod: 'gateway' | 'transfer' | 'pod';
    lines: StoreCartLine[];
    code?: string | null;
    marketingConsent?: boolean;
    customerId?: string | null;
    origin?: string;
  }) {
    if (!input.lines.length) throw new BadRequestException('Your cart is empty');

    // Re-verify the chosen method is actually offered server-side (Business Rule 2).
    // This enforces the web Paystack-only policy: a crafted 'transfer'/'pod' request is
    // rejected because those keys aren't in the offered list.
    const evaluation = await this.evaluateCart({ lines: input.lines, code: input.code, zoneId: input.delivery.zoneId, phone: input.contact.phone, customerId: input.customerId });
    const offered = await this.paymentMethods({ zoneId: input.delivery.zoneId, total: evaluation.grandTotal, phone: input.contact.phone, customerId: input.customerId });
    if (!offered.some((m) => m.key === input.paymentMethod)) {
      throw new BadRequestException('Selected payment method is not available');
    }

    const addressLine = input.delivery.pickup
      ? 'Store pickup'
      : [input.delivery.addressLine, input.delivery.landmark ? `(landmark: ${input.delivery.landmark})` : null].filter(Boolean).join(' ');
    if (!input.delivery.pickup && !input.delivery.addressLine && !input.delivery.addressId) {
      throw new BadRequestException('A delivery address is required');
    }

    // Anko exclusivity — resolve the buyer, then reject any anko line whose fabric
    // is currently locked to a different buyer (set the locks after the order).
    const ankoProductIds: string[] = [];
    for (const line of input.lines) {
      if (line.anko && line.variantId) {
        const v = await this.prisma.variant.findUnique({ where: { id: line.variantId }, select: { productId: true } });
        if (v) ankoProductIds.push(v.productId);
      }
    }
    if (ankoProductIds.length) {
      const buyer = await this.customerCtx(input.contact.phone, input.customerId);
      for (const pid of ankoProductIds) await this.anko.assertBuyable(pid, buyer.customerId);
    }

    const order = await this.orders.createManualOrder(STOREFRONT_ACTOR, {
      customerId: input.customerId ?? undefined,
      customer: input.customerId ? undefined : { phone: input.contact.phone, name: input.contact.name, email: input.contact.email ?? null },
      channel: 'web',
      lines: input.lines,
      addressId: input.delivery.addressId,
      address: input.delivery.addressId ? undefined : { addressLine, area: input.delivery.area, city: input.delivery.city },
      zoneId: input.delivery.pickup ? null : input.delivery.zoneId,
      deliveryMethod: input.delivery.pickup ? 'pickup' : 'rider',
      paymentMethod: input.paymentMethod,
      code: input.code,
    });
    if (!order) throw new BadRequestException('Order could not be created');

    // Lock each anko fabric to the buyer for its exclusivity period.
    if (ankoProductIds.length && order.customerId) {
      for (const pid of ankoProductIds) await this.anko.lockForProduct(pid, order.customerId);
    }

    // D-15: unticked opt-in — record only when explicitly granted.
    if (input.marketingConsent && order.customerId) {
      await this.prisma.consent.create({
        data: { customerId: order.customerId, type: 'marketing_email', status: 'granted', source: 'checkout' },
      });
    }

    // Transfer/gateway → PENDING_PAYMENT; POD stays DRAFT for staff confirmation (D-01/D-07).
    if (input.paymentMethod !== 'pod') {
      await this.orders.confirmDraft(STOREFRONT_ACTOR, order.id);
    } else {
      await this.orders.addEvent(order.id, 'placed_web_pod', { note: 'Awaiting staff POD confirmation' });
    }

    const token = trackingToken(order.id);
    const response: Record<string, unknown> = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      total: order.grandTotal,
      trackingToken: token,
      trackingUrl: `/track/${order.id}?t=${token}`,
    };

    // No bank-transfer branch: the web is Paystack-only, so no account details are ever surfaced.
    if (input.paymentMethod === 'gateway') {
      if (process.env.PAYSTACK_SECRET_KEY) {
        // Real Paystack: initialise and hand back the checkout URL to redirect to.
        const email = input.contact.email
          || `${input.contact.phone.replace(/\D/g, '')}@guest.zahrahfashion.com`;
        const base = (input.origin || process.env.STOREFRONT_URL || '').replace(/\/$/, '');
        const paystack = await this.paystackInitialize({
          orderId: order.id,
          amountKobo: order.grandTotal,
          email,
          callbackUrl: `${base}/checkout/done`,
        });
        response.paystack = paystack;
      } else {
        // Dev fallback (no key configured) — the done page offers a simulate button.
        response.paystack = { simulated: true };
      }
    }
    return response;
  }

  /** Start a Paystack transaction; returns the hosted checkout URL to redirect to. */
  private async paystackInitialize(params: { orderId: string; amountKobo: number; email: string; callbackUrl: string }) {
    const key = process.env.PAYSTACK_SECRET_KEY!;
    const reference = `zf_${params.orderId}_${Date.now().toString(36)}`;
    const res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: params.amountKobo, // already in kobo
        email: params.email,
        reference,
        currency: 'NGN',
        callback_url: params.callbackUrl || undefined,
        metadata: { orderId: params.orderId },
      }),
    }).catch((e) => { console.error('[paystack] init request failed', e); return null; });
    const data = (await res?.json().catch(() => null)) as { status?: boolean; message?: string; data?: { authorization_url: string; reference: string } } | null;
    if (!res?.ok || !data?.status || !data.data) {
      console.error('[paystack] initialize failed', res?.status, data?.message);
      throw new BadRequestException('Could not start the payment — please try again');
    }
    return { authorizationUrl: data.data.authorization_url, reference: data.data.reference };
  }

  /** Verify a transaction with Paystack and confirm the order on success. */
  async verifyPaystack(reference: string) {
    const key = process.env.PAYSTACK_SECRET_KEY;
    if (!key) throw new BadRequestException('Online payment is not configured');
    const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${key}` },
    }).catch((e) => { console.error('[paystack] verify request failed', e); return null; });
    const data = (await res?.json().catch(() => null)) as { status?: boolean; data?: { status: string; reference: string; amount?: number; metadata?: { orderId?: string; kind?: string; giftCardId?: string } } } | null;
    if (!res?.ok || !data?.status || !data.data) throw new BadRequestException('Could not verify the payment');
    const tx = data.data;
    // Gift-card / balance-top-up payments settle in the wallet, not as an order.
    if (tx.metadata?.kind === 'giftcard' || tx.metadata?.kind === 'balance') {
      return this.wallet.settle(tx.metadata.kind, tx);
    }
    const orderId = tx.metadata?.orderId;
    if (!orderId) throw new BadRequestException('Payment is missing its order reference');
    if (tx.status === 'success') {
      await this.orders.confirmGatewayPayment(orderId, tx.reference);
      return { status: 'success' as const, orderId };
    }
    return { status: tx.status, orderId };
  }

  /** Guest "I've sent it" acknowledgment (FR-SF-CHK-06). */
  async acknowledgeTransfer(orderId: string, token: string) {
    this.assertToken(orderId, token);
    await this.orders.addEvent(orderId, 'customer_transfer_sent', { note: 'Customer says the transfer has been sent' });
    return { ok: true };
  }

  assertToken(orderId: string, token: string) {
    if (!token || trackingToken(orderId) !== token) throw new NotFoundException('Order not found');
  }

  /** S-D-09 / S-BR-14: tokenized guest tracking — status, never full PII. */
  async track(orderId: string, token: string) {
    this.assertToken(orderId, token);
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        lines: true,
        customer: { select: { fullName: true } },
        shipments: { orderBy: { createdAt: 'desc' }, take: 1 },
        deliveryZone: { select: { name: true } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');

    const status = customerStatus(order.status, order.paymentMethod);
    const shipment = order.shipments[0];
    return {
      orderNumber: order.orderNumber,
      firstName: order.customer?.fullName.split(' ')[0] ?? 'there',
      placedAt: order.placedAt,
      status: status.label,
      step: status.step,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      awaitingPayment: order.status === 'PENDING_PAYMENT',
      total: order.grandTotal,
      zone: order.deliveryZone?.name ?? null,
      items: order.lines.map((l) => ({ name: l.productNameSnapshot, quantity: Number(l.quantity), unit: l.unitSnapshot })),
      shipment: shipment
        ? {
            method: shipment.method,
            riderFirstName: shipment.riderName?.split(' ')[0] ?? null,
            trackingRef: shipment.trackingRef,
            status: shipment.status,
          }
        : null,
    };
  }

  /** cart_ref snapshots (S-BR-11) — staff restore for WhatsApp handoffs. */
  async saveCartRef(lines: StoreCartLine[], code?: string | null) {
    const snapshot = await this.prisma.cartSnapshot.create({ data: { lines: lines as never, code: code ?? null } });
    return { cartRef: snapshot.id };
  }

  async getCartRef(id: string) {
    const snapshot = await this.prisma.cartSnapshot.findUnique({ where: { id } });
    if (!snapshot) throw new NotFoundException('Cart reference not found');
    return snapshot;
  }
}
