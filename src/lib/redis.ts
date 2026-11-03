import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from '../utils/logger';

let redisInstance: Redis | null = null;

export function getRedisClient(): Redis | null {
  if (redisInstance) return redisInstance;

  const redisUrl = env.REDIS_DB_URL;
  if (!redisUrl) {
    logger.warn('[Redis] REDIS_DB_URL is not set. Caching will run in no-op fallback mode.');
    return null;
  }

  try {
    redisInstance = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      connectTimeout: 5000,
      lazyConnect: false,
      retryStrategy(times) {
        if (times > 3) {
          logger.warn('[Redis] Max reconnection attempts reached, disabling Redis temporarily.');
          return null;
        }
        return Math.min(times * 500, 2000);
      },
    });

    redisInstance.on('error', (err) => {
      logger.warn('[Redis] Connection warning:', err?.message || err);
    });

    redisInstance.on('connect', () => {
      logger.info('[Redis] Connected to Redis successfully.');
    });

    return redisInstance;
  } catch (err: any) {
    logger.warn('[Redis] Initialization error, running without cache:', err?.message || err);
    return null;
  }
}

export const redis = getRedisClient();

/**
 * Safe Redis Helpers with zero-crash fallbacks
 */
export async function getCache<T>(key: string): Promise<T | null> {
  const client = getRedisClient();
  if (!client) return null;
  try {
    const raw = await client.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err: any) {
    logger.warn(`[Redis] Error reading key ${key}:`, err?.message || err);
    return null;
  }
}

export async function setCache(key: string, value: any, ttlSeconds?: number): Promise<void> {
  const client = getRedisClient();
  if (!client) return;
  try {
    const serialized = JSON.stringify(value);
    if (ttlSeconds && ttlSeconds > 0) {
      await client.set(key, serialized, 'EX', ttlSeconds);
    } else {
      // Indefinite retention (no TTL) for static platform policies, escrow rules, etc.
      await client.set(key, serialized);
    }
  } catch (err: any) {
    logger.warn(`[Redis] Error setting key ${key}:`, err?.message || err);
  }
}

export async function delCache(...keys: string[]): Promise<void> {
  const client = getRedisClient();
  if (!client || keys.length === 0) return;
  try {
    await client.del(...keys);
  } catch (err: any) {
    logger.warn(`[Redis] Error deleting keys:`, err?.message || err);
  }
}

export async function delCachePattern(pattern: string): Promise<void> {
  const client = getRedisClient();
  if (!client) return;
  try {
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(...keys);
      logger.info(`[Redis] Invalidated ${keys.length} keys matching pattern: ${pattern}`);
    }
  } catch (err: any) {
    logger.warn(`[Redis] Error clearing pattern ${pattern}:`, err?.message || err);
  }
}
