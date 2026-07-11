import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Req } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { Cap } from '../auth/decorators';
import { AuthedRequest } from '../auth/auth.types';
import { parse } from '../common/zod';
import { slugify } from '../common/slug';
import { catalogAudit } from './catalog-audit';

const categorySchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().max(140).optional(),
  parentId: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
  defaultUnitId: z.string().nullable().optional(),
  fractionalAllowed: z.boolean().default(false),
  minOrderQty: z.number().positive().default(1),
  qtyIncrement: z.number().positive().default(1),
  mediaRules: z.object({ minImages: z.number().int().min(0), maxImages: z.number().int().min(1) }).nullable().optional(),
  returnEligible: z.boolean().default(true),
  perishable: z.boolean().default(false),
  deadStockDays: z.number().int().positive().nullable().optional(),
});

const attributeAssignSchema = z.object({
  attributes: z.array(z.object({
    attributeId: z.string(),
    isRequired: z.boolean().default(false),
    sortOrder: z.number().int().default(0),
  })),
});

@Controller('categories')
export class CategoriesController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @Cap('products.view')
  async tree() {
    const categories = await this.prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        attributes: { include: { attribute: { include: { options: true } } }, orderBy: { sortOrder: 'asc' } },
        _count: { select: { products: true } },
      },
    });
    return categories;
  }

  @Post()
  @Cap('products.manage_categories')
  async create(@Body() body: unknown, @Req() req: AuthedRequest) {
    const data = parse(categorySchema, body);
    const slug = data.slug ? slugify(data.slug) : slugify(data.name);
    const existing = await this.prisma.category.findUnique({ where: { slug } });
    if (existing) throw new BadRequestException(`Slug "${slug}" is already in use`);

    return this.prisma.$transaction(async (tx) => {
      const category = await tx.category.create({ data: { ...data, slug } as never });
      await catalogAudit(tx, { entityType: 'category', entityId: category.id, action: 'create', userId: req.user.id, after: category });
      return category;
    });
  }

  @Put(':id')
  @Cap('products.manage_categories')
  async update(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    const data = parse(categorySchema.partial(), body);
    if (data.parentId === id) throw new BadRequestException('A category cannot be its own parent');
    if (data.slug) data.slug = slugify(data.slug);

    return this.prisma.$transaction(async (tx) => {
      const before = await tx.category.findUniqueOrThrow({ where: { id } });
      const category = await tx.category.update({ where: { id }, data: data as never });
      await catalogAudit(tx, { entityType: 'category', entityId: id, action: 'update', userId: req.user.id, before, after: category });
      return category;
    });
  }

  /** FR-CAT-03 + Validation 6: not deletable/archivable with active products. */
  @Delete(':id')
  @Cap('products.manage_categories')
  async archive(@Param('id') id: string, @Req() req: AuthedRequest) {
    const activeProducts = await this.prisma.product.count({ where: { categoryId: id, status: 'active' } });
    if (activeProducts > 0) {
      throw new BadRequestException(`Category has ${activeProducts} active product(s) — archive or reassign them first`);
    }
    const children = await this.prisma.category.count({ where: { parentId: id, status: 'active' } });
    if (children > 0) {
      throw new BadRequestException('Category has active subcategories — archive them first');
    }

    const anyProducts = await this.prisma.product.count({ where: { categoryId: id } });
    return this.prisma.$transaction(async (tx) => {
      if (anyProducts > 0) {
        const category = await tx.category.update({ where: { id }, data: { status: 'archived' } });
        await catalogAudit(tx, { entityType: 'category', entityId: id, action: 'archive', userId: req.user.id });
        return category;
      }
      const category = await tx.category.delete({ where: { id } });
      await catalogAudit(tx, { entityType: 'category', entityId: id, action: 'delete', userId: req.user.id, before: category });
      return { deleted: true };
    });
  }

  /** FR-ATT-03: assign the category's attribute set with per-category overrides. */
  @Put(':id/attributes')
  @Cap('products.manage_categories')
  async assignAttributes(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    const { attributes } = parse(attributeAssignSchema, body);
    return this.prisma.$transaction(async (tx) => {
      await tx.categoryAttribute.deleteMany({ where: { categoryId: id } });
      for (const a of attributes) {
        await tx.categoryAttribute.create({
          data: { categoryId: id, attributeId: a.attributeId, isRequired: a.isRequired, sortOrder: a.sortOrder },
        });
      }
      await catalogAudit(tx, { entityType: 'category', entityId: id, action: 'update', userId: req.user.id, after: { attributes } });
      return tx.categoryAttribute.findMany({ where: { categoryId: id }, include: { attribute: true } });
    });
  }

  @Put('reorder')
  @Cap('products.manage_categories')
  async reorder(@Body() body: unknown) {
    const { order } = parse(z.object({ order: z.array(z.object({ id: z.string(), sortOrder: z.number().int(), parentId: z.string().nullable() })) }), body);
    await this.prisma.$transaction(
      order.map((o) => this.prisma.category.update({ where: { id: o.id }, data: { sortOrder: o.sortOrder, parentId: o.parentId } })),
    );
    return { ok: true };
  }
}
