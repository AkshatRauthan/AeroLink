import Redis from 'ioredis';

const env = (key: string, fallback: string) => process.env[key] ?? fallback;

const redisClient = new Redis({
    host: env('REDIS_HOST', '127.0.0.1'),
    port: Number(env('REDIS_PORT', '6379')),
    connectTimeout: 5000,
    maxRetriesPerRequest: 2,
    retryStrategy: (times) => Math.min(times * 200, 2000),
});

redisClient.on('error', (err) => {
    console.error('[redis] connection error:', err.message);
});

redisClient.on('connect', () => {
    console.log('[redis] connected');
});

export {
    redisClient
};