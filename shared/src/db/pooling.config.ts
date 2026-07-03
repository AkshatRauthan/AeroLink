import knex, { type Knex } from 'knex';
import { IShardPool } from "../types";
import { NUM_SHARDS, shardConfigs, buildKnexConfig } from './shards.config';

const pools: IShardPool[] = [];

const createPoolConnection = (conn: ReturnType<typeof buildKnexConfig> extends infer T ? T : never) => {
    const instance = knex(conn);

    // Set innodb_lock_wait_timeout per-connection on creation so a stuck
    // SELECT ... FOR UPDATE fails fast (5s) instead of queuing for the
    // MySQL default of 50s. This directly protects booking throughput. 
    instance.client.pool.on('createSuccess', (_eventId: unknown, resource: any) => {
        resource.query('SET SESSION innodb_lock_wait_timeout = 5');
    });

    return instance;
};

const initPools = () => {
    for (let i = 0; i < NUM_SHARDS; i++) {
        const { primary, replica } = shardConfigs[i];
        pools.push({
            primary: createPoolConnection(buildKnexConfig(primary)),
            replica: createPoolConnection(buildKnexConfig(replica)),
        });
    }
};

initPools();

export const getPool = (shardIndex: number): IShardPool => {
    const pool = pools[shardIndex];
    if (!pool) {
        throw new Error(`No connection pool found for shard index ${shardIndex}`);
    }
    return pool;
};

export const getAllPrimaryPools = (): Knex[] => pools.map((p) => p.primary);

export const closeAllPools = async (): Promise<void> => {
    await Promise.all(pools.flatMap((p) => [p.primary.destroy(), p.replica.destroy()]));
};