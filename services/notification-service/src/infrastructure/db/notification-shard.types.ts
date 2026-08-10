import type { Knex } from 'knex';

export interface NotificationDatabaseConnectionConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
}

export interface NotificationShardConfig {
    primary: NotificationDatabaseConnectionConfig;
    /**
    * Optional only because it's absent when NOTIFICATION_READ_REPLICA_ENABLED is
    * false globally. Not a per-shard toggle: when the flag is true, every
    * shard is required to have a replica, or the service fails to start.
    */
    replica?: NotificationDatabaseConnectionConfig;
}

export interface NotificationShardPool {
    primary: Knex;
    /** Undefined unless NOTIFICATION_READ_REPLICA_ENABLED=true. */
    replica?: Knex;
}
