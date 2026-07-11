import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Req } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { Cap } from '../auth/decorators';
import { AuthedRequest } from '../auth/auth.types';
import { parse } from '../common/zod';

const zoneSchema = z.object({
  name: z.string().min(1).max(120),
  areasText: z.string().max(2000).default(''),
  deliveryFee: z.number().int().min(0),
  podAllowed: z.boolean().default(false),
  podMaxValue: z.number().int().positive().nullable().optional(),
  sortOrder: z.number().int().default(0),
});

@Controller('zones')
export class ZonesController {
  constructor(private prisma: PrismaService) {}

  /** Zone list — consumed by Orders, Customers, Reports (FR-ZON-04). */
  @Get()
  async list(@Req() req: AuthedRequest) {
    return this.prisma.zone.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  }

  @Post()
  @Cap('settings.manage_zones')
  async create(@Body() body: unknown, @Req() req: AuthedRequest) {
    const data = parse(zoneSchema, body);
    if (data.podAllowed && !data.podMaxValue) {
      throw new BadRequestException('POD max order value is required when POD is allowed');
    }
    return this.prisma.zone.create({ data });
  }

  @Put(':id')
  @Cap('settings.manage_zones')
  async update(@Param('id') id: string, @Body() body: unknown) {
    const data = parse(zoneSchema.partial(), body);
    if (data.podAllowed === true && data.podMaxValue === undefined) {
      const existing = await this.prisma.zone.findUnique({ where: { id } });
      if (!existing?.podMaxValue) throw new BadRequestException('POD max order value is required when POD is allowed');
    }
    return this.prisma.zone.update({ where: { id }, data });
  }

  /** FR-ZON-02: zones in use are archivable, never deletable. */
  @Delete(':id')
  @Cap('settings.manage_zones')
  async remove(@Param('id') id: string) {
    // Hard delete. Orders/addresses that referenced this state keep their snapshotted
    // fee but have their zone link cleared (FK is ON DELETE SET NULL).
    return this.prisma.zone.delete({ where: { id } });
  }

  @Post(':id/restore')
  @Cap('settings.manage_zones')
  async restore(@Param('id') id: string) {
    return this.prisma.zone.update({ where: { id }, data: { status: 'active' } });
  }
}
