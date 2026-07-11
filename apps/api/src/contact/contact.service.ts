import { Injectable, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

interface RawMessage {
  id: string; name: string | null; email: string; phone: string | null;
  subject: string | null; body: string; status: string; created_at: Date;
}

/** Storefront contact messages (one-way inbox). Stored in a raw `contact_messages`
 *  table created on boot — prisma generate is locked, so all access is raw SQL. */
@Injectable()
export class ContactService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS contact_messages (
      id         text PRIMARY KEY,
      name       text,
      email      text NOT NULL,
      phone      text,
      subject    text,
      body       text NOT NULL,
      status     text NOT NULL DEFAULT 'new',
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await this.prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS contact_messages_created_idx ON contact_messages (created_at DESC)`);
  }

  async save(data: { name?: string; email: string; phone?: string; subject?: string; message: string }) {
    const id = randomUUID();
    await this.prisma.$executeRaw`
      INSERT INTO contact_messages (id, name, email, phone, subject, body, status, created_at)
      VALUES (${id}, ${data.name ?? null}, ${data.email}, ${data.phone ?? null}, ${data.subject ?? null}, ${data.message.slice(0, 5000)}, 'new', now())`;
    return { id };
  }

  // ── Admin inbox ───────────────────────────────────────────────────────────
  async list(params: { status?: string; page?: number }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = 50;
    const offset = (page - 1) * pageSize;
    const filter = params.status === 'new' || params.status === 'read' ? params.status : null;

    const rows = filter
      ? await this.prisma.$queryRaw<RawMessage[]>`SELECT * FROM contact_messages WHERE status = ${filter} ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`
      : await this.prisma.$queryRaw<RawMessage[]>`SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`;
    const totals = await this.prisma.$queryRaw<{ total: bigint; unread: bigint }[]>`
      SELECT COUNT(*)::bigint AS total, COUNT(*) FILTER (WHERE status = 'new')::bigint AS unread FROM contact_messages`;

    return {
      total: Number(totals[0]?.total ?? 0),
      unread: Number(totals[0]?.unread ?? 0),
      page, pageSize,
      rows: rows.map((r) => ({
        id: r.id, name: r.name, email: r.email, phone: r.phone,
        subject: r.subject, body: r.body, status: r.status, createdAt: r.created_at,
      })),
    };
  }

  async setStatus(id: string, status: 'new' | 'read') {
    await this.prisma.$executeRaw`UPDATE contact_messages SET status = ${status} WHERE id = ${id}`;
    return { id, status };
  }
}
