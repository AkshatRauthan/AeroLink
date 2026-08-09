import type { Knex } from 'knex';

export interface PaymentDatabaseConnectionConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
}

export interface PaymentShardConfig {
    primary: PaymentDatabaseConnectionConfig;
    /**
    * Optional only because it's absent when PAYMENT_READ_REPLICA_ENABLED is
    * false globally. Not a per-shard toggle: when the flag is true, every
    * shard is required to have a replica, or the service fails to start.
    */
    replica?: PaymentDatabaseConnectionConfig;
}

export interface PaymentShardPool {
    primary: Knex;
    /** Undefined unless PAYMENT_READ_REPLICA_ENABLED=true. */
    replica?: Knex;
}
