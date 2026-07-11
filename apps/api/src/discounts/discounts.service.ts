import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma, Promotion } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { AuthedUser } from '../auth/auth.types';
import {
  AppliedPromotion,
  CartLineInput,
  EvaluateInput,
  EvaluateResult,
} from './discounts.types';

interface PromoConditions {
  schedule?: { startsAt?: string; endsAt?: string };
  minSpend?: number;
  minQty?: number;
  firstOrderOnly?: boolean;
  tags?: string[];
  channels?: string[];
  zones?: string[];
  paymentMethods?: string[];
}

interface PromoLimits {
  totalUses?: number;
  perCustomerUses?: number;
}

interface PromoCombination {
  withProduct?: boolean;
  withOrder?: boolean;
  withShipping?: boolean;
  exclusive?: boolean;
}

@Injectable()
export class DiscountsService {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
  ) {}

  // In-memory code-attempt rate limiter (FR-COD-04).
  private codeAttempts = new Map<string, { count: number; windowStart: number }>();

  private async logEvent(promotionId: string, type: string, payload?: unknown, actorId?: string | null) {
    await this.prisma.promotionEvent.create({
      data: { promotionId, type, payload: payload as never, actorId: actorId ?? null },
    });
  }

  // ── Lifecycle (FR-ADM-02/03) ───────────────────────────────────────────────

  async transition(userId: string, user: AuthedUser, promotionId: string, action: 'schedule' | 'activate' | 'pause' | 'resume' | 'end' | 'archive') {
    const promo = await this.prisma.promotion.findUnique({ where: { id: promotionId } });
    if (!promo) throw new NotFoundException('Promotion not found');

    const allowed: Record<string, string[]> = {
      schedule: ['draft'],
      activate: ['draft', 'scheduled', 'paused'],
      pause: ['active'],
      resume: ['paused'],
      end: ['active', 'paused', 'scheduled'],
      archive: ['ended', 'draft'],
    };
    if (!allowed[action].includes(promo.status)) {
      throw new BadRequestException(`Cannot ${action} a ${promo.status} promotion`);
    }

    // D-24: Marketing may activate only its own promos within the % ceiling and never below-cost.
    if (['activate', 'schedule', 'resume'].includes(action) && !user.capabilities.has('discounts.activate')) {
      if (!user.capabilities.has('discounts.activate_own')) throw new ForbiddenException('Missing permission');
      if (promo.createdBy !== userId) throw new ForbiddenException('You may only activate your own promotions');
      const ceiling = await this.settings.get<number>('discounts.marketing_self_approve_percent');
      if (promo.valueType === 'percent' && Number(promo.valueAmount) > ceiling) {
        throw new ForbiddenException(`Promotions above ${ceiling}% need Manager/Owner activation (D-24)`);
      }
      if (promo.allowBelowCost) throw new ForbiddenException('Below-cost promotions need Manager/Owner activation');
    }

    const statusMap: Record<string, string> = {
      schedule: 'scheduled',
      activate: 'active',
      pause: 'paused',
      resume: 'active',
      end: 'ended',
      archive: 'archived',
    };
    if (action === 'schedule') {
      const conditions = promo.conditions as PromoConditions;
      const startsAt = conditions.schedule?.startsAt;
      if (!startsAt || new Date(startsAt) <= new Date()) {
        throw new BadRequestException('Scheduled promotions must start in the future (Validation 2)');
      }
    }

    const updated = await this.prisma.promotion.update({
      where: { id: promotionId },
      data: { status: statusMap[action] as never },
    });
    await this.logEvent(promotionId, action, { from: promo.status, to: updated.status }, userId);
    return updated;
  }

  /** FR-FLS-01: minute-accuracy scheduler. */
  @Cron('* * * * *')
  async runScheduler() {
    const now = new Date();
    const scheduled = await this.prisma.promotion.findMany({ where: { status: 'scheduled' } });
    for (const p of scheduled) {
      const startsAt = (p.conditions as PromoConditions).schedule?.startsAt;
      if (startsAt && new Date(startsAt) <= now) {
        await this.prisma.promotion.update({ where: { id: p.id }, data: { status: 'active' } });
        await this.logEvent(p.id, 'auto_activated', { at: now });
      }
    }
    const active = await this.prisma.promotion.findMany({ where: { status: 'active' } });
    for (const p of active) {
      const endsAt = (p.conditions as PromoConditions).schedule?.endsAt;
      if (endsAt && new Date(endsAt) <= now) {
        await this.prisma.promotion.update({ where: { id: p.id }, data: { status: 'ended' } });
        await this.logEvent(p.id, 'auto_ended', { at: now });
      }
    }
  }

  // ── Code validation (FR-COD-03/04) ─────────────────────────────────────────

  async rateLimitCode(key: string) {
    const limit = await this.settings.get<number>('discounts.code_rate_limit_per_min');
    const now = Date.now();
    const entry = this.codeAttempts.get(key);
    if (!entry || now - entry.windowStart > 60_000) {
      this.codeAttempts.set(key, { count: 1, windowStart: now });
      return;
    }
    entry.count += 1;
    if (entry.count > limit) {
      throw new BadRequestException('Too many code attempts — wait a minute and try again');
    }
  }

  private async findCode(codeString: string) {
    const folded = codeString.trim().toUpperCase();
    return this.prisma.promoCode.findUnique({
      where: { code: folded },
      include: { promotion: { include: { scopeItems: true } } },
    });
  }

  // ── Evaluation engine (FR-ENG) — stateless, deterministic ─────────────────

  private promoWindowOk(promo: Promotion, graceEnteredAt: Date | null | undefined, graceMinutes: number): boolean {
    const schedule = (promo.conditions as PromoConditions).schedule;
    const now = new Date();
    if (schedule?.startsAt && new Date(schedule.startsAt) > now) return false;
    if (schedule?.endsAt) {
      const end = new Date(schedule.endsAt);
      if (end <= now) {
        // D-22: grace window for carts that entered checkout before expiry.
        const inGrace =
          graceEnteredAt &&
          graceEnteredAt < end &&
          now.getTime() - end.getTime() <= graceMinutes * 60_000;
        if (!inGrace) return false;
      }
    }
    return true;
  }

  private conditionsOk(promo: Promotion, input: EvaluateInput, subtotal: number, totalQty: number, excludeWholesale: boolean): string | null {
    const c = promo.conditions as PromoConditions;
    if (c.minSpend && subtotal < c.minSpend) return `min_spend:${c.minSpend - subtotal}`;
    if (c.minQty && totalQty < c.minQty) return 'min_qty';
    if (c.firstOrderOnly && !input.customer.firstOrder) return 'not_first_order';
    if (c.channels?.length && !c.channels.includes(input.channel)) return 'channel';
    if (c.zones?.length && (!input.zoneId || !c.zones.includes(input.zoneId))) return 'zone';
    if (c.paymentMethods?.length && (!input.paymentMethod || !c.paymentMethods.includes(input.paymentMethod))) return 'payment_method';
    if (c.tags?.length && !c.tags.some((t) => input.customer.tags.includes(t))) return 'tags';
    // D-25: wholesale excluded unless the promotion explicitly targets the tag.
    if (excludeWholesale && input.customer.tags.includes('wholesale') && !c.tags?.includes('wholesale')) {
      return 'wholesale_excluded';
    }
    return null;
  }

  private lineInScope(promo: Promotion & { scopeItems: { kind: string; refId: string }[] }, line: CartLineInput): boolean {
    if (line.isBundle && !line.bundleEligibleForPromotions) return false; // A1 D-58
    if (promo.scope === 'order' || promo.scope === 'shipping') return true;
    const items = promo.scopeItems;
    const excluded = items.some(
      (i) =>
        (i.kind === 'product_excl' && i.refId === line.productId) ||
        (i.kind === 'category_excl' && line.categoryPath.includes(i.refId)),
    );
    if (excluded) return false;
    return items.some(
      (i) =>
        (i.kind === 'variant' && i.refId === line.variantId) ||
        (i.kind === 'product' && i.refId === line.productId) ||
        (i.kind === 'category' && line.categoryPath.includes(i.refId)),
    );
  }

  async evaluate(input: EvaluateInput): Promise<EvaluateResult> {
    const graceMinutes = await this.settings.get<number>('discounts.grace_window_minutes');
    const excludeWholesale = await this.settings.get<boolean>('discounts.exclude_wholesale');
    const freeShippingLagosOnly = await this.settings.get<boolean>('discounts.free_shipping_lagos_only');

    const subtotal = input.lines.reduce((s, l) => s + Math.round(l.unitPrice * l.quantity), 0);
    const totalQty = input.lines.reduce((s, l) => s + l.quantity, 0);

    const result: EvaluateResult = {
      lines: input.lines.map((l) => ({
        variantId: l.variantId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discount: 0,
        lineTotal: Math.round(l.unitPrice * l.quantity),
      })),
      orderDiscount: 0,
      shippingDiscount: 0,
      subtotal,
      discountTotal: 0,
      appliedPromotions: [],
      rejected: [],
    };

    // Candidate set: active automatics + the entered code's promotion.
    const automatics = await this.prisma.promotion.findMany({
      where: { status: 'active', mechanism: 'automatic' },
      include: { scopeItems: true },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });

    let codePromo: (Promotion & { scopeItems: { kind: string; refId: string }[] }) | null = null;
    let codeId: string | null = null;
    if (input.code) {
      const code = await this.findCode(input.code);
      const fail = (reason: string, message: string) => {
        result.codeError = { code: input.code!, reason, message };
      };
      if (!code || code.status !== 'active' || code.promotion.status !== 'active') {
        fail('invalid', 'This code is not valid');
      } else if (code.maxUses != null && code.usesCount >= code.maxUses) {
        fail('fully_used', 'This code has been fully used');
      } else {
        const limits = code.promotion.limits as PromoLimits;
        if (limits.totalUses != null && code.promotion.usesCount >= limits.totalUses) {
          fail('fully_used', 'This code has been fully used');
        } else if (limits.perCustomerUses != null && input.customer.customerId) {
          const used = await this.prisma.customerPromotionUse.findUnique({
            where: { promotionId_customerId: { promotionId: code.promotionId, customerId: input.customer.customerId } },
          });
          if (used && used.usesCount >= limits.perCustomerUses) {
            fail('per_customer_limit', 'You have already used this code');
          }
        }
        if (!result.codeError) {
          if (!this.promoWindowOk(code.promotion, input.graceEnteredAt, graceMinutes)) {
            fail('expired', 'This code has expired');
          } else {
            const condFail = this.conditionsOk(code.promotion, input, subtotal, totalQty, excludeWholesale);
            if (condFail?.startsWith('min_spend:')) {
              const shortfall = Number(condFail.split(':')[1]);
              fail('min_spend', `Add ₦${(shortfall / 100).toLocaleString()} more to use this code`);
            } else if (condFail) {
              fail(condFail, 'This code is not eligible for this order');
            } else {
              codePromo = code.promotion as Promotion & { scopeItems: { kind: string; refId: string }[] };
              codeId = code.id;
            }
          }
        }
      }
    }

    const candidates = [
      ...automatics.filter((p) => {
        if (!this.promoWindowOk(p, input.graceEnteredAt, graceMinutes)) return false;
        const reason = this.conditionsOk(p, input, subtotal, totalQty, excludeWholesale);
        if (reason) {
          result.rejected.push({ promotionId: p.id, reason });
          return false;
        }
        return true;
      }),
      ...(codePromo ? [codePromo] : []),
    ];

    // Step 1 — product/category-scope promos: best per line (FR-ENG-02/03).
    const productPromos = candidates.filter((p) => ['products', 'categories'].includes(p.scope));
    const appliedProduct = new Map<string, AppliedPromotion>();
    for (const [idx, line] of input.lines.entries()) {
      let best: { promo: typeof productPromos[number]; amount: number } | null = null;
      for (const promo of productPromos) {
        if (!this.lineInScope(promo as never, line)) continue;
        const lineTotal = Math.round(line.unitPrice * line.quantity);
        let amount = 0;
        if (promo.valueType === 'percent') amount = Math.round((lineTotal * Number(promo.valueAmount)) / 100);
        else if (promo.valueType === 'fixed') amount = Math.min(Number(promo.valueAmount), lineTotal); // per line (FR-ENG-05)
        if (amount <= 0) continue;
        if (!best || amount > best.amount || (amount === best.amount && promo.priority > best.promo.priority)) {
          best = { promo, amount };
        }
      }
      if (best) {
        // FR-ENG-04 floor protection.
        let amount = best.amount;
        const line = input.lines[idx];
        if (!best.promo.allowBelowCost && line.costPrice != null) {
          const costFloor = Math.round(line.costPrice * line.quantity);
          const lineTotal = Math.round(line.unitPrice * line.quantity);
          if (lineTotal - amount < costFloor) {
            amount = Math.max(0, lineTotal - costFloor);
          }
        }
        if (amount > 0) {
          result.lines[idx].discount = amount;
          result.lines[idx].lineTotal -= amount;
          const key = best.promo.id;
          const existing = appliedProduct.get(key);
          if (existing) existing.amount += amount;
          else {
            appliedProduct.set(key, {
              promotionId: best.promo.id,
              codeId: best.promo.id === codePromo?.id ? codeId : null,
              name: best.promo.name,
              valueType: best.promo.valueType,
              amount,
              scope: best.promo.scope,
            });
          }
        }
      }
    }
    result.appliedPromotions.push(...appliedProduct.values());

    const productApplied = appliedProduct.size > 0;
    const discountedSubtotal = result.lines.reduce((s, l) => s + l.lineTotal, 0);

    // Step 2 — order-scope: best single one whose combination class permits.
    const orderPromos = candidates.filter((p) => p.scope === 'order');
    let bestOrder: { promo: typeof orderPromos[number]; amount: number } | null = null;
    for (const promo of orderPromos) {
      const combination = promo.combination as PromoCombination;
      if (productApplied && combination.exclusive) {
        result.rejected.push({ promotionId: promo.id, reason: 'exclusive_conflict' });
        continue;
      }
      if (productApplied && combination.withProduct === false) {
        result.rejected.push({ promotionId: promo.id, reason: 'no_combine_product' });
        continue;
      }
      let amount = 0;
      if (promo.valueType === 'percent') amount = Math.round((discountedSubtotal * Number(promo.valueAmount)) / 100);
      else if (promo.valueType === 'fixed') amount = Math.min(Number(promo.valueAmount), discountedSubtotal); // Validation 1
      if (amount <= 0) continue;
      if (!bestOrder || amount > bestOrder.amount || (amount === bestOrder.amount && promo.priority > bestOrder.promo.priority)) {
        bestOrder = { promo, amount };
      }
    }
    if (bestOrder) {
      result.orderDiscount = bestOrder.amount;
      result.appliedPromotions.push({
        promotionId: bestOrder.promo.id,
        codeId: bestOrder.promo.id === codePromo?.id ? codeId : null,
        name: bestOrder.promo.name,
        valueType: bestOrder.promo.valueType,
        amount: bestOrder.amount,
        scope: 'order',
      });
    }

    // Step 3 — shipping promos (free shipping).
    const shippingPromos = candidates.filter((p) => p.scope === 'shipping' || p.valueType === 'free_shipping');
    for (const promo of shippingPromos) {
      const combination = promo.combination as PromoCombination;
      if ((productApplied || bestOrder) && combination.exclusive) continue;
      if (freeShippingLagosOnly && input.zoneId) {
        const zone = await this.prisma.zone.findUnique({ where: { id: input.zoneId } });
        if (zone && !/lagos/i.test(zone.name)) {
          result.rejected.push({ promotionId: promo.id, reason: 'free_shipping_lagos_only' });
          continue;
        }
      }
      if (input.shippingFee > 0) {
        result.shippingDiscount = input.shippingFee;
        result.appliedPromotions.push({
          promotionId: promo.id,
          codeId: promo.id === codePromo?.id ? codeId : null,
          name: promo.name,
          valueType: 'free_shipping',
          amount: input.shippingFee,
          scope: 'shipping',
        });
        break; // one shipping promo is enough
      }
    }

    result.discountTotal =
      result.lines.reduce((s, l) => s + l.discount, 0) + result.orderDiscount + result.shippingDiscount;
    return result;
  }

  // ── price_for_display (FR-ENG-06) — bulk, cacheable ≤60s ──────────────────

  private displayCache: { at: number; promos: (Promotion & { scopeItems: { kind: string; refId: string }[] })[] } | null = null;

  /**
   * Best product/category-scope automatic discount per line, for storefront
   * display. Mirrors the engine's step-1 logic (scope, window, floor).
   */
  async priceForDisplay(
    lines: { variantId: string; productId: string; categoryPath: string[]; unitPrice: number; costPrice: number | null; isBundle?: boolean; bundleEligibleForPromotions?: boolean }[],
  ): Promise<Map<string, { salePrice: number; badge: string | null; endsAt: string | null }>> {
    if (!this.displayCache || Date.now() - this.displayCache.at > 60_000) {
      const promos = await this.prisma.promotion.findMany({
        where: { status: 'active', mechanism: 'automatic', scope: { in: ['products', 'categories'] } },
        include: { scopeItems: true },
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      });
      this.displayCache = { at: Date.now(), promos };
    }
    const now = new Date();
    const active = this.displayCache.promos.filter((p) => {
      const schedule = (p.conditions as PromoConditions).schedule;
      if (schedule?.startsAt && new Date(schedule.startsAt) > now) return false;
      if (schedule?.endsAt && new Date(schedule.endsAt) <= now) return false;
      // Conditional promos (min spend etc.) can't be promised on a PDP.
      const c = p.conditions as PromoConditions;
      if (c.minSpend || c.minQty || c.firstOrderOnly || c.tags?.length) return false;
      return true;
    });

    const result = new Map<string, { salePrice: number; badge: string | null; endsAt: string | null }>();
    for (const line of lines) {
      let best: { amount: number; promo: (typeof active)[number] } | null = null;
      for (const promo of active) {
        if (!this.lineInScope(promo as never, { ...line, quantity: 1 } as never)) continue;
        let amount = 0;
        if (promo.valueType === 'percent') amount = Math.round((line.unitPrice * Number(promo.valueAmount)) / 100);
        else if (promo.valueType === 'fixed') amount = Math.min(Number(promo.valueAmount), line.unitPrice);
        if (amount <= 0) continue;
        if (!best || amount > best.amount) best = { amount, promo };
      }
      if (best) {
        let amount = best.amount;
        if (!best.promo.allowBelowCost && line.costPrice != null && line.unitPrice - amount < line.costPrice) {
          amount = Math.max(0, line.unitPrice - line.costPrice);
        }
        if (amount > 0) {
          result.set(line.variantId, {
            salePrice: line.unitPrice - amount,
            badge: best.promo.valueType === 'percent' ? `-${Number(best.promo.valueAmount)}%` : 'SALE',
            endsAt: (best.promo.conditions as PromoConditions).schedule?.endsAt ?? null,
          });
        }
      }
    }
    return result;
  }

  // ── Redemption (FR-RED-02/03) — exact caps under concurrency ──────────────

  async redeem(orderId: string, customerId: string | null, applied: AppliedPromotion[]) {
    for (const promo of applied) {
      await this.prisma.$transaction(async (tx) => {
        const existing = await tx.redemption.findUnique({ where: { orderId } });
        if (existing && existing.promotionId === promo.promotionId) return; // idempotent

        const limits = (await tx.promotion.findUniqueOrThrow({ where: { id: promo.promotionId } })).limits as PromoLimits;

        // Conditional atomic increment: never exceeds caps (NFR-03).
        if (limits.totalUses != null) {
          const updated = await tx.$executeRaw`
            UPDATE promotions SET uses_count = uses_count + 1
            WHERE id = ${promo.promotionId} AND uses_count < ${limits.totalUses}`;
          if (updated === 0) throw new BadRequestException({ code: 'CAP_EXCEEDED', promotionId: promo.promotionId });
        } else {
          await tx.promotion.update({ where: { id: promo.promotionId }, data: { usesCount: { increment: 1 } } });
        }

        if (promo.codeId) {
          const code = await tx.promoCode.findUniqueOrThrow({ where: { id: promo.codeId } });
          if (code.maxUses != null) {
            const updated = await tx.$executeRaw`
              UPDATE promo_codes SET uses_count = uses_count + 1
              WHERE id = ${promo.codeId} AND uses_count < ${code.maxUses}`;
            if (updated === 0) throw new BadRequestException({ code: 'CODE_CAP_EXCEEDED', promotionId: promo.promotionId });
          } else {
            await tx.promoCode.update({ where: { id: promo.codeId }, data: { usesCount: { increment: 1 } } });
          }
        }

        if (customerId) {
          await tx.$executeRaw`
            INSERT INTO customer_promotion_uses (promotion_id, customer_id, uses_count)
            VALUES (${promo.promotionId}, ${customerId}, 1)
            ON CONFLICT (promotion_id, customer_id) DO UPDATE SET uses_count = customer_promotion_uses.uses_count + 1`;
        }

        await tx.redemption.upsert({
          where: { orderId },
          create: {
            promotionId: promo.promotionId,
            codeId: promo.codeId,
            orderId,
            customerId,
            amount: promo.amount,
            status: 'confirmed',
            resolvedAt: new Date(),
          },
          update: { status: 'confirmed', resolvedAt: new Date() },
        });
      });
      await this.logEvent(promo.promotionId, 'redeemed', { orderId, amount: promo.amount });
    }
  }

  /** Idempotent release on cancellation (FR-RED-03). */
  async release(orderId: string) {
    const redemption = await this.prisma.redemption.findUnique({ where: { orderId } });
    if (!redemption || redemption.status === 'released') return;

    await this.prisma.$transaction(async (tx) => {
      await tx.promotion.update({ where: { id: redemption.promotionId }, data: { usesCount: { decrement: 1 } } });
      if (redemption.codeId) {
        await tx.promoCode.update({ where: { id: redemption.codeId }, data: { usesCount: { decrement: 1 } } });
      }
      if (redemption.customerId) {
        await tx.customerPromotionUse.updateMany({
          where: { promotionId: redemption.promotionId, customerId: redemption.customerId },
          data: { usesCount: { decrement: 1 } },
        });
      }
      await tx.redemption.update({ where: { orderId }, data: { status: 'released', resolvedAt: new Date() } });
    });
    await this.logEvent(redemption.promotionId, 'released', { orderId });
  }

  // ── Manual staff discounts (FR-RED-04, D-20) ───────────────────────────────

  async assertManualDiscountAllowed(user: AuthedUser, orderSubtotal: number, valueType: 'percent' | 'fixed', value: number) {
    const amount = valueType === 'percent' ? Math.round((orderSubtotal * value) / 100) : value;
    if (user.capabilities.has('discounts.manual_uncapped')) return amount;
    if (!user.capabilities.has('discounts.manual_capped')) {
      throw new ForbiddenException('You may not apply manual discounts');
    }
    const capPercent = await this.settings.get<number>('discounts.sales_cap_percent');
    const capNaira = await this.settings.get<number>('discounts.sales_cap_naira');
    const percentOf = orderSubtotal > 0 ? (amount / orderSubtotal) * 100 : 0;
    if (percentOf > capPercent + 1e-9) {
      throw new ForbiddenException(`Manual discounts are capped at ${capPercent}% for your role (D-20)`);
    }
    if (amount > capNaira) {
      throw new ForbiddenException(`Manual discounts are capped at ₦${(capNaira / 100).toLocaleString()} for your role (D-20)`);
    }
    return amount;
  }
}
