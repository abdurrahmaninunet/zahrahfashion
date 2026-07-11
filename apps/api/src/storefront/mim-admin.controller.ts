import { Body, Controller, Get, Put, Req } from '@nestjs/common';
import { z } from 'zod';
import { Cap } from '../auth/decorators';
import { AuthedRequest } from '../auth/auth.types';
import { SettingsService } from '../settings/settings.service';
import { StoreCatalogService } from './store-catalog.service';
import { parse } from '../common/zod';

const contentSchema = z.object({
  enabled: z.boolean(),
  ready: z.object({
    title: z.string().max(120),
    subtitle: z.string().max(240),
    productIds: z.array(z.string()).max(3),
  }),
});

/**
 * MIM back-office Content tab: the master on/off switch for the MIM store plus
 * the homepage "ready to personalise" section (heading, subtitle, up to 3
 * featured MIM products). Both persist as settings (mim.enabled / mim.ready)
 * so they get validation, caching and history for free.
 */
@Controller('mim')
export class MimAdminController {
  constructor(
    private settings: SettingsService,
    private catalog: StoreCatalogService,
  ) {}

  @Get('content')
  @Cap('products.view')
  async content() {
    const [enabled, ready, listing] = await Promise.all([
      this.settings.get<boolean>('mim.enabled'),
      this.settings.get<{ title?: string; subtitle?: string; productIds?: string[] }>('mim.ready'),
      this.catalog.listing({ filters: {}, store: 'mim' }),
    ]);
    return {
      enabled: enabled !== false,
      ready: {
        title: ready?.title ?? '',
        subtitle: ready?.subtitle ?? '',
        productIds: ready?.productIds ?? [],
      },
      // Pickable MIM products (active/visible) for the featured-section chooser.
      products: listing.products.map((p) => ({ id: p.id, name: p.name, image: p.image, price: p.price })),
    };
  }

  @Put('content')
  @Cap('products.create_edit')
  async save(@Body() body: unknown, @Req() req: AuthedRequest) {
    const { enabled, ready } = parse(contentSchema, body);
    const opts = { canEditSensitive: true, canEditOwnerOnly: true, reason: 'MIM Content tab' };
    await this.settings.set('mim.enabled', enabled, req.user.id, opts);
    await this.settings.set('mim.ready', ready, req.user.id, opts);
    return { ok: true };
  }
}
