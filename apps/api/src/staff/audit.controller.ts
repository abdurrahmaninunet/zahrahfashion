import { Controller, Get, Query, Req } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cap } from '../auth/decorators';
import { AuthedRequest } from '../auth/auth.types';

/**
 * FR-AUD-02/03: audit views — settings history, account events, and a
 * cross-module activity federation for a chosen user/period.
 */
@Controller('audit')
export class AuditController {
  constructor(private prisma: PrismaService) {}

  @Get('settings')
  @Cap('settings.view_audit')
  async settingsHistory(@Query('limit') limit?: string) {
    return this.prisma.settingHistory.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(limit ?? 100), 500),
    });
  }

  @Get('account-events')
  @Cap('settings.view_audit')
  async accountEvents(
    @Query('userId') userId?: string,
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.prisma.accountEvent.findMany({
      where: {
        ...(userId ? { userId } : {}),
        ...(type ? { type } : {}),
        createdAt: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to) } : {}),
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(limit ?? 100), 500),
    });
  }

  /** Cross-module activity for one user in a period (read-only federation). */
  @Get('activity')
  @Cap('settings.view_audit')
  async activity(@Req() req: AuthedRequest, @Query('userId') userId: string, @Query('from') from?: string, @Query('to') to?: string) {
    const range = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
    const [account, settings, orders, movements, catalog, content, customers, promos] = await Promise.all([
      this.prisma.accountEvent.findMany({ where: { OR: [{ userId }, { actorId: userId }], createdAt: range }, orderBy: { createdAt: 'desc' }, take: 100 }),
      this.prisma.settingHistory.findMany({ where: { actorId: userId, createdAt: range }, orderBy: { createdAt: 'desc' }, take: 100 }),
      this.prisma.orderEvent.findMany({ where: { actorId: userId, createdAt: range }, orderBy: { createdAt: 'desc' }, take: 100 }),
      this.prisma.stockMovement.findMany({ where: { userId, createdAt: range }, orderBy: { createdAt: 'desc' }, take: 100 }),
      this.prisma.catalogAuditLog.findMany({ where: { userId, createdAt: range }, orderBy: { createdAt: 'desc' }, take: 100 }),
      this.prisma.contentEvent.findMany({ where: { actorId: userId, createdAt: range }, orderBy: { createdAt: 'desc' }, take: 100 }),
      this.prisma.customerAccessLog.findMany({ where: { userId, createdAt: range }, orderBy: { createdAt: 'desc' }, take: 100 }),
      this.prisma.promotionEvent.findMany({ where: { actorId: userId, createdAt: range }, orderBy: { createdAt: 'desc' }, take: 100 }),
    ]);
    return { account, settings, orders, movements, catalog, content, customers, promotions: promos };
  }
}
