// Shared DB code contains mechanics only. Connection topology, shard routing,
// migrations, and repositories belong to the service that owns the data.
export { createKnexClient } from './knex.factory';
export { runTransaction } from './transaction';
