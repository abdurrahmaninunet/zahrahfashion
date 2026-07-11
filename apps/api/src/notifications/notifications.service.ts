import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Bell notifications (Dashboard FR-NTF). Event-driven, idempotent by
 * source_event_id per recipient; role broadcasts fan out to current members.
 */
@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async notify(params: {
    type: string;
    sourceEventId: string;
    payload?: Record<string, unknown>;
    link?: string;
    roleKeys?: string[];
    userIds?: string[];
  }) {
    const userIds = new Set(params.userIds ?? []);
    if (params.roleKeys?.length) {
      const users = await this.prisma.user.findMany({
        where: { roleKey: { in: params.roleKeys }, status: 'active' },
        select: { id: true },
      });
      for (const u of users) userIds.add(u.id);
    }
    if (userIds.size === 0) return;

    await this.prisma.notification.createMany({
      data: Array.from(userIds).map((userId) => ({
        userId,
        type: params.type,
        payload: (params.payload as never) ?? undefined,
        link: params.link,
        sourceEventId: params.sourceEventId,
      })),
      skipDuplicates: true, // FR-NTF-03 idempotency
    });
  }
}
