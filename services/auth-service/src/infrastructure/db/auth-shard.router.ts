import { createHash } from 'crypto';
import { getAuthReadPool, getAuthShardPool } from './auth-db.manager';
import { AUTH_SHARD_COUNT } from './auth-shard.config';

/**
 * Future-proof routing for Auth Service. With one shard every auth maps to shard zero;
 * increasing AUTH_SHARD_COUNT makes the same deterministic hash route auths across the configured shard set.
 */
export const getAuthShardIndex = (userId: string): number => {
    const hash = createHash('md5').update(userId).digest('hex');
    return parseInt(hash.slice(0, 8), 16) % AUTH_SHARD_COUNT;
};

export const getAuthDatabaseShard = (userId: string) =>
    getAuthShardPool(getAuthShardIndex(userId));

/** Use only for stale-tolerant Auth reads such as search or browse queries. */
export const getAuthReadDatabase = (userId: string) =>
    getAuthReadPool(getAuthShardIndex(userId));
