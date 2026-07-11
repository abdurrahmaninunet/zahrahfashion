import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Req } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { Cap } from '../auth/decorators';
import { AuthedRequest } from '../auth/auth.types';
import { parse } from '../common/zod';
import { catalogAudit } from './catalog-audit';

const INPUT_TYPES = ['short_text', 'long_text', 'number', 'select', 'multiselect', 'boolean', 'color', 'image_option', 'date', 'size_chart'] as const;

/** Variants are generated from option lists — only these types can define variants. */
const OPTION_TYPES = ['select', 'multiselect', 'color', 'image_option'];

const attributeSchema = z.object({
  name: z.string().min(1).max(120),
  code: z.string().min(1).max(60).regex(/^[a-z0-9_]+$/, 'lowercase letters, digits and underscores only'),
  inputType: z.enum(INPUT_TYPES),
  unitId: z.string().nullable().optional(),
  isRequiredDefault: z.boolean().default(false),
  isFilterable: z.boolean().default(false),
  isVariantDefining: z.boolean().default(false),
});

const optionSchema = z.object({
  label: z.string().min(1).max(120),
  value: z.string().min(1).max(120),
  hexCode: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  image: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
});

@Controller('attributes')
export class AttributesController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @Cap('products.view')
  list() {
    return this.prisma.attribute.findMany({
      include: { options: { orderBy: { sortOrder: 'asc' } }, categories: { select: { categoryId: true } } },
      orderBy: { name: 'asc' },
    });
  }

  @Post()
  @Cap('products.manage_categories')
  async create(@Body() body: unknown, @Req() req: AuthedRequest) {
    const data = parse(attributeSchema, body);
    if (data.isVariantDefining && !OPTION_TYPES.includes(data.inputType)) {
      throw new BadRequestException('Only option-based attributes (select, colour) can define variants — sizes like 50ml/100ml belong in an option list');
    }
    const dup = await this.prisma.attribute.findUnique({ where: { code: data.code } });
    if (dup) throw new BadRequestException(`Attribute code "${data.code}" already exists`);
    return this.prisma.$transaction(async (tx) => {
      const attr = await tx.attribute.create({ data: data as never });
      await catalogAudit(tx, { entityType: 'attribute', entityId: attr.id, action: 'create', userId: req.user.id, after: attr });
      return attr;
    });
  }

  @Put(':id')
  @Cap('products.manage_categories')
  async update(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    const data = parse(attributeSchema.partial().omit({ code: true }), body);
    const before = await this.prisma.attribute.findUniqueOrThrow({ where: { id } });

    if (data.isVariantDefining === true && !OPTION_TYPES.includes(before.inputType)) {
      throw new BadRequestException('Only option-based attributes (select, colour) can define variants');
    }

    // FR-ATT-06: variant-defining flag frozen once variants exist on products using it.
    if (data.isVariantDefining !== undefined && data.isVariantDefining !== before.isVariantDefining) {
      const usedByVariants = await this.prisma.variant.count({
        where: { optionValues: { path: [before.code], not: 'null' as never } },
      });
      if (usedByVariants > 0) {
        throw new BadRequestException('Variant-defining flag cannot change while generated variants use this attribute');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const attr = await tx.attribute.update({ where: { id }, data: data as never });
      await catalogAudit(tx, { entityType: 'attribute', entityId: id, action: 'update', userId: req.user.id, before, after: attr });
      return attr;
    });
  }

  /** FR-ATT-07: deletion blocked while in use; deactivate instead. */
  @Delete(':id')
  @Cap('products.manage_categories')
  async remove(@Param('id') id: string, @Req() req: AuthedRequest) {
    const inCategories = await this.prisma.categoryAttribute.count({ where: { attributeId: id } });
    if (inCategories > 0) {
      return this.prisma.$transaction(async (tx) => {
        const attr = await tx.attribute.update({ where: { id }, data: { status: 'archived' } });
        await catalogAudit(tx, { entityType: 'attribute', entityId: id, action: 'archive', userId: req.user.id });
        return attr;
      });
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.attributeOption.deleteMany({ where: { attributeId: id } });
      await tx.attribute.delete({ where: { id } });
      await catalogAudit(tx, { entityType: 'attribute', entityId: id, action: 'delete', userId: req.user.id });
      return { deleted: true };
    });
  }

  // ── Options (FR-ATT-04) ────────────────────────────────────────────────────

  @Post(':id/options')
  @Cap('products.manage_categories')
  async addOption(@Param('id') id: string, @Body() body: unknown) {
    const data = parse(optionSchema, body);
    return this.prisma.attributeOption.create({ data: { ...data, attributeId: id } as never });
  }

  @Put(':id/options/:optionId')
  @Cap('products.manage_categories')
  async updateOption(@Param('optionId') optionId: string, @Body() body: unknown) {
    const data = parse(optionSchema.partial().extend({ status: z.enum(['active', 'archived']).optional() }), body);
    return this.prisma.attributeOption.update({ where: { id: optionId }, data: data as never });
  }
}
