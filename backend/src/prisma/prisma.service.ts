import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * The Supabase connection pooler in session mode allows only 15 concurrent
 * sessions for the project. Prisma's default pool is
 * `num_cpus * 2 + 1`, which on a Render instance easily exceeds that and
 * produces:
 *
 *   FATAL: (EMAXCONNSESSION) max clients reached in session mode
 *
 * The pool is therefore capped, and the limit can be overridden with
 * DATABASE_POOL_SIZE for a deployment that is allowed more connections.
 */
const DEFAULT_POOL_SIZE = 5;

function resolvePoolSize(): number {
  const raw = process.env.DATABASE_POOL_SIZE;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) return Math.min(parsed, 15);
  return DEFAULT_POOL_SIZE;
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      log: [
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

/**
 * The pool size is applied through the connection URL, because Prisma reads
 * `connection_limit` from there. Appending it here means every deployment is
 * safe by default, even when the DATABASE_URL was written by hand.
 */
export function withSafePoolSize(url?: string): string | undefined {
  if (!url) return url;
  if (/connection_limit=/.test(url)) return url;

  const limit = resolvePoolSize();
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}connection_limit=${limit}&pool_timeout=30`;
}
