import knex, { Knex } from 'knex';

import { CustomError } from "@aerolink/shared"
import { FlightShardPool } from './flight-shard.types';
import { buildFlightKnexConfig, FLIGHT_READ_REPLICA_ENABLED, FLIGHT_SHARD_COUNT, flightShardConfigs } from './flight-shard.config';
import { StatusCodes } from 'http-status-codes';

const pools: FlightShardPool[] = flightShardConfigs.map(({ primary, replica }) => ({
    primary: knex(buildFlightKnexConfig(primary)),
    ...(FLIGHT_READ_REPLICA_ENABLED && replica ? { replica: knex(buildFlightKnexConfig(replica)) } : {}),
}));

/** Returns Flight Service's pool pair for an already-resolved shard. */
export const getFlightShardPool = (shardIndex: number): FlightShardPool => {
    if (!Number.isInteger(shardIndex) || shardIndex < 0 || shardIndex >= FLIGHT_SHARD_COUNT) {
        throw new CustomError(`Invalid Flight shard index: ${shardIndex}`, StatusCodes.BAD_REQUEST, true);
    }
    return pools[shardIndex];
};

/**
 * Selects the read target for stale-tolerant Flight queries. When replicas are
 * disabled, or a replica was not configured, this safely resolves to primary.
 */
export const getFlightReadPool = (shardIndex: number): Knex => {
    const { primary, replica } = getFlightShardPool(shardIndex);
    return FLIGHT_READ_REPLICA_ENABLED && replica ? replica : primary;
};

/** Used only by Flight Service's migration runner. Replicas are never migrated directly. */
export const getAllFlightPrimaryPools = (): Knex[] => pools.map(({ primary }) => primary);


/**
 * Verifies every Flight pool (primary, and replica if configured) can
 * actually connect, by running a real query against each. Knex connections
 * are lazy, so without this a bad primary/replica config would only surface
 * on the first real request rather than at boot. Call once during service
 * startup, before accepting traffic; throws if any primary or any replica
 * fails, since replicas are all-or-nothing when enabled.
 */
export const connectFlightDatabases = async (): Promise<void> => {
    const checks = pools.flatMap(({ primary, replica }, shardIndex) => [
        primary.raw('SELECT 1').catch((error) => {
            throw new CustomError(`Flight shard ${shardIndex} primary is unreachable: ${error.message}`, StatusCodes.NOT_FOUND, false);
        }),
        ...(replica
            ? [
                replica.raw('SELECT 1').catch((error) => {
                    throw new CustomError(`Flight shard ${shardIndex} replica is unreachable: ${error.message}`, StatusCodes.NOT_FOUND, false);
                }),
            ]
            : []),
    ]);

    const results = await Promise.allSettled(checks);
    const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');

    if (failures.length > 0) {
        const messages = failures.map(({ reason }) => (reason instanceof Error ? reason.message : String(reason)));
        throw new CustomError(`Flight database connectivity check failed:\n${messages.join('\n')}`, StatusCodes.INTERNAL_SERVER_ERROR, false);
    }
};

export const closeFlightDatabaseConnections = async (): Promise<void> => {
    await Promise.all(pools.flatMap(({ primary, replica }) => [primary.destroy(), ...(replica ? [replica.destroy()] : [])]));
};