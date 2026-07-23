/**
 * Redis-backed cache for hot public lookups (event listings, QR resolution).
 * Invalidation is best-effort; it never gates a state transition.
 */

import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { loadRuntimeConfig } from './runtime.config';

@Injectable()
export class CacheService {
  private readonly redis: Redis;

  constructor() {
    const cfg = loadRuntimeConfig().redis;
    this.redis = new Redis({
      host: cfg.host,
      port: cfg.port,
      keyPrefix: cfg.keyPrefix,
    });
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async set(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async invalidate(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
