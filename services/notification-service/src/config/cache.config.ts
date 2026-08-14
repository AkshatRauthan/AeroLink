import { RedisOptions } from 'ioredis';
import { getEnv, getPort } from '@aerolink/shared';

/**
 * Notification Service owns its own Redis connection details, same pattern as
 * notification-shard.config.ts owns its own DB connection details. Other
 * services configure their own Redis connection independently — this is
 * not a shared client.
 */
export const notificationRedisConfig: RedisOptions = {
    host: getEnv('NOTIFICATION_REDIS_HOST', '127.0.0.1'),
    port: getPort('NOTIFICATION_REDIS_PORT', '6379'),
};