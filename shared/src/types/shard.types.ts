import { type Knex } from "knex";

export interface IShardConnectionConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
}

export interface IShardConfig {
    primary: IShardConnectionConfig;
    replica: IShardConnectionConfig;
}

export interface IShardPool {
    primary: Knex;
    replica: Knex;
}
