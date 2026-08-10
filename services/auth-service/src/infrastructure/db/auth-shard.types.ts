import type { Knex } from 'knex';

export interface AuthDatabaseConnectionConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
}

export interface AuthShardConfig {
    primary: AuthDatabaseConnectionConfig;
    /**
    * Optional only because it's absent when AUTH_READ_REPLICA_ENABLED is
    * false globally. Not a per-shard toggle: when the flag is true, every
    * shard is required to have a replica, or the service fails to start.
    */
    replica?: AuthDatabaseConnectionConfig;
}

export interface AuthShardPool {
    primary: Knex;
    /** Undefined unless AUTH_READ_REPLICA_ENABLED=true. */
    replica?: Knex;
}
