import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { z } from 'zod';
import { Cap, Public } from '../auth/decorators';
import { parse } from '../common/zod';
import { PartnershipService } from './partnership.service';

const credsSchema = z.object({ email: z.string().email(), password: z.string().min(1).max(100) });

const styleSchema = z.object({
  image: z.string().max(600).nullable().optional(),
  label: z.string().max(120).optional(),
  stock: z.number().int().min(0).default(0),
});

const productSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  wholesalePrice: z.number().int().min(0),
  stock: z.number().int().min(0).default(0),
  image: z.string().max(600).nullable().optional(),
  status: z.enum(['active', 'hidden']).optional(),
  styles: z.array(styleSchema).max(50).optional(),
});

const applySchema = z.object({
  name: z.string().max(160).optional(),
  businessName: z.string().max(200).optional(),
  email: z.string().email(),
  phone: z.string().max(40).optional(),
  address: z.string().max(500).optional(),
  note: z.string().max(2000).optional(),
});

@Controller('partnership')
export class PartnershipController {
  constructor(private partnership: PartnershipService) {}

  // ── Public (portal apply form) ──────────────────────────────────────────────
  @Public()
  @Post('apply')
  apply(@Body() body: unknown) {
    return this.partnership.apply(parse(applySchema, body));
  }

  // ── Partner portal auth + catalogue (session cookie, not staff auth) ─────────
  // Sign-in is two-step: password → emailed 2FA code → session.
  @Public()
  @Post('login')
  login(@Body() body: unknown) {
    const { email, password } = parse(credsSchema, body);
    return this.partnership.login(email, password);
  }

  @Public()
  @Post('login/verify')
  loginVerify(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const { email, code } = parse(z.object({ email: z.string().email(), code: z.string().min(4).max(8) }), body);
    return this.partnership.loginVerify(email, code, res);
  }

  // Activation is two-step: request code → verify code + set first password.
  @Public()
  @Post('activate/request')
  requestActivation(@Body() body: unknown) {
    const { email } = parse(z.object({ email: z.string().email() }), body);
    return this.partnership.requestActivationOtp(email);
  }

  @Public()
  @Post('activate')
  activate(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const { email, password, code } = parse(z.object({ email: z.string().email(), password: z.string().min(8).max(100), code: z.string().min(4).max(8) }), body);
    return this.partnership.activate(email, password, code, res);
  }

  // Forgot password: request code → verify code + set new password.
  @Public()
  @Post('password/reset/request')
  requestReset(@Body() body: unknown) {
    const { email } = parse(z.object({ email: z.string().email() }), body);
    return this.partnership.requestReset(email);
  }

  @Public()
  @Post('password/reset')
  resetPassword(@Body() body: unknown) {
    const { email, code, newPassword } = parse(z.object({ email: z.string().email(), code: z.string().min(4).max(8), newPassword: z.string().min(8).max(100) }), body);
    return this.partnership.resetPassword(email, code, newPassword);
  }

  @Public()
  @Post('logout')
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.partnership.logout(req, res);
  }

  @Public()
  @Get('me')
  me(@Req() req: Request) {
    return this.partnership.me(req);
  }

  @Public()
  @Put('profile')
  async updateProfile(@Body() body: unknown, @Req() req: Request) {
    const partner = await this.partnership.requirePartner(req);
    const data = parse(z.object({ name: z.string().max(160).optional(), businessName: z.string().max(200).optional(), phone: z.string().max(40).optional() }), body);
    return this.partnership.updateProfile(partner.id, data);
  }

  @Public()
  @Post('password/change')
  async changePassword(@Body() body: unknown, @Req() req: Request) {
    const partner = await this.partnership.requirePartner(req);
    const { currentPassword, newPassword } = parse(z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(100) }), body);
    return this.partnership.changePassword(partner.id, currentPassword, newPassword);
  }

  @Public()
  @Get('catalog')
  async catalog(@Req() req: Request) {
    await this.partnership.requirePartner(req);
    return this.partnership.catalog();
  }

  @Public()
  @Get('catalog/:id')
  async catalogItem(@Param('id') id: string, @Req() req: Request) {
    await this.partnership.requirePartner(req);
    return this.partnership.catalogProduct(id);
  }

  // Placing an order is two-step: request a code, then confirm + pay with it.
  @Public()
  @Post('orders/otp')
  async requestOrderOtp(@Req() req: Request) {
    const partner = await this.partnership.requirePartner(req);
    return this.partnership.requestOrderOtp(partner.email);
  }

  @Public()
  @Post('orders')
  async placeOrder(@Body() body: unknown, @Req() req: Request) {
    const partner = await this.partnership.requirePartner(req);
    const { items, note, origin, code } = parse(
      z.object({
        items: z.array(z.object({
          productId: z.string(),
          quantity: z.number().int().positive().optional(),
          styleMode: z.enum(['auto', 'manual']).optional(),
          styleQtys: z.record(z.string(), z.number().int().min(0)).optional(),
        })).min(1),
        note: z.string().max(1000).optional(),
        origin: z.string().url().max(300).optional(),
        code: z.string().min(4).max(8),
      }),
      body,
    );
    const base = origin || `${req.protocol}://${req.get('host')}`;
    return this.partnership.placeAndPay(partner.id, partner.email, base, items, note, code);
  }

  @Public()
  @Post('orders/verify')
  async verifyOrder(@Body() body: unknown, @Req() req: Request) {
    const partner = await this.partnership.requirePartner(req);
    const { reference } = parse(z.object({ reference: z.string().min(3).max(200) }), body);
    return this.partnership.confirmPayment(reference, partner.id, false);
  }

  @Public()
  @Post('orders/simulate')
  async simulateOrder(@Body() body: unknown, @Req() req: Request) {
    const partner = await this.partnership.requirePartner(req);
    const { reference } = parse(z.object({ reference: z.string().min(3).max(200) }), body);
    return this.partnership.confirmPayment(reference, partner.id, true);
  }

  @Public()
  @Get('orders')
  async myOrders(@Req() req: Request) {
    const partner = await this.partnership.requirePartner(req);
    return this.partnership.listPartnerOrders(partner.id);
  }

  // ── Admin — partner orders ──────────────────────────────────────────────────
  @Get('orders/all')
  @Cap('products.view')
  allOrders(@Query('status') status?: string) {
    return this.partnership.listAllOrders(status);
  }

  @Put('orders/:id/status')
  @Cap('products.create_edit')
  updateOrderStatus(@Param('id') id: string, @Body() body: unknown) {
    const { status } = parse(z.object({ status: z.enum(['pending', 'confirmed', 'fulfilled', 'cancelled']) }), body);
    return this.partnership.updateOrderStatus(id, status);
  }

  // ── Admin — partnership products ────────────────────────────────────────────
  @Get('products')
  @Cap('products.view')
  listProducts() {
    return this.partnership.listProducts();
  }

  @Post('products')
  @Cap('products.create_edit')
  createProduct(@Body() body: unknown) {
    return this.partnership.createProduct(parse(productSchema, body));
  }

  @Put('products/:id')
  @Cap('products.create_edit')
  updateProduct(@Param('id') id: string, @Body() body: unknown) {
    return this.partnership.updateProduct(id, parse(productSchema.partial(), body));
  }

  @Delete('products/:id')
  @Cap('products.create_edit')
  removeProduct(@Param('id') id: string) {
    return this.partnership.removeProduct(id);
  }

  // ── Admin — partner applications ────────────────────────────────────────────
  @Get('applications')
  @Cap('products.view')
  listApplications(@Query('status') status?: string) {
    return this.partnership.listApplications(status);
  }

  @Put('applications/:id')
  @Cap('products.create_edit')
  reviewApplication(@Param('id') id: string, @Body() body: unknown) {
    const { action } = parse(z.object({ action: z.enum(['approve', 'reject']) }), body);
    return this.partnership.reviewApplication(id, action);
  }

  // ── Admin — partner accounts (post-approval controls) ────────────────────────
  @Put('partners/:id')
  @Cap('products.create_edit')
  setPartnerStatus(@Param('id') id: string, @Body() body: unknown) {
    const { action } = parse(z.object({ action: z.enum(['suspend', 'activate']) }), body);
    return this.partnership.setPartnerStatus(id, action);
  }

  @Delete('partners/:id')
  @Cap('products.create_edit')
  removePartner(@Param('id') id: string) {
    return this.partnership.removePartner(id);
  }
}
