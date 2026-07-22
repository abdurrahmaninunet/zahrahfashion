import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StoreCatalogService } from './store-catalog.service';

/**
 * Storefront search — S-D-02: Postgres FTS + trigram typo tolerance +
 * admin-managed synonyms. Terms logged in aggregate (FR-SF-SRC-04).
 */
@Injectable()
export class StoreSearchService {
  constructor(
    private prisma: PrismaService,
    private catalog: StoreCatalogService,
  ) {}

  private fold(q: string) {
    return q.toLowerCase().trim().replace(/\s+/g, ' ').slice(0, 80);
  }

  /** Expand the query with admin synonyms (both directions). */
  private async expand(q: string): Promise<string[]> {
    const folded = this.fold(q);
    const terms = new Set([folded]);
    const rows = await this.prisma.searchSynonym.findMany();
    for (const row of rows) {
      if (folded.includes(row.term)) for (const s of row.synonyms) terms.add(folded.replace(row.term, s));
      for (const s of row.synonyms) {
        if (folded.includes(s.toLowerCase())) terms.add(folded.replace(s.toLowerCase(), row.term));
      }
    }
    return Array.from(terms);
  }

  private async matchProductIds(terms: string[], limit: number): Promise<string[]> {
    // Trigram similarity over name + tags + category name, plus ILIKE matches on
    // colour, occasions and the assigned collection's name (S-search-by-attrs).
    const rows = await this.prisma.$queryRaw<{ id: string; score: number }[]>`
      SELECT p.id,
             GREATEST(
               MAX(similarity(p.name, term.q)),
               MAX(similarity(c.name, term.q)),
               MAX(CASE WHEN p.name ILIKE '%' || term.q || '%' THEN 1.0 ELSE 0 END),
               MAX(CASE WHEN EXISTS (SELECT 1 FROM unnest(p.tags) t WHERE t ILIKE '%' || term.q || '%') THEN 0.9 ELSE 0 END),
               MAX(CASE WHEN p.attribute_values->>'_colour' ILIKE '%' || term.q || '%' THEN 0.95 ELSE 0 END),
               MAX(CASE WHEN p.attribute_values->>'_occasions' ILIKE '%' || term.q || '%' THEN 0.9 ELSE 0 END),
               MAX(CASE WHEN col.name ILIKE '%' || term.q || '%' THEN 0.9 ELSE 0 END)
             ) AS score
      FROM products p
      JOIN categories c ON c.id = p.category_id
      LEFT JOIN collections col ON col.id = (p.attribute_values->>'_collectionId')
      CROSS JOIN unnest(${terms}::text[]) AS term(q)
      WHERE p.status = 'active' AND p.visibility = 'visible'
      GROUP BY p.id
      HAVING GREATEST(
               MAX(similarity(p.name, term.q)),
               MAX(similarity(c.name, term.q)),
               MAX(CASE WHEN p.name ILIKE '%' || term.q || '%' THEN 1.0 ELSE 0 END),
               MAX(CASE WHEN EXISTS (SELECT 1 FROM unnest(p.tags) t WHERE t ILIKE '%' || term.q || '%') THEN 0.9 ELSE 0 END),
               MAX(CASE WHEN p.attribute_values->>'_colour' ILIKE '%' || term.q || '%' THEN 0.95 ELSE 0 END),
               MAX(CASE WHEN p.attribute_values->>'_occasions' ILIKE '%' || term.q || '%' THEN 0.9 ELSE 0 END),
               MAX(CASE WHEN col.name ILIKE '%' || term.q || '%' THEN 0.9 ELSE 0 END)
             ) > 0.25
      ORDER BY score DESC
      LIMIT ${limit}`;
    return rows.map((r) => r.id);
  }

  private async logTerm(q: string, zeroResult: boolean) {
    const term = this.fold(q);
    await this.prisma.$executeRaw`
      INSERT INTO search_term_log (term, count, zero_result, last_at)
      VALUES (${term}, 1, ${zeroResult}, NOW())
      ON CONFLICT (term) DO UPDATE SET count = search_term_log.count + 1, zero_result = ${zeroResult}, last_at = NOW()`;
  }

  /** FR-SF-SRC-01: suggest-as-you-type. */
  async suggest(q: string) {
    const terms = await this.expand(q);
    const [productIds, categories] = await Promise.all([
      this.matchProductIds(terms, 5),
      this.prisma.category.findMany({
        where: { status: 'active', OR: terms.map((t) => ({ name: { contains: t, mode: 'insensitive' as const } })) },
        select: { id: true, name: true, slug: true },
        take: 3,
      }),
    ]);
    const { products } = productIds.length
      ? await this.catalog.listing({ filters: {}, ids: productIds })
      : { products: [] };
    return { products: products.slice(0, 5), categories };
  }

  /** FR-SF-SRC-02/03: full results with did-you-mean. */
  async results(q: string, page: number, sort?: string) {
    const terms = await this.expand(q);
    const productIds = await this.matchProductIds(terms, 100);
    await this.logTerm(q, productIds.length === 0);

    if (!productIds.length) {
      // "Did you mean": nearest product name by trigram distance.
      const near = await this.prisma.$queryRaw<{ name: string }[]>`
        SELECT name FROM products
        WHERE status = 'active' AND visibility = 'visible'
        ORDER BY name <-> ${this.fold(q)} LIMIT 1`;
      const popular = await this.prisma.category.findMany({
        where: { status: 'active', parentId: null },
        select: { name: true, slug: true },
        take: 4,
      });
      return { products: [], total: 0, didYouMean: near[0]?.name ?? null, popularCategories: popular };
    }

    const result = await this.catalog.listing({ filters: {}, ids: productIds, sort, page });
    // Preserve relevance order for default sort.
    if (!sort || sort === 'relevance') {
      const rank = new Map(productIds.map((id, i) => [id, i]));
      result.products.sort((a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999));
    }
    return { ...result, didYouMean: null };
  }
}
