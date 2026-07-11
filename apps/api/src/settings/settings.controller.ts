import { Body, Controller, ForbiddenException, Get, Param, Post, Put, Req } from '@nestjs/common';
import { z } from 'zod';
import { SettingsService } from './settings.service';
import { SETTINGS_BY_KEY } from './settings-catalog';
import { Cap } from '../auth/decorators';
import { AuthedRequest } from '../auth/auth.types';
import { parse } from '../common/zod';

const writeSchema = z.object({ value: z.unknown(), reason: z.string().max(500).optional() });

@Controller('settings')
export class SettingsController {
  constructor(private settings: SettingsService) {}

  @Get()
  @Cap('settings.view')
  async catalog(@Req() req: AuthedRequest) {
    return this.settings.catalog(req.user.capabilities.has('settings.edit_sensitive'));
  }

  @Put(':key')
  @Cap('settings.edit')
  async write(@Param('key') key: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    const { value, reason } = parse(writeSchema, body);
    const def = SETTINGS_BY_KEY.get(key);

    // FR-SET-05: sensitive settings need a fresh step-up confirmation.
    if (def?.sensitive) {
      if (!req.stepUpUntil || req.stepUpUntil < new Date()) {
        throw new ForbiddenException({ message: 'Step-up confirmation required', code: 'STEP_UP_REQUIRED' });
      }
    }

    return this.settings.set(key, value, req.user.id, {
      canEditSensitive: req.user.capabilities.has('settings.edit_sensitive'),
      canEditOwnerOnly: req.user.roleKey === 'owner',
      reason,
    });
  }

  @Get(':key/history')
  @Cap('settings.view_audit')
  async history(@Param('key') key: string) {
    return this.settings.history(key);
  }

  @Post(':key/revert/:historyId')
  @Cap('settings.edit')
  async revert(@Param('key') key: string, @Param('historyId') historyId: string, @Req() req: AuthedRequest) {
    const history = await this.settings.history(key, 200);
    const entry = history.find((h) => h.id === historyId);
    if (!entry) throw new ForbiddenException('History entry not found');
    const def = SETTINGS_BY_KEY.get(key);
    if (def?.sensitive && (!req.stepUpUntil || req.stepUpUntil < new Date())) {
      throw new ForbiddenException({ message: 'Step-up confirmation required', code: 'STEP_UP_REQUIRED' });
    }
    // Revert = a new logged write (BR-03).
    return this.settings.set(key, entry.oldValue, req.user.id, {
      canEditSensitive: req.user.capabilities.has('settings.edit_sensitive'),
      canEditOwnerOnly: req.user.roleKey === 'owner',
      reason: `Revert to state before ${entry.createdAt.toISOString()}`,
    });
  }

  @Get('export/effective')
  @Cap('settings.export_audit')
  async exportEffective() {
    return this.settings.exportEffective();
  }
}
