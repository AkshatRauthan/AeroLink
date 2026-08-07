import knex, { type Knex } from 'knex';

/**
 * Creates a Knex client from a service-owned configuration.
 *
 * This module deliberately knows nothing about shards, schemas, replica
 * selection, or domain tables. Those are data-ownership decisions and live
 * in the service that owns the data.
 */
export const createKnexClient = (config: Knex.Config): Knex => knex(config);
