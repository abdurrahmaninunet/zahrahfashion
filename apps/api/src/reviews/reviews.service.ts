import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

/** Modest bad-word list — obvious curses auto-hide + flag a review on submit.
 *  Harassment is subjective, so the admin still reviews everything manually. */
const BAD_WORDS = [
  'fuck', 'fucker', 'fucking', 'motherfucker', 'shit', 'bullshit', 'bitch', 'bastard',
  'asshole', 'arsehole', 'dickhead', 'cunt', 'pussy', 'slut', 'whore', 'faggot',
  'nigger', 'nigga', 'retard', 'idiot', 'stupid', 'ashawo', 'olosho', 'idiot', 'ashewo',
];
const PROFANITY = new RegExp(`\\b(${BAD_WORDS.join('|')})\\b`, 'i');

interface RawReview {
  id: string; product_id: string; customer_id: string; rating: number;
  body: string | null; status: string; flagged: boolean; created_at: Date;
}

/** Product reviews + moderation. The `product_reviews` table is created here on
 *  boot (raw DDL) because prisma generate is locked; all access is raw SQL. */
@Injectable()
export class ReviewsService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS product_reviews (
      id          text PRIMARY KEY,
      product_id  text NOT NULL,
      customer_id text NOT NULL,
      rating      int  NOT NULL,
      body        text,
      status      text NOT NULL DEFAULT 'visible',
      flagged     boolean NOT NULL DEFAULT false,
      created_at  timestamptz NOT NULL DEFAULT now()
    )`);
    await this.prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS product_reviews_product_idx ON product_reviews (product_id)`);
    await this.prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS product_reviews_cust_prod_uq ON product_reviews (customer_id, product_id)`);
  }

  /** Visible-only aggregate for the PDP rating row. */
  async summary(productId: string): Promise<{ average: number; count: number }> {
    const rows = await this.prisma.$queryRaw<{ count: bigint; avg: number | null }[]>`
      SELECT COUNT(*)::bigint AS count, AVG(rating)::float AS avg
      FROM product_reviews WHERE product_id = ${productId} AND status = 'visible'`;
    const count = Number(rows[0]?.count ?? 0);
    return { count, average: count ? Number((rows[0].avg ?? 0).toFixed(2)) : 0 };
  }

  /** Batch visible-rating aggregate for many products (PLP/rail cards). Products
   *  with no visible reviews are simply absent from the map. */
  async summaryMany(productIds: string[]): Promise<Map<string, { average: number; count: number }>> {
    const map = new Map<string, { average: number; count: number }>();
    if (!productIds.length) return map;
    const rows = await this.prisma.$queryRaw<{ product_id: string; count: bigint; avg: number | null }[]>`
      SELECT product_id, COUNT(*)::bigint AS count, AVG(rating)::float AS avg
      FROM product_reviews
      WHERE product_id IN (${Prisma.join(productIds)}) AND status = 'visible'
      GROUP BY product_id`;
    for (const r of rows) {
      const count = Number(r.count);
      map.set(r.product_id, { count, average: count ? Number((r.avg ?? 0).toFixed(2)) : 0 });
    }
    return map;
  }

  /** Visible reviews + summary + star distribution, for the storefront. */
  async listForProduct(productId: string) {
    const rows = await this.prisma.$queryRaw<RawReview[]>`
      SELECT id, customer_id, rating, body, created_at FROM product_reviews
      WHERE product_id = ${productId} AND status = 'visible' ORDER BY created_at DESC LIMIT 100`;
    const custIds = [...new Set(rows.map((r) => r.customer_id))];
    const customers = custIds.length
      ? await this.prisma.customer.findMany({ where: { id: { in: custIds } }, select: { id: true, fullName: true } })
      : [];
    const nameById = new Map(customers.map((c) => [c.id, c.fullName]));

    const distRows = await this.prisma.$queryRaw<{ rating: number; count: bigint }[]>`
      SELECT rating, COUNT(*)::bigint AS count FROM product_reviews
      WHERE product_id = ${productId} AND status = 'visible' GROUP BY rating`;
    const distribution = [0, 0, 0, 0, 0];
    for (const d of distRows) if (d.rating >= 1 && d.rating <= 5) distribution[d.rating - 1] = Number(d.count);
    const summary = await this.summary(productId);

    return {
      summary: { ...summary, distribution },
      reviews: rows.map((r) => ({
        id: r.id, rating: r.rating, body: r.body, createdAt: r.created_at,
        author: firstName(nameById.get(r.customer_id)),
      })),
    };
  }

  /** The signed-in customer's eligibility + their own review (for the form). */
  async myReview(customerId: string, productId: string) {
    const purchased = await this.hasPurchased(customerId, productId);
    const rows = await this.prisma.$queryRaw<RawReview[]>`
      SELECT rating, body, status FROM product_reviews WHERE customer_id = ${customerId} AND product_id = ${productId} LIMIT 1`;
    const review = rows[0] ? { rating: rows[0].rating, body: rows[0].body, status: rows[0].status } : null;
    return { canReview: purchased, purchased, review };
  }

  /** Create/replace a customer's review (verified buyers only; profanity auto-hides). */
  async create(customerId: string, productId: string, rating: number, body: string) {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new BadRequestException('Rating must be 1–5');
    if (!(await this.hasPurchased(customerId, productId))) {
      throw new BadRequestException('You can only review a product you have purchased.');
    }
    const clean = (body ?? '').trim().slice(0, 2000);
    const flagged = PROFANITY.test(clean);
    const status = flagged ? 'hidden' : 'visible';
    const id = randomUUID();
    await this.prisma.$executeRaw`
      INSERT INTO product_reviews (id, product_id, customer_id, rating, body, status, flagged, created_at)
      VALUES (${id}, ${productId}, ${customerId}, ${rating}, ${clean}, ${status}, ${flagged}, now())
      ON CONFLICT (customer_id, product_id)
      DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body, status = EXCLUDED.status, flagged = EXCLUDED.flagged, created_at = now()`;
    // Flagged reviews are hidden pending manual review — tell the shopper.
    return { ok: true, flagged, pending: flagged };
  }

  private async hasPurchased(customerId: string, productId: string): Promise<boolean> {
    // A verified buyer = a real order (confirmed/paid onward) containing the
    // product — not a draft, unpaid, or cancelled one.
    const count = await this.prisma.order.count({
      where: {
        customerId,
        status: { notIn: ['DRAFT', 'PENDING_PAYMENT', 'CANCELLED'] as never },
        lines: { some: { variant: { productId } } },
      },
    });
    return count > 0;
  }

  // ── Admin moderation ──────────────────────────────────────────────────────
  async adminList(params: { status?: string; page?: number }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = 50;
    const offset = (page - 1) * pageSize;
    const filter = params.status === 'visible' || params.status === 'hidden' ? params.status : null;

    const rows = filter
      ? await this.prisma.$queryRaw<RawReview[]>`SELECT * FROM product_reviews WHERE status = ${filter} ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`
      : await this.prisma.$queryRaw<RawReview[]>`SELECT * FROM product_reviews ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`;
    const totalRows = filter
      ? await this.prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*)::bigint AS count FROM product_reviews WHERE status = ${filter}`
      : await this.prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*)::bigint AS count FROM product_reviews`;

    const productIds = [...new Set(rows.map((r) => r.product_id))];
    const custIds = [...new Set(rows.map((r) => r.customer_id))];
    const [products, customers] = await Promise.all([
      productIds.length ? this.prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, slug: true } }) : [],
      custIds.length ? this.prisma.customer.findMany({ where: { id: { in: custIds } }, select: { id: true, fullName: true, email: true, primaryPhone: true } }) : [],
    ]);
    const pById = new Map(products.map((p) => [p.id, p]));
    const cById = new Map(customers.map((c) => [c.id, c]));

    return {
      total: Number(totalRows[0]?.count ?? 0), page, pageSize,
      rows: rows.map((r) => {
        const p = pById.get(r.product_id);
        const c = cById.get(r.customer_id);
        return {
          id: r.id, rating: r.rating, body: r.body, status: r.status, flagged: r.flagged, createdAt: r.created_at,
          product: p ? { name: p.name, slug: p.slug } : null,
          customer: c ? { name: c.fullName, email: c.email, phone: c.primaryPhone } : null,
        };
      }),
    };
  }

  async setStatus(id: string, status: 'visible' | 'hidden') {
    await this.prisma.$executeRaw`UPDATE product_reviews SET status = ${status} WHERE id = ${id}`;
    return { id, status };
  }
}

function firstName(full?: string): string {
  return (full ?? 'Anonymous').trim().split(/\s+/)[0] || 'Anonymous';
}
