import dotenv from 'dotenv';
import path from 'path';

import { CustomError } from '@aerolink/shared';
import { StatusCodes } from 'http-status-codes';

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

const getEnv = (key: string, fallback?: string): string => {
    const value = process.env[key] ?? fallback;
    if (value === undefined || value.trim() === '') throw new CustomError(`Missing required environment variable: ${key}`, StatusCodes.NOT_FOUND, true);
    return value;
};
const getPort = (key: string, fallback?: string): number => {
    const value = Number(getEnv(key, fallback));
    if (!Number.isInteger(value) || value < 1 || value > 65535) throw new CustomError(`Environment variable ${key} must be a valid port number.`, StatusCodes.BAD_REQUEST, true);
    return value;
};
const getPositiveInteger = (key: string, fallback: string): number => {
    const value = Number(getEnv(key, fallback));
    if (!Number.isInteger(value) || value < 1) throw new CustomError(`Environment variable ${key} must be a positive integer.`, StatusCodes.BAD_REQUEST, true);
    return value;
};
const getBoolean = (key: string, fallback: boolean): boolean => {
    const value = process.env[key];
    if (value === undefined || value.trim() === '') return fallback;
    if (value === 'true') return true;
    if (value === 'false') return false;
    throw new CustomError(`Environment variable ${key} must be either "true" or "false".`, StatusCodes.BAD_REQUEST, true);
};

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
