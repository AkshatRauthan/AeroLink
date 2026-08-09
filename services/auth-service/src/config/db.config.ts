import path from 'path';
import dotenv from 'dotenv';
import { CustomError } from "@aerolink/shared";
import { StatusCodes } from 'http-status-codes';
import { getPort, getRequired, getBoolean, getPositiveInteger } from "@aerolink/shared";

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface AuthDatabaseEnvironment { host: string; port: number; user: string; password: string; database: string; }
export interface AuthShardEnvironment { primary: AuthDatabaseEnvironment; replica?: AuthDatabaseEnvironment; }

const READ_REPLICA_ENABLED = getBoolean('AUTH_READ_REPLICA_ENABLED', false);
const AUTH_SHARD_COUNT = getPositiveInteger('AUTH_SHARD_COUNT', '1');

/** Database topology and replica settings owned by Auth Service. */
const DbConfig = {
    READ_REPLICA_ENABLED,
    AUTH_SHARD_COUNT,
    getAuthShardEnvironment: (shardIndex: number): AuthShardEnvironment => {
        if (!Number.isInteger(shardIndex) || shardIndex < 0 || shardIndex >= AUTH_SHARD_COUNT) throw new CustomError(`Invalid Auth shard index: ${shardIndex}`, StatusCodes.BAD_REQUEST, true);
        const prefix = `AUTH_SHARD${shardIndex}`;
        const primary: AuthDatabaseEnvironment = {
            host: getRequired(`${prefix}_PRIMARY_HOST`, '127.0.0.1'), port: getPort(`${prefix}_PRIMARY_PORT`, '3306'),
            user: getRequired('AUTH_DB_USER', 'auth_service'), password: getRequired('AUTH_DB_PASSWORD', 'auth_service_password'),
            database: getRequired(`${prefix}_DB_NAME`, `aerolink_auth_shard${shardIndex}`),
        };
        if (!READ_REPLICA_ENABLED) return { primary };
        return {
            primary, replica: {
                host: getRequired(`${prefix}_REPLICA_HOST`), port: getPort(`${prefix}_REPLICA_PORT`),
                user: getRequired('AUTH_REPLICA_DB_USER', primary.user), password: getRequired('AUTH_REPLICA_DB_PASSWORD', primary.password),
                database: getRequired(`${prefix}_REPLICA_DB_NAME`, primary.database),
            }
        };
    },
};

export default DbConfig;
