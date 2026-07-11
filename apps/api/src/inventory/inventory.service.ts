import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MovementType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { NotificationsService } from '../notifications/notifications.service';

export interface LineRequest {
  variantId: string;
  quantity: number; // positive
}

/**
 * Append-only ledger + materialized totals (Inventory SRS §1).
 * All mutations go through postMovement inside a transaction that locks the
 * stock_levels row (FR-RSV-03) — no oversell under concurrency.
 */
@Injectable()
export class InventoryService {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
    private notifications: NotificationsService,
  ) {}

  private defaultLocationId: string | null = null;

  async getDefaultLocationId(): Promise<string> {
    if (this.defaultLocationId) return this.defaultLocationId;
    let location = await this.prisma.location.findFirst({ where: { status: 'active' } });
    if (!location) {
      location = await this.prisma.location.create({ data: { name: 'Main Store', type: 'store' } });
    }
    this.defaultLocationId = location.id;
    return location.id;
  }

  // ── Quantity validation (FR-RSV-08 / FR-LED-05) ───────────────────────────

  async assertQuantityValid(variantId: string, qty: number) {
    if (qty <= 0) throw new BadRequestException('Quantity must be positive');
    const variant = await this.prisma.variant.findUnique({
      where: { id: variantId },
      include: { product: true },
    });
    if (!variant) throw new NotFoundException(`Variant ${variantId} not found`);

    const unit = variant.product.sellUnitId
      ? await this.prisma.unit.findUnique({ where: { id: variant.product.sellUnitId } })
      : null;
    const fractional = unit?.fractionalAllowed ?? false;
    if (!fractional && !Number.isInteger(qty)) {
      throw new BadRequestException(`${variant.sku}: quantity must be a whole number of ${unit?.name ?? 'pieces'}`);
    }
    const increment = Number(variant.product.qtyIncrement ?? 1);
    if (increment > 0) {
      const steps = qty / increment;
      if (Math.abs(steps - Math.round(steps)) > 1e-9) {
        throw new BadRequestException(`${variant.sku}: quantity must be in steps of ${increment}`);
      }
    }
    return variant;
  }

  // ── Core ledger posting ────────────────────────────────────────────────────

  /**
   * Lock the level row, apply deltas, append the movement. Caller supplies the
   * transaction. Throws when the operation would violate availability.
   */
  private async post(
    tx: Prisma.TransactionClient,
    params: {
      variantId: string;
      locationId: string;
      type: MovementType;
      quantity: number; // signed ledger quantity
      onHandDelta: number;
      reservedDelta: number;
      unitCost?: number | null;
      reasonCode?: string;
      note?: string;
      referenceType?: string;
      referenceId?: string;
      userId?: string | null;
      enforceAvailability?: boolean; // reserve path
    },
  ) {
    // Ensure the level row exists, then lock it.
    await tx.$executeRaw`
      INSERT INTO stock_levels (variant_id, location_id, on_hand, reserved, updated_at)
      VALUES (${params.variantId}, ${params.locationId}, 0, 0, NOW())
      ON CONFLICT (variant_id, location_id) DO NOTHING`;
    const rows = await tx.$queryRaw<{ on_hand: string; reserved: string; allow_backorder: boolean; backorder_cap: string | null }[]>`
      SELECT on_hand, reserved, allow_backorder, backorder_cap
      FROM stock_levels WHERE variant_id = ${params.variantId} AND location_id = ${params.locationId}
      FOR UPDATE`;
    const level = rows[0];
    const onHand = Number(level.on_hand);
    const reserved = Number(level.reserved);

    const newOnHand = onHand + params.onHandDelta;
    const newReserved = reserved + params.reservedDelta;

    if (params.enforceAvailability) {
      const newAvailable = newOnHand - newReserved;
      const cap = level.allow_backorder ? -Number(level.backorder_cap ?? 0) : 0;
      if (newAvailable < cap) {
        throw new BadRequestException({
          message: 'Insufficient stock',
          code: 'INSUFFICIENT_STOCK',
          variantId: params.variantId,
          available: onHand - reserved,
        });
      }
    }
    if (newReserved < -1e-9) throw new BadRequestException('Reserved cannot go negative');
    if (newOnHand < -1e-9 && !level.allow_backorder) {
      throw new BadRequestException({ message: 'On-hand cannot go negative', variantId: params.variantId });
    }

    await tx.$executeRaw`
      UPDATE stock_levels SET on_hand = ${newOnHand}, reserved = ${newReserved}, updated_at = NOW()
      WHERE variant_id = ${params.variantId} AND location_id = ${params.locationId}`;

    await tx.stockMovement.create({
      data: {
        variantId: params.variantId,
        locationId: params.locationId,
        type: params.type,
        quantity: params.quantity,
        unitCost: params.unitCost ?? null,
        reasonCode: params.reasonCode,
        note: params.note,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        userId: params.userId ?? null,
      },
    });

    return { onHand: newOnHand, reserved: newReserved, available: newOnHand - newReserved };
  }

  /** FR-ALT-02/03: recompute alert state after a change. */
  private async refreshAlerts(variantId: string, locationId: string) {
    const level = await this.prisma.stockLevel.findUnique({
      where: { variantId_locationId: { variantId, locationId } },
    });
    if (!level) return;
    const available = Number(level.onHand) - Number(level.reserved);
    const threshold = level.lowStockThreshold != null
      ? Number(level.lowStockThreshold)
      : await this.settings.get<number>('inventory.default_low_stock_threshold');

    const out = available <= 0 && !level.allowBackorder;
    const low = !out && available > 0 && available <= threshold;

    // Resolve alerts that no longer apply, raise those that do (idempotent).
    await this.prisma.stockAlert.updateMany({
      where: { variantId, locationId, status: 'active', type: out ? 'low_stock' : low ? 'out_of_stock' : { in: ['low_stock', 'out_of_stock'] } },
      data: { status: 'resolved', resolvedAt: new Date() },
    });
    if (out || low) {
      const type = out ? 'out_of_stock' : 'low_stock';
      const existing = await this.prisma.stockAlert.findFirst({ where: { variantId, locationId, type, status: 'active' } });
      if (!existing) {
        await this.prisma.stockAlert.create({ data: { variantId, locationId, type, detail: { available, threshold } as never } });
      }
    }
  }

  // ── Order-facing contracts (FR-RSV-01/02/06) — idempotent by reference ─────

  async checkAvailability(lines: LineRequest[]) {
    const locationId = await this.getDefaultLocationId();
    const results = [];
    for (const line of lines) {
      const level = await this.prisma.stockLevel.findUnique({
        where: { variantId_locationId: { variantId: line.variantId, locationId } },
      });
      const available = level ? Number(level.onHand) - Number(level.reserved) : 0;
      const backorderable = level?.allowBackorder
        ? available + Number(level.backorderCap ?? 0)
        : available;
      results.push({
        variantId: line.variantId,
        requested: line.quantity,
        available,
        ok: line.quantity <= backorderable,
      });
    }
    return { ok: results.every((r) => r.ok), lines: results };
  }

  /** Atomic all-or-nothing reserve, idempotent per order (FR-RSV-02, NFR-05). */
  async reserve(orderId: string, lines: LineRequest[], userId?: string | null) {
    const locationId = await this.getDefaultLocationId();
    for (const line of lines) await this.assertQuantityValid(line.variantId, line.quantity);

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.stockMovement.findFirst({
        where: { referenceType: 'order', referenceId: orderId, type: 'RESERVE' },
      });
      if (existing) return; // idempotent retry

      for (const line of lines) {
        await this.post(tx, {
          variantId: line.variantId,
          locationId,
          type: 'RESERVE',
          quantity: line.quantity,
          onHandDelta: 0,
          reservedDelta: line.quantity,
          referenceType: 'order',
          referenceId: orderId,
          userId,
          enforceAvailability: true,
        });
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });

    for (const line of lines) await this.refreshAlerts(line.variantId, locationId);
  }

  /** Release remaining reservations for an order (cancel / TTL expiry). */
  async release(orderId: string, reason: string, userId?: string | null) {
    const locationId = await this.getDefaultLocationId();
    await this.prisma.$transaction(async (tx) => {
      const reserves = await tx.stockMovement.groupBy({
        by: ['variantId'],
        where: { referenceType: 'order', referenceId: orderId, type: { in: ['RESERVE', 'RELEASE', 'DEDUCT'] } },
        _sum: { quantity: true },
      });
      // RESERVE rows are +, RELEASE rows are −, DEDUCT rows are − → sum = outstanding reserved.
      for (const r of reserves) {
        const outstanding = Number(r._sum.quantity ?? 0);
        if (outstanding <= 1e-9) continue;
        await this.post(tx, {
          variantId: r.variantId,
          locationId,
          type: 'RELEASE',
          quantity: -outstanding,
          onHandDelta: 0,
          reservedDelta: -outstanding,
          note: reason,
          referenceType: 'order',
          referenceId: orderId,
          userId,
        });
      }
    });
  }

  /** Deduct shipped lines (FR-RSV-06 partial supported), idempotent per shipment. */
  async deductForShipment(orderId: string, shipmentId: string, lines: LineRequest[], userId?: string | null) {
    const locationId = await this.getDefaultLocationId();
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.stockMovement.findFirst({
        where: { referenceType: 'shipment', referenceId: shipmentId, type: 'DEDUCT' },
      });
      if (existing) return;

      for (const line of lines) {
        // Validation 4: DEDUCT cannot exceed the order's outstanding reservation.
        const agg = await tx.stockMovement.aggregate({
          where: { referenceType: 'order', referenceId: orderId, variantId: line.variantId, type: { in: ['RESERVE', 'RELEASE', 'DEDUCT'] } },
          _sum: { quantity: true },
        });
        const outstanding = Number(agg._sum.quantity ?? 0);
        if (line.quantity > outstanding + 1e-9) {
          throw new BadRequestException(`Cannot deduct more than reserved for variant ${line.variantId}`);
        }
        await this.post(tx, {
          variantId: line.variantId,
          locationId,
          type: 'DEDUCT',
          quantity: -line.quantity,
          onHandDelta: -line.quantity,
          reservedDelta: -line.quantity,
          referenceType: 'shipment',
          referenceId: shipmentId,
          note: `order:${orderId}`,
          userId,
        });
      }
    });
    for (const line of lines) await this.refreshAlerts(line.variantId, locationId);
  }

  /** Return restock / damaged write-off (FR-RTN-01), idempotent per return. */
  async restockReturn(
    returnId: string,
    orderId: string,
    lines: { variantId: string; quantity: number; condition: 'restockable' | 'damaged' }[],
    userId?: string | null,
  ) {
    const locationId = await this.getDefaultLocationId();
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.stockMovement.findFirst({
        where: { referenceType: 'return', referenceId: returnId },
      });
      if (existing) return;

      for (const line of lines) {
        if (line.condition === 'restockable') {
          await this.post(tx, {
            variantId: line.variantId,
            locationId,
            type: 'RETURN_RESTOCK',
            quantity: line.quantity,
            onHandDelta: line.quantity,
            reservedDelta: 0,
            referenceType: 'return',
            referenceId: returnId,
            note: `order:${orderId}`,
            userId,
          });
        } else {
          const variant = await tx.variant.findUnique({ where: { id: line.variantId } });
          await this.post(tx, {
            variantId: line.variantId,
            locationId,
            type: 'WRITE_OFF',
            quantity: -line.quantity,
            onHandDelta: 0, // damaged returns never re-entered on-hand
            reservedDelta: 0,
            unitCost: variant?.costPrice ?? null,
            reasonCode: 'damaged_return',
            referenceType: 'return',
            referenceId: returnId,
            note: `order:${orderId}`,
            userId,
          });
        }
      }
    });
    for (const line of lines) await this.refreshAlerts(line.variantId, locationId);
  }

  // ── Receiving (FR-RCV) ─────────────────────────────────────────────────────

  async postReceipt(
    userId: string,
    data: { supplierId?: string | null; note?: string; lines: { variantId: string; quantity: number; unitCost?: number | null }[] },
  ) {
    if (!data.lines.length) throw new BadRequestException('Add at least one line');
    const locationId = await this.getDefaultLocationId();
    for (const line of data.lines) await this.assertQuantityValid(line.variantId, line.quantity);

    const receipt = await this.prisma.$transaction(async (tx) => {
      const receipt = await tx.receipt.create({
        data: { locationId, supplierId: data.supplierId ?? null, note: data.note, status: 'posted', createdBy: userId, postedAt: new Date() },
      });
      for (const line of data.lines) {
        await tx.receiptLine.create({
          data: { receiptId: receipt.id, variantId: line.variantId, quantity: line.quantity, unitCost: line.unitCost ?? null },
        });
        await this.post(tx, {
          variantId: line.variantId,
          locationId,
          type: 'RECEIPT',
          quantity: line.quantity,
          onHandDelta: line.quantity,
          reservedDelta: 0,
          unitCost: line.unitCost ?? null,
          referenceType: 'receipt',
          referenceId: receipt.id,
          userId,
        });
        // FR-RCV-03 + D-03: last-cost update.
        if (line.unitCost != null) {
          await tx.variant.update({ where: { id: line.variantId }, data: { costPrice: line.unitCost } });
        }
      }
      return receipt;
    });
    for (const line of data.lines) await this.refreshAlerts(line.variantId, locationId);
    return receipt;
  }

  // ── Adjustments (FR-ADJ) ───────────────────────────────────────────────────

  async adjust(
    userId: string,
    data: { variantId: string; quantity: number; direction: 'up' | 'down'; reasonCode: string; note?: string },
    recountOnly: boolean,
  ) {
    const REASONS = ['recount', 'damage', 'theft_loss', 'promo_gift', 'correction', 'expiry', 'other'];
    if (!REASONS.includes(data.reasonCode)) throw new BadRequestException('Invalid reason code');
    if (recountOnly && data.reasonCode !== 'recount') {
      throw new BadRequestException('Your role may only post recount adjustments (FR-ADJ-04)');
    }
    if (data.reasonCode === 'other' && !data.note) throw new BadRequestException('A note is required for "other"');
    await this.assertQuantityValid(data.variantId, data.quantity);

    const locationId = await this.getDefaultLocationId();
    const signed = data.direction === 'up' ? data.quantity : -data.quantity;
    const isWriteOff = ['damage', 'theft_loss', 'expiry'].includes(data.reasonCode) && data.direction === 'down';
    const variant = await this.prisma.variant.findUnique({ where: { id: data.variantId } });
    const adjustType =
      data.reasonCode === 'recount' ? 'ADJUST_RECOUNT'
      : data.reasonCode === 'damage' ? 'ADJUST_DAMAGE'
      : data.reasonCode === 'theft_loss' ? 'ADJUST_THEFT'
      : 'ADJUST_CORRECTION';

    await this.prisma.$transaction(async (tx) => {
      await this.post(tx, {
        variantId: data.variantId,
        locationId,
        type: isWriteOff ? 'WRITE_OFF' : (adjustType as never),
        quantity: signed,
        onHandDelta: signed,
        reservedDelta: 0,
        unitCost: isWriteOff ? variant?.costPrice ?? null : null, // FR-ADJ-02 shrinkage value
        reasonCode: data.reasonCode,
        note: data.note,
        referenceType: 'adjustment',
        userId,
      });
    });
    await this.refreshAlerts(data.variantId, locationId);
    return { ok: true };
  }

  // ── Stocktakes (FR-STK) ────────────────────────────────────────────────────

  async createStocktake(userId: string, scopeCategoryId: string | null, blind: boolean) {
    const locationId = await this.getDefaultLocationId();
    const variants = await this.prisma.variant.findMany({
      where: {
        status: 'active',
        ...(scopeCategoryId ? { product: { categoryId: scopeCategoryId } } : {}),
      },
      include: { stockLevels: { where: { locationId } } },
    });

    return this.prisma.$transaction(async (tx) => {
      const stocktake = await tx.stocktake.create({
        data: { locationId, scopeCategoryId, blind, status: 'counting', createdBy: userId },
      });
      for (const v of variants) {
        const level = v.stockLevels[0];
        await tx.stocktakeLine.create({
          data: {
            stocktakeId: stocktake.id,
            variantId: v.id,
            systemQty: level ? level.onHand : 0,
          },
        });
      }
      return stocktake;
    });
  }

  async enterCounts(stocktakeId: string, counts: { lineId: string; countedQty: number }[]) {
    const stocktake = await this.prisma.stocktake.findUnique({ where: { id: stocktakeId } });
    if (!stocktake || !['counting', 'review'].includes(stocktake.status)) {
      throw new BadRequestException('Stocktake is not open for counting');
    }
    for (const c of counts) {
      const line = await this.prisma.stocktakeLine.findUnique({ where: { id: c.lineId }, include: { stocktake: false } });
      if (!line || line.stocktakeId !== stocktakeId) continue;
      const variant = await this.prisma.variant.findUnique({ where: { id: line.variantId } });
      const variance = c.countedQty - Number(line.systemQty);
      await this.prisma.stocktakeLine.update({
        where: { id: c.lineId },
        data: {
          countedQty: c.countedQty,
          variance,
          varianceCost: variant?.costPrice != null ? Math.round(variance * variant.costPrice) : null,
        },
      });
    }
    await this.prisma.stocktake.update({ where: { id: stocktakeId }, data: { status: 'review' } });
    return { ok: true };
  }

  /** FR-STK-04: one-time approval posts variance movements. */
  async approveStocktake(userId: string, stocktakeId: string) {
    const stocktake = await this.prisma.stocktake.findUnique({
      where: { id: stocktakeId },
      include: { lines: true },
    });
    if (!stocktake) throw new NotFoundException('Stocktake not found');
    if (stocktake.status !== 'review') throw new BadRequestException('Stocktake is not in review (Validation 7)');

    await this.prisma.$transaction(async (tx) => {
      for (const line of stocktake.lines) {
        const variance = Number(line.variance ?? 0);
        if (line.countedQty == null || Math.abs(variance) < 1e-9) continue;
        await this.post(tx, {
          variantId: line.variantId,
          locationId: stocktake.locationId,
          type: 'STOCKTAKE_VARIANCE',
          quantity: variance,
          onHandDelta: variance,
          reservedDelta: 0,
          reasonCode: 'stocktake',
          referenceType: 'stocktake',
          referenceId: stocktake.id,
          userId,
        });
      }
      await tx.stocktake.update({
        where: { id: stocktakeId },
        data: { status: 'approved', approvedBy: userId, approvedAt: new Date() },
      });
    });
    for (const line of stocktake.lines) await this.refreshAlerts(line.variantId, stocktake.locationId);
    return { ok: true };
  }

  // ── Reconciliation (Validation 8 / FR-LED-03) ─────────────────────────────

  @Cron('0 3 * * *')
  async reconcile() {
    const drift = await this.prisma.$queryRaw<{ variant_id: string; location_id: string; ledger_on_hand: string; on_hand: string }[]>`
      SELECT sl.variant_id, sl.location_id, sl.on_hand,
             COALESCE(SUM(CASE WHEN sm.type IN ('RECEIPT','RETURN_RESTOCK','ADJUST_RECOUNT','ADJUST_DAMAGE','ADJUST_THEFT','ADJUST_CORRECTION','STOCKTAKE_VARIANCE') THEN sm.quantity
                               WHEN sm.type IN ('DEDUCT','WRITE_OFF') THEN sm.quantity
                               ELSE 0 END), 0) AS ledger_on_hand
      FROM stock_levels sl
      LEFT JOIN stock_movements sm ON sm.variant_id = sl.variant_id AND sm.location_id = sl.location_id
      GROUP BY sl.variant_id, sl.location_id, sl.on_hand
      HAVING ABS(sl.on_hand - COALESCE(SUM(CASE WHEN sm.type IN ('RECEIPT','RETURN_RESTOCK','ADJUST_RECOUNT','ADJUST_DAMAGE','ADJUST_THEFT','ADJUST_CORRECTION','STOCKTAKE_VARIANCE') THEN sm.quantity
                               WHEN sm.type IN ('DEDUCT','WRITE_OFF') THEN sm.quantity
                               ELSE 0 END), 0)) > 0.001`;

    if (drift.length > 0) {
      await this.notifications.notify({
        type: 'reconciliation_drift',
        sourceEventId: `inv-drift-${new Date().toISOString().slice(0, 10)}`,
        payload: { count: drift.length, sample: drift.slice(0, 5) },
        link: '/inventory',
        roleKeys: ['owner', 'manager'],
      });
    }
    return drift.length;
  }
}
