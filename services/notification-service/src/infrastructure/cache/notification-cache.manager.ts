import { createRedisClient, createCacheManager, pingRedis } from '@aerolink/shared/cache';
import { notificationRedisConfig } from '@root/config';

const notificationRedisClient = createRedisClient(notificationRedisConfig, 'notification-redis');

/** Every Notification Service module should go through this, not the raw client. */
export const notificationCache = createCacheManager(notificationRedisClient);

/**
 * Verifies Redis is actually reachable, by pinging it. Call once during
 * service startup alongside connectNotificationDatabases(), before accepting
 * traffic — ioredis's retryStrategy retries indefinitely by default, so
 * without this check a down Redis at boot won't surface clearly.
 */
export const connectNotificationCache = async (): Promise<void> => {
    await pingRedis(notificationRedisClient, 'notification-redis');
};

export const closeNotificationCacheConnection = async (): Promise<void> => {
    await notificationRedisClient.quit();
};