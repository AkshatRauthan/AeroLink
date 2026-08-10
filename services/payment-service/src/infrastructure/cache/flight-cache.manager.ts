import { createRedisClient, createCacheManager, pingRedis } from '@aerolink/shared';
import { paymentRedisConfig } from '@root/config';

const paymentRedisClient = createRedisClient(paymentRedisConfig, 'payment-redis');

/** Every Payment Service module should go through this, not the raw client. */
export const paymentCache = createCacheManager(paymentRedisClient);

/**
 * Verifies Redis is actually reachable, by pinging it. Call once during
 * service startup alongside connectPaymentDatabases(), before accepting
 * traffic — ioredis's retryStrategy retries indefinitely by default, so
 * without this check a down Redis at boot won't surface clearly.
 */
export const connectPaymentCache = async (): Promise<void> => {
    await pingRedis(paymentRedisClient, 'payment-redis');
};

export const closePaymentCacheConnection = async (): Promise<void> => {
    await paymentRedisClient.quit();
};