import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { ReportsController } from './reports.controller';
import { MetricsService } from './metrics.service';

@Module({
  controllers: [DashboardController, ReportsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class DashboardModule {}
