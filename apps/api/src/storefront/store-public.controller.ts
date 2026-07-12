import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';
import { Public } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { StoreCatalogService } from './store-catalog.service';
import { StoreSearchService } from './store-search.service';
import { MediaService } from '../content/media.service';
import { ReviewsService } from '../reviews/reviews.service';
import { AnkoService } from '../anko/anko.service';
import { parse } from '../common/zod';

/**
 * Public storefront surface: catalog, content, search. No staff session.
 * All routes cache-friendly; interaction-time truth comes from /availability.
 */
@Public()
@Controller('store')
export class StorePublicController {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
    private catalog: StoreCatalogService,
    private search: StoreSearchService,
    private media: MediaService,
    private reviews: ReviewsService,
    private anko: AnkoService,
  ) {}

  /** Slugs + timestamps for the storefront sitemap.xml (SEO). */
  @Get('sitemap')
  sitemap() {
    return this.catalog.sitemapEntries();
  }

  /** MIM homepage "ready to personalise" section — up to 3 curated MIM products.
   *  Returns enabled=false (and no products) when the MIM store is switched off. */
  @Get('mim/ready')
  async mimReady() {
    const [enabled, ready] = await Promise.all([
      this.settings.get<boolean>('mim.enabled'),
      this.settings.get<{ title?: string; subtitle?: string; productIds?: string[] }>('mim.ready'),
    ]);
    if (enabled === false) return { enabled: false, title: '', subtitle: '', products: [] };
    const ids = (ready?.productIds ?? []).filter(Boolean).slice(0, 3);
    let products: Awaited<ReturnType<StoreCatalogService['listing']>>['products'] = [];
    if (ids.length) {
      const { products: cards } = await this.catalog.listing({ filters: {}, ids });
      const byId = new Map(cards.map((p) => [p.id, p]));
      products = ids.map((id) => byId.get(id)).filter((p): p is (typeof cards)[number] => Boolean(p));
    }
    return { enabled: true, title: ready?.title ?? '', subtitle: ready?.subtitle ?? '', products };
  }

  /** Anko store — fabrics available for anko right now (enabled and not locked). */
  @Get('anko')
  async ankoStore() {
    const ids = await this.anko.availableProductIds();
    if (!ids.length) return { products: [] };
    return this.catalog.listing({ filters: {}, ids });
  }

  /** Public product reviews (visible only) + summary + star distribution. */
  @Get('products/:slug/reviews')
  async productReviews(@Param('slug') slug: string) {
    const product = await this.prisma.product.findUnique({ where: { slug }, select: { id: true } });
    if (!product) throw new NotFoundException('Product not found');
    return this.reviews.listForProduct(product.id);
  }

  // ── Customer image upload (MIM design editor) ─────────────────────────────
  // Public: shoppers upload a logo/photo and the flattened design preview.
  // MediaService validates mime (JPG/PNG/WebP) and the 8MB size limit.
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file: { originalname: string; mimetype: string; size: number; buffer: Buffer } | undefined) {
    if (!file) throw new BadRequestException('No file received');
    const asset = await this.media.upload('storefront', file, 'MIM design', ['mim', 'customer-upload']);
    return { url: asset!.url };
  }

  // ── Shell context (header nav, announcement, WhatsApp, trust) ─────────────

  @Get('context')
  async context() {
    const [categories, announcement, store] = await Promise.all([
      this.catalog.categoryTree(),
      this.prisma.contentItem.findFirst({
        where: { type: 'announcement', status: 'published' },
        orderBy: { updatedAt: 'desc' },
      }),
      this.settings.getMany([
        'store.name', 'store.phone', 'store.whatsapp', 'store.email', 'store.address', 'store.social',
        'notifications.whatsapp_chat', 'mim.enabled',
      ]),
    ]);
    // POD promise renders only while POD is enabled somewhere (Homepage §3.7).
    const podZones = await this.prisma.zone.count({ where: { status: 'active', podAllowed: true } });
    return {
      store: {
        name: store['store.name'],
        phone: store['store.phone'],
        whatsapp: (store['notifications.whatsapp_chat'] as { number?: string })?.number || store['store.whatsapp'],
        whatsappMessage: (store['notifications.whatsapp_chat'] as { message?: string })?.message ?? '',
        email: store['store.email'],
        address: store['store.address'],
        social: store['store.social'],
      },
      mimEnabled: store['mim.enabled'] !== false,
      podAvailable: podZones > 0,
      announcement: announcement ? { message: (announcement.fields as { message?: string }).message, link: (announcement.fields as { link?: { url?: string } }).link?.url ?? null } : null,
      categories,
    };
  }

  // ── Homepage composition (S-BR-01) ─────────────────────────────────────────

  @Get('composition/:surface')
  async composition(@Param('surface') surface: string) {
    const composition = await this.prisma.composition.findUnique({
      where: { surface },
      include: { sections: { include: { contentItem: true }, orderBy: { sortOrder: 'asc' } } },
    });
    if (!composition) return { sections: [] };

    const sections = [];
    for (const s of composition.sections) {
      const item = s.contentItem;
      if (item.status !== 'published') continue; // drafts never served
      const payload: Record<string, unknown> = {
        id: item.id,
        sectionKey: item.sectionKey,
        title: item.title,
        fields: item.fields,
      };
      // Collection rails resolve to live product cards (FR-COL / rails).
      if (item.sectionKey === 'collection_rail') {
        const fields = item.fields as { collectionId?: string; rule?: string; maxItems?: number; title?: string };
        payload.products = await this.railProducts(fields);
      }
      // Today's Deals: resolve the two curated product lists in the chosen order.
      if (item.sectionKey === 'todays_deals') {
        const f = item.fields as { menProducts?: string[]; womenProducts?: string[] };
        payload.menProducts = await this.dealProducts(f.menProducts);
        payload.womenProducts = await this.dealProducts(f.womenProducts);
      }
      sections.push(payload);
    }
    return { sections };
  }

  /** Resolve a curated product-id list to cards, preserving the admin's order. */
  private async dealProducts(ids?: string[]) {
    const chosen = (ids ?? []).slice(0, 3);
    if (!chosen.length) return [];
    const { products } = await this.catalog.listing({ filters: {}, ids: chosen });
    const byId = new Map(products.map((p) => [p.id, p]));
    return chosen.map((id) => byId.get(id)).filter((p): p is (typeof products)[number] => Boolean(p));
  }

  private async railProducts(fields: { collectionId?: string; rule?: string; maxItems?: number }) {
    const limit = Math.min(fields.maxItems ?? 10, 12);
    if (fields.collectionId) {
      const collection = await this.prisma.contentItem.findUnique({ where: { id: fields.collectionId } });
      const productIds = ((collection?.fields as { productIds?: string[] })?.productIds ?? []).slice(0, limit);
      if (productIds.length) {
        const { products } = await this.catalog.listing({ filters: {}, ids: productIds });
        return products.filter((p) => !p.soldOut); // sold-out hidden in rails by default
      }
    }
    // Rules: newest (default) / best_sellers
    if (fields.rule === 'best_sellers') {
      const rows = await this.prisma.$queryRaw<{ product_id: string }[]>`
        SELECT v.product_id, SUM(ol.line_total) AS revenue
        FROM order_lines ol
        JOIN variants v ON v.id = ol.variant_id
        JOIN orders o ON o.id = ol.order_id
        WHERE o.confirmed_at > NOW() - INTERVAL '30 days'
          AND o.status::text NOT IN ('CANCELLED','REFUNDED','DRAFT')
        GROUP BY v.product_id ORDER BY revenue DESC LIMIT ${limit}`;
      if (rows.length) {
        const { products } = await this.catalog.listing({ filters: {}, ids: rows.map((r) => r.product_id) });
        return products.filter((p) => !p.soldOut);
      }
    }
    const { products } = await this.catalog.listing({ filters: {}, sort: 'newest' });
    return products.filter((p) => !p.soldOut).slice(0, limit);
  }

  // ── Content pages ──────────────────────────────────────────────────────────

  @Get('pages/:slug')
  async page(@Param('slug') slug: string) {
    const page = await this.prisma.contentItem.findFirst({
      where: { OR: [{ slug }, { systemKey: slug }], type: 'page' },
    });
    if (!page || page.status !== 'published') {
      // D-30: honor redirects before 404.
      const redirect = await this.prisma.redirect.findUnique({ where: { fromSlug: slug } });
      if (redirect) return { redirect: redirect.toSlug };
      throw new BadRequestException('Page not found');
    }
    return { title: page.title, body: (page.fields as { body?: string }).body ?? '', seo: page.seo, updatedAt: page.updatedAt };
  }

  // ── Catalog ────────────────────────────────────────────────────────────────

  @Get('categories')
  categories() {
    return this.catalog.categoryTree();
  }

  @Get('plp')
  listing(
    @Query('category') category?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
    @Query('priceMin') priceMin?: string,
    @Query('priceMax') priceMax?: string,
    @Query('store') store?: string,
    @Query() allQuery?: Record<string, string>,
  ) {
    const filters: Record<string, string> = {};
    for (const [key, value] of Object.entries(allQuery ?? {})) {
      if (key.startsWith('f_') && value) filters[key.slice(2)] = value;
    }
    return this.catalog.listing({
      categorySlug: category,
      filters,
      sort,
      page: Number(page) || 1,
      priceMin: priceMin ? Math.round(Number(priceMin) * 100) : undefined,
      priceMax: priceMax ? Math.round(Number(priceMax) * 100) : undefined,
      store: store === 'mim' ? 'mim' : store === 'lefe' ? 'lefe' : undefined,
    });
  }

  /** Card payloads for a set of product ids — powers the (local) wishlist page. */
  @Get('products-by-ids')
  async byIds(@Query('ids') ids?: string) {
    const list = (ids ?? '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 100);
    if (!list.length) return { products: [] };
    const { products } = await this.catalog.listing({ filters: {}, ids: list });
    return { products };
  }

  @Get('products/:slug')
  product(@Param('slug') slug: string) {
    return this.catalog.productDetail(slug);
  }

  @Post('availability')
  availability(@Body() body: unknown) {
    const { lines } = parse(
      z.object({
        lines: z.array(z.object({
          variantId: z.string().optional(),
          bundleProductId: z.string().optional(),
          formatId: z.string().optional(),
          quantity: z.number().positive(),
        })).min(1).max(50),
      }),
      body,
    );
    return this.catalog.availability(lines);
  }

  // ── Search (FR-SF-SRC) ─────────────────────────────────────────────────────

  @Get('search/suggest')
  suggest(@Query('q') q?: string) {
    if (!q || q.trim().length < 2) return { products: [], categories: [] };
    return this.search.suggest(q);
  }

  @Get('search')
  results(@Query('q') q?: string, @Query('page') page?: string, @Query('sort') sort?: string) {
    if (!q || q.trim().length < 2) return { products: [], total: 0, didYouMean: null };
    return this.search.results(q, Number(page) || 1, sort);
  }
}
