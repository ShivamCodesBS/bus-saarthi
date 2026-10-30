import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

/**
 * Thin Redis wrapper used for caching hot read paths and for cross-process
 * coordination (Socket.IO pub/sub, rate-limit style cooldowns).
 *
 * Redis is OPTIONAL. When it is not reachable the service degrades to a
 * no-op: `get` always misses, `set` is a no-op. Callers must therefore always
 * be able to serve the value from the database. The same "is it up?" question
 * is answered once here instead of in every consumer.
 */
@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private client: RedisClientType | null = null;
  private available = false;
  private connecting = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        /* already closed */
      }
      this.client = null;
    }
  }

  private async connect(): Promise<void> {
    if (this.connecting || this.available) return;
    this.connecting = true;

    const url =
      this.configService.get<string>('redis.url') || 'redis://localhost:6379';

    try {
      const client = createClient({
        url,
        socket: {
          // Fail fast instead of hanging the boot sequence.
          connectTimeout: 3000,
          reconnectStrategy: (retries) =>
            retries > 5 ? new Error('Redis reconnect limit reached') : 500,
        },
      }) as RedisClientType;

      client.on('error', (err: any) => {
        this.logger.debug(`Redis error: ${err?.message}`);
      });

      await client.connect();
      this.client = client;
      this.available = true;
      this.logger.log('✅ Redis cache connected');
    } catch (err: any) {
      this.available = false;
      this.client = null;
      this.logger.warn(
        `⚠️  Redis unavailable (${err?.message}). Running with in-process fallback.`,
      );
    } finally {
      this.connecting = false;
    }
  }

  get isAvailable(): boolean {
    return this.available;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    if (!this.available || !this.client) return null;
    try {
      const raw = await this.client.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
    if (!this.available || !this.client) return;
    try {
      await this.client.set(key, JSON.stringify(value), { EX: ttlSeconds });
    } catch {
      /* cache write failures must never break the request */
    }
  }

  /**
   * Read-through cache. On a miss the loader runs and its result is cached.
   * The loader is only ever called with Redis down, so the database stays the
   * source of truth.
   */
  async remember<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const value = await loader();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  async del(...keys: string[]): Promise<void> {
    if (!this.available || !this.client || keys.length === 0) return;
    try {
      await this.client.del(keys);
    } catch {
      /* ignore */
    }
  }

  /**
   * Remove every key matching a glob pattern (used on cache invalidation).
   * Uses SCAN — `KEYS` blocks the Redis event loop for the whole keyspace,
   * which stalled every request sharing that Redis while invalidation ran.
   */
  async delByPattern(pattern: string): Promise<void> {
    if (!this.available || !this.client) return;
    try {
      let cursor = '0';
      do {
        const { cursor: next, keys } = await this.client.scan(cursor, {
          MATCH: pattern,
          COUNT: 200,
        });
        cursor = next;
        if (keys.length > 0) await this.client.del(keys);
      } while (cursor !== '0');
    } catch {
      /* ignore */
    }
  }

  /**
   * Set a key only if it does not exist yet, with TTL — the atomic
   * "first caller wins" primitive for cooldowns/rate-limits.
   */
  async setIfNotExists(
    key: string,
    seconds: number,
    value = '1',
  ): Promise<boolean> {
    if (!this.available || !this.client) return true;
    try {
      const result = await this.client.set(key, value, {
        EX: seconds,
        NX: true,
      });
      return result === 'OK';
    } catch {
      return true;
    }
  }

  async incr(key: string, ttlSeconds?: number): Promise<number> {
    if (!this.available || !this.client) return 0;
    try {
      const value = await this.client.incr(key);
      if (value === 1 && ttlSeconds) {
        await this.client.expire(key, ttlSeconds);
      }
      return value;
    } catch {
      return 0;
    }
  }

  async setEx(key: string, seconds: number, value: string): Promise<void> {
    if (!this.available || !this.client) return;
    try {
      await this.client.set(key, value, { EX: seconds });
    } catch {
      /* ignore */
    }
  }

  async getRaw(key: string): Promise<string | null> {
    if (!this.available || !this.client) return null;
    try {
      return await this.client.get(key);
    } catch {
      return null;
    }
  }

  async expire(key: string, seconds: number): Promise<void> {
    if (!this.available || !this.client) return;
    try {
      await this.client.expire(key, seconds);
    } catch {
      /* ignore */
    }
  }
}
