import { createRedisClient, createCacheManager, pingRedis } from '@aerolink/shared/cache';
import { flightRedisConfig } from '@root/config';

const flightRedisClient = createRedisClient(flightRedisConfig, 'flight-redis');

/** Every Flight Service module should go through this, not the raw client. */
export const flightCache = createCacheManager(flightRedisClient);

/**
 * Verifies Redis is actually reachable, by pinging it. Call once during
 * service startup alongside connectFlightDatabases(), before accepting
 * traffic — ioredis's retryStrategy retries indefinitely by default, so
 * without this check a down Redis at boot won't surface clearly.
 */
export const connectFlightCache = async (): Promise<void> => {
    await pingRedis(flightRedisClient, 'flight-redis');
};

export const closeFlightCacheConnection = async (): Promise<void> => {
    await flightRedisClient.quit();
};