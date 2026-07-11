import { Global, Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { ZonesController } from './zones.controller';
import { StoreLocationsController } from './store-locations.controller';
import { TaxController } from './tax.controller';

@Global()
@Module({
  controllers: [SettingsController, ZonesController, StoreLocationsController, TaxController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
