import { createHash } from 'crypto';
import { getPaymentReadPool, getPaymentShardPool } from './payment-db.manager';
import { PAYMENT_SHARD_COUNT } from './payment-shard.config';

/**
 * Future-proof routing for Payment Service. With one shard every payment maps to
 * shard zero; increasing PAYMENT_SHARD_COUNT makes the same deterministic hash
 * route payments across the configured shard set.
 */
export const getPaymentShardIndex = (paymentId: string): number => {
    const hash = createHash('md5').update(paymentId).digest('hex');
    return parseInt(hash.slice(0, 8), 16) % PAYMENT_SHARD_COUNT;
};

export const getPaymentShard = (paymentId: string) =>
    getPaymentShardPool(getPaymentShardIndex(paymentId));

/** Use only for stale-tolerant Payment reads such as search or browse queries. */
export const getPaymentReadDatabase = (paymentId: string) =>
    getPaymentReadPool(getPaymentShardIndex(paymentId));
