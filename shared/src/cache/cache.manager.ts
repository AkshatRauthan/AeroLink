import { redisClient } from './redis.config';

/**
 * Every service must go through CacheManager instead of calling redisClient
 * directly. This is the single place to add logging, metrics, or error
 * handling for cache operations across the whole app.
 */
const CacheManager = {
    // ---- String (JSON) operations ----

    async get<T>(key: string): Promise<T | null> {
        const value = await redisClient.get(key);
        if (!value) return null;
        return JSON.parse(value) as T;
    },

    async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
        await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    },

    async invalidate(key: string): Promise<void> {
        await redisClient.del(key);
    },

    // ---- Hash operations (e.g. per-seat availability within a flight) ----

    async hGet(key: string, field: string): Promise<string | null> {
        return redisClient.hget(key, field);
    },

    async hGetAll(key: string): Promise<Record<string, string>> {
        return redisClient.hgetall(key);
    },

    async hSet(key: string, field: string, value: string, ttlSeconds?: number): Promise<void> {
        await redisClient.hset(key, field, value);
        if (ttlSeconds) await redisClient.expire(key, ttlSeconds);
    },

    async hDel(key: string, field: string): Promise<void> {
        await redisClient.hdel(key, field);
    },

    // ---- Counter operations (rate limiting) ----

    /**
     * Atomically increments a counter and sets TTL only on first increment
     * (so the window doesn't keep extending on every request).
     */
    async incrWithWindow(key: string, windowSeconds: number): Promise<number> {
        const count = await redisClient.incr(key);
        if (count === 1) {
            await redisClient.expire(key, windowSeconds);
        }
        return count;
    },

    // ---- Sorted set operations (e.g. booking history ordered by time) ----

    async zAdd(key: string, score: number, member: string, ttlSeconds?: number): Promise<void> {
        await redisClient.zadd(key, score, member);
        if (ttlSeconds) await redisClient.expire(key, ttlSeconds);
    },

    async zRange(key: string, start = 0, stop = -1): Promise<string[]> {
        return redisClient.zrange(key, start, stop);
    },
};

export default CacheManager;