import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { normalizePhone, tryNormalizePhone } from './phone';

@Injectable()
export class CustomersService {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
  ) {}

  async logAccess(userId: string, action: string, customerId?: string, detail?: Record<string, unknown>) {
    await this.prisma.customerAccessLog.create({
      data: { userId, action, customerId, detail: detail as never },
    });
  }

  // ── find_or_create (FR-CUS-03) — checkout-path contract ───────────────────

  async findOrCreate(data: { phone: string; email?: string | null; name?: string; source?: string }) {
    const phone = normalizePhone(data.phone);
    const email = data.email?.toLowerCase().trim() || null;

    // Match by phone (primary or alias), then email.
    let customer = await this.prisma.customer.findUnique({ where: { primaryPhone: phone } });
    if (!customer) {
      const alias = await this.prisma.customerAlias.findFirst({ where: { kind: { in: ['phone', 'merged_record'] }, value: phone } });
      if (alias) customer = await this.prisma.customer.findUnique({ where: { id: alias.customerId } });
    }
    if (!customer && email) {
      customer = await this.prisma.customer.findUnique({ where: { email } });
      // FR-CUS-04: new phone on an email-matched customer → candidate alias, not overwrite.
      if (customer && customer.primaryPhone !== phone) {
        await this.prisma.customerAlias.create({
          data: { customerId: customer.id, kind: 'phone', value: phone, source: 'order_intake' },
        }).catch(() => undefined);
      }
    }
    if (customer) {
      if (customer.anonymizedAt) throw new BadRequestException('This customer record was anonymized');
      return { customerId: customer.id, created: false };
    }

    try {
      const created = await this.prisma.customer.create({
        data: {
          fullName: data.name?.trim() || 'Customer',
          primaryPhone: phone,
          email,
          type: 'guest',
          createdSource: data.source ?? 'order',
        },
      });
      return { customerId: created.id, created: true };
    } catch (e) {
      // NFR-03: race-safe under concurrent intake — retry the phone match.
      if ((e as Prisma.PrismaClientKnownRequestError).code === 'P2002') {
        const existing = await this.prisma.customer.findUnique({ where: { primaryPhone: phone } });
        if (existing) return { customerId: existing.id, created: false };
      }
      throw e;
    }
  }

  // ── risk_check (FR-CUS-06) ─────────────────────────────────────────────────

  async riskCheck(idOrPhone: { customerId?: string; phone?: string }) {
    let customer = null;
    if (idOrPhone.customerId) {
      customer = await this.prisma.customer.findUnique({ where: { id: idOrPhone.customerId } });
    } else if (idOrPhone.phone) {
      const phone = tryNormalizePhone(idOrPhone.phone);
      if (phone) customer = await this.prisma.customer.findUnique({ where: { primaryPhone: phone } });
    }
    if (!customer) return { status: 'ok' as const, reason: null };
    if (customer.status === 'blocked') return { status: 'blocked' as const, reason: customer.statusReason };
    if (customer.status === 'pod_blocked') return { status: 'pod_blocked' as const, reason: customer.statusReason };
    return { status: 'ok' as const, reason: null, watch: customer.status === 'watch' };
  }

  /** D-16: called by Orders on customer-caused POD failure. */
  async recordPodFailure(customerId: string) {
    const threshold = await this.settings.get<number>('customers.pod_autoblock_failures');
    const customer = await this.prisma.customer.update({
      where: { id: customerId },
      data: { failedPodCount: { increment: 1 } },
    });
    if (customer.failedPodCount >= threshold && customer.status === 'active') {
      await this.prisma.customer.update({
        where: { id: customerId },
        data: { status: 'pod_blocked', statusReason: `Auto-blocked after ${customer.failedPodCount} failed POD deliveries (D-16)` },
      });
    }
  }

  // ── Metrics cache (FR-PRF-01) ──────────────────────────────────────────────

  async recomputeMetrics(customerId: string) {
    const orders = await this.prisma.order.findMany({
      where: { customerId, status: { notIn: ['DRAFT', 'CANCELLED'] } },
      select: { grandTotal: true, channel: true, confirmedAt: true, createdAt: true, status: true },
    });
    const confirmed = orders.filter((o) => o.confirmedAt != null);
    const spend = confirmed.reduce((s, o) => s + o.grandTotal, 0);
    const refunds = await this.prisma.refund.count({
      where: { order: { customerId }, status: 'processed' },
    });
    const dates = confirmed.map((o) => o.confirmedAt!.getTime());
    const metrics = {
      orders: confirmed.length,
      spend,
      aov: confirmed.length ? Math.round(spend / confirmed.length) : 0,
      firstOrderAt: dates.length ? new Date(Math.min(...dates)) : null,
      lastOrderAt: dates.length ? new Date(Math.max(...dates)) : null,
      refunds,
      channels: Array.from(new Set(orders.map((o) => o.channel))),
    };
    await this.prisma.customer.update({ where: { id: customerId }, data: { metrics: metrics as never } });
    return metrics;
  }

  // ── Search (FR-DUP-01) ─────────────────────────────────────────────────────

  async search(params: { q?: string; status?: string; tag?: string; page?: number }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = 25;
    const phone = params.q ? tryNormalizePhone(params.q) : null;

    const where: Prisma.CustomerWhereInput = {
      anonymizedAt: null,
      ...(params.status ? { status: params.status as never } : {}),
      ...(params.tag ? { tags: { some: { tag: params.tag } } } : {}),
      ...(params.q
        ? phone
          ? { OR: [{ primaryPhone: phone }, { altPhone: phone }, { aliases: { some: { value: phone } } }] }
          : {
              OR: [
                { fullName: { contains: params.q, mode: 'insensitive' } },
                { email: { contains: params.q.toLowerCase() } },
                // partial phone digits — an all-letters query strips to '' and `contains: ''` would match everyone
                ...(params.q.replace(/\D/g, '').length >= 3
                  ? [{ primaryPhone: { contains: params.q.replace(/\D/g, '') } }]
                  : []),
              ],
            }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          tags: true,
          addresses: { where: { status: 'active' }, orderBy: { isDefault: 'desc' }, take: 1 },
        },
      }),
    ]);
    return { total, page, pageSize, rows };
  }

  async profile(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        addresses: { orderBy: { isDefault: 'desc' } },
        tags: true,
        notesList: { orderBy: { createdAt: 'desc' }, take: 50 },
        consents: { orderBy: { createdAt: 'desc' } },
        aliases: true,
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: { id: true, orderNumber: true, status: true, paymentStatus: true, grandTotal: true, channel: true, createdAt: true },
        },
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    // Current consent status per type = latest record.
    const consentNow: Record<string, string> = {};
    for (const c of [...customer.consents].reverse()) consentNow[c.type] = c.status;
    return { ...customer, consentNow };
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  async create(data: { fullName: string; phone: string; altPhone?: string; email?: string | null; gender?: string; preferredChannel?: string; tags?: string[] }) {
    const phone = normalizePhone(data.phone);
    const existing = await this.prisma.customer.findUnique({ where: { primaryPhone: phone } });
    if (existing) throw new BadRequestException({ message: 'A customer with this phone already exists', customerId: existing.id });

    return this.prisma.customer.create({
      data: {
        fullName: data.fullName,
        primaryPhone: phone,
        altPhone: data.altPhone ? normalizePhone(data.altPhone) : null,
        email: data.email?.toLowerCase().trim() || null,
        gender: data.gender,
        preferredChannel: data.preferredChannel,
        type: 'guest',
        createdSource: 'manual',
        tags: data.tags?.length ? { create: data.tags.map((tag) => ({ tag })) } : undefined,
      },
    });
  }

  async update(id: string, data: Record<string, unknown>) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException('Customer not found');
    if (customer.anonymizedAt) throw new BadRequestException('Anonymized records cannot be edited (Validation 4)');

    const clean: Record<string, unknown> = {};
    for (const k of ['fullName', 'email', 'gender', 'birthMonth', 'birthDay', 'birthYear', 'preferredChannel']) {
      if (data[k] !== undefined) clean[k] = data[k];
    }
    if (data.phone) clean.primaryPhone = normalizePhone(data.phone as string);
    if (data.altPhone !== undefined) clean.altPhone = data.altPhone ? normalizePhone(data.altPhone as string) : null;
    if (typeof clean.email === 'string') clean.email = (clean.email as string).toLowerCase().trim() || null;

    return this.prisma.customer.update({ where: { id }, data: clean as never });
  }

  /** Validation 3: blocked/pod_blocked need reason; Manager+ enforced at controller. */
  async setStatus(id: string, status: 'active' | 'watch' | 'pod_blocked' | 'blocked', reason?: string) {
    if (['blocked', 'pod_blocked', 'watch'].includes(status) && !reason) {
      throw new BadRequestException('A reason is required for this status');
    }
    return this.prisma.customer.update({
      where: { id },
      data: { status, statusReason: status === 'active' ? null : reason, ...(status === 'active' ? { failedPodCount: 0 } : {}) },
    });
  }

  // ── Merge (FR-DUP-03) ──────────────────────────────────────────────────────

  async merge(userId: string, survivorId: string, mergedId: string) {
    if (survivorId === mergedId) throw new BadRequestException('Choose two different records');
    const [survivor, merged] = await Promise.all([
      this.prisma.customer.findUnique({ where: { id: survivorId }, include: { tags: true } }),
      this.prisma.customer.findUnique({ where: { id: mergedId }, include: { tags: true, addresses: true } }),
    ]);
    if (!survivor || !merged) throw new NotFoundException('Customer not found');
    if (survivor.anonymizedAt || merged.anonymizedAt) throw new BadRequestException('Anonymized records cannot be merged');

    await this.prisma.$transaction(async (tx) => {
      await tx.order.updateMany({ where: { customerId: mergedId }, data: { customerId: survivorId } });
      await tx.customerAddress.updateMany({ where: { customerId: mergedId }, data: { customerId: survivorId, isDefault: false } });
      await tx.customerNote.updateMany({ where: { customerId: mergedId }, data: { customerId: survivorId } });
      await tx.consent.updateMany({ where: { customerId: mergedId }, data: { customerId: survivorId } });
      await tx.customerAlias.updateMany({ where: { customerId: mergedId }, data: { customerId: survivorId } });

      const survivorTags = new Set(survivor.tags.map((t) => t.tag));
      for (const t of merged.tags) {
        if (!survivorTags.has(t.tag)) await tx.customerTag.create({ data: { customerId: survivorId, tag: t.tag } });
      }
      await tx.customerTag.deleteMany({ where: { customerId: mergedId } });

      // Merged identifiers become alias pointers (FR-DUP-04).
      await tx.customerAlias.create({ data: { customerId: survivorId, kind: 'merged_record', value: merged.primaryPhone, source: mergedId } });
      if (merged.email) {
        await tx.customerAlias.create({ data: { customerId: survivorId, kind: 'email', value: merged.email, source: mergedId } });
      }

      await tx.mergeEvent.create({
        data: { survivorId, mergedId, userId, snapshot: { merged: { ...merged, tags: undefined, addresses: undefined } } as never },
      });
      // Free the unique phone/email, keep the row as tombstone.
      await tx.customer.update({
        where: { id: mergedId },
        data: {
          status: 'blocked',
          statusReason: `Merged into ${survivorId}`,
          primaryPhone: `merged:${mergedId}`,
          email: null,
          anonymizedAt: new Date(),
        },
      });
    });

    await this.recomputeMetrics(survivorId);
    await this.logAccess(userId, 'merge', survivorId, { mergedId });
    return this.profile(survivorId);
  }

  /** FR-DUP-02: duplicate candidates (same email, or same name+zone heuristic). */
  async duplicateCandidates() {
    const emailDups = await this.prisma.$queryRaw<{ email: string; ids: string[] }[]>`
      SELECT email, ARRAY_AGG(id) AS ids FROM customers
      WHERE email IS NOT NULL AND anonymized_at IS NULL
      GROUP BY email HAVING COUNT(*) > 1 LIMIT 50`;
    const nameDups = await this.prisma.$queryRaw<{ name: string; ids: string[] }[]>`
      SELECT LOWER(full_name) AS name, ARRAY_AGG(id) AS ids FROM customers
      WHERE anonymized_at IS NULL
      GROUP BY LOWER(full_name) HAVING COUNT(*) > 1 LIMIT 50`;
    const ids = new Set([...emailDups.flatMap((d) => d.ids), ...nameDups.flatMap((d) => d.ids)]);
    const customers = await this.prisma.customer.findMany({
      where: { id: { in: Array.from(ids) } },
      select: { id: true, fullName: true, primaryPhone: true, email: true, metrics: true, createdAt: true },
    });
    const byId = new Map(customers.map((c) => [c.id, c]));
    return [
      ...emailDups.map((d) => ({ reason: 'same_email', customers: d.ids.map((i) => byId.get(i)).filter(Boolean) })),
      ...nameDups.map((d) => ({ reason: 'same_name', customers: d.ids.map((i) => byId.get(i)).filter(Boolean) })),
    ];
  }

  // ── NDPA (FR-PRV-02/03, D-17) ──────────────────────────────────────────────

  async subjectAccessExport(userId: string, customerId: string) {
    const profile = await this.profile(customerId);
    await this.logAccess(userId, 'subject_export', customerId);
    // D-14: staff notes excluded by default from subject-access exports.
    return {
      generatedAt: new Date(),
      personalData: {
        fullName: profile.fullName,
        phone: profile.primaryPhone,
        altPhone: profile.altPhone,
        email: profile.email,
        gender: profile.gender,
        birthday: profile.birthMonth ? `${profile.birthMonth}/${profile.birthDay ?? '?'}` : null,
      },
      addresses: profile.addresses.map((a) => ({ label: a.label, address: a.addressLine, area: a.area, city: a.city })),
      consentHistory: profile.consents,
      orderSummaries: profile.orders.map((o) => ({
        orderNumber: o.orderNumber,
        date: o.createdAt,
        status: o.status,
        total: o.grandTotal,
      })),
    };
  }

  async requestAnonymization(userId: string, customerId: string) {
    const graceDays = await this.settings.get<number>('customers.anonymization_grace_days');
    const pending = await this.prisma.anonymizationRequest.findFirst({
      where: { customerId, executedAt: null, cancelledAt: null },
    });
    if (pending) throw new BadRequestException('An anonymization request is already pending');
    const request = await this.prisma.anonymizationRequest.create({
      data: {
        customerId,
        requestedBy: userId,
        executeAfter: new Date(Date.now() + graceDays * 86_400_000),
      },
    });
    await this.logAccess(userId, 'anonymize_requested', customerId);
    return request;
  }

  async cancelAnonymization(userId: string, requestId: string) {
    return this.prisma.anonymizationRequest.update({
      where: { id: requestId },
      data: { cancelledAt: new Date(), cancelledBy: userId },
    });
  }

  /** Daily job: execute matured anonymization requests. */
  @Cron('0 2 * * *')
  async executeAnonymizations() {
    const due = await this.prisma.anonymizationRequest.findMany({
      where: { executedAt: null, cancelledAt: null, executeAfter: { lte: new Date() } },
    });
    for (const request of due) {
      await this.prisma.$transaction(async (tx) => {
        const c = await tx.customer.findUnique({ where: { id: request.customerId } });
        if (!c || c.anonymizedAt) return;
        await tx.customer.update({
          where: { id: c.id },
          data: {
            fullName: 'Anonymized customer',
            primaryPhone: `anon:${c.id}`,
            altPhone: null,
            email: null,
            gender: null,
            birthMonth: null,
            birthDay: null,
            birthYear: null,
            anonymizedAt: new Date(),
            status: 'blocked',
            statusReason: 'NDPA anonymization',
          },
        });
        await tx.customerAddress.updateMany({ where: { customerId: c.id }, data: { addressLine: '[removed]', area: null, city: null, status: 'archived' } });
        await tx.customerNote.deleteMany({ where: { customerId: c.id } });
        await tx.customerAlias.deleteMany({ where: { customerId: c.id } });
        await tx.anonymizationRequest.update({ where: { id: request.id }, data: { executedAt: new Date() } });
      });
    }
    return due.length;
  }

  /** Nightly metric reconciliation (Validation 5). */
  @Cron('30 2 * * *')
  async reconcileMetrics() {
    const stale = await this.prisma.customer.findMany({
      where: { anonymizedAt: null, orders: { some: {} } },
      select: { id: true },
      take: 500,
    });
    for (const c of stale) await this.recomputeMetrics(c.id);
  }
}
