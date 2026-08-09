import type { Knex } from 'knex';

export interface FlightDatabaseConnectionConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
}

export interface FlightShardConfig {
    primary: FlightDatabaseConnectionConfig;
    /**
    * Optional only because it's absent when FLIGHT_READ_REPLICA_ENABLED is
    * false globally. Not a per-shard toggle: when the flag is true, every
    * shard is required to have a replica, or the service fails to start.
    */
    replica?: FlightDatabaseConnectionConfig;
}

export interface FlightShardPool {
    primary: Knex;
    /** Undefined unless FLIGHT_READ_REPLICA_ENABLED=true. */
    replica?: Knex;
}
