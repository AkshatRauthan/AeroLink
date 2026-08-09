import dotenv from 'dotenv';
import path from 'path';

import { CustomError } from '@aerolink/shared';
import { StatusCodes } from 'http-status-codes';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface FlightDatabaseConnectionEnvironment {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
}

interface FlightShardEnvironment {
    primary: FlightDatabaseConnectionEnvironment;
    replica?: FlightDatabaseConnectionEnvironment;
}

const getEnv = (key: string, fallback?: string): string => {
    const value = process.env[key] ?? fallback;
    if (value === undefined || value.trim() === '') {
        throw new CustomError(`Missing required environment variable: ${key}`, StatusCodes.NOT_FOUND, true);
    }
    return value;
};

const getPort = (key: string, fallback?: string): number => {
    const value = Number(getEnv(key, fallback));
    if (!Number.isInteger(value) || value < 1 || value > 65535) {
        throw new CustomError(`Environment variable ${key} must be a valid port number.`, StatusCodes.BAD_REQUEST, true);
    }
    return value;
};

const getPositiveInteger = (key: string, fallback: string): number => {
    const value = Number(getEnv(key, fallback));
    if (!Number.isInteger(value) || value < 1) {
        throw new CustomError(`Environment variable ${key} must be a positive integer.`, StatusCodes.BAD_REQUEST, true);
    }
    return value;
};

const getBoolean = (key: string, fallback: boolean): boolean => {
    const value = process.env[key];
    if (value === undefined || value.trim() === '') return fallback;
    if (value === 'true') return true;
    if (value === 'false') return false;
    throw new CustomError(`Environment variable ${key} must be either "true" or "false".`, StatusCodes.BAD_REQUEST, true);
};

/**
 * Reads one shard's connection environment. When readReplicaEnabled is true,
 * this shard's REPLICA_HOST/REPLICA_PORT env vars are required with no
 * fallback — a missing replica config for any single shard fails the whole
 * service at startup. FLIGHT_READ_REPLICA_ENABLED is an all-or-nothing
 * switch across every shard, not a per-shard opt-in, even though `replica`
 * is typed as optional on FlightShardConfig/FlightShardEnvironment.
 */
const readShardEnvironment = (
    shardIndex: number,
    readReplicaEnabled: boolean,
): FlightShardEnvironment => {
    const prefix = `FLIGHT_SHARD${shardIndex}`;
    const primary: FlightDatabaseConnectionEnvironment = {
        host: getEnv(`${prefix}_PRIMARY_HOST`, '127.0.0.1'),
        port: getPort(`${prefix}_PRIMARY_PORT`, '3306'),
        user: getEnv('FLIGHT_DB_USER'),
        password: getEnv('FLIGHT_DB_PASSWORD'),
        database: getEnv(`${prefix}_DB_NAME`, `aerolink_flight_shard${shardIndex}`),
    };

    if (!readReplicaEnabled) return { primary };

    return {
        primary,
        replica: {
            host: getEnv(`${prefix}_REPLICA_HOST`),
            port: getPort(`${prefix}_REPLICA_PORT`),
            user: getEnv('FLIGHT_REPLICA_DB_USER', primary.user),
            password: getEnv('FLIGHT_REPLICA_DB_PASSWORD', primary.password),
            database: getEnv(`${prefix}_REPLICA_DB_NAME`, primary.database),
        },
    };
};

const READ_REPLICA_ENABLED = getBoolean('FLIGHT_READ_REPLICA_ENABLED', false);
const FLIGHT_SHARD_COUNT = getPositiveInteger('FLIGHT_SHARD_COUNT', '1');

/**
 * Flight Service environment configuration. Database topology stays local to
 * this service, while future shards are added through FLIGHT_SHARD_COUNT and
 * the matching FLIGHT_SHARD<n>_* variables.
 */
/** Database topology and replica settings owned by Flight Service. */
const DbConfig = {
    READ_REPLICA_ENABLED,
    FLIGHT_SHARD_COUNT,
    getFlightShardEnvironment: (shardIndex: number): FlightShardEnvironment => {
        if (!Number.isInteger(shardIndex) || shardIndex < 0 || shardIndex >= FLIGHT_SHARD_COUNT) {
            throw new CustomError(`Invalid Flight shard index: ${shardIndex}`, StatusCodes.BAD_REQUEST, true);
        }
        return readShardEnvironment(shardIndex, READ_REPLICA_ENABLED);
    },
};

export default DbConfig;
export type { FlightDatabaseConnectionEnvironment, FlightShardEnvironment };
