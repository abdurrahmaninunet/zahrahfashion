import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DiscountsService } from '../discounts/discounts.service';
import { ProductsService } from '../catalog/products.service';
import { ReviewsService } from '../reviews/reviews.service';
import { AnkoService } from '../anko/anko.service';

/**
 * Public catalog surface (Storefront FR-SF-CAT). All money is kobo; the
 * storefront never computes prices — everything here is server truth.
 */
@Injectable()
export class StoreCatalogService {
  constructor(
    private prisma: PrismaService,
    private discounts: DiscountsService,
    private products: ProductsService,
    private reviews: ReviewsService,
    private anko: AnkoService,
  ) {}

  /** S-D-01: urgency threshold — fabrics (fractional categories) 10, others 5. */
  private urgencyThreshold(fractional: boolean): number {
    return fractional ? 10 : 5;
  }

  async categoryTree() {
    const categories = await this.prisma.category.findMany({
      // "lefe" is an internal container for Lefe bundles (its own /lefe store) —
      // keep it out of the main category menu.
      where: { status: 'active', slug: { not: 'lefe' } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, slug: true, parentId: true, image: true },
    });
    return categories;
  }

  private async categoryWithDescendants(categoryId: string): Promise<string[]> {
    const all = await this.prisma.category.findMany({ select: { id: true, parentId: true } });
    const ids = [categoryId];
    let frontier = [categoryId];
    while (frontier.length) {
      const children = all.filter((c) => c.parentId && frontier.includes(c.parentId)).map((c) => c.id);
      ids.push(...children);
      frontier = children;
    }
    return ids;
  }

  private async availabilityByVariant(variantIds: string[]): Promise<Map<string, number>> {
    if (!variantIds.length) return new Map();
    const levels = await this.prisma.stockLevel.findMany({ where: { variantId: { in: variantIds } } });
    const map = new Map<string, number>();
    for (const l of levels) {
      map.set(l.variantId, (map.get(l.variantId) ?? 0) + Number(l.onHand) - Number(l.reserved));
    }
    return map;
  }

  /** Product card payload shared by PLP, rails and search (FR-SF-CAT-02). */
  private async cards(products: Prisma.ProductGetPayload<{
    include: { category: true; variants: true; media: { orderBy: { sortOrder: 'asc' } }; bundleConfig: true };
  }>[]) {
    const allVariants = products.flatMap((p) => p.variants.filter((v) => v.status === 'active'));
    const availability = await this.availabilityByVariant(allVariants.map((v) => v.id));
    const display = await this.discounts.priceForDisplay(
      allVariants.map((v) => {
        const p = products.find((x) => x.id === v.productId)!;
        return {
          variantId: v.id,
          productId: v.productId,
          categoryPath: [p.categoryId, ...(p.category.parentId ? [p.category.parentId] : [])],
          unitPrice: v.price,
          costPrice: v.costPrice,
        };
      }),
    );

    const cards = [];
    for (const p of products) {
      const active = p.variants.filter((v) => v.status === 'active');
      if (!active.length && p.type === 'standard') continue;
      // (availability is computed just below; sold-out products are skipped there)

      let priceMin: number, compareAt: number | null = null, badge: string | null = null, available: number;
      let savings: number | null = null;

      if (p.type !== 'standard') {
        const bundle = await this.products.bundleAvailability(p.id).catch(() => null);
        if (!bundle) continue;
        priceMin = bundle.price;
        // Lefe packages carry a manual "compare-at" (attributeValues._lefeCompareAt)
        // to show a discount; other bundles fall back to the sum of their contents.
        const lefeCompareAt = Math.round(Number((p.attributeValues as { _lefeCompareAt?: number } | null)?._lefeCompareAt ?? 0)) || 0;
        compareAt = lefeCompareAt > bundle.price ? lefeCompareAt : bundle.componentSum;
        savings = Math.max(0, compareAt - bundle.price);
        available = bundle.availability;
      } else {
        const priced = active.map((v) => ({ base: v.price, sale: display.get(v.id)?.salePrice ?? v.price, b: display.get(v.id)?.badge ?? null, compareAt: v.compareAtPrice }));
        priceMin = Math.min(...priced.map(x => x.sale));
        const cheapest = priced.find((x) => x.sale === priceMin)!;
        if (cheapest.sale < cheapest.base) { compareAt = cheapest.base; badge = cheapest.b; }
        else if (cheapest.compareAt) compareAt = cheapest.compareAt;
        available = active.reduce((s, v) => s + (availability.get(v.id) ?? 0), 0);
      }

      // "Sell as whole" (product flag) overrides a measured category; sell
      // formats always win (route to the PDP to choose a format).
      const cardHasFormats = Array.isArray((p.attributeValues as { _sellFormats?: unknown[] } | null)?._sellFormats)
        && ((p.attributeValues as { _sellFormats?: unknown[] })._sellFormats!.length > 0);
      const cardWholeItem = !cardHasFormats && !!(p.flags as { wholeItem?: boolean } | null)?.wholeItem;
      const threshold = this.urgencyThreshold(!cardWholeItem && p.category.fractionalAllowed);
      // Direct add-to-cart is safe for a simple single-variant whole item — a
      // non-fractional category, or one flagged "sell as whole". Formats → PDP.
      const directEligible = !cardHasFormats && (cardWholeItem || !p.category.fractionalAllowed);
      const directVariantId =
        p.type === 'standard' && active.length === 1 && directEligible ? active[0].id : null;
      // Sold-out products are hidden from the storefront entirely (no card).
      if (available <= 0) continue;
      cards.push({
        id: p.id,
        slug: p.slug,
        name: p.name,
        variantId: directVariantId,
        type: p.type,
        category: { name: p.category.name, slug: p.category.slug },
        image: p.media[0]?.url ?? null,
        imageAlt: p.media[0]?.altText ?? p.name,
        secondImage: p.media[1]?.url ?? null,
        price: priceMin,
        compareAt,
        badge,
        savings,
        unitName: cardWholeItem ? 'piece' : p.sellUnitId ? (await this.unitName(p.sellUnitId)) : 'piece',
        soldOut: false,
        onlyLeft: available <= threshold ? available : null, // S-D-01
        maxAvailable: available, // stepper cap — quantity can't exceed live stock
        swatches: this.swatches(p),
      });
    }
    return cards;
  }

  private unitCache = new Map<string, string>();
  private async unitName(unitId: string) {
    if (!this.unitCache.has(unitId)) {
      const unit = await this.prisma.unit.findUnique({ where: { id: unitId } });
      this.unitCache.set(unitId, unit?.name ?? 'piece');
    }
    return this.unitCache.get(unitId)!;
  }

  private swatches(p: { variants: { optionValues: unknown; status: string }[] }) {
    const colours = new Set<string>();
    for (const v of p.variants) {
      if (v.status !== 'active') continue;
      const ov = v.optionValues as Record<string, string> | null;
      if (ov?.colour) colours.add(ov.colour);
    }
    return Array.from(colours).slice(0, 5);
  }

  // ── PLP (FR-SF-CAT-01) ─────────────────────────────────────────────────────

  async listing(params: {
    categorySlug?: string;
    filters: Record<string, string>; // attrCode → value
    priceMin?: number;
    priceMax?: number;
    sort?: string;
    page?: number;
    q?: string; // when reused by search results
    ids?: string[];
    store?: string; // 'mim' → only MIM products; otherwise exclude MIM
  }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = 24;

    let categoryIds: string[] | null = null;
    let category = null;
    if (params.categorySlug) {
      category = await this.prisma.category.findUnique({ where: { slug: params.categorySlug } });
      if (!category || category.status !== 'active') throw new NotFoundException('Category not found');
      categoryIds = await this.categoryWithDescendants(category.id);
    }

    // Store separation (MIM & Lefe vs the main Zahrah shop), marked via
    // flags.mim / flags.lefe — no migration. JSON "not equals / is-null" filters
    // are unreliable across null shapes, so resolve ids with safe only-match
    // queries and include/exclude by id.
    const [mimRows, lefeRows] = await Promise.all([
      this.prisma.product.findMany({ where: { flags: { path: ['mim'], equals: true } }, select: { id: true } }),
      this.prisma.product.findMany({ where: { flags: { path: ['lefe'], equals: true } }, select: { id: true } }),
    ]);
    const mimIds = mimRows.map((p) => p.id);
    const lefeIds = lefeRows.map((p) => p.id);

    const attrFilters = Object.entries(params.filters);
    const where: Prisma.ProductWhereInput = {
      status: 'active',
      visibility: 'visible',
      // Default (no store) shows the main shop (not MIM, not Lefe); store='mim'
      // → only MIM; store='lefe' → only Lefe.
      ...(params.store === 'mim'
        ? { id: { in: mimIds } }
        : params.store === 'lefe'
          ? { id: { in: lefeIds } }
          : (mimIds.length || lefeIds.length)
            ? { id: { notIn: [...mimIds, ...lefeIds] } }
            : {}),
      ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
      ...(params.ids ? { id: { in: params.ids } } : {}),
      // Attribute filters: match product attributeValues OR variant optionValues.
      ...(attrFilters.length
        ? {
            AND: attrFilters.map(([code, value]) => ({
              OR: [
                { attributeValues: { path: [code], equals: value } },
                { variants: { some: { status: 'active', optionValues: { path: [code], equals: value } } } },
              ],
            })),
          }
        : {}),
      ...(params.priceMin != null || params.priceMax != null
        ? {
            variants: {
              some: {
                status: 'active',
                price: { ...(params.priceMin != null ? { gte: params.priceMin } : {}), ...(params.priceMax != null ? { lte: params.priceMax } : {}) },
              },
            },
          }
        : {}),
    };

    const orderBy: Prisma.ProductOrderByWithRelationInput =
      params.sort === 'price_asc' || params.sort === 'price_desc'
        ? { createdAt: 'desc' } // sorted post-pricing below
        : { createdAt: 'desc' };

    const [total, products] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { category: true, variants: true, media: { orderBy: { sortOrder: 'asc' } }, bundleConfig: true },
      }),
    ]);

    let cards = await this.cards(products);
    // Sold-out de-prioritized in default sort (S-BR-02).
    if (!params.sort || params.sort === 'newest') cards = [...cards.filter((c) => !c.soldOut), ...cards.filter((c) => c.soldOut)];
    if (params.sort === 'price_asc') cards.sort((a, b) => a.price - b.price);
    if (params.sort === 'price_desc') cards.sort((a, b) => b.price - a.price);

    return {
      category: category ? { id: category.id, name: category.name, slug: category.slug, image: category.image } : null,
      total,
      page,
      pageSize,
      products: cards,
      filters: category ? await this.filtersFor(categoryIds!) : [],
    };
  }

  /** FR-FLT-01/02: filterable attributes with live value counts. */
  private async filtersFor(categoryIds: string[]) {
    const catAttrs = await this.prisma.categoryAttribute.findMany({
      where: { categoryId: { in: categoryIds }, attribute: { isFilterable: true, status: 'active' } },
      include: { attribute: { include: { options: { where: { status: 'active' }, orderBy: { sortOrder: 'asc' } } } } },
    });
    const seen = new Map<string, (typeof catAttrs)[number]['attribute']>();
    for (const ca of catAttrs) seen.set(ca.attribute.code, ca.attribute);

    const filters = [];
    for (const attr of seen.values()) {
      const values = [];
      for (const option of attr.options) {
        const count = await this.prisma.product.count({
          where: {
            status: 'active', visibility: 'visible', categoryId: { in: categoryIds },
            OR: [
              { attributeValues: { path: [attr.code], equals: option.value } },
              { variants: { some: { status: 'active', optionValues: { path: [attr.code], equals: option.value } } } },
            ],
          },
        });
        if (count > 0) values.push({ label: option.label, value: option.value, hexCode: option.hexCode, count });
      }
      if (values.length) filters.push({ code: attr.code, name: attr.name, inputType: attr.inputType, values });
    }
    return filters;
  }

  // ── PDP (FR-SF-CAT-03..08) ─────────────────────────────────────────────────

  async productDetail(slug: string) {
    const p = await this.prisma.product.findUnique({
      where: { slug },
      include: {
        category: { include: { parent: true } },
        variants: { where: { status: 'active' } },
        media: { orderBy: { sortOrder: 'asc' } },
        bundleConfig: true,
        bundleComponents: { include: { variant: { include: { product: { select: { name: true, slug: true, media: { orderBy: { sortOrder: 'asc' }, take: 1 } } } } } }, orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!p || p.status !== 'active') throw new NotFoundException('Product not found');

    const unit = p.sellUnitId ? await this.prisma.unit.findUnique({ where: { id: p.sellUnitId } }) : null;
    const threshold = this.urgencyThreshold(p.category.fractionalAllowed);

    // Variant-defining attributes → selector definitions.
    const catAttrs = await this.prisma.categoryAttribute.findMany({
      where: { categoryId: p.categoryId, attribute: { isVariantDefining: true } },
      include: { attribute: { include: { options: { where: { status: 'active' }, orderBy: { sortOrder: 'asc' } } } } },
      orderBy: { sortOrder: 'asc' },
    });

    // Descriptive attributes for the details section.
    const allCatAttrs = await this.prisma.categoryAttribute.findMany({
      where: { categoryId: p.categoryId },
      include: { attribute: true },
      orderBy: { sortOrder: 'asc' },
    });
    const attributeValues = p.attributeValues as Record<string, unknown>;
    const attrDetails = allCatAttrs
      .filter((ca) => !ca.attribute.isVariantDefining && attributeValues[ca.attribute.code] != null && attributeValues[ca.attribute.code] !== '')
      .map((ca) => ({ name: ca.attribute.name, value: attributeValues[ca.attribute.code] }));
    // Free-form details added ad-hoc in the admin (stored under the reserved
    // "_custom" key) show alongside the structured category attributes.
    const customDetails = Array.isArray(attributeValues._custom)
      ? (attributeValues._custom as { name?: unknown; value?: unknown }[])
          .filter((d) => d && typeof d.name === 'string' && d.name.trim() !== '' && d.value != null && d.value !== '')
          .map((d) => ({ name: String(d.name), value: d.value }))
      : [];
    const details = [...attrDetails, ...customDetails];
    const rating = await this.reviews.summary(p.id);

    if (p.type !== 'standard') {
      const bundle = await this.products.bundleAvailability(p.id);
      // Lefe packages carry a manual "compare-at" (attributeValues._lefeCompareAt)
      // shown struck-through; other bundles use the sum of their contents.
      const lefeCompareAt = Math.round(Number((p.attributeValues as { _lefeCompareAt?: number } | null)?._lefeCompareAt ?? 0)) || 0;
      const worth = lefeCompareAt > bundle.price ? lefeCompareAt : bundle.componentSum;
      return {
        id: p.id, slug: p.slug, name: p.name, description: p.description, type: p.type,
        category: { name: p.category.name, slug: p.category.slug },
        media: p.media.map((m) => ({ url: m.url, alt: m.altText ?? p.name, type: m.type })),
        details,
        bundle: {
          price: bundle.price,
          worth,
          savings: Math.max(0, worth - bundle.price),
          available: bundle.availability, // constraining item withheld (FR-SF-CAT-06)
          onlyLeft: bundle.availability > 0 && bundle.availability <= 5 ? bundle.availability : null,
          soldOut: bundle.availability <= 0,
          contents: p.bundleComponents.map((c) => ({
            name: c.variant.product.name,
            slug: c.variant.product.slug,
            image: c.variant.product.media[0]?.url ?? null,
            quantity: Number(c.quantity),
          })),
        },
        unit: { name: 'package', fractional: false, minQty: 1, increment: 1 },
        variants: [],
        selectors: [],
        bulkEligible: false,
        rating,
      };
    }

    const availability = await this.availabilityByVariant(p.variants.map((v) => v.id));
    const display = await this.discounts.priceForDisplay(
      p.variants.map((v) => ({
        variantId: v.id,
        productId: p.id,
        categoryPath: [p.categoryId, ...(p.category.parentId ? [p.category.parentId] : [])],
        unitPrice: v.price,
        costPrice: v.costPrice,
      })),
    );

    // Wholesale offer (from the reserved "_wholesale" config) surfaced to the PDP.
    const wRaw = attributeValues._wholesale as { enabled?: boolean; increment?: number; unitPrice?: number; note?: string } | undefined;
    const wholesale = wRaw?.enabled && Number(wRaw.increment) > 0 && Number(wRaw.unitPrice) > 0
      ? { enabled: true, increment: Number(wRaw.increment), unitPrice: Number(wRaw.unitPrice), note: wRaw.note ?? null }
      : null;

    // Anko offer (reserved "_anko") — lowest bulk tier + exclusivity lock status.
    const aRaw = attributeValues._anko as { enabled?: boolean; increment?: number; unitPrice?: number; exclusivityDays?: number; note?: string } | undefined;
    const ankoLock = aRaw?.enabled ? await this.anko.activeLock(p.id) : null;
    const anko = aRaw?.enabled && Number(aRaw.increment) > 0 && Number(aRaw.unitPrice) > 0
      ? {
          enabled: true,
          increment: Number(aRaw.increment),
          unitPrice: Number(aRaw.unitPrice),
          exclusivityDays: Number(aRaw.exclusivityDays) > 0 ? Number(aRaw.exclusivityDays) : 60,
          note: aRaw.note ?? null,
          lockedUntil: ankoLock ? ankoLock.lockedUntil.toISOString() : null,
        }
      : null;

    // Sell formats (reserved "_sellFormats" + "_baseUnit"): configurable buy
    // options priced per format, drawing from a shared base-unit stock pool.
    const rawFormats = Array.isArray(attributeValues._sellFormats)
      ? (attributeValues._sellFormats as Record<string, unknown>[])
      : [];
    const sellFormats = rawFormats
      .filter((f) => f && typeof f.id === 'string' && typeof f.label === 'string' && Number(f.price) > 0)
      .map((f) => ({
        id: String(f.id),
        label: String(f.label),
        price: Number(f.price),
        baseQty: Number(f.baseQty) > 0 ? Number(f.baseQty) : 1,
        minQty: Number(f.minQty) > 0 ? Number(f.minQty) : 1,
        increment: Number(f.increment) > 0 ? Number(f.increment) : 1,
        fractional: !!f.fractional,
        default: !!f.default,
      }));
    const baseUnit = typeof attributeValues._baseUnit === 'string' ? attributeValues._baseUnit : null;

    // "Sell as whole" (product flag) — sold as a complete item, not by
    // measurement. Overrides a measured category; sell formats take precedence.
    const wholeItem = sellFormats.length === 0 && !!(p.flags as { wholeItem?: boolean } | null)?.wholeItem;
    // MIM custom-printing: whether shoppers can personalise this item (drives the
    // personalise-one / team cards on the /mim product page) and the per-unit
    // printing surcharge added on top of the product price.
    const mimCustomizable = !!(p.flags as { mimCustomizable?: boolean } | null)?.mimCustomizable;
    const mimPrintPrice = Math.round(Number((p.attributeValues as { _mimPrintPrice?: number } | null)?._mimPrintPrice ?? 0)) || 0;
    const mimPrintArea = (p.attributeValues as { _mimPrintArea?: { x: number; y: number; width: number; height: number } } | null)?._mimPrintArea ?? null;
    // Sides (front/back/…) for the design editor. Fall back to a single "Front"
    // side from the cover image + legacy single print area.
    const coverUrl = p.media[0]?.url ?? null;
    const rawSides = (p.attributeValues as { _mimSides?: { id: string; label: string; image: string; printArea: { x: number; y: number; width: number; height: number } }[] } | null)?._mimSides;
    const mimSides = Array.isArray(rawSides) && rawSides.length
      ? rawSides.map((s) => ({ id: s.id, label: s.label, image: s.image || coverUrl, printArea: s.printArea ?? null }))
      : [{ id: 'front', label: 'Front', image: coverUrl, printArea: mimPrintArea }];

    return {
      id: p.id, slug: p.slug, name: p.name, description: p.description, type: p.type,
      brand: p.brand,
      mimCustomizable,
      mimPrintPrice,
      mimPrintArea,
      mimSides,
      category: { name: p.category.name, slug: p.category.slug },
      media: p.media.map((m) => ({ url: m.url, alt: m.altText ?? p.name, type: m.type, variantId: m.variantId })),
      details,
      wholesale,
      anko,
      sellFormats,
      baseUnit,
      unit: {
        // A whole item is priced/sold like any non-measured product — the
        // storefront then drops the "/unit" price, unit label and 0.5 steps.
        name: wholeItem ? 'piece' : (unit?.name ?? 'piece'),
        fractional: wholeItem ? false : (unit?.fractionalAllowed ?? false),
        minQty: wholeItem ? 1 : Number(p.minOrderQty ?? 1),
        increment: wholeItem ? 1 : Number(p.qtyIncrement ?? 1),
      },
      selectors: catAttrs.map((ca) => ({
        code: ca.attribute.code,
        name: ca.attribute.name,
        inputType: ca.attribute.inputType,
        options: ca.attribute.options.map((o) => ({ label: o.label, value: o.value, hexCode: o.hexCode })),
      })),
      variants: p.variants.map((v) => {
        const d = display.get(v.id);
        const available = availability.get(v.id) ?? 0;
        return {
          id: v.id,
          sku: v.sku,
          optionValues: v.optionValues,
          price: d?.salePrice ?? v.price,
          compareAt: d ? v.price : v.compareAtPrice,
          badge: d?.badge ?? null,
          saleEndsAt: d?.endsAt ?? null,
          available,
          soldOut: available <= 0,
          onlyLeft: available > 0 && available <= threshold ? available : null,
        };
      }),
      // S-D-06: aso-ebi element on measured (fabric) categories — but not when
      // the product is sold as a whole item or already offers sell formats.
      bulkEligible: !wholeItem && sellFormats.length === 0 && p.category.fractionalAllowed,
      bundle: null,
      rating,
    };
  }

  /** Live availability check used at PDP interaction + cart (FR-SF-CAT-08). */
  async availability(lines: { variantId?: string; bundleProductId?: string; formatId?: string; quantity: number }[]) {
    const results = [];
    for (const line of lines) {
      if (line.bundleProductId) {
        const bundle = await this.products.bundleAvailability(line.bundleProductId).catch(() => null);
        results.push({ ...line, available: bundle?.availability ?? 0, ok: (bundle?.availability ?? 0) >= line.quantity });
      } else if (line.variantId) {
        const map = await this.availabilityByVariant([line.variantId]);
        const availableBase = map.get(line.variantId) ?? 0;
        // Sell-format lines consume `quantity × baseQty` base units; report the
        // amount that's actually stockable in the format's own units.
        const fmt = line.formatId ? await this.sellFormatFor(line.variantId, line.formatId) : null;
        const baseQty = fmt && fmt.baseQty > 0 ? fmt.baseQty : 1;
        const availableInFormat = fmt
          ? (fmt.fractional
            ? Math.floor((availableBase / baseQty) / fmt.increment) * fmt.increment
            : Math.floor(availableBase / baseQty))
          : availableBase;
        results.push({ ...line, available: availableInFormat, ok: availableBase >= line.quantity * baseQty });
      }
    }
    return { ok: results.every((r) => r.ok), lines: results };
  }

  /** Resolve a product's configured sell format for a variant (base-unit math). */
  private async sellFormatFor(variantId: string, formatId: string) {
    const v = await this.prisma.variant.findUnique({
      where: { id: variantId },
      select: { product: { select: { attributeValues: true } } },
    });
    const formats = (v?.product.attributeValues as { _sellFormats?: { id: string; baseQty?: number; increment?: number; fractional?: boolean }[] } | null)?._sellFormats;
    const f = Array.isArray(formats) ? formats.find((x) => x.id === formatId) : undefined;
    if (!f) return null;
    return {
      baseQty: Number(f.baseQty) > 0 ? Number(f.baseQty) : 1,
      increment: Number(f.increment) > 0 ? Number(f.increment) : 1,
      fractional: !!f.fractional,
    };
  }
}
