import type { Knex } from 'knex';
import { DbConfig } from '../../config';
import type { AuthDatabaseConnectionConfig, AuthShardConfig } from './auth-shard.types';

export const AUTH_SHARD_COUNT = DbConfig.AUTH_SHARD_COUNT;
export const AUTH_READ_REPLICA_ENABLED = DbConfig.READ_REPLICA_ENABLED;

const toConnectionConfig = (
    config: AuthDatabaseConnectionConfig,
): AuthDatabaseConnectionConfig => ({ ...config });

/**
 * Auth owns this configuration. More shards require only an increased
 * AUTH_SHARD_COUNT and a matching AUTH_SHARD<n>_* environment block.
 */
export const authShardConfigs: AuthShardConfig[] = Array.from(
    { length: AUTH_SHARD_COUNT },
    (_, shardIndex) => {
        const shard = DbConfig.getAuthShardEnvironment(shardIndex);
        return {
            primary: toConnectionConfig(shard.primary),
            ...(shard.replica ? { replica: toConnectionConfig(shard.replica) } : {}),
        };
    },
);

export const buildAuthKnexConfig = (
    connection: AuthDatabaseConnectionConfig,
): Knex.Config => ({
    client: 'mysql2',
    connection,
    pool: {
        min: 1,
        max: 5,
        acquireTimeoutMillis: 5000,
    },
});
