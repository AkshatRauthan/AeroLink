import { createHash } from 'crypto';
import { getNotificationReadPool, getNotificationShardPool } from './notification-db.manager';
import { NOTIFICATION_SHARD_COUNT } from './notification-shard.config';

/**
 * Future-proof routing for Notification Service. With one shard every notification maps to
 * shard zero; increasing NOTIFICATION_SHARD_COUNT makes the same deterministic hash
 * route notifications across the configured shard set.
 */
export const getNotificationShardIndex = (notificationId: string): number => {
    const hash = createHash('md5').update(notificationId).digest('hex');
    return parseInt(hash.slice(0, 8), 16) % NOTIFICATION_SHARD_COUNT;
};

export const getNotificationShard = (notificationId: string) =>
    getNotificationShardPool(getNotificationShardIndex(notificationId));

/** Use only for stale-tolerant Notification reads such as search or browse queries. */
export const getNotificationReadDatabase = (notificationId: string) =>
    getNotificationReadPool(getNotificationShardIndex(notificationId));
