import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Short-lived shared key/value store for OTP + pending-auth state, so those
 * survive across multiple API instances. Backed by **Redis** when REDIS_URL is
 * set; otherwise an in-process Map (single-instance dev). Values are JSON;
 * every key carries a TTL (seconds) and expires automatically.
 */
@Injectable()
export class EphemeralStore implements OnModuleDestroy {
  private readonly redis: Redis | null;
  private readonly mem = new Map<string, { value: string; expiresAt: number }>();

  constructor() {
    if (process.env.REDIS_URL) {
      this.redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 3 });
      this.redis.on('error', (e) => console.error('[redis]', e.message));
    } else {
      this.redis = null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const json = JSON.stringify(value);
    const ttl = Math.max(1, Math.ceil(ttlSeconds));
    if (this.redis) {
      await this.redis.set(key, json, 'EX', ttl);
    } else {
      this.mem.set(key, { value: json, expiresAt: Date.now() + ttl * 1000 });
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.redis) {
      const v = await this.redis.get(key);
      return v ? (JSON.parse(v) as T) : null;
    }
    const entry = this.mem.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) { this.mem.delete(key); return null; }
    return JSON.parse(entry.value) as T;
  }

  async del(key: string): Promise<void> {
    if (this.redis) await this.redis.del(key);
    else this.mem.delete(key);
  }

  onModuleDestroy() {
    this.redis?.disconnect();
  }
}
