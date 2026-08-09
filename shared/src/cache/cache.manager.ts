import type Redis from 'ioredis';

/**
 * Generic Redis operations wrapper. Every service goes through an instance
 * of this instead of calling its redis client directly. Domain-specific key
 * names and TTLs stay out of here — that's each service's own concern.
 */
export const createCacheManager = (redisClient: Redis) => ({
    async get<T>(key: string): Promise<T | null> {
        const value = await redisClient.get(key);
        return value ? (JSON.parse(value) as T) : null;
    },
    async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
        await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    },
    async invalidate(key: string): Promise<void> {
        await redisClient.del(key);
    },
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
    async incrWithWindow(key: string, windowSeconds: number): Promise<number> {
        const count = await redisClient.incr(key);
        if (count === 1) await redisClient.expire(key, windowSeconds);
        return count;
    },
    async zAdd(key: string, score: number, member: string, ttlSeconds?: number): Promise<void> {
        await redisClient.zadd(key, score, member);
        if (ttlSeconds) await redisClient.expire(key, ttlSeconds);
    },
    async zRange(key: string, start = 0, stop = -1): Promise<string[]> {
        return redisClient.zrange(key, start, stop);
    },
});

export type CacheManager = ReturnType<typeof createCacheManager>;