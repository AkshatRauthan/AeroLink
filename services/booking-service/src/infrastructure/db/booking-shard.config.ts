import dotenv from 'dotenv';
import path from 'path';
import type { Knex } from 'knex';
import type { BookingDatabaseConnectionConfig, BookingShardConfig } from './booking-shard.types';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const env = (key: string, fallback: string): string => process.env[key] ?? fallback;

/** Booking Service owns this topology; no other service imports it. */
export const BOOKING_SHARD_COUNT = 2;

export const bookingShardConfigs: BookingShardConfig[] = [
    {
        primary: {
            host: env('BOOKING_SHARD0_PRIMARY_HOST', '127.0.0.1'),
            port: Number(env('BOOKING_SHARD0_PRIMARY_PORT', '3307')),
            user: env('BOOKING_DB_USER', 'booking_service'),
            password: env('BOOKING_DB_PASSWORD', 'booking_service_password'),
            database: env('BOOKING_SHARD0_DB_NAME', 'aerolink_booking_shard0'),
        },
        replica: {
            host: env('BOOKING_SHARD0_REPLICA_HOST', '127.0.0.1'),
            port: Number(env('BOOKING_SHARD0_REPLICA_PORT', '3309')),
            user: env('BOOKING_DB_USER', 'booking_service'),
            password: env('BOOKING_DB_PASSWORD', 'booking_service_password'),
            database: env('BOOKING_SHARD0_DB_NAME', 'aerolink_booking_shard0'),
        },
    },
    {
        primary: {
            host: env('BOOKING_SHARD1_PRIMARY_HOST', '127.0.0.1'),
            port: Number(env('BOOKING_SHARD1_PRIMARY_PORT', '3308')),
            user: env('BOOKING_DB_USER', 'booking_service'),
            password: env('BOOKING_DB_PASSWORD', 'booking_service_password'),
            database: env('BOOKING_SHARD1_DB_NAME', 'aerolink_booking_shard1'),
        },
        replica: {
            host: env('BOOKING_SHARD1_REPLICA_HOST', '127.0.0.1'),
            port: Number(env('BOOKING_SHARD1_REPLICA_PORT', '3310')),
            user: env('BOOKING_DB_USER', 'booking_service'),
            password: env('BOOKING_DB_PASSWORD', 'booking_service_password'),
            database: env('BOOKING_SHARD1_DB_NAME', 'aerolink_booking_shard1'),
        },
    },
];

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
