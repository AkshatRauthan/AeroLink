import dotenv from 'dotenv';
import path from 'path';
import { CustomError } from "@aerolink/shared";
import { StatusCodes } from 'http-status-codes';
import { getBoolean, getEnv, getPort, getPositiveInteger } from "@aerolink/shared";

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface PaymentDatabaseEnvironment { host: string; port: number; user: string; password: string; database: string; }
export interface PaymentShardEnvironment { primary: PaymentDatabaseEnvironment; replica?: PaymentDatabaseEnvironment; }

const READ_REPLICA_ENABLED = getBoolean('PAYMENT_READ_REPLICA_ENABLED', false);
const PAYMENT_SHARD_COUNT = getPositiveInteger('PAYMENT_SHARD_COUNT', '1');

/** Database topology and replica settings owned by Payment Service. */
const DbConfig = {
    READ_REPLICA_ENABLED,
    PAYMENT_SHARD_COUNT,
    getPaymentShardEnvironment: (shardIndex: number): PaymentShardEnvironment => {
        if (!Number.isInteger(shardIndex) || shardIndex < 0 || shardIndex >= PAYMENT_SHARD_COUNT) throw new CustomError(`Invalid Payment shard index: ${shardIndex}`, StatusCodes.BAD_REQUEST, true);
        const prefix = `PAYMENT_SHARD${shardIndex}`;
        const primary: PaymentDatabaseEnvironment = {
            host: getEnv(`${prefix}_PRIMARY_HOST`, '127.0.0.1'), port: getPort(`${prefix}_PRIMARY_PORT`, '3306'),
            user: getEnv('PAYMENT_DB_USER', 'auth_service'), password: getEnv('PAYMENT_DB_PASSWORD', 'auth_service_password'),
            database: getEnv(`${prefix}_DB_NAME`, `aerolink_auth_shard${shardIndex}`),
        };
        if (!READ_REPLICA_ENABLED) return { primary };
        return {
            primary, replica: {
                host: getEnv(`${prefix}_REPLICA_HOST`), port: getPort(`${prefix}_REPLICA_PORT`),
                user: getEnv('PAYMENT_REPLICA_DB_USER', primary.user), password: getEnv('PAYMENT_REPLICA_DB_PASSWORD', primary.password),
                database: getEnv(`${prefix}_REPLICA_DB_NAME`, primary.database),
            }
        };
    },
};

export default DbConfig;
