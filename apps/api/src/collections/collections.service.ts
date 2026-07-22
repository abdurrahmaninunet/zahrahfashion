import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { slugify } from '../common/slug';

interface RawCollection { id: string; name: string; slug: string; sort_order: number; created_at: Date }

/**
 * Product collections — named groupings a product can be assigned to (via the
 * reserved `attributeValues._collectionId` key on the product). The `collections`
 * table is created here on boot (raw DDL, since prisma generate is locked); all
 * access is raw SQL.
 */
@Injectable()
export class CollectionsService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS collections (
      id          text PRIMARY KEY,
      name        text NOT NULL,
      slug        text NOT NULL UNIQUE,
      sort_order  int  NOT NULL DEFAULT 0,
      created_at  timestamptz NOT NULL DEFAULT now()
    )`);
  }

  async list(): Promise<{ id: string; name: string; slug: string }[]> {
    const rows = await this.prisma.$queryRaw<RawCollection[]>`
      SELECT id, name, slug, sort_order FROM collections ORDER BY sort_order ASC, name ASC`;
    return rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug }));
  }

  async bySlug(slug: string): Promise<{ id: string; name: string; slug: string } | null> {
    const rows = await this.prisma.$queryRaw<RawCollection[]>`
      SELECT id, name, slug FROM collections WHERE slug = ${slug} LIMIT 1`;
    return rows[0] ? { id: rows[0].id, name: rows[0].name, slug: rows[0].slug } : null;
  }

  async create(name: string) {
    const clean = name.trim();
    if (!clean) throw new BadRequestException('Name is required');
    const slug = slugify(clean);
    const clash = await this.prisma.$queryRaw<{ id: string }[]>`SELECT id FROM collections WHERE slug = ${slug} LIMIT 1`;
    if (clash.length) throw new BadRequestException(`A collection named "${clean}" already exists`);
    const id = randomUUID();
    await this.prisma.$executeRaw`INSERT INTO collections (id, name, slug) VALUES (${id}, ${clean}, ${slug})`;
    return { id, name: clean, slug };
  }

  async rename(id: string, name: string) {
    const clean = name.trim();
    if (!clean) throw new BadRequestException('Name is required');
    await this.prisma.$executeRaw`UPDATE collections SET name = ${clean} WHERE id = ${id}`;
    return { id, name: clean };
  }

  async remove(id: string) {
    // Products referencing this via attributeValues._collectionId simply stop
    // matching — no orphan cleanup needed.
    await this.prisma.$executeRaw`DELETE FROM collections WHERE id = ${id}`;
    return { ok: true };
  }
}
