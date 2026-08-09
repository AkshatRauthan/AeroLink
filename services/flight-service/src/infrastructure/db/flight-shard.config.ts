import type { Knex } from 'knex';
import { DbConfig } from '../../config';
import type { FlightDatabaseConnectionConfig, FlightShardConfig } from './flight-shard.types';

export const FLIGHT_SHARD_COUNT = DbConfig.FLIGHT_SHARD_COUNT;
export const FLIGHT_READ_REPLICA_ENABLED = DbConfig.READ_REPLICA_ENABLED;

const toConnectionConfig = (
    config: FlightDatabaseConnectionConfig,
): FlightDatabaseConnectionConfig => ({ ...config });

/**
 * Flight owns this configuration. More shards require only an increased
 * FLIGHT_SHARD_COUNT and a matching FLIGHT_SHARD<n>_* environment block.
 */
export const flightShardConfigs: FlightShardConfig[] = Array.from(
    { length: FLIGHT_SHARD_COUNT },
    (_, shardIndex) => {
        const shard = DbConfig.getFlightShardEnvironment(shardIndex);
        return {
            primary: toConnectionConfig(shard.primary),
            ...(shard.replica ? { replica: toConnectionConfig(shard.replica) } : {}),
        };
    },
);

export const buildFlightKnexConfig = (
    connection: FlightDatabaseConnectionConfig,
): Knex.Config => ({
    client: 'mysql2',
    connection,
    pool: {
        min: 1,
        max: 5,
        acquireTimeoutMillis: 5000,
    },
});
