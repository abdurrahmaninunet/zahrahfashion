import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Capability } from './capabilities';

const CACHE_TTL_MS = 60_000; // FR-RBAC-03: cached ≤ 60s

interface Entry {
  caps: Set<Capability>;
  at: number;
}

@Injectable()
export class PermissionsService {
  private cache = new Map<string, Entry>();

  constructor(private prisma: PrismaService) {}

  /** Effective permissions = role ∪ grants ∖ revokes (FR-RBAC-02). */
  async effectiveCapabilities(userId: string, roleKey: string): Promise<Set<Capability>> {
    const hit = this.cache.get(userId);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.caps;

    const role = await this.prisma.role.findUnique({ where: { key: roleKey } });
    const caps = new Set<Capability>((role?.capabilities as Capability[]) ?? []);

    const overrides = await this.prisma.userPermissionOverride.findMany({ where: { userId } });
    const now = new Date();
    for (const o of overrides) {
      if (o.expiresAt && o.expiresAt < now) continue;
      if (o.mode === 'grant') caps.add(o.capability as Capability);
      else caps.delete(o.capability as Capability);
    }

    this.cache.set(userId, { caps, at: Date.now() });
    return caps;
  }

  /** Invalidate on role/override/status change (Validation Rule 8). */
  invalidate(userId?: string) {
    if (userId) this.cache.delete(userId);
    else this.cache.clear();
  }
}
