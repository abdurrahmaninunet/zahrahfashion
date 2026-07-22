import { Body, Controller, Delete, Get, OnModuleInit, Param, Post, Put } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { Cap, Public } from '../auth/decorators';
import { parse } from '../common/zod';

// Physical shop locations. Uses raw SQL (table added out-of-band) so it works without
// regenerating the Prisma client. Fields mirror the admin "Store locations" manager.
const locationSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().max(40).nullable().optional(),
  email: z.string().max(200).nullable().optional(),
  whatsapp: z.string().max(40).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  opensAt: z.string().max(10).nullable().optional(),
  closesAt: z.string().max(10).nullable().optional(),
  imageUrl: z.string().max(600).nullable().optional(),
});

interface LocationRow {
  id: string; name: string; phone: string | null; email: string | null; whatsapp: string | null;
  address: string | null; opensAt: string | null; closesAt: string | null;
  imageUrl: string | null; sortOrder: number; status: string;
}

const clean = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

@Controller('store-locations')
export class StoreLocationsController implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  // Add the shop-photo column if it isn't there yet (auto-applies on deploy).
  async onModuleInit() {
    await this.prisma.$executeRawUnsafe(`ALTER TABLE store_locations ADD COLUMN IF NOT EXISTS image_url text`);
  }

  // Public: the storefront "Our shops" page (/shops) lists these. Only active
  // rows and shop-facing fields are returned; writes below stay staff-only.
  @Public()
  @Get()
  list() {
    return this.prisma.$queryRaw<LocationRow[]>`
      SELECT id, name, phone, email, whatsapp, address,
             opens_at AS "opensAt", closes_at AS "closesAt", image_url AS "imageUrl",
             sort_order AS "sortOrder", status
      FROM store_locations WHERE status = 'active'
      ORDER BY sort_order ASC, name ASC`;
  }

  @Post()
  @Cap('settings.edit')
  async create(@Body() body: unknown) {
    const d = parse(locationSchema, body);
    const id = 'loc_' + randomBytes(8).toString('hex');
    await this.prisma.$executeRaw`
      INSERT INTO store_locations (id, name, phone, email, whatsapp, address, opens_at, closes_at, image_url, sort_order, status, created_at, updated_at)
      VALUES (${id}, ${d.name.trim()}, ${clean(d.phone)}, ${clean(d.email)}, ${clean(d.whatsapp)}, ${clean(d.address)},
              ${clean(d.opensAt)}, ${clean(d.closesAt)}, ${clean(d.imageUrl)},
              (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM store_locations), 'active', now(), now())`;
    return { id };
  }

  @Put(':id')
  @Cap('settings.edit')
  async update(@Param('id') id: string, @Body() body: unknown) {
    const d = parse(locationSchema, body);
    await this.prisma.$executeRaw`
      UPDATE store_locations SET
        name = ${d.name.trim()}, phone = ${clean(d.phone)}, email = ${clean(d.email)},
        whatsapp = ${clean(d.whatsapp)}, address = ${clean(d.address)},
        opens_at = ${clean(d.opensAt)}, closes_at = ${clean(d.closesAt)},
        image_url = ${clean(d.imageUrl)}, updated_at = now()
      WHERE id = ${id}`;
    return { ok: true };
  }

  @Delete(':id')
  @Cap('settings.edit')
  async remove(@Param('id') id: string) {
    await this.prisma.$executeRaw`UPDATE store_locations SET status = 'archived', updated_at = now() WHERE id = ${id}`;
    return { ok: true };
  }
}
