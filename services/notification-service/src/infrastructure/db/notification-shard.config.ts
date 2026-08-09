import type { Knex } from 'knex';
import { DbConfig } from '../../config';
import type { NotificationDatabaseConnectionConfig, NotificationShardConfig } from './notification-shard.types';

export const NOTIFICATION_SHARD_COUNT = DbConfig.NOTIFICATION_SHARD_COUNT;
export const NOTIFICATION_READ_REPLICA_ENABLED = DbConfig.READ_REPLICA_ENABLED;

const toConnectionConfig = (
    config: NotificationDatabaseConnectionConfig,
): NotificationDatabaseConnectionConfig => ({ ...config });

/**
 * Notification owns this configuration. More shards require only an increased
 * NOTIFICATION_SHARD_COUNT and a matching NOTIFICATION_SHARD<n>_* environment block.
 */
export const notificationShardConfigs: NotificationShardConfig[] = Array.from(
    { length: NOTIFICATION_SHARD_COUNT },
    (_, shardIndex) => {
        const shard = DbConfig.getNotificationShardEnvironment(shardIndex);
        return {
            primary: toConnectionConfig(shard.primary),
            ...(shard.replica ? { replica: toConnectionConfig(shard.replica) } : {}),
        };
    },
);

export const buildNotificationKnexConfig = (
    connection: NotificationDatabaseConnectionConfig,
): Knex.Config => ({
    client: 'mysql2',
    connection,
    pool: {
        min: 1,
        max: 5,
        acquireTimeoutMillis: 5000,
    },
});
