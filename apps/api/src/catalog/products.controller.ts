import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
import { z } from 'zod';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';
import { Cap } from '../auth/decorators';
import { AuthedRequest } from '../auth/auth.types';
import { parse } from '../common/zod';

const createSchema = z.object({
  categoryId: z.string(),
  name: z.string().min(1).max(200),
  slug: z.string().optional(),
  brand: z.string().max(120).optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  type: z.enum(['standard', 'bundle', 'configurable_bundle']).optional(),
  attributeValues: z.record(z.unknown()).optional(),
  sellUnitId: z.string().nullable().optional(),
  minOrderQty: z.number().positive().optional(),
  qtyIncrement: z.number().positive().optional(),
  basePrice: z.number().int().min(0).optional(),
  taxable: z.boolean().optional(),
  requiresShipping: z.boolean().optional(),
  flags: z.record(z.boolean()).optional(),
});

const variantUpdateSchema = z.object({
  name: z.string().max(120).nullable().optional(),
  sku: z.string().min(1).max(64).optional(),
  barcode: z.string().nullable().optional(),
  price: z.number().int().min(0).optional(),
  compareAtPrice: z.number().int().min(0).nullable().optional(),
  costPrice: z.number().int().min(0).nullable().optional(),
  weight: z.number().nullable().optional(),
  status: z.enum(['active', 'archived']).optional(),
});

const bundleSchema = z.object({
  components: z.array(z.object({
    variantId: z.string(),
    quantity: z.number().positive(),
    sortOrder: z.number().int().optional(),
  })).min(2).max(15),
  config: z.object({
    pricingMode: z.enum(['fixed', 'percent_off_sum']),
    fixedPrice: z.number().int().min(0).nullable().optional(),
    percentOff: z.number().min(0).max(99).nullable().optional(),
    allowBelowCost: z.boolean().optional(),
    eligibleForPromotions: z.boolean().optional(),
    maxSellable: z.number().int().positive().nullable().optional(),
    activeFrom: z.string().datetime().nullable().optional(),
    activeUntil: z.string().datetime().nullable().optional(),
    returnMode: z.enum(['whole_only', 'pro_rata']).optional(),
  }),
});

const lefeSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(200),
  price: z.number().int().min(0),
  compareAt: z.number().int().min(0).nullable().optional(),
  coverUrl: z.string().max(2000).nullable().optional(),
  components: z.array(z.object({ variantId: z.string(), quantity: z.number().positive() })).min(2).max(15),
});

const mediaSchema = z.object({
  media: z.array(z.object({
    id: z.string().optional(),
    url: z.string(),
    variantId: z.string().nullable().optional(),
    type: z.string().default('image'),
    altText: z.string().nullable().optional(),
    sortOrder: z.number().int(),
  })),
});

@Controller('products')
export class ProductsController {
  constructor(
    private products: ProductsService,
    private prisma: PrismaService,
  ) {}

  @Get()
  @Cap('products.view')
  list(
    @Query('q') q?: string,
    @Query('categoryId') categoryId?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('stock') stock?: 'low' | 'out',
    @Query('store') store?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.products.list({ q, categoryId, status, type, stock, store, page: Number(page) || 1, pageSize: Number(pageSize) || 25 });
  }

  @Get(':id')
  @Cap('products.view')
  async detail(@Param('id') id: string, @Req() req: AuthedRequest) {
    const product = await this.products.detail(id);
    if (!req.user.capabilities.has('products.view_costs')) {
      // NFR-05: cost price never exposed without the capability.
      for (const v of product.variants) (v as { costPrice: number | null }).costPrice = null;
    }
    return product;
  }

  @Post()
  @Cap('products.create_edit')
  create(@Body() body: unknown, @Req() req: AuthedRequest) {
    return this.products.create(req.user.id, parse(createSchema, body));
  }

  /** Create or update a Lefe (bridal gift package) — a Lefe-flagged bundle. */
  @Post('lefe')
  @Cap('products.create_edit')
  saveLefe(@Body() body: unknown, @Req() req: AuthedRequest) {
    return this.products.saveLefe(req.user.id, parse(lefeSchema, body));
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    const canFull = req.user.capabilities.has('products.create_edit');
    const canContent = req.user.capabilities.has('products.edit_content_only');
    if (!canFull && !canContent) throw new BadRequestException('Missing permission: products.create_edit');
    return this.products.update(req.user.id, id, body as Record<string, unknown>, !canFull);
  }

  @Post(':id/activate')
  @Cap('products.create_edit')
  activate(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.products.activate(req.user.id, id);
  }

  @Delete(':id')
  @Cap('products.archive')
  archive(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.products.archive(req.user.id, id);
  }

  @Post(':id/duplicate')
  @Cap('products.create_edit')
  duplicate(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.products.duplicate(req.user.id, id);
  }

  @Post(':id/restore')
  @Cap('products.archive')
  restore(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.products.restore(req.user.id, id);
  }

  @Delete(':id/permanent')
  @Cap('products.archive')
  deleteDraft(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.products.deleteDraft(req.user.id, id);
  }

  @Delete('variants/:variantId')
  @Cap('products.create_edit')
  deleteVariant(@Param('variantId') variantId: string, @Req() req: AuthedRequest) {
    return this.products.deleteVariant(req.user.id, variantId);
  }

  @Post(':id/variants/default')
  @Cap('products.create_edit')
  createDefaultVariant(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    const { price } = parse(z.object({ price: z.number().int().min(0).default(0) }), body ?? {});
    return this.products.createDefaultVariant(req.user.id, id, price ?? 0);
  }

  @Post(':id/variants/generate')
  @Cap('products.create_edit')
  generateVariants(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    const { selections, basePrice } = parse(
      z.object({ selections: z.record(z.array(z.string()).min(1)), basePrice: z.number().int().min(0) }),
      body,
    );
    return this.products.generateVariants(req.user.id, id, selections, basePrice);
  }

  @Put('variants/:variantId')
  @Cap('products.create_edit')
  updateVariant(@Param('variantId') variantId: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    return this.products.updateVariant(
      req.user.id,
      variantId,
      parse(variantUpdateSchema, body) as never,
      req.user.capabilities.has('products.set_prices'),
    );
  }

  /** Replace the product's media set (order = display order, first = cover). */
  @Put(':id/media')
  @Cap('products.create_edit')
  async setMedia(@Param('id') id: string, @Body() body: unknown) {
    const { media } = parse(mediaSchema, body);
    await this.prisma.$transaction(async (tx) => {
      await tx.productMedia.deleteMany({ where: { productId: id } });
      for (const m of media) {
        await tx.productMedia.create({
          data: { productId: id, url: m.url, variantId: m.variantId ?? null, type: m.type, altText: m.altText ?? null, sortOrder: m.sortOrder },
        });
      }
    });
    return this.prisma.productMedia.findMany({ where: { productId: id }, orderBy: { sortOrder: 'asc' } });
  }

  // ── Bundles (A1) ───────────────────────────────────────────────────────────

  @Put(':id/bundle')
  @Cap('products.create_edit')
  setBundle(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    const data = parse(bundleSchema, body);
    if (data.config.allowBelowCost && !req.user.capabilities.has('discounts.allow_below_cost')) {
      throw new BadRequestException('Only Owner/Manager may allow below-cost bundle pricing');
    }
    return this.products.setBundle(req.user.id, id, data as never);
  }

  @Get(':id/bundle/availability')
  @Cap('products.view')
  bundleAvailability(@Param('id') id: string) {
    return this.products.bundleAvailability(id);
  }

  @Get(':id/audit')
  @Cap('products.view')
  audit(@Param('id') id: string) {
    return this.prisma.catalogAuditLog.findMany({
      where: { entityType: 'product', entityId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
