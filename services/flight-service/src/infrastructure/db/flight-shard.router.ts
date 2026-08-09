import { createHash } from 'crypto';
import { getFlightReadPool, getFlightShardPool } from './flight-db.manager';
import { FLIGHT_SHARD_COUNT } from './flight-shard.config';

/**
 * Future-proof routing for Flight Service. With one shard every flight maps to
 * shard zero; increasing FLIGHT_SHARD_COUNT makes the same deterministic hash
 * route flights across the configured shard set.
 */
export const getFlightShardIndex = (flightId: string): number => {
    const hash = createHash('md5').update(flightId).digest('hex');
    return parseInt(hash.slice(0, 8), 16) % FLIGHT_SHARD_COUNT;
};

export const getFlightShard = (flightId: string) =>
    getFlightShardPool(getFlightShardIndex(flightId));

/** Use only for stale-tolerant Flight reads such as search or browse queries. */
export const getFlightReadDatabase = (flightId: string) =>
    getFlightReadPool(getFlightShardIndex(flightId));
