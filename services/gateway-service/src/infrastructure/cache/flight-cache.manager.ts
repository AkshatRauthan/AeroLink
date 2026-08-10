import { createRedisClient, createCacheManager, pingRedis } from '@aerolink/shared/cache';
import { gatewayRedisConfig } from '@root/config';

const gatewayRedisClient = createRedisClient(gatewayRedisConfig, 'gateway-redis');

/** Every Gateway Service module should go through this, not the raw client. */
export const gatewayCache = createCacheManager(gatewayRedisClient);

/**
 * Verifies Redis is actually reachable, by pinging it. Call once during
 * service startup alongside connectGatewayDatabases(), before accepting
 * traffic — ioredis's retryStrategy retries indefinitely by default, so
 * without this check a down Redis at boot won't surface clearly.
 */
export const connectGatewayCache = async (): Promise<void> => {
    await pingRedis(gatewayRedisClient, 'gateway-redis');
};

export const closeGatewayCacheConnection = async (): Promise<void> => {
    await gatewayRedisClient.quit();
};