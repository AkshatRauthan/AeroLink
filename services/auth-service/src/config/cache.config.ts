import { RedisOptions } from 'ioredis';
import { getEnv, getPort, getPositiveInteger } from '@aerolink/shared';

/**
 * Auth Service owns its own Redis connection details, same pattern as
 * auth-shard.config.ts owns its own DB connection details. Other
 * services configure their own Redis connection independently — this is
 * not a shared client.
 */
export const authRedisConfig: RedisOptions = {
    host: getEnv('AUTH_REDIS_HOST', '127.0.0.1'),
    port: getPort('AUTH_REDIS_PORT', '6379'),
};

export const AuthCacheTTLConfig = {
    AuthBlacklistTTL: getPositiveInteger("REFRESH_TOKEN_EXPIRY", "604800"),
    ReverseUserIdLookupTTL: getPositiveInteger("REVERSE_USERID_CACHE_EXPIRY", "604800"),
    UserSessionsLookupTTL: getPositiveInteger("USER_SESSIONS_CACHE_EXPIRY", "604800"),
}