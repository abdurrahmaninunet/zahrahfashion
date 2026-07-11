import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SETTINGS_BY_KEY, SETTINGS_CATALOG, SettingDef } from './settings-catalog';

const CACHE_TTL_MS = 30_000; // NFR-03: ≤ 60s propagation; in-process cache

interface CacheEntry {
  value: unknown;
  at: number;
}

@Injectable()
export class SettingsService {
  private cache = new Map<string, CacheEntry>();

  constructor(private prisma: PrismaService) {}

  /** Typed read with catalog default fallback (FR-SET-03). */
  async get<T = unknown>(key: string): Promise<T> {
    const def = SETTINGS_BY_KEY.get(key);
    if (!def) throw new Error(`Unknown setting key: ${key}`);

    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value as T;

    const row = await this.prisma.settingValue.findUnique({ where: { key } });
    const value = row ? (row.value as T) : (def.default as T);
    this.cache.set(key, { value, at: Date.now() });
    return value;
  }

  async getMany(keys: string[]): Promise<Record<string, unknown>> {
    const out: Record<string, unknown> = {};
    for (const key of keys) out[key] = await this.get(key);
    return out;
  }

  /** Full catalog with current values for the settings UI (FR-SET-02). */
  async catalog(includeSensitive: boolean) {
    const rows = await this.prisma.settingValue.findMany();
    const values = new Map(rows.map((r) => [r.key, r]));
    return SETTINGS_CATALOG.filter((d) => includeSensitive || !d.sensitive).map((d) => {
      const row = values.get(d.key);
      return {
        key: d.key,
        domain: d.domain,
        label: d.label,
        description: d.description,
        type: d.type,
        enumValues: d.enumValues,
        sensitive: !!d.sensitive,
        editableBy: d.editableBy,
        default: d.default,
        min: d.min,
        max: d.max,
        value: row ? row.value : d.default,
        updatedBy: row?.updatedBy ?? null,
        updatedAt: row?.updatedAt ?? null,
      };
    });
  }

  private validate(def: SettingDef, value: unknown): unknown {
    switch (def.type) {
      case 'string':
        if (typeof value !== 'string') throw new BadRequestException(`${def.key} must be a string`);
        return value;
      case 'bool':
        if (typeof value !== 'boolean') throw new BadRequestException(`${def.key} must be a boolean`);
        return value;
      case 'int':
      case 'money': {
        const n = typeof value === 'string' ? Number(value) : value;
        if (typeof n !== 'number' || !Number.isInteger(n)) throw new BadRequestException(`${def.key} must be an integer`);
        if (def.min !== undefined && n < def.min) throw new BadRequestException(`${def.key} must be ≥ ${def.min}`);
        if (def.max !== undefined && n > def.max) throw new BadRequestException(`${def.key} must be ≤ ${def.max}`);
        return n;
      }
      case 'decimal': {
        const n = typeof value === 'string' ? Number(value) : value;
        if (typeof n !== 'number' || Number.isNaN(n)) throw new BadRequestException(`${def.key} must be a number`);
        if (def.min !== undefined && n < def.min) throw new BadRequestException(`${def.key} must be ≥ ${def.min}`);
        if (def.max !== undefined && n > def.max) throw new BadRequestException(`${def.key} must be ≤ ${def.max}`);
        return n;
      }
      case 'enum':
        if (typeof value !== 'string' || !def.enumValues?.includes(value)) {
          throw new BadRequestException(`${def.key} must be one of: ${def.enumValues?.join(', ')}`);
        }
        return value;
      case 'json':
        if (value === null || value === undefined) throw new BadRequestException(`${def.key} is required`);
        return value;
    }
  }

  /**
   * Transactional write with history (FR-SET-04). Permission/step-up checks are
   * the controller's job; `canEditSensitive` gates Owner-only settings here as
   * defense in depth (BR-05).
   */
  async set(key: string, value: unknown, actorId: string, opts: { canEditSensitive: boolean; canEditOwnerOnly: boolean; reason?: string }) {
    const def = SETTINGS_BY_KEY.get(key);
    if (!def) throw new NotFoundException(`Unknown setting: ${key}`);
    if (def.sensitive && !opts.canEditSensitive) throw new ForbiddenException('Sensitive setting — Owner only');
    if (def.editableBy === 'owner' && !opts.canEditOwnerOnly) throw new ForbiddenException('Owner-only setting');

    const clean = this.validate(def, value);
    const existing = await this.prisma.settingValue.findUnique({ where: { key } });
    const oldValue = existing ? existing.value : (def.default as never);

    await this.prisma.$transaction([
      this.prisma.settingValue.upsert({
        where: { key },
        create: { key, value: clean as never, updatedBy: actorId },
        update: { value: clean as never, updatedBy: actorId },
      }),
      this.prisma.settingHistory.create({
        data: { key, oldValue: oldValue as never, newValue: clean as never, actorId, reason: opts.reason },
      }),
    ]);

    this.cache.delete(key);
    return { key, value: clean };
  }

  async history(key: string, limit = 50) {
    if (!SETTINGS_BY_KEY.has(key)) throw new NotFoundException(`Unknown setting: ${key}`);
    return this.prisma.settingHistory.findMany({
      where: { key },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /** FR-SET-06: effective configuration export (excludes sensitive values). */
  async exportEffective() {
    const items = await this.catalog(false);
    return Object.fromEntries(items.map((i) => [i.key, i.value]));
  }
}
