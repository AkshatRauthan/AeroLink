import Redis, { RedisOptions } from 'ioredis';

/**
 * Generic Redis client factory. Each service builds its own client from its
 * own env-driven config — shared only owns consistent wiring (timeouts,
 * retry strategy, logging), not connection details or key patterns.
 */
export const createRedisClient = (options: RedisOptions, label = 'redis'): Redis => {
    const client = new Redis({
        connectTimeout: 5000,
        maxRetriesPerRequest: 2,
        retryStrategy: (times) => Math.min(times * 200, 2000),
        ...options,
    });

    client.on('error', (err) => console.error(`[${label}] connection error:`, err.message));
    client.on('connect', () => console.log(`[${label}] connected`));

    return client;
};

/** Verifies a Redis client is reachable — for startup healthchecks, mirrors connectFlightDatabases. */
export const pingRedis = async (client: Redis, label = 'redis'): Promise<void> => {
    try {
        await client.ping();
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`${label} is unreachable: ${message}`);
    }
};