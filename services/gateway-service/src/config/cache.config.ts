import { RedisOptions } from 'ioredis';
import { getEnv, getPort } from '@aerolink/shared';

/**
 * Gateway Service owns its own Redis connection details, same pattern as
 * gateway-shard.config.ts owns its own DB connection details. Other
 * services configure their own Redis connection independently — this is
 * not a shared client.
 */
export const gatewayRedisConfig: RedisOptions = {
    host: getEnv('GATEWAY_REDIS_HOST', '127.0.0.1'),
    port: getPort('GATEWAY_REDIS_PORT', '6379'),
};