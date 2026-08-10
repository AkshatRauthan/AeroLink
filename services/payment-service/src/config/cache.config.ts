import { RedisOptions } from 'ioredis';
import { getEnv, getPort } from '@aerolink/shared';

/**
 * Payment Service owns its own Redis connection details, same pattern as
 * payment-shard.config.ts owns its own DB connection details. Other
 * services configure their own Redis connection independently — this is
 * not a shared client.
 */
export const paymentRedisConfig: RedisOptions = {
    host: getEnv('PAYMENT_REDIS_HOST', '127.0.0.1'),
    port: getPort('PAYMENT_REDIS_PORT', '6379'),
};