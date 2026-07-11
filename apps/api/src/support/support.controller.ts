import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { Cap } from '../auth/decorators';
import { AuthedRequest } from '../auth/auth.types';
import { parse } from '../common/zod';

const TOPICS = ['order_status', 'payment', 'delivery', 'return_refund', 'complaint', 'pre_sales', 'wholesale_asoebi', 'account_privacy', 'other'] as const;
const CHANNELS = ['whatsapp', 'phone', 'instagram', 'email', 'in_store'] as const;
const OUTCOMES = ['resolved', 'promised_action', 'escalated', 'no_action_needed'] as const;

const logSchema = z.object({
  customerId: z.string(),
  orderId: z.string().nullable().optional(),
  channel: z.enum(CHANNELS),
  topic: z.enum(TOPICS),
  summary: z.string().min(3).max(280),
  outcome: z.enum(OUTCOMES),
  followUpAt: z.string().datetime().nullable().optional(),
  parentId: z.string().nullable().optional(),
  detail: z.object({
    yardage: z.number().optional(),
    fabric: z.string().optional(),
    eventDate: z.string().optional(),
  }).optional(), // A4-FR-07 wholesale intake
});

/**
 * A4 Interactions Log — append-only support memory (≤20s to record).
 * Read/write: Manager + Management (customers.notes_tags proxies that set).
 */
@Controller('support/interactions')
export class SupportController {
  constructor(private prisma: PrismaService) {}

  @Post()
  @Cap('customers.notes_tags')
  async log(@Body() body: unknown, @Req() req: AuthedRequest) {
    const data = parse(logSchema, body);

    // A4-FR-04: a promise without a date is the failure this log prevents.
    if (data.outcome === 'promised_action' && !data.followUpAt) {
      throw new BadRequestException('A promised action needs a follow-up date (A4-FR-04)');
    }
    if (data.topic === 'wholesale_asoebi' && !data.detail) {
      throw new BadRequestException('Wholesale enquiries need the intake fields: yardage, fabric, event date (A4-FR-07)');
    }

    const interaction = await this.prisma.supportInteraction.create({
      data: {
        customerId: data.customerId,
        orderId: data.orderId ?? null,
        channel: data.channel,
        topic: data.topic,
        summary: data.summary,
        outcome: data.outcome,
        followUpAt: data.followUpAt ? new Date(data.followUpAt) : null,
        followUpStatus: data.followUpAt ? 'due' : 'none',
        assignedTo: data.followUpAt ? req.user.id : null,
        parentId: data.parentId ?? null,
        detail: (data.detail as never) ?? undefined,
        staffId: req.user.id,
      },
    });

    // Order timeline gains a support_contact event (A4-FR-02).
    if (data.orderId) {
      await this.prisma.orderEvent.create({
        data: {
          orderId: data.orderId,
          type: 'support_contact',
          payload: { interactionId: interaction.id, topic: data.topic } as never,
          actorType: 'user',
          actorId: req.user.id,
        },
      });
    }

    // Completing a follow-up: child entry closes the parent (A4-FR-03).
    if (data.parentId) {
      await this.prisma.supportInteraction.updateMany({
        where: { id: data.parentId, followUpStatus: 'due' },
        data: { followUpStatus: 'done' },
      });
    }
    return interaction;
  }

  /** Interactions tab on the customer profile (A4-FR-06). */
  @Get('customer/:customerId')
  @Cap('customers.view')
  async forCustomer(@Param('customerId') customerId: string) {
    const interactions = await this.prisma.supportInteraction.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const staffIds = Array.from(new Set(interactions.map((i) => i.staffId)));
    const staff = await this.prisma.user.findMany({ where: { id: { in: staffIds } }, select: { id: true, name: true } });
    const smap = new Map(staff.map((s) => [s.id, s.name]));
    const lastContact = interactions[0] ?? null;
    return {
      lastContact: lastContact ? { at: lastContact.createdAt, topic: lastContact.topic } : null,
      interactions: interactions.map((i) => ({ ...i, staffName: smap.get(i.staffId) ?? i.staffId })),
    };
  }

  /** "Support follow-ups due" (A4-FR-03) — joined into the dashboard feed. */
  @Get('follow-ups')
  @Cap('customers.notes_tags')
  async followUps(@Query('all') all?: string) {
    const due = await this.prisma.supportInteraction.findMany({
      where: {
        followUpStatus: 'due',
        ...(all === 'true' ? {} : { followUpAt: { lte: new Date() } }),
      },
      orderBy: { followUpAt: 'asc' },
      take: 100,
    });
    const customerIds = Array.from(new Set(due.map((i) => i.customerId)));
    const customers = await this.prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, fullName: true, primaryPhone: true },
    });
    const cmap = new Map(customers.map((c) => [c.id, c]));
    return due.map((i) => ({ ...i, customer: cmap.get(i.customerId) ?? null }));
  }

  @Post(':id/reassign')
  @Cap('customers.notes_tags')
  async reassign(@Param('id') id: string, @Body() body: unknown) {
    const { userId } = parse(z.object({ userId: z.string() }), body);
    await this.prisma.supportInteraction.update({
      where: { id },
      data: { assignedTo: userId, followUpStatus: 'due' },
    });
    return { ok: true };
  }

  /** A4-FR-08: support metrics for Reports. */
  @Get('report')
  @Cap('reports.view_ops')
  async report(@Query('days') days?: string) {
    const since = new Date(Date.now() - (Number(days) || 30) * 86_400_000);
    const [byTopic, byChannel, followUpStats, repeatContacts] = await Promise.all([
      this.prisma.supportInteraction.groupBy({ by: ['topic'], where: { createdAt: { gte: since } }, _count: true, orderBy: { _count: { topic: 'desc' } } }),
      this.prisma.supportInteraction.groupBy({ by: ['channel'], where: { createdAt: { gte: since } }, _count: true }),
      this.prisma.supportInteraction.groupBy({ by: ['followUpStatus'], where: { createdAt: { gte: since }, followUpStatus: { not: 'none' } }, _count: true }),
      this.prisma.$queryRaw<{ customer_id: string; full_name: string; count: string }[]>`
        SELECT si.customer_id, c.full_name, COUNT(*) AS count
        FROM support_interactions si
        JOIN customers c ON c.id = si.customer_id
        WHERE si.created_at > NOW() - INTERVAL '30 days'
        GROUP BY si.customer_id, c.full_name
        HAVING COUNT(*) >= 3
        ORDER BY count DESC LIMIT 20`,
    ]);
    const followUps = Object.fromEntries(followUpStats.map((f) => [f.followUpStatus, f._count]));
    const totalFollowUps = (followUps.due ?? 0) + (followUps.done ?? 0) + (followUps.reassigned ?? 0);
    return {
      byTopic: byTopic.map((t) => ({ topic: t.topic, count: t._count })),
      byChannel: byChannel.map((c) => ({ channel: c.channel, count: c._count })),
      followUpCompletionRate: totalFollowUps > 0 ? Math.round(((followUps.done ?? 0) / totalFollowUps) * 1000) / 10 : null,
      repeatContactCustomers: repeatContacts.map((r) => ({ customerId: r.customer_id, name: r.full_name, count: Number(r.count) })),
    };
  }
}
