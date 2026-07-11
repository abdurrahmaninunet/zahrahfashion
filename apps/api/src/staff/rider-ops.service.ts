import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrdersService } from '../orders/orders.service';
import { AuthedUser } from '../auth/auth.types';

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

export function addressHash(address: string): string {
  return createHash('sha256').update(address.toLowerCase().replace(/\s+/g, ' ').trim()).digest('hex');
}

const RIDER_ACTION_SEQUENCE: Record<string, string[]> = {
  // FR-DSP-04: enforced action order per shipment status.
  picked_up: ['pending'],
  out: ['pending', 'out'], // idempotent-ish: picked_up sets status out
  delivered: ['out'],
  failed: ['out'],
  transfer_flagged: ['out'],
};

@Injectable()
export class RiderOpsService {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
    private notifications: NotificationsService,
    private orders: OrdersService,
  ) {}

  /** Resolve the staff_member (rider) record for a logged-in rider user. */
  async riderForUser(userId: string) {
    const rider = await this.prisma.staffMember.findUnique({ where: { userId } });
    if (!rider || rider.roleKey !== 'rider' || rider.status !== 'active') {
      throw new ForbiddenException('No active rider profile is linked to your account');
    }
    return rider;
  }

  // ── Dispatch board (FR-DSP) ────────────────────────────────────────────────

  async board() {
    const [unassigned, riders] = await Promise.all([
      this.prisma.shipment.findMany({
        where: { method: 'rider', riderId: null, status: { in: ['pending', 'out'] } },
        include: {
          order: {
            select: {
              id: true, orderNumber: true, grandTotal: true, paymentMethod: true, paymentStatus: true, address: true,
              deliveryZone: { select: { id: true, name: true } },
              customer: { select: { fullName: true, primaryPhone: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.staffMember.findMany({ where: { roleKey: 'rider', status: 'active' }, orderBy: { fullName: 'asc' } }),
    ]);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const riderColumns = [];
    for (const rider of riders) {
      const stops = await this.prisma.shipment.findMany({
        where: { riderId: rider.id, status: { in: ['pending', 'out', 'delivered', 'failed'] }, createdAt: { gte: startOfDay } },
        include: {
          order: {
            select: {
              id: true, orderNumber: true, grandTotal: true, paymentMethod: true, paymentStatus: true, address: true,
              customer: { select: { fullName: true, primaryPhone: true } },
            },
          },
        },
        orderBy: [{ dispatchOrder: 'asc' }, { createdAt: 'asc' }],
      });
      riderColumns.push({
        rider: { id: rider.id, fullName: rider.fullName, phone: rider.phone, photo: rider.photo },
        stops,
        codExposure: stops
          .filter((s) => s.status !== 'delivered')
          .reduce((sum, s) => sum + (s.codExpected ?? 0), 0), // FR-DSP-02
      });
    }
    return { unassigned, riders: riderColumns };
  }

  async assign(actor: AuthedUser, shipmentIds: string[], riderId: string) {
    const rider = await this.prisma.staffMember.findUnique({ where: { id: riderId } });
    if (!rider || rider.roleKey !== 'rider' || rider.status !== 'active') {
      throw new BadRequestException('Not an active rider');
    }
    const maxOrder = await this.prisma.shipment.aggregate({
      where: { riderId },
      _max: { dispatchOrder: true },
    });
    let sequence = (maxOrder._max.dispatchOrder ?? 0) + 1;

    for (const shipmentId of shipmentIds) {
      const shipment = await this.prisma.shipment.findUnique({ where: { id: shipmentId } });
      if (!shipment) continue;
      if (shipment.method !== 'rider') throw new BadRequestException('Only rider shipments are assignable (FR-DSP-04)');
      const previousRider = shipment.riderId;
      await this.prisma.shipment.update({
        where: { id: shipmentId },
        data: { riderId, riderName: rider.fullName, riderPhone: rider.phone, dispatchOrder: sequence++ },
      });
      await this.orders.addEvent(shipment.orderId, previousRider ? 'shipment_reassigned' : 'shipment_assigned', {
        shipmentId, riderId, riderName: rider.fullName, previousRider,
      }, { type: 'user', id: actor.id });
    }
    return { assigned: shipmentIds.length };
  }

  async setSequence(riderId: string, orderedShipmentIds: string[]) {
    await this.prisma.$transaction(
      orderedShipmentIds.map((id, i) =>
        this.prisma.shipment.updateMany({ where: { id, riderId }, data: { dispatchOrder: i + 1 } }),
      ),
    );
    return { ok: true };
  }

  // ── Rider workspace (FR-RWS) ───────────────────────────────────────────────

  async todayList(userId: string) {
    const rider = await this.riderForUser(userId);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const shipments = await this.prisma.shipment.findMany({
      where: { riderId: rider.id, OR: [{ status: { in: ['pending', 'out'] } }, { createdAt: { gte: startOfDay } }] },
      include: {
        order: {
          select: {
            id: true, orderNumber: true, grandTotal: true, paymentMethod: true, paymentStatus: true, address: true,
            customer: { select: { fullName: true, primaryPhone: true } },
          },
        },
        geoEvents: { orderBy: { serverTime: 'desc' }, take: 3 },
      },
      orderBy: [{ dispatchOrder: 'asc' }, { createdAt: 'asc' }],
    });

    // Cash-carried strip (Scenario A2-3).
    const balance = await this.prisma.riderCashLedger.aggregate({
      where: { riderId: rider.id },
      _sum: { amount: true },
    });
    return {
      rider: { id: rider.id, fullName: rider.fullName },
      cashCarried: balance._sum.amount ?? 0,
      shipments,
    };
  }

  /** Geo-stamped status action (FR-RWS + FR-GEO-02/03). */
  async riderStatusAction(
    userId: string,
    shipmentId: string,
    data: {
      action: 'picked_up' | 'out' | 'delivered' | 'failed' | 'transfer_flagged';
      lat: number;
      lng: number;
      accuracyM?: number;
      clientTime: string;
      codCollected?: number;
      failureReason?: string;
      customerCaused?: boolean;
    },
    riderAuthedUser: AuthedUser,
  ) {
    const rider = await this.riderForUser(userId);
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { order: true },
    });
    if (!shipment || shipment.riderId !== rider.id) {
      throw new ForbiddenException('This shipment is not assigned to you (FR-DSP-04)');
    }
    if (!RIDER_ACTION_SEQUENCE[data.action]?.includes(shipment.status)) {
      throw new BadRequestException(`"${data.action}" is not available while the shipment is ${shipment.status}`);
    }

    // Server-side verdict (FR-GEO-03) — client distances ignored (Validation 3).
    const threshold = await this.settings.get<number>('delivery.proximity_threshold_m');
    const address = shipment.order.address as { line?: string; area?: string; city?: string } | null;
    const addressKey = address ? addressHash(`${address.line ?? ''} ${address.area ?? ''} ${address.city ?? ''}`) : null;
    const geocode = addressKey
      ? await this.prisma.addressGeocode.findUnique({ where: { addressHash: addressKey } })
      : null;

    let distanceM: number | null = null;
    let verdict: 'verified' | 'flagged' | 'low_confidence' = 'low_confidence';
    if ((data.accuracyM ?? 0) > 200) {
      verdict = 'low_confidence'; // FR-GEO-03
    } else if (geocode) {
      distanceM = haversineMeters(data.lat, data.lng, Number(geocode.lat), Number(geocode.lng));
      verdict = distanceM <= threshold ? 'verified' : 'flagged';
    }

    const clientTime = new Date(data.clientTime);
    const submittedLate = Math.abs(Date.now() - clientTime.getTime()) > 10 * 60_000;

    const geoEvent = await this.prisma.shipmentGeoEvent.create({
      data: {
        shipmentId,
        riderId: rider.id,
        action: data.action,
        lat: data.lat,
        lng: data.lng,
        accuracyM: data.accuracyM,
        clientTime,
        distanceM,
        verdict,
        submittedLate,
      },
    });

    // Side effects per action.
    switch (data.action) {
      case 'picked_up':
      case 'out':
        await this.prisma.shipment.update({ where: { id: shipmentId }, data: { status: 'out', shippedAt: shipment.shippedAt ?? new Date() } });
        break;

      case 'delivered': {
        const codDue = shipment.codExpected ?? 0;
        const collected = data.codCollected ?? 0;
        if (codDue > 0 && collected > 0) {
          // FR-RWS-05: cash ledger + order payment simultaneously.
          await this.prisma.riderCashLedger.create({
            data: { riderId: rider.id, type: 'collection', amount: collected, shipmentId, recordedBy: userId },
          });
        }
        await this.orders.recordDelivery(
          riderAuthedUser,
          shipment.orderId,
          shipmentId,
          codDue > 0 && collected > 0
            ? { method: 'pod_cash', amount: collected, collector: rider.fullName }
            : undefined,
        );
        break;
      }

      case 'failed':
        await this.orders.deliveryFailed(riderAuthedUser, shipment.orderId, shipmentId, data.failureReason ?? 'unspecified', data.customerCaused ?? false);
        break;

      case 'transfer_flagged':
        // Scenario A2-5: customer paying by transfer at the door — office verifies.
        await this.notifications.notify({
          type: 'transfer_at_door',
          sourceEventId: `transfer-door-${shipmentId}-${geoEvent.id}`,
          payload: { orderNumber: shipment.order.orderNumber, rider: rider.fullName },
          link: `/orders/${shipment.orderId}`,
          roleKeys: ['owner', 'manager', 'management'],
        });
        break;
    }

    return { geoEvent, verdict, distanceM };
  }

  // ── Geo review queue (FR-GEO-04) ───────────────────────────────────────────

  async flaggedEvents() {
    const events = await this.prisma.shipmentGeoEvent.findMany({
      where: { verdict: 'flagged', disposition: null },
      include: {
        shipment: {
          include: { order: { select: { id: true, orderNumber: true, address: true } } },
        },
      },
      orderBy: { serverTime: 'desc' },
      take: 100,
    });
    const riderIds = Array.from(new Set(events.map((e) => e.riderId)));
    const riders = await this.prisma.staffMember.findMany({ where: { id: { in: riderIds } }, select: { id: true, fullName: true } });
    const rmap = new Map(riders.map((r) => [r.id, r.fullName]));
    return events.map((e) => ({ ...e, riderName: rmap.get(e.riderId) ?? 'Unknown' }));
  }

  async disposition(actorId: string, eventId: string, disposition: 'ok' | 'address_error' | 'unresolved', fix?: { lat: number; lng: number }) {
    const event = await this.prisma.shipmentGeoEvent.findUnique({
      where: { id: eventId },
      include: { shipment: { include: { order: { select: { address: true } } } } },
    });
    if (!event) throw new NotFoundException('Geo event not found');

    await this.prisma.shipmentGeoEvent.update({
      where: { id: eventId },
      data: { disposition, dispositionBy: actorId },
    });

    // address-error: correct the geocode with a manual pin (Scenario A2-4).
    if (disposition === 'address_error' && fix) {
      const address = event.shipment.order.address as { line?: string; area?: string; city?: string } | null;
      if (address) {
        const key = addressHash(`${address.line ?? ''} ${address.area ?? ''} ${address.city ?? ''}`);
        await this.prisma.addressGeocode.upsert({
          where: { addressHash: key },
          create: { addressHash: key, lat: fix.lat, lng: fix.lng, provider: 'manual', manualOverride: true, confidence: 1 },
          update: { lat: fix.lat, lng: fix.lng, provider: 'manual', manualOverride: true, confidence: 1 },
        });
      }
    }
    return { ok: true };
  }

  /** Manual geocode pin for a shipment address (FR-GEO-01 manual correction). */
  async setGeocode(addressText: string, lat: number, lng: number) {
    const key = addressHash(addressText);
    return this.prisma.addressGeocode.upsert({
      where: { addressHash: key },
      create: { addressHash: key, lat, lng, provider: 'manual', manualOverride: true, confidence: 1 },
      update: { lat, lng, provider: 'manual', manualOverride: true },
    });
  }

  // ── Cash reconciliation (FR-CSH) ───────────────────────────────────────────

  async riderBalances() {
    const riders = await this.prisma.staffMember.findMany({ where: { roleKey: 'rider' }, orderBy: { fullName: 'asc' } });
    const result = [];
    for (const rider of riders) {
      const balance = await this.prisma.riderCashLedger.aggregate({ where: { riderId: rider.id }, _sum: { amount: true } });
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const today = await this.prisma.riderCashLedger.aggregate({
        where: { riderId: rider.id, type: 'collection', createdAt: { gte: startOfDay } },
        _sum: { amount: true },
      });
      result.push({
        rider: { id: rider.id, fullName: rider.fullName, status: rider.status },
        balance: balance._sum.amount ?? 0,
        collectedToday: today._sum.amount ?? 0,
      });
    }
    return result;
  }

  async recordRemittance(actorId: string, riderId: string, amount: number, note?: string) {
    const balance = await this.prisma.riderCashLedger.aggregate({ where: { riderId }, _sum: { amount: true } });
    const current = balance._sum.amount ?? 0;
    if (amount > current) {
      throw new BadRequestException(`Remittance ₦${amount / 100} exceeds the rider's balance ₦${current / 100} — record an overage adjustment explicitly (Validation 4)`);
    }
    return this.prisma.riderCashLedger.create({
      data: { riderId, type: 'remittance', amount: -amount, reason: note, recordedBy: actorId },
    });
  }

  async recordAdjustment(actorId: string, riderId: string, amount: number, reason: string) {
    return this.prisma.riderCashLedger.create({
      data: { riderId, type: 'adjustment', amount, reason, recordedBy: actorId },
    });
  }

  /** FR-CSH-02: day close — expected vs remitted, approval closes. */
  async dayClose(actorId: string, riderId: string, dateStr: string, resolution?: string) {
    const date = new Date(dateStr);
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);

    const [collections, remittances] = await Promise.all([
      this.prisma.riderCashLedger.aggregate({
        where: { riderId, type: 'collection', createdAt: { gte: dayStart, lt: dayEnd } },
        _sum: { amount: true },
      }),
      this.prisma.riderCashLedger.aggregate({
        where: { riderId, type: 'remittance', createdAt: { gte: dayStart, lt: dayEnd } },
        _sum: { amount: true },
      }),
    ]);
    const expected = collections._sum.amount ?? 0;
    const remitted = -(remittances._sum.amount ?? 0);
    const difference = expected - remitted;
    if (difference !== 0 && !resolution) {
      throw new BadRequestException(`Difference of ₦${difference / 100} needs a resolution note (FR-CSH-02)`);
    }

    const existing = await this.prisma.riderDayClose.findUnique({
      where: { riderId_date: { riderId, date: dayStart } },
    });
    if (existing?.status === 'closed') throw new BadRequestException('This day is already closed (Validation 5)');

    return this.prisma.riderDayClose.upsert({
      where: { riderId_date: { riderId, date: dayStart } },
      create: { riderId, date: dayStart, expected, remitted, difference, resolution, approvedBy: actorId, status: 'closed' },
      update: { expected, remitted, difference, resolution, approvedBy: actorId, status: 'closed' },
    });
  }

  /** Rider scorecard (FR-PRF-02). */
  async riderScorecard(riderId: string) {
    const [delivered, failed, flags, discrepancies] = await Promise.all([
      this.prisma.shipment.count({ where: { riderId, status: 'delivered' } }),
      this.prisma.shipment.count({ where: { riderId, status: 'failed' } }),
      this.prisma.shipmentGeoEvent.groupBy({
        by: ['disposition'],
        where: { riderId, verdict: 'flagged' },
        _count: true,
      }),
      this.prisma.riderDayClose.aggregate({
        where: { riderId, difference: { not: 0 } },
        _count: true,
        _sum: { difference: true },
      }),
    ]);
    const total = delivered + failed;
    return {
      delivered,
      failed,
      successRate: total > 0 ? Math.round((delivered / total) * 1000) / 10 : null,
      proximityFlags: Object.fromEntries(flags.map((f) => [f.disposition ?? 'open', f._count])),
      cashDiscrepancies: { count: discrepancies._count, totalValue: discrepancies._sum.difference ?? 0 },
    };
  }
}
