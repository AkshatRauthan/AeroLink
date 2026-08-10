import path from 'path';
import dotenv from 'dotenv';
import { CustomError } from "@aerolink/shared";
import { StatusCodes } from 'http-status-codes';
import { getBoolean, getPort, getPositiveInteger, getRequired } from '@aerolink/shared';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface NotificationDatabaseEnvironment { host: string; port: number; user: string; password: string; database: string; }
export interface NotificationShardEnvironment { primary: NotificationDatabaseEnvironment; replica?: NotificationDatabaseEnvironment; }
    
const READ_REPLICA_ENABLED = getBoolean('NOTIFICATION_READ_REPLICA_ENABLED', false);
const NOTIFICATION_SHARD_COUNT = getPositiveInteger('NOTIFICATION_SHARD_COUNT', '1');

/** Database topology and replica settings owned by Notification Service. */
const DbConfig = {
    READ_REPLICA_ENABLED,
    NOTIFICATION_SHARD_COUNT,
    getNotificationShardEnvironment: (shardIndex: number): NotificationShardEnvironment => {
        if (!Number.isInteger(shardIndex) || shardIndex < 0 || shardIndex >= NOTIFICATION_SHARD_COUNT) throw new CustomError(`Invalid Notification shard index: ${shardIndex}`, StatusCodes.BAD_REQUEST, true);
        const prefix = `NOTIFICATION_SHARD${shardIndex}`;
        const primary: NotificationDatabaseEnvironment = {
            host: getRequired(`${prefix}_PRIMARY_HOST`, '127.0.0.1'), port: getPort(`${prefix}_PRIMARY_PORT`, '3306'),
            user: getRequired('NOTIFICATION_DB_USER', 'auth_service'), password: getRequired('NOTIFICATION_DB_PASSWORD', 'auth_service_password'),
            database: getRequired(`${prefix}_DB_NAME`, `aerolink_auth_shard${shardIndex}`),
        };
        if (!READ_REPLICA_ENABLED) return { primary };
        return {
            primary, replica: {
                host: getRequired(`${prefix}_REPLICA_HOST`), port: getPort(`${prefix}_REPLICA_PORT`),
                user: getRequired('NOTIFICATION_REPLICA_DB_USER', primary.user), password: getRequired('NOTIFICATION_REPLICA_DB_PASSWORD', primary.password),
                database: getRequired(`${prefix}_REPLICA_DB_NAME`, primary.database),
            }
        };
    },
};

export default DbConfig;
