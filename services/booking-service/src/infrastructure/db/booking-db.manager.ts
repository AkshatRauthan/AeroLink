import type { Knex } from 'knex';
import knex from 'knex';
import { bookingShardConfigs, BOOKING_SHARD_COUNT, buildBookingKnexConfig } from './booking-shard.config';
import type { BookingShardPool } from './booking-shard.types';

const pools: BookingShardPool[] = bookingShardConfigs.map(({ primary, replica }) => ({
    primary: knex(buildBookingKnexConfig(primary)),
    replica: knex(buildBookingKnexConfig(replica)),
}));

/** Returns Booking Service's pool pair for an already-resolved shard. */
export const getBookingShardPool = (shardIndex: number): BookingShardPool => {
    if (!Number.isInteger(shardIndex) || shardIndex < 0 || shardIndex >= BOOKING_SHARD_COUNT) {
        throw new Error(`Invalid booking shard index: ${shardIndex}`);
    }
    return pools[shardIndex];
};

/** Used only by the Booking Service migration runner. Replicas are never migrated directly. */
export const getAllBookingPrimaryPools = (): Knex[] => pools.map(({ primary }) => primary);

export const closeBookingDatabaseConnections = async (): Promise<void> => {
    await Promise.all(pools.flatMap(({ primary, replica }) => [primary.destroy(), replica.destroy()]));
};
