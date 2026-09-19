import Redis from 'ioredis';

/**
 * Generic Redis operations wrapper. Every service goes through an instance
 * of this instead of calling its redis client directly. Domain-specific key
 * names and TTLs stay out of here — that's each service's own concern.
 */

// NOTE: this is a global ambient augmentation — it adds these method
// signatures to the `Redis` type everywhere `@aerolink/shared` is
// imported, regardless of whether that service's client actually went
// through `createCacheManager` (which is what calls `defineCommand` and
// makes these methods exist at runtime). If you see one of these three
// methods type-check on a `redisClient` that was never passed through
// `createCacheManager`, that's why — and it'll throw at runtime, not
// compile time.
declare module 'ioredis' {
    interface Redis {
        hsetWithTtl(key: string, field: string, value: string, ttlSeconds: number): Promise<number>;
        zaddWithTtl(key: string, score: number, member: string, ttlSeconds: number): Promise<number>;
        incrWithWindow(key: string, windowSeconds: number): Promise<number>;
        checkAndEvictLru(key: string, limit: number): Promise<string | null>;
    }
}

// Lua scripts run atomically on the Redis server, so "write + expire"
// can't be split by a crash or dropped connection between the two calls.

const HSET_WITH_TTL = `
redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])
if tonumber(ARGV[3]) > 0 then
  redis.call('EXPIRE', KEYS[1], ARGV[3])
end
return 1
`;

const ZADD_WITH_TTL = `
redis.call('ZADD', KEYS[1], ARGV[1], ARGV[2])
if tonumber(ARGV[3]) > 0 then
  redis.call('EXPIRE', KEYS[1], ARGV[3])
end
return 1
`;

const INCR_WITH_WINDOW = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return count
`;

// Atomically decides AND removes the LRU eviction victim in one round-trip,
// so two concurrent callers can never both read the same "count is at
// limit, victim is X" snapshot and both act on it — Redis executes this
// single-threaded, so the check (ZCARD) and the removal (ZREM) can't be
// interleaved by another client's script. If a second caller runs this
// script microseconds later, it sees the post-removal state and picks a
// different victim (or finds nothing to evict at all) rather than racing
// on the same one. This closes the cache-side race; the DB-side revoke work
// for the returned victim still happens afterward, outside this script,
// since Lua can't reach into MySQL.
const CHECK_AND_EVICT_LRU = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])

local count = redis.call('ZCARD', key)
if count < limit then
  return false
end

local victims = redis.call('ZRANGE', key, 0, 0)
if #victims == 0 then
  return false
end

local victim = victims[1]
redis.call('ZREM', key, victim)
return victim
`;

export const createCacheManager = (redisClient: Redis) => {
    // Register scripts once per client instance so they're cached
    // server-side (EVALSHA) rather than re-sent as source every call.
    redisClient.defineCommand('hsetWithTtl', { numberOfKeys: 1, lua: HSET_WITH_TTL });
    redisClient.defineCommand('zaddWithTtl', { numberOfKeys: 1, lua: ZADD_WITH_TTL });
    redisClient.defineCommand('incrWithWindow', { numberOfKeys: 1, lua: INCR_WITH_WINDOW });
    redisClient.defineCommand('checkAndEvictLru', { numberOfKeys: 1, lua: CHECK_AND_EVICT_LRU });

    return {
        /**
         * Reads a single value stored under `key` (via `set` below) and
         * JSON-parses it back into type T. Use for simple "one key → one
         * value" data — a cached object, a lookup result, a flag, etc.
         * Returns null on a genuine cache miss AND on malformed/corrupted
         * JSON (treated as a miss rather than thrown, so a bad cache entry
         * never crashes the caller — it just falls through to the source
         * of truth).
         */
        async get<T>(key: string): Promise<T | null> {
            const value = await redisClient.get(key);
            if (!value) return null;
            try {
                return JSON.parse(value) as T;
            } catch {
                // Treat malformed cache data as a miss rather than throwing.
                return null;
            }
        },

        /**
         * Writes any JSON-serializable value under `key` with a fixed TTL.
         * Pairs with `get`. `value` can be a primitive, object, or array —
         * whatever `JSON.stringify` can handle. `undefined` is rejected
         * explicitly since it would otherwise silently serialize to the
         * string `"undefined"` rather than failing loudly.
         */
        async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
            if (value === undefined) {
                throw new Error(`cache.set: cannot cache undefined value for key "${key}"`);
            }
            await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
        },

        /**
         * Deletes a key outright, regardless of its underlying Redis type
         * (string, hash, sorted set, etc.). Use this for hard invalidation —
         * e.g. a revoke/logout path where a stale cache entry would be a
         * correctness problem, not just a staleness annoyance.
         */
        async invalidate(key: string): Promise<void> {
            await redisClient.del(key);
        },

        /**
         * Sets (or refreshes) a key's expiry independently of any write.
         * Returns false if the key doesn't exist.
         */
        async expire(key: string, ttlSeconds: number): Promise<boolean> {
            return (await redisClient.expire(key, ttlSeconds)) === 1;
        },

        /**
         * Checks whether a key is present at all, regardless of type or
         * value — doesn't deserialize or return the value itself. Cheaper
         * than `get` when all you need is a yes/no (e.g. "is this sessionId
         * on the blacklist").
         */
        async exists(key: string): Promise<boolean> {
            return (await redisClient.exists(key)) === 1;
        },

        /**
         * Returns seconds remaining before `key` expires.
         */
        async ttl(key: string): Promise<number> {
            // ioredis TTL semantics: -2 = key doesn't exist, -1 = key exists but has no expiry
            return redisClient.ttl(key);
        },

        /**
         * Reads a single field out of a Redis hash stored under `key`. Use
         * hashes for "one entity, many named fields" data — e.g. a session's
         * ipAddress/deviceInfo/lastActiveAt stored as separate fields under
         * one key, so you can update one field without rewriting the rest.
         */
        async hGet(key: string, field: string): Promise<string | null> {
            return redisClient.hget(key, field);
        },

        /**
         * Reads every field of a hash at once, as a plain field→value
         * string map. Use when you need the whole entity rather than one
         * field of it.
         */
        async hGetAll(key: string): Promise<Record<string, string>> {
            return redisClient.hgetall(key);
        },

        /**
         * Writes a single field of a hash, optionally (re)setting the
         * whole key's TTL in the same atomic call.
         *
         * NOTE: ttlSeconds resets the *whole hash's* expiry on every call
         * (Redis TTLs are key-level, not field-level). Repeated calls with a
         * ttl produce sliding-window expiry, not a fixed one. If you need a
         * fixed expiry regardless of later writes, set it once via `expire()`
         * after creating the key, and don't pass ttlSeconds here again.
         */
        async hSet(key: string, field: string, value: string, ttlSeconds?: number): Promise<void> {
            // 0 is a valid explicit "no ttl" — distinct from the old
            // `if (ttlSeconds)` falsy check, which silently skipped ttl=0.
            const ttl = ttlSeconds ?? 0;
            await redisClient.hsetWithTtl(key, field, value, ttl);
        },

        /**
         * Removes a single field from a hash, leaving the rest of the hash
         * (and its TTL) untouched. Doesn't delete the key itself even if
         * this was the last field — use `invalidate` for that.
         */
        async hDel(key: string, field: string): Promise<void> {
            await redisClient.hdel(key, field);
        },

        /**
         * Increments a counter at `key` and, only on the call that first
         * creates the key (count reaches 1), sets it to expire after
         * `windowSeconds`. Every increment after that within the window
         * does NOT extend the expiry — this is a fixed rolling window, not
         * sliding. Use for rate limiting / "N events per window" counting.
         */
        async incrWithWindow(key: string, windowSeconds: number): Promise<number> {
            return redisClient.incrWithWindow(key, windowSeconds);
        },

        /**
         * Adds (or updates) one member of a sorted set with a numeric
         * score, optionally (re)setting the whole key's TTL in the same
         * atomic call. Use sorted sets for "many IDs belonging to one
         * owner, ordered by some numeric value" — e.g. a user's session
         * IDs ordered by lastActiveAt. The member should be an ID/string
         * reference (e.g. sessionId), never a full object — scores must be
         * numeric, so full objects can't be stored as members if you want
         * to sort/range over them.
         *
         * NOTE: ttlSeconds resets the *whole key's* expiry on every call —
         * a sorted set lives under one Redis key, so this has the same
         * sliding-vs-fixed-expiry caveat as hSet above.
         */
        async zAdd(key: string, score: number, member: string, ttlSeconds?: number): Promise<void> {
            const ttl = ttlSeconds ?? 0;
            await redisClient.zaddWithTtl(key, score, member, ttl);
        },

        /**
         * Returns members of a sorted set between `start` and `stop`
         * (inclusive, 0-indexed), ordered ascending by score. Defaults to
         * the whole set. Since it's ascending, `zRange(key, 0, 0)` gives
         * you the single lowest-scored member — e.g. the oldest/least-
         * recently-active session, useful for LRU-style eviction.
         */
        async zRange(key: string, start = 0, stop = -1): Promise<string[]> {
            return redisClient.zrange(key, start, stop);
        },

        /**
         * Removes a single member from a sorted set. Returns the number of
         * members actually removed (0 if it wasn't present — not an error).
         * This is the "pull one session out of the set" primitive — use it
         * directly, or via `pull()` below if you prefer the mongo-styled name.
         */
        async zRem(key: string, member: string): Promise<number> {
            return redisClient.zrem(key, member);
        },

        /**
         * Returns a member's score, or null if the member isn't in the set.
         * Doubles as an O(log n) existence check — e.g. "is this sessionId
         * still active for this user" — without pulling the whole set back
         * and scanning it client-side.
         */
        async zScore(key: string, member: string): Promise<number | null> {
            const score = await redisClient.zscore(key, member);
            return score === null ? null : Number(score);
        },

        /**
         * Cardinality of the sorted set — e.g. how many active sessions a
         * user currently has. Check this before a write that's gated by a
         * limit (max concurrent sessions), so the eviction decision is made
         * against a fresh count rather than an assumed one.
         */
        async zCard(key: string): Promise<number> {
            return redisClient.zcard(key);
        },

        /**
         * Mongo-styled alias over zAdd — "push a member into the set" with a
         * score (e.g. lastActiveAt) and optional key-level ttl. Same
         * sliding-expiry caveat as zAdd/hSet applies.
         */
        async push(key: string, member: string, score: number, ttlSeconds?: number): Promise<void> {
            const ttl = ttlSeconds ?? 0;
            await redisClient.zaddWithTtl(key, score, member, ttl);
        },

        /**
         * Mongo-styled alias over zRem — "pull a member out of the set".
         * Returns the number removed (0 if it was already gone).
         */
        async pull(key: string, member: string): Promise<number> {
            return redisClient.zrem(key, member);
        },

        /**
         * Atomically checks whether a sorted set is at/over `limit` and, if
         * so, removes and returns its lowest-scored member (the LRU victim)
         * in the same Redis-side operation — closing the race where two
         * concurrent callers both read the same "at capacity, victim is X"
         * snapshot from separate zCard/zRange calls and both act on it.
         * Returns null if under the limit or the set is empty (nothing to
         * evict). The caller still owns any DB-side cleanup for the
         * returned victim (revoking tokens, the session row, blacklisting)
         * — this only handles the cache-side decision+removal atomically.
         */
        async checkAndEvictLru(key: string, limit: number): Promise<string | null> {
            const victim = await redisClient.checkAndEvictLru(key, limit);
            return victim || null;
        },
    };
};

export type CacheManager = ReturnType<typeof createCacheManager>;