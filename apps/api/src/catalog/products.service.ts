import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { slugify } from '../common/slug';
import { catalogAudit } from './catalog-audit';

type AttrWithOptions = Prisma.AttributeGetPayload<{ include: { options: true } }>;

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  // ── Listing (FR-PRD-08) ────────────────────────────────────────────────────

  async list(params: {
    q?: string;
    categoryId?: string;
    status?: string;
    type?: string;
    stock?: 'low' | 'out';
    store?: string; // 'mim' → only MIM products
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, params.pageSize ?? 25);

    // Filtering by a parent category includes its whole subtree.
    let categoryIds: string[] | null = null;
    if (params.categoryId) {
      const all = await this.prisma.category.findMany({ select: { id: true, parentId: true } });
      categoryIds = [params.categoryId];
      let frontier = [params.categoryId];
      while (frontier.length) {
        const children = all.filter((c) => c.parentId && frontier.includes(c.parentId)).map((c) => c.id);
        categoryIds.push(...children);
        frontier = children;
      }
    }

    // Store separation: the main list excludes MIM & Lefe; store=mim / store=lefe
    // show only those. Id-based (null-safe) — JSON not-equals filters wrongly drop
    // null-flags rows.
    const [mimRows, lefeRows] = await Promise.all([
      this.prisma.product.findMany({ where: { flags: { path: ['mim'], equals: true } }, select: { id: true } }),
      this.prisma.product.findMany({ where: { flags: { path: ['lefe'], equals: true } }, select: { id: true } }),
    ]);
    const mimIds = mimRows.map((p) => p.id);
    const lefeIds = lefeRows.map((p) => p.id);

    const where: Prisma.ProductWhereInput = {
      ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
      ...(params.status ? { status: params.status as never } : {}),
      ...(params.type ? { type: params.type as never } : {}),
      ...(params.store === 'mim'
        ? { id: { in: mimIds } }
        : params.store === 'lefe'
          ? { id: { in: lefeIds } }
          : (mimIds.length || lefeIds.length) ? { id: { notIn: [...mimIds, ...lefeIds] } } : {}),
      ...(params.q
        ? {
            OR: [
              { name: { contains: params.q, mode: 'insensitive' } },
              { variants: { some: { sku: { contains: params.q, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };

    const [total, products] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          category: { select: { id: true, name: true } },
          variants: { select: { id: true, sku: true, price: true, status: true, stockLevels: true } },
          media: { orderBy: { sortOrder: 'asc' }, take: 1 },
          bundleConfig: true,
          bundleComponents: { include: { variant: { select: { price: true, stockLevels: true } } } },
        },
      }),
    ]);

    const rows = products.map((p) => {
      let totalStock: number;
      let priceMin: number | null;
      let priceMax: number | null;

      if (p.type !== 'standard' && p.bundleConfig) {
        // Bundles: package price + derived availability (A1 FR-BAV-01).
        const componentSum = p.bundleComponents.reduce(
          (s, c) => s + Math.round(c.variant.price * Number(c.quantity)),
          0,
        );
        priceMin = p.bundleConfig.pricingMode === 'fixed'
          ? p.bundleConfig.fixedPrice ?? 0
          : Math.round(componentSum * (1 - Number(p.bundleConfig.percentOff ?? 0) / 100));
        priceMax = priceMin;
        let derived = Infinity;
        for (const c of p.bundleComponents) {
          const available = c.variant.stockLevels.reduce((s, l) => s + Number(l.onHand) - Number(l.reserved), 0);
          derived = Math.min(derived, Math.floor(available / Number(c.quantity)));
        }
        if (p.bundleConfig.maxSellable != null) {
          derived = Math.min(derived, p.bundleConfig.maxSellable - p.bundleConfig.soldCount);
        }
        totalStock = Number.isFinite(derived) ? Math.max(0, derived) : 0;
      } else {
        totalStock = p.variants.reduce(
          (sum, v) => sum + v.stockLevels.reduce((s, l) => s + Number(l.onHand) - Number(l.reserved), 0),
          0,
        );
        const prices = p.variants.filter((v) => v.status === 'active').map((v) => v.price);
        priceMin = prices.length ? Math.min(...prices) : null;
        priceMax = prices.length ? Math.max(...prices) : null;
      }

      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        type: p.type,
        status: p.status,
        visibility: p.visibility,
        category: p.category,
        variantCount: p.variants.length,
        priceMin,
        priceMax,
        totalStock,
        cover: p.media[0]?.url ?? null,
        // Selling-mode flags for the list badges.
        wholeItem: !!(p.flags as { wholeItem?: boolean } | null)?.wholeItem,
        hasFormats: Array.isArray((p.attributeValues as { _sellFormats?: unknown[] } | null)?._sellFormats)
          && ((p.attributeValues as { _sellFormats?: unknown[] })._sellFormats!.length > 0),
        updatedAt: p.updatedAt,
      };
    });

    const filtered =
      params.stock === 'out' ? rows.filter((r) => r.totalStock <= 0)
      : params.stock === 'low' ? rows.filter((r) => r.totalStock > 0 && r.totalStock <= 5)
      : rows;

    return { total, page, pageSize, rows: filtered };
  }

  async detail(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: { include: { attributes: { include: { attribute: { include: { options: true } } }, orderBy: { sortOrder: 'asc' } } } },
        variants: { include: { stockLevels: true }, orderBy: { sku: 'asc' } },
        media: { orderBy: { sortOrder: 'asc' } },
        bundleConfig: true,
        bundleComponents: { include: { variant: { include: { product: { select: { name: true } } } } }, orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  // ── Attribute validation (FR-PRD-03) ───────────────────────────────────────

  private async categoryAttributes(categoryId: string) {
    return this.prisma.categoryAttribute.findMany({
      where: { categoryId },
      include: { attribute: { include: { options: true } } },
    });
  }

  /**
   * Validates product-level attribute values and returns the sanitized set.
   * - Variant-defining attributes are skipped entirely: their values live on
   *   variants (option values), never on the product.
   * - Keys for attributes no longer in the category are silently dropped, so
   *   editing a category's attribute set can never strand its products.
   */
  private validateAttributeValues(
    catAttrs: { isRequired: boolean; attribute: AttrWithOptions }[],
    values: Record<string, unknown>,
    forActivation: boolean,
  ): Record<string, unknown> {
    const errors: string[] = [];
    const productLevel = catAttrs.filter((ca) => !ca.attribute.isVariantDefining);
    const known = new Set(productLevel.map((ca) => ca.attribute.code));
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(values)) {
      if (known.has(key)) clean[key] = value;
    }
    // Free-form custom details (name/value pairs) live under the reserved
    // "_custom" key so admins can add ad-hoc specs without editing the category
    // taxonomy. Sanitise here since they bypass the attribute whitelist.
    if (Array.isArray(values._custom)) {
      const custom = (values._custom as { name?: unknown; value?: unknown }[])
        .filter((d) => d && typeof d.name === 'string' && d.name.trim() !== '' && d.value != null && d.value !== '')
        .map((d) => ({
          name: String(d.name).trim().slice(0, 80),
          value: typeof d.value === 'number' ? d.value : String(d.value).trim().slice(0, 500),
        }));
      if (custom.length) clean._custom = custom;
    }
    // Wholesale config (reserved "_wholesale" key): a toggle, an increment (the
    // quantity step / minimum for wholesale) and the wholesale unit price (kobo).
    // Bypasses the attribute whitelist, so sanitise it.
    if (values._wholesale && typeof values._wholesale === 'object' && !Array.isArray(values._wholesale)) {
      const w = values._wholesale as { enabled?: unknown; increment?: unknown; unitPrice?: unknown; note?: unknown };
      const increment = Math.round(Number(w.increment));
      const unitPrice = Math.round(Number(w.unitPrice));
      const valid = Number.isFinite(increment) && increment > 0 && Number.isFinite(unitPrice) && unitPrice > 0;
      clean._wholesale = {
        enabled: !!w.enabled && valid,
        increment: valid ? increment : 0,
        unitPrice: valid ? unitPrice : 0,
        ...(typeof w.note === 'string' && w.note.trim() ? { note: w.note.trim().slice(0, 200) } : {}),
      };
    }
    // Anko config (reserved "_anko" key): the cheapest bulk tier for group/event
    // (aso-ebi) buys, plus an exclusivity period (days) that locks the fabric's
    // bulk to the buyer. Same shape as wholesale + exclusivityDays.
    if (values._anko && typeof values._anko === 'object' && !Array.isArray(values._anko)) {
      const a = values._anko as { enabled?: unknown; increment?: unknown; unitPrice?: unknown; exclusivityDays?: unknown; note?: unknown };
      const increment = Math.round(Number(a.increment));
      const unitPrice = Math.round(Number(a.unitPrice));
      const valid = Number.isFinite(increment) && increment > 0 && Number.isFinite(unitPrice) && unitPrice > 0;
      const days = Math.round(Number(a.exclusivityDays));
      clean._anko = {
        enabled: !!a.enabled && valid,
        increment: valid ? increment : 0,
        unitPrice: valid ? unitPrice : 0,
        exclusivityDays: Number.isFinite(days) && days > 0 ? Math.min(365, days) : 60,
        ...(typeof a.note === 'string' && a.note.trim() ? { note: a.note.trim().slice(0, 200) } : {}),
      };
    }
    // Sell formats (reserved "_baseUnit" + "_sellFormats"): configurable ways to
    // buy the product (piece, yard…), each priced per format and drawing from a
    // shared base-unit stock pool via `baseQty`. Bypasses the whitelist → sanitise.
    if (typeof values._baseUnit === 'string' && values._baseUnit.trim()) {
      clean._baseUnit = values._baseUnit.trim().slice(0, 30);
    }
    if (Array.isArray(values._sellFormats)) {
      const seen = new Set<string>();
      const formats: Record<string, unknown>[] = [];
      for (const raw of values._sellFormats as Record<string, unknown>[]) {
        const label = typeof raw?.label === 'string' ? raw.label.trim().slice(0, 40) : '';
        const idSource = typeof raw?.id === 'string' && raw.id.trim() ? raw.id : label;
        const id = idSource.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
        const price = Math.round(Number(raw?.price));
        if (!id || !label || !Number.isFinite(price) || price <= 0 || seen.has(id)) continue;
        seen.add(id);
        const baseQty = Number(raw?.baseQty);
        const minQty = Number(raw?.minQty);
        const increment = Number(raw?.increment);
        formats.push({
          id,
          label,
          price,
          baseQty: baseQty > 0 ? baseQty : 1,
          minQty: minQty > 0 ? minQty : 1,
          increment: increment > 0 ? increment : 1,
          fractional: !!raw?.fractional,
          default: !!raw?.default,
        });
      }
      if (formats.length) {
        // Exactly one default.
        let hasDefault = false;
        for (const f of formats) {
          if (f.default && !hasDefault) hasDefault = true;
          else f.default = false;
        }
        if (!hasDefault) formats[0].default = true;
        clean._sellFormats = formats;
      }
    }
    // MIM custom-printing surcharge (reserved "_mimPrintPrice", kobo) — added to
    // each personalised unit on the /mim store. Bypasses the whitelist → sanitise.
    const mimPrint = Math.round(Number(values._mimPrintPrice));
    if (Number.isFinite(mimPrint) && mimPrint > 0) clean._mimPrintPrice = mimPrint;

    // Lefe package "compare-at" (reserved "_lefeCompareAt", kobo) — manual worth
    // shown struck-through on the /lefe store. Bypasses the whitelist → sanitise.
    const lefeCompare = Math.round(Number(values._lefeCompareAt));
    if (Number.isFinite(lefeCompare) && lefeCompare > 0) clean._lefeCompareAt = lefeCompare;

    const clamp01 = (v: unknown, d: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : d; };
    // MIM print area (legacy single area, reserved "_mimPrintArea") — fractions.
    if (values._mimPrintArea && typeof values._mimPrintArea === 'object' && !Array.isArray(values._mimPrintArea)) {
      const a = values._mimPrintArea as Record<string, unknown>;
      clean._mimPrintArea = { x: clamp01(a.x, 0.24), y: clamp01(a.y, 0.2), width: clamp01(a.width, 0.52), height: clamp01(a.height, 0.52) };
    }
    // MIM sides (reserved "_mimSides") — front/back/… each with its own image
    // (a product-media URL) and print area (fractions). Bypasses whitelist → clamp.
    if (Array.isArray(values._mimSides)) {
      const seen = new Set<string>();
      const sides: Record<string, unknown>[] = [];
      for (const raw of values._mimSides as Record<string, unknown>[]) {
        if (!raw || typeof raw !== 'object') continue;
        const label = typeof raw.label === 'string' ? raw.label.trim().slice(0, 30) : '';
        const id = ((typeof raw.id === 'string' && raw.id.trim() ? raw.id : label).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')).slice(0, 20);
        if (!id || !label || seen.has(id)) continue;
        seen.add(id);
        const pa = (raw.printArea && typeof raw.printArea === 'object') ? raw.printArea as Record<string, unknown> : {};
        sides.push({
          id, label,
          image: typeof raw.image === 'string' ? raw.image.slice(0, 2000) : '',
          printArea: { x: clamp01(pa.x, 0.24), y: clamp01(pa.y, 0.2), width: clamp01(pa.width, 0.52), height: clamp01(pa.height, 0.52) },
        });
      }
      if (sides.length) clean._mimSides = sides;
    }

    for (const ca of productLevel) {
      const attr = ca.attribute;
      const value = clean[attr.code];
      const empty = value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);

      if (empty) {
        if (forActivation && ca.isRequired) errors.push(`"${attr.name}" is required`);
        continue;
      }
      switch (attr.inputType) {
        case 'number':
          if (typeof value !== 'number' || Number.isNaN(value)) errors.push(`"${attr.name}" must be a number`);
          break;
        case 'boolean':
          if (typeof value !== 'boolean') errors.push(`"${attr.name}" must be yes/no`);
          break;
        case 'select':
        case 'color':
        case 'image_option': {
          const valid = attr.options.some((o) => o.value === value);
          if (!valid) errors.push(`"${attr.name}": "${value}" is not a valid option`);
          break;
        }
        case 'multiselect': {
          if (!Array.isArray(value)) errors.push(`"${attr.name}" must be a list`);
          else {
            const validValues = new Set(attr.options.map((o) => o.value));
            for (const v of value) if (!validValues.has(v as string)) errors.push(`"${attr.name}": "${v}" is not a valid option`);
          }
          break;
        }
        default:
          if (typeof value !== 'string') errors.push(`"${attr.name}" must be text`);
      }
    }
    if (errors.length) throw new BadRequestException({ message: 'Attribute validation failed', errors });
    return clean;
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  async create(userId: string, data: {
    categoryId: string;
    name: string;
    slug?: string;
    brand?: string;
    description?: string;
    tags?: string[];
    type?: 'standard' | 'bundle' | 'configurable_bundle';
    attributeValues?: Record<string, unknown>;
    sellUnitId?: string | null;
    minOrderQty?: number;
    qtyIncrement?: number;
    basePrice?: number; // used for the default variant in single-SKU mode
    taxable?: boolean;
    requiresShipping?: boolean;
    flags?: Record<string, boolean>;
  }) {
    const category = await this.prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category || category.status !== 'active') throw new BadRequestException('Invalid category');

    const catAttrs = await this.categoryAttributes(data.categoryId);
    data.attributeValues = this.validateAttributeValues(catAttrs, data.attributeValues ?? {}, false);

    let slug = data.slug ? slugify(data.slug) : slugify(data.name);
    const dup = await this.prisma.product.findUnique({ where: { slug } });
    if (dup) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          categoryId: data.categoryId,
          name: data.name,
          slug,
          brand: data.brand,
          description: data.description,
          tags: data.tags ?? [],
          type: data.type ?? 'standard',
          status: 'draft',
          taxable: data.taxable ?? true,
          requiresShipping: data.requiresShipping ?? true,
          sellUnitId: data.sellUnitId ?? category.defaultUnitId,
          minOrderQty: data.minOrderQty ?? category.minOrderQty,
          qtyIncrement: data.qtyIncrement ?? category.qtyIncrement,
          attributeValues: (data.attributeValues ?? {}) as never,
          flags: (data.flags ?? {}) as never,
          createdBy: userId,
        },
      });

      // FR-VAR-06: default variant for single-SKU mode.
      const hasVariantDefining = catAttrs.some((ca) => ca.attribute.isVariantDefining);
      if (!hasVariantDefining && data.type !== 'bundle') {
        await tx.variant.create({
          data: {
            productId: product.id,
            sku: `${slug.toUpperCase().replace(/-/g, '').slice(0, 16)}-01`,
            price: data.basePrice ?? 0,
            optionValues: {},
          },
        });
      }

      await catalogAudit(tx, { entityType: 'product', entityId: product.id, action: 'create', userId, after: product });
      return this.detailTx(tx, product.id);
    });
  }

  private detailTx(tx: Prisma.TransactionClient, id: string) {
    return tx.product.findUnique({
      where: { id },
      include: { variants: true, media: true, bundleConfig: true, bundleComponents: true },
    });
  }

  async update(userId: string, id: string, data: Record<string, unknown>, contentOnly: boolean) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');

    const allowed = contentOnly
      ? ['description', 'tags', 'flags'] // Product §4: Content role edits content fields only
      : ['name', 'slug', 'brand', 'description', 'tags', 'categoryId', 'visibility', 'taxable',
         'requiresShipping', 'sellUnitId', 'minOrderQty', 'qtyIncrement', 'attributeValues', 'flags'];
    const clean: Record<string, unknown> = {};
    for (const key of allowed) if (data[key] !== undefined) clean[key] = data[key];

    if (clean.slug) clean.slug = slugify(clean.slug as string);
    if (clean.attributeValues) {
      const catAttrs = await this.categoryAttributes((clean.categoryId as string) ?? product.categoryId);
      clean.attributeValues = this.validateAttributeValues(catAttrs, clean.attributeValues as Record<string, unknown>, false);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({ where: { id }, data: clean as never });
      await catalogAudit(tx, { entityType: 'product', entityId: id, action: 'update', userId, before: product, after: updated });
      return updated;
    });
  }

  /** FR-PRD-06 activation gate + Validation Rules 1/5 + A1 FR-BND-03 for bundles. */
  async activate(userId: string, id: string) {
    const product = await this.detail(id);
    const errors: string[] = [];

    const catAttrs = product.category.attributes;
    try {
      this.validateAttributeValues(catAttrs as never, product.attributeValues as Record<string, unknown>, true);
    } catch (e) {
      const resp = (e as BadRequestException).getResponse() as { errors?: string[] };
      errors.push(...(resp.errors ?? ['Attribute validation failed']));
    }

    const mediaRules = (product.category.mediaRules as { minImages?: number } | null) ?? {};
    const minImages = mediaRules.minImages ?? 1;
    if (product.media.length < minImages) errors.push(`At least ${minImages} image(s) required`);

    if (product.type === 'bundle') {
      if (product.bundleComponents.length < 2) errors.push('A bundle needs at least 2 components');
      if (!product.bundleConfig) errors.push('Bundle pricing is not configured');
      else if (product.bundleConfig.pricingMode === 'fixed' && !product.bundleConfig.fixedPrice) {
        errors.push('Bundle fixed price is not set');
      }
      const inactive = product.bundleComponents.filter((c) => c.variant.status !== 'active');
      if (inactive.length) errors.push('All bundle components must be active variants');
    } else {
      const activeVariants = product.variants.filter((v) => v.status === 'active');
      if (activeVariants.length === 0) errors.push('At least one active variant is required');
      if (activeVariants.some((v) => v.price <= 0)) errors.push('Every variant needs a price');
    }

    if (errors.length) throw new BadRequestException({ message: 'Product cannot be activated', errors });

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({ where: { id }, data: { status: 'active' } });
      await catalogAudit(tx, { entityType: 'product', entityId: id, action: 'update', userId, before: { status: product.status }, after: { status: 'active' } });
      return updated;
    });
  }

  /** FR-PRD-09: archive keeps history; storefront removal only. */
  async archive(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({ where: { id }, data: { status: 'archived' } });
      await catalogAudit(tx, { entityType: 'product', entityId: id, action: 'archive', userId });
      return updated;
    });
  }

  /** Permanently delete a DRAFT that has no stock or order history. */
  async deleteDraft(userId: string, id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { variants: { select: { id: true } } },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (product.status !== 'draft') {
      throw new BadRequestException('Only drafts can be deleted — archive active products instead');
    }

    const variantIds = product.variants.map((v) => v.id);
    const [orderLines, movements, usedInBundles] = await Promise.all([
      variantIds.length ? this.prisma.orderLine.count({ where: { variantId: { in: variantIds } } }) : 0,
      variantIds.length ? this.prisma.stockMovement.count({ where: { variantId: { in: variantIds } } }) : 0,
      variantIds.length ? this.prisma.bundleComponent.count({ where: { variantId: { in: variantIds } } }) : 0,
    ]);
    if (orderLines + movements + usedInBundles > 0) {
      throw new BadRequestException(
        'This draft already has stock or order history — archive it instead so those records stay intact',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      if (variantIds.length) {
        await tx.stockLevel.deleteMany({ where: { variantId: { in: variantIds } } });
        await tx.stockAlert.deleteMany({ where: { variantId: { in: variantIds } } });
        await tx.promotionScopeItem.deleteMany({ where: { kind: 'variant', refId: { in: variantIds } } });
      }
      await tx.promotionScopeItem.deleteMany({ where: { kind: { in: ['product', 'product_excl'] }, refId: id } });
      await tx.productMedia.deleteMany({ where: { productId: id } });
      await tx.bundleComponent.deleteMany({ where: { bundleProductId: id } });
      await tx.bundleSlot.deleteMany({ where: { bundleProductId: id } });
      await tx.bundleConfig.deleteMany({ where: { bundleProductId: id } });
      await tx.variant.deleteMany({ where: { productId: id } });
      await tx.product.delete({ where: { id } });
      await catalogAudit(tx, { entityType: 'product', entityId: id, action: 'delete', userId, before: { name: product.name, slug: product.slug } });
    });
    return { deleted: true };
  }

  /** Unarchive: back to draft so the activation checks re-run before it sells again. */
  async restore(userId: string, id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    if (product.status !== 'archived') throw new BadRequestException('Only archived products can be restored');
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({ where: { id }, data: { status: 'draft' } });
      await catalogAudit(tx, { entityType: 'product', entityId: id, action: 'restore', userId });
      return updated;
    });
  }

  /**
   * Delete a variant. History integrity rules (NFR-07): a variant referenced
   * by orders, stock movements or bundles is archived, never deleted.
   */
  async deleteVariant(userId: string, variantId: string) {
    const variant = await this.prisma.variant.findUnique({ where: { id: variantId } });
    if (!variant) throw new NotFoundException('Variant not found');

    const [orderLines, movements, bundleUse] = await Promise.all([
      this.prisma.orderLine.count({ where: { variantId } }),
      this.prisma.stockMovement.count({ where: { variantId } }),
      this.prisma.bundleComponent.count({ where: { variantId } }),
    ]);

    if (orderLines + movements + bundleUse > 0) {
      await this.prisma.$transaction(async (tx) => {
        await tx.variant.update({ where: { id: variantId }, data: { status: 'archived' } });
        await catalogAudit(tx, {
          entityType: 'variant', entityId: variantId, action: 'archive', userId,
          before: { sku: variant.sku },
          after: { inUseBy: { orderLines, movements, bundleUse } },
        });
      });
      return { archived: true, inUseBy: { orderLines, movements, bundleUse } };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.stockLevel.deleteMany({ where: { variantId } });
      await tx.productMedia.updateMany({ where: { variantId }, data: { variantId: null } });
      await tx.promotionScopeItem.deleteMany({ where: { kind: 'variant', refId: variantId } });
      await tx.variant.delete({ where: { id: variantId } });
      await catalogAudit(tx, { entityType: 'variant', entityId: variantId, action: 'delete', userId, before: { sku: variant.sku } });
    });
    return { deleted: true };
  }

  /** FR-PRD-07 / A1 FR-BND-05: duplicate as draft, cleared SKUs/stock/sold_count. */
  async duplicate(userId: string, id: string) {
    const src = await this.detail(id);
    const slug = `${src.slug}-copy-${Date.now().toString(36).slice(-4)}`;

    return this.prisma.$transaction(async (tx) => {
      const copy = await tx.product.create({
        data: {
          categoryId: src.categoryId,
          name: `${src.name} (copy)`,
          slug,
          brand: src.brand,
          description: src.description,
          tags: src.tags,
          type: src.type,
          status: 'draft',
          visibility: src.visibility,
          taxable: src.taxable,
          requiresShipping: src.requiresShipping,
          sellUnitId: src.sellUnitId,
          minOrderQty: src.minOrderQty,
          qtyIncrement: src.qtyIncrement,
          attributeValues: src.attributeValues as never,
          flags: src.flags as never,
          createdBy: userId,
        },
      });
      for (const v of src.variants) {
        await tx.variant.create({
          data: {
            productId: copy.id,
            sku: `${v.sku}-COPY-${Date.now().toString(36).slice(-3).toUpperCase()}`,
            optionValues: v.optionValues as never,
            price: v.price,
            compareAtPrice: v.compareAtPrice,
            costPrice: v.costPrice,
            weight: v.weight,
            dimensions: v.dimensions as never,
          },
        });
      }
      for (const c of src.bundleComponents) {
        await tx.bundleComponent.create({
          data: { bundleProductId: copy.id, variantId: c.variantId, quantity: c.quantity, sortOrder: c.sortOrder },
        });
      }
      if (src.bundleConfig) {
        const { bundleProductId: _ignored, soldCount: _sc, ...cfg } = src.bundleConfig;
        await tx.bundleConfig.create({ data: { ...cfg, bundleProductId: copy.id, soldCount: 0 } as never });
      }
      await catalogAudit(tx, { entityType: 'product', entityId: copy.id, action: 'create', userId, after: { duplicatedFrom: id } });
      return copy;
    });
  }

  // ── Variants (FR-VAR) ──────────────────────────────────────────────────────

  /** Recreate the default variant for single-SKU products left variant-less. */
  async createDefaultVariant(userId: string, productId: string, price: number) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { variants: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (product.variants.some((v) => v.status === 'active')) {
      throw new BadRequestException('This product already has an active variant');
    }

    let sku = `${product.slug.toUpperCase().replace(/-/g, '').slice(0, 16)}-01`;
    if (await this.prisma.variant.findUnique({ where: { sku } })) {
      sku = `${sku}-${Date.now().toString(36).slice(-3).toUpperCase()}`;
    }
    return this.prisma.$transaction(async (tx) => {
      const variant = await tx.variant.create({
        data: { productId, sku, optionValues: {}, price },
      });
      await catalogAudit(tx, { entityType: 'variant', entityId: variant.id, action: 'create', userId, after: { sku, default: true } });
      return variant;
    });
  }

  /** Cartesian generation; only new combinations are created (FR-VAR-05). */
  async generateVariants(userId: string, productId: string, selections: Record<string, string[]>, basePrice: number) {
    const product = await this.prisma.product.findUnique({ where: { id: productId }, include: { variants: true } });
    if (!product) throw new NotFoundException('Product not found');

    const codes = Object.keys(selections);
    if (codes.length === 0) throw new BadRequestException('Select at least one attribute value');

    // Cartesian product of selected option values.
    let combos: Record<string, string>[] = [{}];
    for (const code of codes) {
      const values = selections[code];
      if (!values?.length) throw new BadRequestException(`No values selected for "${code}"`);
      combos = combos.flatMap((c) => values.map((v) => ({ ...c, [code]: v })));
    }
    if (combos.length > 200) throw new BadRequestException('Too many combinations (max 200)');

    const existingKeys = new Set(
      product.variants.map((v) => JSON.stringify(Object.entries((v.optionValues as Record<string, string>) ?? {}).sort())),
    );
    const fresh = combos.filter((c) => !existingKeys.has(JSON.stringify(Object.entries(c).sort())));

    const skuBase = product.slug.toUpperCase().replace(/-/g, '').slice(0, 12);
    return this.prisma.$transaction(async (tx) => {
      const created = [];
      for (const combo of fresh) {
        const suffix = Object.values(combo)
          .map((v) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))
          .join('-');
        let sku = `${skuBase}-${suffix}`;
        // Global SKU uniqueness (Validation 2) with cheap collision fallback.
        if (await tx.variant.findUnique({ where: { sku } })) sku = `${sku}-${Date.now().toString(36).slice(-3).toUpperCase()}`;
        created.push(
          await tx.variant.create({
            data: { productId, sku, optionValues: combo as never, price: basePrice },
          }),
        );
      }
      await catalogAudit(tx, { entityType: 'product', entityId: productId, action: 'generate_variants', userId, after: { count: created.length } });
      return created;
    });
  }

  async updateVariant(
    userId: string,
    variantId: string,
    data: { name?: string | null; sku?: string; barcode?: string | null; price?: number; compareAtPrice?: number | null; costPrice?: number | null; weight?: number | null; status?: 'active' | 'archived' },
    canSetPrices: boolean,
  ) {
    const before = await this.prisma.variant.findUnique({ where: { id: variantId } });
    if (!before) throw new NotFoundException('Variant not found');

    if (!canSetPrices) {
      // Product §4: only Owner/Manager set/override prices.
      delete data.price;
      delete data.compareAtPrice;
      delete data.costPrice;
    }
    if (data.compareAtPrice != null && data.price != null && data.compareAtPrice < data.price) {
      throw new BadRequestException('Compare-at price must be ≥ selling price (Validation 5)');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.variant.update({ where: { id: variantId }, data: data as never });
      const priceChanged = data.price !== undefined && data.price !== before.price;
      await catalogAudit(tx, {
        entityType: 'variant',
        entityId: variantId,
        action: priceChanged ? 'price_change' : 'update',
        userId,
        before: { sku: before.sku, price: before.price, costPrice: before.costPrice },
        after: data,
      });
      return updated;
    });
  }

  // ── Bundles (A1 FR-BND-01/02) ──────────────────────────────────────────────

  async setBundle(
    userId: string,
    productId: string,
    data: {
      components: { variantId: string; quantity: number; sortOrder?: number }[];
      config: {
        pricingMode: 'fixed' | 'percent_off_sum';
        fixedPrice?: number | null;
        percentOff?: number | null;
        allowBelowCost?: boolean;
        eligibleForPromotions?: boolean;
        maxSellable?: number | null;
        activeFrom?: string | null;
        activeUntil?: string | null;
        returnMode?: 'whole_only' | 'pro_rata';
      };
    },
  ) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.type === 'standard') throw new BadRequestException('Not a bundle product');
    if (data.components.length < 2 || data.components.length > 15) {
      throw new BadRequestException('Bundles need 2–15 components (FR-BND-01)');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.bundleComponent.deleteMany({ where: { bundleProductId: productId } });
      for (const [i, c] of data.components.entries()) {
        await tx.bundleComponent.create({
          data: { bundleProductId: productId, variantId: c.variantId, quantity: c.quantity, sortOrder: c.sortOrder ?? i },
        });
      }
      const cfg = data.config;
      await tx.bundleConfig.upsert({
        where: { bundleProductId: productId },
        create: {
          bundleProductId: productId,
          pricingMode: cfg.pricingMode,
          fixedPrice: cfg.fixedPrice ?? null,
          percentOff: cfg.percentOff ?? null,
          allowBelowCost: cfg.allowBelowCost ?? false,
          eligibleForPromotions: cfg.eligibleForPromotions ?? false,
          maxSellable: cfg.maxSellable ?? null,
          activeFrom: cfg.activeFrom ? new Date(cfg.activeFrom) : null,
          activeUntil: cfg.activeUntil ? new Date(cfg.activeUntil) : null,
          returnMode: cfg.returnMode ?? 'whole_only',
        },
        update: {
          pricingMode: cfg.pricingMode,
          fixedPrice: cfg.fixedPrice ?? null,
          percentOff: cfg.percentOff ?? null,
          allowBelowCost: cfg.allowBelowCost ?? false,
          eligibleForPromotions: cfg.eligibleForPromotions ?? false,
          maxSellable: cfg.maxSellable ?? null,
          activeFrom: cfg.activeFrom ? new Date(cfg.activeFrom) : null,
          activeUntil: cfg.activeUntil ? new Date(cfg.activeUntil) : null,
          returnMode: cfg.returnMode ?? 'whole_only',
        },
      });
      await catalogAudit(tx, { entityType: 'product', entityId: productId, action: 'update', userId, after: { bundle: data } });
      return this.detailTx(tx, productId);
    });
  }

  /** Lefe (bridal gift package) — a bundle flagged flags.lefe, in the "Lefe"
   *  category, fixed-priced with a manual compare-at. Create or update in one
   *  call: resolves each chosen product's active variant, sets the bundle
   *  components + price, optional cover image, then publishes it. */
  async saveLefe(userId: string, data: {
    id?: string;
    name: string;
    price: number;                 // fixed package price (kobo)
    compareAt?: number | null;     // manual "worth" shown struck-through (kobo)
    coverUrl?: string | null;
    components: { variantId: string; quantity: number }[];
  }) {
    if (data.components.length < 2) throw new BadRequestException('A Lefe needs at least 2 items');
    const components = data.components.map((c, i) => ({ variantId: c.variantId, quantity: c.quantity > 0 ? c.quantity : 1, sortOrder: i }));

    // Dedicated "Lefe" category (find-or-create).
    let category = await this.prisma.category.findUnique({ where: { slug: 'lefe' } });
    if (!category) category = await this.prisma.category.create({ data: { name: 'Lefe', slug: 'lefe', status: 'active' } });

    const attributeValues = { _lefeCompareAt: data.compareAt && data.compareAt > 0 ? Math.round(data.compareAt) : 0 };

    let productId = data.id;
    if (productId) {
      await this.prisma.product.update({
        where: { id: productId },
        data: { name: data.name, attributeValues: attributeValues as never, flags: { lefe: true } as never },
      });
    } else {
      const created = await this.create(userId, {
        categoryId: category.id, name: data.name, type: 'bundle',
        flags: { lefe: true }, attributeValues,
      });
      if (!created) throw new BadRequestException('Could not create the Lefe');
      productId = created.id;
    }

    await this.setBundle(userId, productId, {
      components,
      config: { pricingMode: 'fixed', fixedPrice: Math.round(data.price), eligibleForPromotions: false },
    } as never);

    // Cover image (first media = storefront cover).
    if (data.coverUrl) {
      await this.prisma.$transaction(async (tx) => {
        await tx.productMedia.deleteMany({ where: { productId: productId! } });
        await tx.productMedia.create({ data: { productId: productId!, url: data.coverUrl!, type: 'image', altText: data.name, sortOrder: 0 } });
      });
    }

    // Publish it (bundles are created as drafts).
    await this.prisma.product.update({ where: { id: productId }, data: { status: 'active', visibility: 'visible' } });
    return this.prisma.product.findUnique({ where: { id: productId } });
  }

  /** A1 FR-BAV-01: derived availability + pricing summary for the admin editor. */
  async bundleAvailability(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        bundleConfig: true,
        bundleComponents: { include: { variant: { include: { stockLevels: true, product: { select: { name: true } } } } } },
      },
    });
    if (!product?.bundleConfig) throw new NotFoundException('Bundle not configured');

    let availability = Infinity;
    let constrainedBy: string | null = null;
    let componentSum = 0;
    let componentCostSum = 0;

    for (const c of product.bundleComponents) {
      const available = c.variant.stockLevels.reduce((s, l) => s + Number(l.onHand) - Number(l.reserved), 0);
      const possible = Math.floor(available / Number(c.quantity));
      if (possible < availability) {
        availability = possible;
        constrainedBy = `${c.variant.product.name} (${c.variant.sku})`;
      }
      componentSum += Math.round(c.variant.price * Number(c.quantity));
      componentCostSum += Math.round((c.variant.costPrice ?? 0) * Number(c.quantity));
    }

    const cfg = product.bundleConfig;
    if (cfg.maxSellable != null) {
      const capRemaining = cfg.maxSellable - cfg.soldCount;
      if (capRemaining < availability) {
        availability = Math.max(0, capRemaining);
        constrainedBy = 'max sellable cap';
      }
    }

    const price =
      cfg.pricingMode === 'fixed'
        ? cfg.fixedPrice ?? 0
        : Math.round(componentSum * (1 - Number(cfg.percentOff ?? 0) / 100));

    return {
      availability: Number.isFinite(availability) ? availability : 0,
      constrainedBy,
      componentSum,
      componentCostSum,
      price,
      savings: componentSum - price,
      belowCost: price < componentCostSum,
      soldCount: cfg.soldCount,
      maxSellable: cfg.maxSellable,
    };
  }
}
