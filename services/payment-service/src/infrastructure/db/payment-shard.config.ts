import type { Knex } from 'knex';
import { DbConfig } from '../../config';
import type { PaymentDatabaseConnectionConfig, PaymentShardConfig } from './payment-shard.types';

export const PAYMENT_SHARD_COUNT = DbConfig.PAYMENT_SHARD_COUNT;
export const PAYMENT_READ_REPLICA_ENABLED = DbConfig.READ_REPLICA_ENABLED;

const toConnectionConfig = (
    config: PaymentDatabaseConnectionConfig,
): PaymentDatabaseConnectionConfig => ({ ...config });

/**
 * Payment owns this configuration. More shards require only an increased
 * PAYMENT_SHARD_COUNT and a matching PAYMENT_SHARD<n>_* environment block.
 */
export const paymentShardConfigs: PaymentShardConfig[] = Array.from(
    { length: PAYMENT_SHARD_COUNT },
    (_, shardIndex) => {
        const shard = DbConfig.getPaymentShardEnvironment(shardIndex);
        return {
            primary: toConnectionConfig(shard.primary),
            ...(shard.replica ? { replica: toConnectionConfig(shard.replica) } : {}),
        };
    },
);

export const buildPaymentKnexConfig = (
    connection: PaymentDatabaseConnectionConfig,
): Knex.Config => ({
    client: 'mysql2',
    connection,
    pool: {
        min: 1,
        max: 5,
        acquireTimeoutMillis: 5000,
    },
});
