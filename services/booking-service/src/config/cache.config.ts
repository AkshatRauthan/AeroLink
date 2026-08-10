import { RedisOptions } from 'ioredis';
import { getEnv, getPort } from '@aerolink/shared';

/**
 * Booking Service owns its own Redis connection details, same pattern as
 * booking-shard.config.ts owns its own DB connection details. Other
 * services configure their own Redis connection independently — this is
 * not a shared client.
 */
export const bookingRedisConfig: RedisOptions = {
    host: getEnv('BOOKING_REDIS_HOST', '127.0.0.1'),
    port: getPort('BOOKING_REDIS_PORT', '6379'),
};