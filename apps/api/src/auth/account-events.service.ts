import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Append-only account/auth event log — FR-AUTH-05, FR-AUD-01. */
@Injectable()
export class AccountEventsService {
  constructor(private prisma: PrismaService) {}

  async log(params: {
    userId?: string | null;
    type: string;
    detail?: Record<string, unknown>;
    actorId?: string | null;
    ip?: string | null;
  }) {
    await this.prisma.accountEvent.create({
      data: {
        userId: params.userId ?? null,
        type: params.type,
        detail: (params.detail as never) ?? undefined,
        actorId: params.actorId ?? null,
        ip: params.ip ?? null,
      },
    });
  }
}
