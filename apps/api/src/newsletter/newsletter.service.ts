import { Injectable, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

interface RawSubscriber { id: string; email: string; source: string | null; created_at: Date }

/** Newsletter sign-ups from the storefront footer. Raw `newsletter_subscribers`
 *  table created on boot (prisma generate is locked → raw SQL). Email is unique;
 *  a repeat sign-up is a harmless no-op. */
@Injectable()
export class NewsletterService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id         text PRIMARY KEY,
      email      text NOT NULL UNIQUE,
      source     text,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await this.prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS newsletter_created_idx ON newsletter_subscribers (created_at DESC)`);
  }

  /** Store a sign-up (idempotent on email). */
  async subscribe(email: string, source = 'footer') {
    const clean = email.toLowerCase().trim();
    await this.prisma.$executeRaw`
      INSERT INTO newsletter_subscribers (id, email, source, created_at)
      VALUES (${randomUUID()}, ${clean}, ${source}, now())
      ON CONFLICT (email) DO NOTHING`;
    return { ok: true };
  }

  // ── Admin ──────────────────────────────────────────────────────────────────
  async list(params: { page?: number; q?: string }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = 50;
    const offset = (page - 1) * pageSize;
    const q = params.q?.trim() ? `%${params.q.trim().toLowerCase()}%` : null;

    const rows = q
      ? await this.prisma.$queryRaw<RawSubscriber[]>`SELECT * FROM newsletter_subscribers WHERE lower(email) LIKE ${q} ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`
      : await this.prisma.$queryRaw<RawSubscriber[]>`SELECT * FROM newsletter_subscribers ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`;
    const totals = await this.prisma.$queryRaw<{ total: bigint }[]>`SELECT COUNT(*)::bigint AS total FROM newsletter_subscribers`;

    return {
      total: Number(totals[0]?.total ?? 0),
      page,
      pageSize,
      rows: rows.map((r) => ({ id: r.id, email: r.email, source: r.source, createdAt: r.created_at })),
    };
  }

  async remove(id: string) {
    await this.prisma.$executeRaw`DELETE FROM newsletter_subscribers WHERE id = ${id}`;
    return { ok: true };
  }
}
