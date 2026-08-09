export { getAuthReadPool, getAuthShardPool, getAllAuthPrimaryPools, closeAuthDatabaseConnections } from './auth-db.manager';
export { getAuthReadDatabase, getAuthShard, getAuthShardIndex } from './auth-shard.router';
export { AUTH_READ_REPLICA_ENABLED, AUTH_SHARD_COUNT } from './auth-shard.config';
export type { AuthDatabaseConnectionConfig, AuthShardConfig, AuthShardPool } from './auth-shard.types';
