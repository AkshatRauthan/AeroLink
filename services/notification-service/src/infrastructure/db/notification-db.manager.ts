import knex, { Knex } from 'knex';


import { CustomError } from "@aerolink/shared";
import { StatusCodes } from 'http-status-codes';
import { NotificationShardPool } from './notification-shard.types';
import { buildNotificationKnexConfig, NOTIFICATION_READ_REPLICA_ENABLED, NOTIFICATION_SHARD_COUNT, notificationShardConfigs } from './notification-shard.config';

const pools: NotificationShardPool[] = notificationShardConfigs.map(({ primary, replica }) => ({
    primary: knex(buildNotificationKnexConfig(primary)),
    ...(NOTIFICATION_READ_REPLICA_ENABLED && replica ? { replica: knex(buildNotificationKnexConfig(replica)) } : {}),
}));

/** Returns Notification Service's pool pair for an already-resolved shard. */
export const getNotificationShardPool = (shardIndex: number): NotificationShardPool => {
    if (!Number.isInteger(shardIndex) || shardIndex < 0 || shardIndex >= NOTIFICATION_SHARD_COUNT) {
        throw new CustomError(`Invalid Notification shard index: ${shardIndex}`, StatusCodes.BAD_REQUEST, true);
    }
    return pools[shardIndex];
};

/**
 * Selects the read target for stale-tolerant Notification queries. When replicas are
 * disabled, or a replica was not configured, this safely resolves to primary.
 */
export const getNotificationReadPool = (shardIndex: number): Knex => {
    const { primary, replica } = getNotificationShardPool(shardIndex);
    return NOTIFICATION_READ_REPLICA_ENABLED && replica ? replica : primary;
};

/** Used only by Notification Service's migration runner. Replicas are never migrated directly. */
export const getAllNotificationPrimaryPools = (): Knex[] => pools.map(({ primary }) => primary);

/**
 * Verifies every Notification pool (primary, and replica if configured) can
 * actually connect, by running a real query against each. Knex connections
 * are lazy, so without this a bad primary/replica config would only surface
 * on the first real request rather than at boot. Call once during service
 * startup, before accepting traffic; throws if any primary or any replica
 * fails, since replicas are all-or-nothing when enabled.
 */
export const connectNotificationDatabases = async (): Promise<void> => {
    const checks = pools.flatMap(({ primary, replica }, shardIndex) => [
        primary.raw('SELECT 1').catch((error) => {
            throw new CustomError(`Notification shard ${shardIndex} primary is unreachable: ${error.message}`, StatusCodes.NOT_FOUND, false);
        }),
        ...(replica
            ? [
                replica.raw('SELECT 1').catch((error) => {
                    throw new CustomError(`Notification shard ${shardIndex} replica is unreachable: ${error.message}`, StatusCodes.NOT_FOUND, false);
                }),
            ]
            : []),
    ]);

    const results = await Promise.allSettled(checks);
    const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');

    if (failures.length > 0) {
        const messages = failures.map(({ reason }) => (reason instanceof Error ? reason.message : String(reason)));
        throw new CustomError(`Notification database connectivity check failed:\n${messages.join('\n')}`, StatusCodes.INTERNAL_SERVER_ERROR, false);
    }
};

export const closeNotificationDatabaseConnections = async (): Promise<void> => {
    await Promise.all(pools.flatMap(({ primary, replica }) => [primary.destroy(), ...(replica ? [replica.destroy()] : [])]));
};