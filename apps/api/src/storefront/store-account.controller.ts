import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { z } from 'zod';
import { Public } from '../auth/decorators';
import { parse } from '../common/zod';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { CustomerAuthService, trackingToken } from './customer-auth.service';
import { customerStatus } from './store-checkout.service';
import { OrdersService } from '../orders/orders.service';
import { CustomersService } from '../customers/customers.service';
import { tryNormalizePhone } from '../customers/phone';
import { ReviewsService } from '../reviews/reviews.service';
import { AnkoService } from '../anko/anko.service';
import { ContactService } from '../contact/contact.service';
import { WalletService } from '../wallet/wallet.service';
import { WishlistAlertsService } from './wishlist-alerts.service';
import { AuthedUser } from '../auth/auth.types';

const amountSchema = z.object({ amount: z.number().int().positive(), origin: z.string().max(200).optional() });

const reviewSchema = z.object({
  productId: z.string(),
  rating: z.number().int().min(1).max(5),
  body: z.string().max(2000).optional(),
});

const addressSchema = z.object({
  label: z.string().max(60).optional(),
  addressLine: z.string().min(3).max(500),
  area: z.string().max(120).optional(),
  city: z.string().max(120).optional(),
  landmark: z.string().max(200).optional(),
  zoneId: z.string().nullable().optional(),
  isDefault: z.boolean().default(false),
});

/** Customer account area (Customer FR-ACC / Storefront FR-SF-ACC). */
@Public()
@Controller('store/account')
export class StoreAccountController {
  constructor(
    private customerAuth: CustomerAuthService,
    private prisma: PrismaService,
    private settings: SettingsService,
    private orders: OrdersService,
    private customers: CustomersService,
    private reviews: ReviewsService,
    private anko: AnkoService,
    private contactInbox: ContactService,
    private wallet: WalletService,
    private wishlistAlerts: WishlistAlertsService,
  ) {}

  // ── Gift cards & balance (signed-in) ──────────────────────────────────────
  @Post('gift-cards/purchase')
  async purchaseGiftCard(@Body() body: unknown, @Req() req: Request) {
    const customer = await this.customerAuth.requireCustomer(req);
    const { amount, origin } = parse(amountSchema, body);
    return this.wallet.purchaseGiftCard({ id: customer.id, email: customer.email }, amount, origin);
  }

  @Get('gift-cards')
  async giftCards(@Req() req: Request) {
    const customer = await this.customerAuth.requireCustomer(req);
    return this.wallet.listGiftCards(customer.id);
  }

  @Post('gift-cards/:id/share')
  async shareGiftCard(@Param('id') id: string, @Body() body: unknown, @Req() req: Request) {
    const customer = await this.customerAuth.requireCustomer(req);
    const { email, phone, message } = parse(z.object({ email: z.string().email(), phone: z.string().max(40).optional(), message: z.string().max(2000).optional() }), body);
    return this.wallet.shareGiftCard(customer.id, id, email, phone, message);
  }

  @Post('gift-cards/:id/use')
  async useGiftCard(@Param('id') id: string, @Req() req: Request) {
    const customer = await this.customerAuth.requireCustomer(req);
    return this.wallet.useGiftCard(customer.id, id);
  }

  @Get('balance')
  async balance(@Req() req: Request) {
    const customer = await this.customerAuth.requireCustomer(req);
    return this.wallet.getBalance(customer.id);
  }

  @Post('balance/topup')
  async topup(@Body() body: unknown, @Req() req: Request) {
    const customer = await this.customerAuth.requireCustomer(req);
    const { amount, origin } = parse(amountSchema, body);
    return this.wallet.topupBalance({ id: customer.id, email: customer.email }, amount, origin);
  }

  /** Server-generated PDF receipt for one wallet transaction. */
  @Get('balance/receipt/:ledgerId')
  async balanceReceipt(@Param('ledgerId') ledgerId: string, @Req() req: Request, @Res() res: Response) {
    const customer = await this.customerAuth.requireCustomer(req);
    const { filename, bytes } = await this.wallet.receiptPdf(customer.id, ledgerId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(bytes.length),
    });
    res.end(Buffer.from(bytes));
  }

  @Post('balance/claim')
  async claim(@Body() body: unknown, @Req() req: Request) {
    const customer = await this.customerAuth.requireCustomer(req);
    const { code, password } = parse(z.object({ code: z.string().min(12).max(30), password: z.string().min(4).max(40) }), body);
    return this.wallet.claimGiftCard(customer.id, code, password);
  }

  /** Dev-only: settle a gift-card/top-up without a real Paystack round-trip. */
  @Post('wallet/simulate')
  async walletSimulate(@Body() body: unknown, @Req() req: Request) {
    await this.customerAuth.requireCustomer(req);
    const { reference } = parse(z.object({ reference: z.string().min(6) }), body);
    return this.wallet.simulate(reference);
  }

  /** Does the signed-in customer hold the active anko lock on this fabric?
   *  (lets the holder keep buying while others are blocked). */
  @Get('anko/mine')
  async ankoMine(@Query('productId') productId: string, @Req() req: Request) {
    const customer = await this.customerAuth.requireCustomer(req);
    return { heldByMe: await this.anko.heldBy(productId, customer.id) };
  }

  // ── Product reviews (verified buyers) ─────────────────────────────────────
  /** Whether the signed-in customer may review a product + their existing one. */
  @Get('reviews/mine')
  async myReview(@Query('productId') productId: string, @Req() req: Request) {
    const customer = await this.customerAuth.requireCustomer(req);
    return this.reviews.myReview(customer.id, productId);
  }

  @Post('reviews')
  async writeReview(@Body() body: unknown, @Req() req: Request) {
    const customer = await this.customerAuth.requireCustomer(req);
    const data = parse(reviewSchema, body);
    return this.reviews.create(customer.id, data.productId, data.rating, data.body ?? '');
  }

  // ── Auth ───────────────────────────────────────────────────────────────────

  @Post('register')
  register(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const data = parse(
      z.object({ name: z.string().max(200).optional(), phone: z.string().min(7), email: z.string().email(), password: z.string().min(8) }),
      body,
    );
    return this.customerAuth.register(data, res);
  }

  @Post('register/start')
  registerStart(@Body() body: unknown) {
    const data = parse(
      z.object({ name: z.string().max(200).optional(), phone: z.string().min(7), email: z.string().email(), password: z.string().min(8) }),
      body,
    );
    return this.customerAuth.startRegistration(data);
  }

  @Post('register/verify')
  registerVerify(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const { pendingToken, code } = parse(z.object({ pendingToken: z.string().min(10), code: z.string().length(6) }), body);
    return this.customerAuth.verifyRegistration(pendingToken, code, res);
  }

  @Post('google')
  google(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const { credential } = parse(z.object({ credential: z.string().min(10) }), body);
    return this.customerAuth.googleSignIn(credential, res);
  }

  @Post('login')
  login(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const { identifier, password } = parse(z.object({ identifier: z.string().min(3), password: z.string().min(1) }), body);
    return this.customerAuth.login(identifier, password, res);
  }

  @Post('reset/start')
  resetStart(@Body() body: unknown) {
    // Password reset is email-only (no phone) — D-reset.
    const { email } = parse(z.object({ email: z.string().email() }), body);
    return this.customerAuth.startPasswordReset(email);
  }

  @Post('contact')
  async contact(@Body() body: unknown) {
    const data = parse(
      z.object({
        name: z.string().max(120).optional(),
        email: z.string().email(),
        phone: z.string().max(40).optional(),
        subject: z.string().max(160).optional(),
        message: z.string().min(1).max(4000),
      }),
      body,
    );
    // Store it in the admin Contact inbox first (reliable), then best-effort email.
    await this.contactInbox.save(data);
    try { await this.customerAuth.sendContactMessage(data); } catch { /* email is best-effort */ }
    return { ok: true };
  }

  @Post('reset/verify')
  resetVerify(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const { pendingToken, code, password } = parse(
      z.object({ pendingToken: z.string().min(10), code: z.string().length(6), password: z.string().min(8) }),
      body,
    );
    return this.customerAuth.verifyPasswordReset(pendingToken, code, password, res);
  }

  // ── Wishlist (account-synced; guests use the device-local store) ────────────

  @Get('wishlist')
  async getWishlist(@Req() req: Request) {
    const customer = await this.customerAuth.requireCustomer(req);
    const rows = await this.prisma.$queryRaw<{ wishlist: string[] }[]>`SELECT wishlist FROM customers WHERE id = ${customer.id}`;
    return { ids: rows[0]?.wishlist ?? [] };
  }

  /** Replace the customer's saved set (the client sends the full merged list). */
  @Put('wishlist')
  async putWishlist(@Body() body: unknown, @Req() req: Request) {
    const customer = await this.customerAuth.requireCustomer(req);
    const { ids } = parse(z.object({ ids: z.array(z.string().max(64)).max(500) }), body);
    const unique = [...new Set(ids)];
    await this.prisma.$executeRaw`UPDATE customers SET wishlist = ${unique}::text[] WHERE id = ${customer.id}`;
    return { ids: unique };
  }

  // ── Wishlist alerts (price drop / back in stock) ───────────────────────────

  @Get('wishlist-alerts')
  async wishlistAlertsList(@Req() req: Request) {
    const customer = await this.customerAuth.requireCustomer(req);
    return this.wishlistAlerts.list(customer.id);
  }

  @Post('wishlist-alerts')
  async wishlistAlertsSet(@Body() body: unknown, @Req() req: Request) {
    const customer = await this.customerAuth.requireCustomer(req);
    const { productIds, notifyPrice, notifyStock } = parse(
      z.object({
        productIds: z.array(z.string().max(64)).min(1).max(200),
        notifyPrice: z.boolean().optional(),
        notifyStock: z.boolean().optional(),
      }),
      body,
    );
    return this.wishlistAlerts.set(customer.id, productIds, { notifyPrice, notifyStock });
  }

  /** Dev-only: run the alert scan immediately (production uses the hourly cron). */
  @Post('wishlist-alerts/run')
  async wishlistAlertsRun(@Req() req: Request) {
    await this.customerAuth.requireCustomer(req);
    if (process.env.NODE_ENV === 'production') throw new BadRequestException('Not available');
    return this.wishlistAlerts.scan();
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.customerAuth.logout(req, res);
    return { ok: true };
  }

  @Get('me')
  async me(@Req() req: Request) {
    const customer = await this.customerAuth.resolve(req);
    if (!customer) return { customer: null };
    const consents = await this.prisma.consent.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: 'asc' },
    });
    const consentNow: Record<string, string> = {};
    for (const c of consents) consentNow[c.type] = c.status;
    const cred = await this.prisma.customerCredential.findUnique({
      where: { customerId: customer.id },
      select: { verifiedAt: true },
    });
    const hasPassword = !!cred;
    // Verified when there's an email and either a verified password credential or
    // a Google account (which has no credential but a Google-verified email).
    const emailVerified = !!customer.email && (cred ? !!cred.verifiedAt : true);
    return {
      customer: {
        id: customer.id,
        fullName: customer.fullName,
        phone: customer.primaryPhone,
        email: customer.email,
        hasPassword,
        emailVerified,
        memberSince: customer.createdAt,
        consentNow,
      },
    };
  }

  @Put('profile')
  async updateProfile(@Body() body: unknown, @Req() req: Request) {
    const customer = await this.customerAuth.requireCustomer(req);
    const { fullName, phone } = parse(
      z.object({ fullName: z.string().min(1).max(200), phone: z.string().max(40).optional() }),
      body,
    );
    const data: { fullName: string; primaryPhone?: string } = { fullName };
    if (phone !== undefined && phone.trim()) {
      const normalized = tryNormalizePhone(phone);
      if (!normalized) throw new BadRequestException('Enter a valid phone number');
      if (normalized !== customer.primaryPhone) {
        const clash = await this.prisma.customer.findUnique({ where: { primaryPhone: normalized } });
        if (clash && clash.id !== customer.id) throw new BadRequestException('That phone number is already in use on another account.');
        data.primaryPhone = normalized;
      }
    }
    await this.prisma.customer.update({ where: { id: customer.id }, data });
    return { ok: true };
  }

  /** Change password (signed-in): verify the current password → email an OTP. */
  @Post('password/change/start')
  async passwordChangeStart(@Body() body: unknown, @Req() req: Request) {
    const customer = await this.customerAuth.requireCustomer(req);
    const { oldPassword, newPassword } = parse(
      z.object({ oldPassword: z.string().min(1), newPassword: z.string().min(8) }),
      body,
    );
    return this.customerAuth.startPasswordChange(customer.id, oldPassword, newPassword);
  }

  /** Confirm the OTP → apply the new password. */
  @Post('password/change/verify')
  async passwordChangeVerify(@Body() body: unknown, @Req() req: Request) {
    const customer = await this.customerAuth.requireCustomer(req);
    const { pendingToken, code } = parse(
      z.object({ pendingToken: z.string().min(10), code: z.string().length(6) }),
      body,
    );
    return this.customerAuth.verifyPasswordChange(customer.id, pendingToken, code);
  }

  /** Change email (signed-in): email an OTP to the NEW address. */
  @Post('email/change/start')
  async emailChangeStart(@Body() body: unknown, @Req() req: Request) {
    const customer = await this.customerAuth.requireCustomer(req);
    const { email } = parse(z.object({ email: z.string().email() }), body);
    return this.customerAuth.startEmailChange(customer.id, email);
  }

  /** Confirm the OTP → apply the new email. */
  @Post('email/change/verify')
  async emailChangeVerify(@Body() body: unknown, @Req() req: Request) {
    const customer = await this.customerAuth.requireCustomer(req);
    const { pendingToken, code } = parse(
      z.object({ pendingToken: z.string().min(10), code: z.string().length(6) }),
      body,
    );
    return this.customerAuth.verifyEmailChange(customer.id, pendingToken, code);
  }

  @Post('consent')
  async consent(@Body() body: unknown, @Req() req: Request) {
    const customer = await this.customerAuth.requireCustomer(req);
    const { type, status } = parse(
      z.object({ type: z.enum(['marketing_email', 'marketing_sms', 'marketing_whatsapp']), status: z.enum(['granted', 'revoked']) }),
      body,
    );
    await this.prisma.consent.create({ data: { customerId: customer.id, type, status, source: 'account' } });
    return { ok: true };
  }

  // ── Orders (FR-SF-ACC-02/03) ───────────────────────────────────────────────

  @Get('orders')
  async ordersList(@Req() req: Request) {
    const customer = await this.customerAuth.requireCustomer(req);
    const orders = await this.prisma.order.findMany({
      where: { customerId: customer.id, status: { not: 'DRAFT' } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { lines: { select: { productNameSnapshot: true, quantity: true } } },
    });
    return orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      placedAt: o.placedAt ?? o.createdAt,
      total: o.grandTotal,
      status: customerStatus(o.status, o.paymentMethod).label,
      step: customerStatus(o.status, o.paymentMethod).step,
      itemsSummary: o.lines.map((l) => `${Number(l.quantity)}× ${l.productNameSnapshot}`).slice(0, 3).join(', '),
      trackingUrl: `/track/${o.id}?t=${trackingToken(o.id)}`,
    }));
  }

  @Get('orders/:id')
  async orderDetail(@Param('id') id: string, @Req() req: Request) {
    const customer = await this.customerAuth.requireCustomer(req);
    const order = await this.prisma.order.findFirst({
      where: { id, customerId: customer.id },
      include: {
        lines: true,
        payments: { where: { status: 'confirmed' }, select: { method: true, amount: true, createdAt: true } },
        returns: { include: { lines: true } },
        deliveryZone: { select: { name: true } },
      },
    });
    if (!order) throw new BadRequestException('Order not found');

    const windowDays = await this.settings.get<number>('orders.return_window_days');
    const withinWindow = order.deliveredAt
      ? Date.now() - order.deliveredAt.getTime() <= windowDays * 86_400_000
      : false;

    const lines = [];
    for (const line of order.lines) {
      let returnable = withinWindow && Number(line.qtyShipped) - Number(line.qtyReturned) > 0;
      let nonReturnableReason: string | null = null;
      if (returnable && line.variantId) {
        const variant = await this.prisma.variant.findUnique({
          where: { id: line.variantId },
          include: { product: { include: { category: true } } },
        });
        if (variant && !variant.product.category.returnEligible) {
          returnable = false;
          nonReturnableReason = `${variant.product.category.name} items are non-returnable`; // D-09
        }
      }
      if (!withinWindow && order.deliveredAt) nonReturnableReason = `Return window (${windowDays} days) has closed`;
      lines.push({
        id: line.id,
        name: line.productNameSnapshot,
        quantity: Number(line.quantity),
        unit: line.unitSnapshot,
        unitPrice: line.unitPriceSnapshot,
        lineTotal: line.lineTotal,
        eligibleQty: Number(line.qtyShipped) - Number(line.qtyReturned),
        returnable,
        nonReturnableReason,
      });
    }

    const status = customerStatus(order.status, order.paymentMethod);
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      placedAt: order.placedAt ?? order.createdAt,
      status: status.label,
      step: status.step,
      awaitingPayment: order.status === 'PENDING_PAYMENT',
      paymentMethod: order.paymentMethod,
      subtotal: order.subtotal,
      discountTotal: order.discountTotal,
      shippingFee: order.shippingFee,
      taxTotal: order.taxTotal,
      total: order.grandTotal,
      zone: order.deliveryZone?.name,
      address: order.address,
      lines,
      payments: order.payments,
      returns: order.returns.map((r) => ({ id: r.id, status: r.status, reasonCode: r.reasonCode, requestedAt: r.requestedAt })),
      trackingUrl: `/track/${order.id}?t=${trackingToken(order.id)}`,
      deliveredAt: order.deliveredAt,
      returnWindowDays: windowDays,
    };
  }

  @Post('orders/:id/return')
  async requestReturn(@Param('id') id: string, @Body() body: unknown, @Req() req: Request) {
    const customer = await this.customerAuth.requireCustomer(req);
    const order = await this.prisma.order.findFirst({ where: { id, customerId: customer.id } });
    if (!order) throw new BadRequestException('Order not found');
    const data = parse(
      z.object({
        reasonCode: z.enum(['changed_mind', 'wrong_item', 'damaged_item', 'quality_issue', 'size_issue']),
        lines: z.array(z.object({ orderLineId: z.string(), quantity: z.number().positive() })).min(1),
      }),
      body,
    );
    const actor: AuthedUser = {
      id: `customer:${customer.id}`, name: customer.fullName, email: customer.email ?? '',
      roleKey: 'customer', status: 'active', totpEnabled: false, capabilities: new Set(),
    };
    return this.orders.requestReturn(actor, id, data as never);
  }

  // ── Addresses (FR-SF-ACC-05) ───────────────────────────────────────────────

  @Get('addresses')
  async addresses(@Req() req: Request) {
    const customer = await this.customerAuth.requireCustomer(req);
    return this.prisma.customerAddress.findMany({
      where: { customerId: customer.id, status: 'active' },
      orderBy: { isDefault: 'desc' },
    });
  }

  @Post('addresses')
  async addAddress(@Body() body: unknown, @Req() req: Request) {
    const customer = await this.customerAuth.requireCustomer(req);
    const data = parse(addressSchema, body);
    const addressLine = data.landmark ? `${data.addressLine} (landmark: ${data.landmark})` : data.addressLine;
    return this.prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.customerAddress.updateMany({ where: { customerId: customer.id }, data: { isDefault: false } });
      }
      return tx.customerAddress.create({
        data: { customerId: customer.id, label: data.label, addressLine, area: data.area, city: data.city, zoneId: data.zoneId ?? null, isDefault: data.isDefault },
      });
    });
  }

  @Delete('addresses/:addressId')
  async removeAddress(@Param('addressId') addressId: string, @Req() req: Request) {
    const customer = await this.customerAuth.requireCustomer(req);
    await this.prisma.customerAddress.updateMany({
      where: { id: addressId, customerId: customer.id },
      data: { status: 'archived' },
    });
    return { ok: true };
  }

  // ── NDPA self-service erasure (right to be forgotten) ─────────────────────
  // Same request pipeline the admin NDPA menu uses — one pending request per
  // customer, executed by the daily job after the grace period.

  @Get('privacy/erasure')
  async erasureStatus(@Req() req: Request) {
    const customer = await this.customerAuth.requireCustomer(req);
    const pending = await this.prisma.anonymizationRequest.findFirst({
      where: { customerId: customer.id, executedAt: null, cancelledAt: null },
    });
    const graceDays = await this.settings.get<number>('customers.anonymization_grace_days');
    return { pending: pending ? { id: pending.id, executeAfter: pending.executeAfter } : null, graceDays };
  }

  @Post('privacy/erasure')
  async requestErasure(@Req() req: Request) {
    const customer = await this.customerAuth.requireCustomer(req);
    const request = await this.customers.requestAnonymization(`customer:${customer.id}`, customer.id);
    return { id: request.id, executeAfter: request.executeAfter };
  }

  @Delete('privacy/erasure/:requestId')
  async cancelErasure(@Param('requestId') requestId: string, @Req() req: Request) {
    const customer = await this.customerAuth.requireCustomer(req);
    const request = await this.prisma.anonymizationRequest.findFirst({
      where: { id: requestId, customerId: customer.id, executedAt: null, cancelledAt: null },
    });
    if (!request) throw new BadRequestException('No pending erasure request found');
    await this.customers.cancelAnonymization(`customer:${customer.id}`, request.id);
    return { ok: true };
  }
}
