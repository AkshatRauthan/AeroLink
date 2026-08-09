import { createRedisClient, createCacheManager, pingRedis } from '@aerolink/shared';
import { authRedisConfig } from '@root/config';

const authRedisClient = createRedisClient(authRedisConfig, 'auth-redis');

/** Every Auth Service module should go through this, not the raw client. */
export const authCache = createCacheManager(authRedisClient);

/**
 * Verifies Redis is actually reachable, by pinging it. Call once during
 * service startup alongside connectAuthDatabases(), before accepting
 * traffic — ioredis's retryStrategy retries indefinitely by default, so
 * without this check a down Redis at boot won't surface clearly.
 */
export const connectAuthCache = async (): Promise<void> => {
    await pingRedis(authRedisClient, 'auth-redis');
};

export const closeAuthCacheConnection = async (): Promise<void> => {
    await authRedisClient.quit();
};