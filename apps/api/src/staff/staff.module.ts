import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AuditController } from './audit.controller';
import { RiderOpsService } from './rider-ops.service';
import { StaffMembersController, RiderWorkspaceController } from './rider.controller';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [OrdersModule],
  controllers: [UsersController, AuditController, StaffMembersController, RiderWorkspaceController],
  providers: [UsersService, RiderOpsService],
  exports: [UsersService],
})
export class StaffModule {}
