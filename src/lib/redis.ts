import Redis from 'ioredis';
// @ts-ignore
import RedisMock from 'ioredis-mock';

const globalForRedis = global as unknown as { redis: Redis };

const getRedisClient = () => {
    if (process.env.REDIS_URL) {
        console.log('Redis: Connecting to', process.env.REDIS_URL);
        return new Redis(process.env.REDIS_URL);
    }

    // Fallback for local development without Redis
    if (process.env.NODE_ENV === 'development') {
        console.warn("⚠️  Redis: No REDIS_URL found. Using in-memory mock. Data will be lost on restart.");
        return new RedisMock();
    }

    // Default to localhost in production if undefined (or maybe throw error?)
    return new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
};

export const redis =
    globalForRedis.redis ||
    getRedisClient();

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;
