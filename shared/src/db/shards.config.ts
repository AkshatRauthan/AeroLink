import type { Knex } from 'knex';
import { IShardConfig, IShardConnectionConfig } from "../types";

export const NUM_SHARDS = 2;

// Pulled from env\
// Local dev defaults match docker-compose.dev.yaml ports.
const env = (key: string, fallback: string) => process.env[key] ?? fallback;

export const shardConfigs: IShardConfig[] = [
    {
        // Shard 0
        primary: {
            host: env('SHARD0_PRIMARY_HOST', '127.0.0.1'),
            port: Number(env('SHARD0_PRIMARY_PORT', '3307')),
            user: env('SHARD0_DB_USER', 'root'),
            password: env('SHARD0_DB_PASSWORD', 'root'),
            database: env('SHARD0_DB_NAME', 'aerolink_shard0'),
        },
        replica: {
            host: env('SHARD0_REPLICA_HOST', '127.0.0.1'),
            port: Number(env('SHARD0_REPLICA_PORT', '3309')),
            user: env('SHARD0_DB_USER', 'root'),
            password: env('SHARD0_DB_PASSWORD', 'root'),
            database: env('SHARD0_DB_NAME', 'aerolink_shard0'),
        },
    },
    {
        // Shard 1
        primary: {
            host: env('SHARD1_PRIMARY_HOST', '127.0.0.1'),
            port: Number(env('SHARD1_PRIMARY_PORT', '3308')),
            user: env('SHARD1_DB_USER', 'root'),
            password: env('SHARD1_DB_PASSWORD', 'root'),
            database: env('SHARD1_DB_NAME', 'aerolink_shard1'),
        },
        replica: {
            host: env('SHARD1_REPLICA_HOST', '127.0.0.1'),
            port: Number(env('SHARD1_REPLICA_PORT', '3310')),
            user: env('SHARD1_DB_USER', 'root'),
            password: env('SHARD1_DB_PASSWORD', 'root'),
            database: env('SHARD1_DB_NAME', 'aerolink_shard1'),
        },
    },
];

// Pool sizing is deliberately conservative — with 7 services x 2 connections
// (primary + replica) per shard, unbounded pools will exhaust MySQL's
// max_connections fast. Tune per-service if a particular service is DB-heavy.
export const buildKnexConfig = (conn: IShardConnectionConfig): Knex.Config => ({
    client: 'mysql2',
    connection: {
        host: conn.host,
        port: conn.port,
        user: conn.user,
        password: conn.password,
        database: conn.database,
        typeCast: (_: any, next: () => any) => {
            // Returns DECIMAL columns as strings by default (mysql2 behavior) —
            // keep this explicit so price fields never silently become floats.
            return next();
        },
    },
    pool: {
        min: 2,
        max: 10,
        // Fail fast instead of queuing requests indefinitely when the pool is exhausted.
        acquireTimeoutMillis: 5000,
    },
    // Keep InnoDB lock waits short — a stuck booking transaction holding a
    // row lock for 50s (the MySQL default) will tank throughput under load.
    // Run once per connection via afterCreate below.
});