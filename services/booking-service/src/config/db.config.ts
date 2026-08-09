import path from 'path';
import dotenv from 'dotenv';
import { CustomError } from '@aerolink/shared';
import { StatusCodes } from 'http-status-codes';
import { getBoolean, getEnv, getPort, getPositiveInteger } from '@aerolink/shared';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface BookingDatabaseConnectionEnvironment {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
}

interface BookingShardEnvironment {
    primary: BookingDatabaseConnectionEnvironment;
    replica?: BookingDatabaseConnectionEnvironment;
}

const READ_REPLICA_ENABLED = getBoolean('BOOKING_READ_REPLICA_ENABLED', false);
const BOOKING_SHARD_COUNT = getPositiveInteger('BOOKING_SHARD_COUNT', '2');

const readBookingShardEnvironment = (shardIndex: number): BookingShardEnvironment => {
    const prefix = `BOOKING_SHARD${shardIndex}`;
    const primary: BookingDatabaseConnectionEnvironment = {
        host: getEnv(`${prefix}_PRIMARY_HOST`, '127.0.0.1'),
        port: getPort(`${prefix}_PRIMARY_PORT`, '3306'),
        user: getEnv('BOOKING_DB_USER', 'booking_service'),
        password: getEnv('BOOKING_DB_PASSWORD', 'booking_service_password'),
        database: getEnv(`${prefix}_DB_NAME`, `aerolink_booking_shard${shardIndex}`),
    };
    if (!READ_REPLICA_ENABLED) return { primary };
    return {
        primary,
        replica: {
            host: getEnv(`${prefix}_REPLICA_HOST`),
            port: getPort(`${prefix}_REPLICA_PORT`),
            user: getEnv('BOOKING_REPLICA_DB_USER', primary.user),
            password: getEnv('BOOKING_REPLICA_DB_PASSWORD', primary.password),
            database: getEnv(`${prefix}_REPLICA_DB_NAME`, primary.database),
        },
    };
};

/** Database topology and replica settings owned by Booking Service. */
const DbConfig = {
    READ_REPLICA_ENABLED,
    BOOKING_SHARD_COUNT,
    getBookingShardEnvironment: (shardIndex: number): BookingShardEnvironment => {
        if (!Number.isInteger(shardIndex) || shardIndex < 0 || shardIndex >= BOOKING_SHARD_COUNT) {
            throw new CustomError(`Invalid Booking shard index: ${shardIndex}`, StatusCodes.BAD_REQUEST, true);
        }
        return readBookingShardEnvironment(shardIndex);
    },
};

export default DbConfig;
export type { BookingDatabaseConnectionEnvironment, BookingShardEnvironment };
