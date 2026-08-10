import { RedisOptions } from 'ioredis';
import { getEnv, getPort } from '@aerolink/shared';

/**
 * Flight Service owns its own Redis connection details, same pattern as
 * flight-shard.config.ts owns its own DB connection details. Other
 * services configure their own Redis connection independently — this is
 * not a shared client.
 */
export const flightRedisConfig: RedisOptions = {
    host: getEnv('FLIGHT_REDIS_HOST', '127.0.0.1'),
    port: getPort('FLIGHT_REDIS_PORT', '6379'),
};