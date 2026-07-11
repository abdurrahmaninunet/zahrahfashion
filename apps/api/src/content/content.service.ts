import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AuthedUser } from '../auth/auth.types';
import { slugify, RESERVED_SLUGS } from '../common/slug';
import { FieldDef, SECTION_TYPES_BY_KEY, SYSTEM_PAGES } from './section-types';

@Injectable()
export class ContentService {
  constructor(private prisma: PrismaService) {}

  private async logEvent(contentItemId: string | null, type: string, actorId?: string | null, payload?: unknown) {
    await this.prisma.contentEvent.create({
      data: { contentItemId, type, actorType: actorId ? 'user' : 'system', actorId: actorId ?? null, payload: payload as never },
    });
  }

  // ── Validation (Content Validation Rules 1/3/6) ────────────────────────────

  /** Strip anything that could smuggle scripts into rich text (Rule 6). */
  sanitizeRichText(html: string): string {
    return html
      .replace(/<\s*(script|style|iframe|object|embed|form)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
      .replace(/<\s*(script|style|iframe|object|embed|form)[^>]*\/?\s*>/gi, '')
      .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
      .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
      .replace(/javascript\s*:/gi, '');
  }

  private validateFields(defs: FieldDef[], values: Record<string, unknown>, forPublish: boolean, errors: string[], prefix = '') {
    for (const def of defs) {
      const value = values?.[def.key];
      const empty = value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
      if (empty) {
        if (forPublish && def.required) errors.push(`${prefix}${def.label} is required`);
        continue;
      }
      if (def.type === 'text' && typeof value === 'string' && def.maxLength && value.length > def.maxLength) {
        errors.push(`${prefix}${def.label} exceeds ${def.maxLength} characters`);
      }
      if ((def.type === 'slides' || def.type === 'tiles') && Array.isArray(value) && def.itemFields) {
        value.forEach((item, i) => {
          this.validateFields(def.itemFields!, item as Record<string, unknown>, forPublish, errors, `${def.label} #${i + 1}: `);
        });
      }
      if (def.type === 'image' && forPublish) {
        const img = value as { url?: string; alt?: string };
        if (typeof img === 'object' && img.url && !img.alt) {
          errors.push(`${prefix}${def.label}: alt text is required on published imagery (NFR-08)`);
        }
      }
    }
  }

  private validateItem(type: string, sectionKey: string | null, fields: Record<string, unknown>, forPublish: boolean) {
    const errors: string[] = [];
    if (type === 'section') {
      const sectionType = sectionKey ? SECTION_TYPES_BY_KEY.get(sectionKey) : null;
      if (!sectionType) throw new BadRequestException(`Unknown section type: ${sectionKey}`);
      this.validateFields(sectionType.fields, fields, forPublish, errors);
    }
    if (type === 'page' && forPublish) {
      if (!fields.body || (typeof fields.body === 'string' && fields.body.trim() === '')) {
        errors.push('Page body is required to publish');
      }
    }
    if (errors.length) throw new BadRequestException({ message: 'Content validation failed', errors });
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  async list(params: { type?: string; status?: string; q?: string }) {
    return this.prisma.contentItem.findMany({
      where: {
        ...(params.type ? { type: params.type } : {}),
        ...(params.status ? { status: params.status as never } : {}),
        ...(params.q ? { title: { contains: params.q, mode: 'insensitive' } } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
  }

  async detail(id: string) {
    const item = await this.prisma.contentItem.findUnique({
      where: { id },
      include: { versions: { orderBy: { publishedAt: 'desc' }, take: 20 } },
    });
    if (!item) throw new NotFoundException('Content not found');
    return item;
  }

  async create(user: AuthedUser, data: {
    type: 'section' | 'page' | 'menu' | 'announcement' | 'collection';
    sectionKey?: string;
    title: string;
    fields?: Record<string, unknown>;
    slug?: string;
    startsAt?: string | null;
    endsAt?: string | null;
    promotionId?: string | null;
    seo?: Record<string, unknown>;
  }) {
    const fields = data.fields ?? {};
    if (typeof fields.body === 'string') fields.body = this.sanitizeRichText(fields.body);
    this.validateItem(data.type, data.sectionKey ?? null, fields, false);

    let slug: string | null = null;
    if (data.type === 'page' || data.slug) {
      slug = slugify(data.slug || data.title);
      if (RESERVED_SLUGS.has(slug)) throw new BadRequestException(`"${slug}" is a reserved route (Validation 3)`);
      const clash = await this.prisma.contentItem.findUnique({ where: { slug } });
      if (clash) throw new BadRequestException(`Slug "${slug}" is already in use`);
    }
    if (data.startsAt && data.endsAt && new Date(data.endsAt) <= new Date(data.startsAt)) {
      throw new BadRequestException('Schedule end must be after start (Validation 4)');
    }

    const item = await this.prisma.contentItem.create({
      data: {
        type: data.type,
        sectionKey: data.sectionKey ?? null,
        title: data.title,
        fields: fields as never,
        slug,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
        promotionId: data.promotionId ?? null,
        seo: (data.seo as never) ?? undefined,
        createdBy: user.id,
      },
    });
    await this.logEvent(item.id, 'created', user.id);
    return item;
  }

  async update(user: AuthedUser, id: string, data: Record<string, unknown>) {
    const item = await this.detail(id);
    this.assertPolicyPermission(user, item, 'edit');

    const clean: Record<string, unknown> = {};
    for (const key of ['title', 'fields', 'startsAt', 'endsAt', 'promotionId', 'seo']) {
      if (data[key] !== undefined) clean[key] = data[key];
    }
    if (clean.fields && typeof (clean.fields as Record<string, unknown>).body === 'string') {
      (clean.fields as Record<string, unknown>).body = this.sanitizeRichText((clean.fields as Record<string, unknown>).body as string);
    }
    if (data.slug !== undefined && !item.systemKey) {
      const slug = slugify(data.slug as string);
      if (RESERVED_SLUGS.has(slug)) throw new BadRequestException(`"${slug}" is a reserved route`);
      clean.slug = slug;
    }
    if (clean.startsAt) clean.startsAt = new Date(clean.startsAt as string);
    if (clean.endsAt) clean.endsAt = new Date(clean.endsAt as string);

    const updated = await this.prisma.contentItem.update({ where: { id }, data: clean as never });
    await this.logEvent(id, 'updated', user.id, { keys: Object.keys(clean) });
    return updated;
  }

  /** D-27: policy pages are Manager-gated; content staff may draft only. */
  private assertPolicyPermission(user: AuthedUser, item: { systemKey: string | null }, action: 'edit' | 'publish') {
    const isPolicy = item.systemKey ? SYSTEM_PAGES.find((p) => p.systemKey === item.systemKey)?.policy : false;
    if (isPolicy && action === 'publish' && !user.capabilities.has('content.publish_policy')) {
      throw new ForbiddenException('Policy pages can only be published by a Manager or the Owner (D-27)');
    }
  }

  async publish(user: AuthedUser, id: string) {
    const item = await this.detail(id);
    this.assertPolicyPermission(user, item, 'publish');
    this.validateItem(item.type, item.sectionKey, item.fields as Record<string, unknown>, true);

    const now = new Date();
    const scheduled = item.startsAt && item.startsAt > now;
    const updated = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.contentItem.update({
        where: { id },
        data: { status: scheduled ? 'scheduled' : 'published' },
      });
      // Versioning (FR: content_versions).
      await tx.contentVersion.create({
        data: { contentItemId: id, snapshot: { title: item.title, fields: item.fields, seo: item.seo } as never, editorId: user.id },
      });
      return updated;
    });
    await this.logEvent(id, scheduled ? 'scheduled' : 'published', user.id);
    return updated;
  }

  async unpublish(user: AuthedUser, id: string) {
    const updated = await this.prisma.contentItem.update({ where: { id }, data: { status: 'draft' } });
    await this.logEvent(id, 'unpublished', user.id);
    return updated;
  }

  async archive(user: AuthedUser, id: string) {
    const item = await this.detail(id);
    if (item.systemKey) throw new BadRequestException('System pages cannot be deleted (Validation 7)');
    if (!user.capabilities.has('content.delete_any')) {
      if (!(user.capabilities.has('content.delete_own_drafts') && item.createdBy === user.id && item.status === 'draft')) {
        throw new ForbiddenException('You may only delete your own drafts');
      }
    }
    const updated = await this.prisma.contentItem.update({ where: { id }, data: { status: 'archived' } });
    await this.prisma.compositionSection.deleteMany({ where: { contentItemId: id } });
    await this.logEvent(id, 'archived', user.id);
    return updated;
  }

  // ── Composition (homepage) ─────────────────────────────────────────────────

  async getComposition(surface: string) {
    let composition = await this.prisma.composition.findUnique({
      where: { surface },
      include: { sections: { include: { contentItem: true }, orderBy: { sortOrder: 'asc' } } },
    });
    if (!composition) {
      composition = await this.prisma.composition.create({
        data: { surface },
        include: { sections: { include: { contentItem: true }, orderBy: { sortOrder: 'asc' } } },
      });
    }
    return composition;
  }

  async setComposition(user: AuthedUser, surface: string, contentItemIds: string[]) {
    const composition = await this.getComposition(surface);
    await this.prisma.$transaction(async (tx) => {
      await tx.compositionSection.deleteMany({ where: { compositionId: composition.id } });
      for (const [i, contentItemId] of contentItemIds.entries()) {
        await tx.compositionSection.create({
          data: { compositionId: composition.id, contentItemId, sortOrder: i },
        });
      }
      await tx.composition.update({ where: { id: composition.id }, data: { updatedBy: user.id } });
    });
    await this.logEvent(null, 'composition_updated', user.id, { surface, count: contentItemIds.length });
    return this.getComposition(surface);
  }

  // ── Redirects ──────────────────────────────────────────────────────────────

  async addRedirect(fromSlug: string, toSlug: string) {
    const from = slugify(fromSlug);
    if (from === slugify(toSlug)) throw new BadRequestException('A redirect cannot point to itself');
    return this.prisma.redirect.upsert({
      where: { fromSlug: from },
      create: { fromSlug: from, toSlug },
      update: { toSlug },
    });
  }

  // ── Scheduler (FR-PUB-01, NFR-02: ≤1 min accuracy) ────────────────────────

  @Cron('* * * * *')
  async runScheduler() {
    const now = new Date();
    const toPublish = await this.prisma.contentItem.findMany({
      where: { status: 'scheduled', startsAt: { lte: now } },
    });
    for (const item of toPublish) {
      await this.prisma.contentItem.update({ where: { id: item.id }, data: { status: 'published' } });
      await this.logEvent(item.id, 'auto_published');
    }
    const toExpire = await this.prisma.contentItem.findMany({
      where: { status: 'published', endsAt: { lte: now } },
    });
    for (const item of toExpire) {
      await this.prisma.contentItem.update({ where: { id: item.id }, data: { status: 'draft' } });
      await this.logEvent(item.id, 'auto_expired');
    }

    // Promotion-bound content follows the promotion state (Scenario 2).
    const bound = await this.prisma.contentItem.findMany({
      where: { status: 'published', promotionId: { not: null } },
    });
    for (const item of bound) {
      const promo = await this.prisma.promotion.findUnique({ where: { id: item.promotionId! } });
      if (promo && ['paused', 'ended', 'archived'].includes(promo.status)) {
        await this.prisma.contentItem.update({ where: { id: item.id }, data: { status: 'draft' } });
        await this.prisma.needsAttention.create({
          data: { contentItemId: item.id, kind: 'promo_ended', detail: { promotionId: promo.id, promoStatus: promo.status } as never },
        });
        await this.logEvent(item.id, 'auto_hidden_promo');
      }
    }
  }

  /** Broken-ref sweep → needs_attention (FR-PUB-03/04). */
  @Cron('*/15 * * * *')
  async sweepBrokenRefs() {
    const collections = await this.prisma.contentItem.findMany({ where: { type: 'collection', status: 'published' } });
    for (const c of collections) {
      const fields = c.fields as { productIds?: string[] };
      if (fields.productIds?.length) {
        const active = await this.prisma.product.count({ where: { id: { in: fields.productIds }, status: 'active' } });
        if (active === 0) {
          const existing = await this.prisma.needsAttention.findFirst({
            where: { contentItemId: c.id, kind: 'empty_collection', status: 'active' },
          });
          if (!existing) {
            await this.prisma.needsAttention.create({
              data: { contentItemId: c.id, kind: 'empty_collection', detail: {} as never },
            });
          }
        }
      }
    }
  }

  /** Seed system pages on boot (idempotent). */
  async seedSystemPages() {
    for (const page of SYSTEM_PAGES) {
      const existing = await this.prisma.contentItem.findUnique({ where: { systemKey: page.systemKey } });
      if (!existing) {
        await this.prisma.contentItem.create({
          data: {
            type: 'page',
            title: page.title,
            systemKey: page.systemKey,
            slug: page.systemKey,
            fields: { body: '' } as never,
            status: 'draft',
            createdBy: 'system',
          },
        });
      }
    }
  }
}
