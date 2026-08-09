import knex, { Knex } from 'knex';

import { CustomError } from "@aerolink/shared";
import { StatusCodes } from 'http-status-codes';
import type { BookingShardPool } from './booking-shard.types';
import { bookingShardConfigs, BOOKING_READ_REPLICA_ENABLED, BOOKING_SHARD_COUNT, buildBookingKnexConfig } from './booking-shard.config';

const pools: BookingShardPool[] = bookingShardConfigs.map(({ primary, replica }) => ({
    primary: knex(buildBookingKnexConfig(primary)),
    ...(replica ? { replica: knex(buildBookingKnexConfig(replica)) } : {}),
}));

/** Returns Booking Service's pool pair for an already-resolved shard. */
export const getBookingShardPool = (shardIndex: number): BookingShardPool => {
    if (!Number.isInteger(shardIndex) || shardIndex < 0 || shardIndex >= BOOKING_SHARD_COUNT) {
        throw new CustomError(`Invalid booking shard index: ${shardIndex}`, StatusCodes.BAD_REQUEST, true);
    }
    return pools[shardIndex];
};

/** Used only by the Booking Service migration runner. Replicas are never migrated directly. */
export const getAllBookingPrimaryPools = (): Knex[] => pools.map(({ primary }) => primary);

/** Selects a stale-tolerant read pool, falling back to primary when disabled. */
export const getBookingReadPool = (shardIndex: number): Knex => {
    const { primary, replica } = getBookingShardPool(shardIndex);
    return BOOKING_READ_REPLICA_ENABLED && replica ? replica : primary;
};

/**
 * Verifies every Booking pool (primary, and replica if configured) can
 * actually connect, by running a real query against each. Knex connections
 * are lazy, so without this a bad primary/replica config would only surface
 * on the first real request rather than at boot. Call once during service
 * startup, before accepting traffic; throws if any primary or any replica
 * fails, since replicas are all-or-nothing when enabled.
 */
export const connectBookingDatabases = async (): Promise<void> => {
    const checks = pools.flatMap(({ primary, replica }, shardIndex) => [
        primary.raw('SELECT 1').catch((error) => {
            throw new CustomError(`Booking shard ${shardIndex} primary is unreachable: ${error.message}`, StatusCodes.NOT_FOUND, false);
        }),
        ...(replica
            ? [
                replica.raw('SELECT 1').catch((error) => {
                    throw new CustomError(`Booking shard ${shardIndex} replica is unreachable: ${error.message}`, StatusCodes.NOT_FOUND, false);
                }),
            ]
            : []),
    ]);

    const results = await Promise.allSettled(checks);
    const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');

    if (failures.length > 0) {
        const messages = failures.map(({ reason }) => (reason instanceof Error ? reason.message : String(reason)));
        throw new CustomError(`Booking database connectivity check failed:\n${messages.join('\n')}`, StatusCodes.INTERNAL_SERVER_ERROR, false);
    }
};

export const closeBookingDatabaseConnections = async (): Promise<void> => {
    await Promise.all(pools.flatMap(({ primary, replica }) => [primary.destroy(), ...(replica ? [replica.destroy()] : [])]));
};
