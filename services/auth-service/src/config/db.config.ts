import path from 'path';
import dotenv from 'dotenv';
import { CustomError } from "@aerolink/shared";
import { StatusCodes } from 'http-status-codes';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface AuthDatabaseEnvironment { host: string; port: number; user: string; password: string; database: string; }
export interface AuthShardEnvironment { primary: AuthDatabaseEnvironment; replica?: AuthDatabaseEnvironment; }

const required = (key: string, fallback?: string): string => {
    const value = process.env[key] ?? fallback;
    if (!value?.trim()) throw new CustomError(`Missing required environment variable: ${key}`, StatusCodes.NOT_FOUND, true);
    return value;
};
const port = (key: string, fallback?: string): number => {
    const value = Number(required(key, fallback));
    if (!Number.isInteger(value) || value < 1 || value > 65535) throw new CustomError(`Environment variable ${key} must be a valid port number.`, StatusCodes.BAD_REQUEST, true);
    return value;
};
const positiveInteger = (key: string, fallback: string): number => {
    const value = Number(required(key, fallback));
    if (!Number.isInteger(value) || value < 1) throw new CustomError(`Environment variable ${key} must be a positive integer.`, StatusCodes.BAD_REQUEST, true);
    return value;
};
const boolean = (key: string, fallback: boolean): boolean => {
    const value = process.env[key];
    if (!value?.trim()) return fallback;
    if (value === 'true') return true;
    if (value === 'false') return false;
    throw new CustomError(`Environment variable ${key} must be either "true" or "false".`, StatusCodes.BAD_REQUEST, true);
};

const READ_REPLICA_ENABLED = boolean('AUTH_READ_REPLICA_ENABLED', false);
const AUTH_SHARD_COUNT = positiveInteger('AUTH_SHARD_COUNT', '1');

/** Database topology and replica settings owned by Auth Service. */
const DbConfig = {
    READ_REPLICA_ENABLED,
    AUTH_SHARD_COUNT,
    getAuthShardEnvironment: (shardIndex: number): AuthShardEnvironment => {
        if (!Number.isInteger(shardIndex) || shardIndex < 0 || shardIndex >= AUTH_SHARD_COUNT) throw new CustomError(`Invalid Auth shard index: ${shardIndex}`, StatusCodes.BAD_REQUEST, true);
        const prefix = `AUTH_SHARD${shardIndex}`;
        const primary: AuthDatabaseEnvironment = {
            host: required(`${prefix}_PRIMARY_HOST`, '127.0.0.1'), port: port(`${prefix}_PRIMARY_PORT`, '3306'),
            user: required('AUTH_DB_USER', 'auth_service'), password: required('AUTH_DB_PASSWORD', 'auth_service_password'),
            database: required(`${prefix}_DB_NAME`, `aerolink_auth_shard${shardIndex}`),
        };
        if (!READ_REPLICA_ENABLED) return { primary };
        return {
            primary, replica: {
                host: required(`${prefix}_REPLICA_HOST`), port: port(`${prefix}_REPLICA_PORT`),
                user: required('AUTH_REPLICA_DB_USER', primary.user), password: required('AUTH_REPLICA_DB_PASSWORD', primary.password),
                database: required(`${prefix}_REPLICA_DB_NAME`, primary.database),
            }
        };
    },
};

export default DbConfig;
