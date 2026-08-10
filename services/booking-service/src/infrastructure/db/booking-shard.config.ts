import { Knex } from 'knex';

import { DbConfig } from '../../config';
import type { BookingDatabaseConnectionConfig, BookingShardConfig } from './booking-shard.types';

/** Booking Service owns this topology; no other service imports it. */
export const BOOKING_SHARD_COUNT = DbConfig.BOOKING_SHARD_COUNT;
export const BOOKING_READ_REPLICA_ENABLED = DbConfig.READ_REPLICA_ENABLED;

export const bookingShardConfigs: BookingShardConfig[] = Array.from(
    { length: BOOKING_SHARD_COUNT },
    (_, shardIndex) => {
        const shard = DbConfig.getBookingShardEnvironment(shardIndex);
        return {
            primary: { ...shard.primary },
            ...(shard.replica ? { replica: { ...shard.replica } } : {}),
        };
    },
);

export const buildBookingKnexConfig = (
    connection: BookingDatabaseConnectionConfig,
): Knex.Config => ({
    client: 'mysql2',
    connection,
    pool: {
        min: 2,
        max: 10,
        acquireTimeoutMillis: 5000,
        afterCreate: (resource: { query: (sql: string, callback: (error?: Error) => void) => void }, done: (error: Error | null, connection: unknown) => void) => {
            resource.query('SET SESSION innodb_lock_wait_timeout = 5', (error?: Error) => done(error ?? null, resource));
        },
    },
});
