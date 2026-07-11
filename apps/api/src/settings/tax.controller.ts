import { Body, Controller, Get, Put, Req } from '@nestjs/common';
import { z } from 'zod';
import { SettingsService } from './settings.service';
import { Cap } from '../auth/decorators';
import { AuthedRequest } from '../auth/auth.types';
import { parse } from '../common/zod';

/**
 * Tax — a single editable percentage applied to the product subtotal at
 * checkout (shown as "Tax"). Backed by the tax.rate_percent setting so it gets
 * validation, caching and history for free. Powers the admin Settings → Tax page.
 */
@Controller('tax')
export class TaxController {
  constructor(private settings: SettingsService) {}

  @Get()
  async get() {
    const ratePercent = Number(await this.settings.get<number>('tax.rate_percent')) || 0;
    return { ratePercent };
  }

  @Put()
  @Cap('settings.edit')
  async set(@Body() body: unknown, @Req() req: AuthedRequest) {
    const { ratePercent } = parse(z.object({ ratePercent: z.number().min(0).max(100) }), body);
    await this.settings.set('tax.rate_percent', ratePercent, req.user.id, {
      canEditSensitive: true,
      canEditOwnerOnly: true,
      reason: 'Tax rate updated',
    });
    return { ratePercent };
  }
}
