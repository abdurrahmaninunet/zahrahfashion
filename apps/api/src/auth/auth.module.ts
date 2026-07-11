import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { PermissionsService } from './permissions.service';
import { AccountEventsService } from './account-events.service';
import { SettingsModule } from '../settings/settings.module';

@Global()
@Module({
  imports: [SettingsModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    PermissionsService,
    AccountEventsService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [AuthService, PermissionsService, AccountEventsService],
})
export class AuthModule {}
