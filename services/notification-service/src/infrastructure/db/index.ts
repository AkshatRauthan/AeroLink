export { getNotificationReadPool, getNotificationShardPool, getAllNotificationPrimaryPools, closeNotificationDatabaseConnections } from './notification-db.manager';
export { getNotificationReadDatabase, getNotificationShard, getNotificationShardIndex } from './notification-shard.router';
export { NOTIFICATION_READ_REPLICA_ENABLED, NOTIFICATION_SHARD_COUNT } from './notification-shard.config';
export type { NotificationDatabaseConnectionConfig, NotificationShardConfig, NotificationShardPool } from './notification-shard.types';
