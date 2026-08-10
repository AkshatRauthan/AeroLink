import { createRedisClient, createCacheManager, pingRedis } from '@aerolink/shared';
import { bookingRedisConfig } from '@root/config';

const bookingRedisClient = createRedisClient(bookingRedisConfig, 'booking-redis');

/** Every Booking Service module should go through this, not the raw client. */
export const bookingCache = createCacheManager(bookingRedisClient);

/**
 * Verifies Redis is actually reachable, by pinging it. Call once during
 * service startup alongside connectBookingDatabases(), before accepting
 * traffic — ioredis's retryStrategy retries indefinitely by default, so
 * without this check a down Redis at boot won't surface clearly.
 */
export const connectBookingCache = async (): Promise<void> => {
    await pingRedis(bookingRedisClient, 'booking-redis');
};

export const closeBookingCacheConnection = async (): Promise<void> => {
    await bookingRedisClient.quit();
};