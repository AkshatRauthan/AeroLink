import type { Knex } from 'knex';

export interface BookingDatabaseConnectionConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
}

export interface BookingShardConfig {
    primary: BookingDatabaseConnectionConfig;
    replica?: BookingDatabaseConnectionConfig;
}

export interface BookingShardPool {
    primary: Knex;
    replica?: Knex;
}
