import { createHash } from 'crypto';
import { NUM_SHARDS } from './shards.config';
import { getPool } from './pooling.config';
/**
 * Resolves which shard a given key belongs to.
 *
 * Shard key is always `flight_id` — this guarantees every booking,
 * seat row, and lock for a given flight lives on the same shard,
 * which is required for SELECT ... FOR UPDATE to actually prevent
 * cross-shard race conditions.
 */
export const getShardIndex = (key: string): number => {
    const hash = createHash('md5').update(key).digest('hex');
    // Use first 8 hex chars as a 32-bit int — plenty of distribution for NUM_SHARDS.
    const intHash = parseInt(hash.slice(0, 8), 16);
    return intHash % NUM_SHARDS;
};

/**
 * Returns the { primary, replica } Knex instances for the shard that owns `key`.
 * `key` should always be the flight_id for booking/seat-related queries.
 */
export const getShard = (key: string) => {
    const index = getShardIndex(key);
    return getPool(index);
};