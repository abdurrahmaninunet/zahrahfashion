import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { Cap } from '../auth/decorators';
import { parse } from '../common/zod';

const unitSchema = z.object({
  name: z.string().min(1).max(60),
  abbreviation: z.string().min(1).max(12),
  measurementType: z.enum(['length', 'volume', 'weight', 'count']),
  fractionalAllowed: z.boolean().default(false),
  status: z.enum(['active', 'archived']).default('active'),
});

@Controller('units')
export class UnitsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @Cap('products.view')
  list() {
    return this.prisma.unit.findMany({ orderBy: [{ measurementType: 'asc' }, { name: 'asc' }] });
  }

  @Post()
  @Cap('products.manage_units')
  create(@Body() body: unknown) {
    return this.prisma.unit.create({ data: parse(unitSchema, body) });
  }

  @Put(':id')
  @Cap('products.manage_units')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.prisma.unit.update({ where: { id }, data: parse(unitSchema.partial(), body) });
  }

  /** Units in use by categories/products/attributes are archived, not deleted. */
  @Delete(':id')
  @Cap('products.manage_units')
  async remove(@Param('id') id: string) {
    const [categories, products, attributes] = await Promise.all([
      this.prisma.category.count({ where: { defaultUnitId: id } }),
      this.prisma.product.count({ where: { sellUnitId: id } }),
      this.prisma.attribute.count({ where: { unitId: id } }),
    ]);
    if (categories + products + attributes > 0) {
      await this.prisma.unit.update({ where: { id }, data: { status: 'archived' } });
      return { archived: true, inUseBy: { categories, products, attributes } };
    }
    await this.prisma.unit.delete({ where: { id } });
    return { deleted: true };
  }
}
