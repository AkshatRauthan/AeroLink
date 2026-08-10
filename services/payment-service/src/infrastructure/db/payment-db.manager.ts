import knex, { Knex } from 'knex';

import { CustomError } from "@aerolink/shared";
import { StatusCodes } from 'http-status-codes';
import type { PaymentShardPool } from './payment-shard.types';
import { buildPaymentKnexConfig, PAYMENT_READ_REPLICA_ENABLED, PAYMENT_SHARD_COUNT, paymentShardConfigs } from './payment-shard.config';

const pools: PaymentShardPool[] = paymentShardConfigs.map(({ primary, replica }) => ({
    primary: knex(buildPaymentKnexConfig(primary)),
    ...(PAYMENT_READ_REPLICA_ENABLED && replica ? { replica: knex(buildPaymentKnexConfig(replica)) } : {}),
}));

/** Returns Payment Service's pool pair for an already-resolved shard. */
export const getPaymentShardPool = (shardIndex: number): PaymentShardPool => {
    if (!Number.isInteger(shardIndex) || shardIndex < 0 || shardIndex >= PAYMENT_SHARD_COUNT) {
        throw new CustomError(`Invalid Payment shard index: ${shardIndex}`, StatusCodes.BAD_REQUEST, true);
    }
    return pools[shardIndex];
};

/**
 * Selects the read target for stale-tolerant Payment queries. When replicas are
 * disabled, or a replica was not configured, this safely resolves to primary.
 */
export const getPaymentReadPool = (shardIndex: number): Knex => {
    const { primary, replica } = getPaymentShardPool(shardIndex);
    return PAYMENT_READ_REPLICA_ENABLED && replica ? replica : primary;
};

/** Used only by Payment Service's migration runner. Replicas are never migrated directly. */
export const getAllPaymentPrimaryPools = (): Knex[] => pools.map(({ primary }) => primary);

/**
 * Verifies every Payment pool (primary, and replica if configured) can
 * actually connect, by running a real query against each. Knex connections
 * are lazy, so without this a bad primary/replica config would only surface
 * on the first real request rather than at boot. Call once during service
 * startup, before accepting traffic; throws if any primary or any replica
 * fails, since replicas are all-or-nothing when enabled.
 */
export const connectPaymentDatabases = async (): Promise<void> => {
    const checks = pools.flatMap(({ primary, replica }, shardIndex) => [
        primary.raw('SELECT 1').catch((error) => {
            throw new CustomError(`Payment shard ${shardIndex} primary is unreachable: ${error.message}`, StatusCodes.NOT_FOUND, false);
        }),
        ...(replica
            ? [
                replica.raw('SELECT 1').catch((error) => {
                    throw new CustomError(`Payment shard ${shardIndex} replica is unreachable: ${error.message}`, StatusCodes.NOT_FOUND, false);
                }),
            ]
            : []),
    ]);

    const results = await Promise.allSettled(checks);
    const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');

    if (failures.length > 0) {
        const messages = failures.map(({ reason }) => (reason instanceof Error ? reason.message : String(reason)));
        throw new CustomError(`Payment database connectivity check failed:\n${messages.join('\n')}`, StatusCodes.INTERNAL_SERVER_ERROR, false);
    }
};

export const closePaymentDatabaseConnections = async (): Promise<void> => {
    await Promise.all(pools.flatMap(({ primary, replica }) => [primary.destroy(), ...(replica ? [replica.destroy()] : [])]));
};