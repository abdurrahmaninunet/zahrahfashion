import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { z } from 'zod';
import { Public } from '../auth/decorators';
import { parse } from '../common/zod';
import { PrismaService } from '../prisma/prisma.service';
import { StoreCheckoutService } from './store-checkout.service';
import { CustomerAuthService } from './customer-auth.service';
import { OrdersService } from '../orders/orders.service';

const personalizationSchema = z.object({
  mode: z.enum(['solo', 'names', 'design']),
  text: z.string().max(500).optional(),
  names: z.array(z.string().max(80)).max(500).optional(),
  // MIM design editor: flattened preview image URL + the structured recipe.
  previewUrl: z.string().max(2000).optional(),
  spec: z.any().optional(),
}).optional();

const cartLinesSchema = z.array(z.object({
  variantId: z.string().optional(),
  bundleProductId: z.string().optional(),
  formatId: z.string().optional(),
  personalization: personalizationSchema,
  anko: z.boolean().optional(),
  quantity: z.number().positive(),
})).min(1).max(50);

const placeSchema = z.object({
  contact: z.object({
    phone: z.string().min(7),
    name: z.string().max(200).optional(),
    email: z.string().email().nullable().optional(),
  }),
  delivery: z.object({
    pickup: z.boolean().optional(),
    zoneId: z.string().nullable().optional(),
    addressLine: z.string().max(500).optional(),
    area: z.string().max(120).optional(),
    city: z.string().max(120).optional(),
    landmark: z.string().max(200).optional(),
    addressId: z.string().optional(),
  }),
  paymentMethod: z.enum(['gateway', 'transfer', 'pod']),
  lines: cartLinesSchema,
  code: z.string().nullable().optional(),
  marketingConsent: z.boolean().optional(),
  origin: z.string().url().optional(), // storefront origin for the Paystack callback
});

@Public()
@Controller('store')
export class StoreCheckoutController {
  constructor(
    private checkout: StoreCheckoutService,
    private customerAuth: CustomerAuthService,
    private orders: OrdersService,
    private prisma: PrismaService,
  ) {}

  @Post('cart/evaluate')
  async evaluate(@Body() body: unknown, @Req() req: Request) {
    const data = parse(
      z.object({ lines: cartLinesSchema, code: z.string().nullable().optional(), zoneId: z.string().nullable().optional(), phone: z.string().optional() }),
      body,
    );
    const customer = await this.customerAuth.resolve(req);
    return this.checkout.evaluateCart({ ...data, customerId: customer?.id ?? null });
  }

  @Get('checkout/methods')
  async methods(@Req() req: Request, @Query('zoneId') zoneId?: string, @Query('total') total?: string, @Query('phone') phone?: string) {
    const customer = await this.customerAuth.resolve(req);
    return this.checkout.paymentMethods({
      zoneId: zoneId || null,
      total: Number(total) || 0,
      phone,
      customerId: customer?.id ?? null,
    });
  }

  @Get('zones')
  zones() {
    return this.prisma.zone.findMany({
      where: { status: 'active' },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, areasText: true, deliveryFee: true, podAllowed: true },
    });
  }

  @Post('checkout/place')
  async place(@Body() body: unknown, @Req() req: Request) {
    const data = parse(placeSchema, body);
    const customer = await this.customerAuth.resolve(req);
    return this.checkout.placeOrder({ ...data, customerId: customer?.id ?? null } as never);
  }

  /** Verify a Paystack transaction server-side (called when Paystack redirects
   *  back), then confirm the order. Never trusts the client for payment state. */
  @Post('checkout/paystack/verify')
  async paystackVerify(@Body() body: unknown) {
    const { reference } = parse(z.object({ reference: z.string().min(6) }), body);
    return this.checkout.verifyPaystack(reference);
  }

  /** Paystack webhook — confirms even if the shopper closes the tab. Safe without
   *  signature checks because it re-verifies each reference with Paystack directly. */
  @Post('checkout/paystack/webhook')
  async paystackWebhook(@Body() body: unknown) {
    const evt = body as { event?: string; data?: { reference?: string } };
    if (evt?.event === 'charge.success' && evt.data?.reference) {
      try { await this.checkout.verifyPaystack(evt.data.reference); } catch { /* ignore — verify is the gate */ }
    }
    return { received: true };
  }

  /** Local Paystack stand-in (dev only, when PAYSTACK_SECRET_KEY isn't set). */
  @Post('checkout/:orderId/pay-simulate')
  async paySimulate(@Param('orderId') orderId: string, @Body() body: unknown) {
    const { token } = parse(z.object({ token: z.string() }), body);
    this.checkout.assertToken(orderId, token);
    return this.orders.confirmGatewayPayment(orderId, `SIM-${Date.now().toString(36).toUpperCase()}`);
  }

  @Post('checkout/:orderId/transfer-sent')
  transferSent(@Param('orderId') orderId: string, @Body() body: unknown) {
    const { token } = parse(z.object({ token: z.string() }), body);
    return this.checkout.acknowledgeTransfer(orderId, token);
  }

  @Get('track/:orderId')
  track(@Param('orderId') orderId: string, @Query('t') token?: string) {
    return this.checkout.track(orderId, token ?? '');
  }

  @Post('cart-ref')
  saveCartRef(@Body() body: unknown) {
    const { lines, code } = parse(z.object({ lines: cartLinesSchema, code: z.string().nullable().optional() }), body);
    return this.checkout.saveCartRef(lines, code);
  }

  @Get('cart-ref/:id')
  getCartRef(@Param('id') id: string) {
    return this.checkout.getCartRef(id);
  }
}
