import Redis from 'ioredis';

/**
 * Create and configure Redis client
 * @returns {Redis} Configured Redis client
 */
export function createRedisClient() {
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env. REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB) || 0,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    maxRetriesPerRequest: 3,
  });

  redis.on('connect', () => {
    console. log('✅ Redis connected successfully');
  });

  redis.on('error', (err) => {
    console.error('❌ Redis connection error:', err);
  });

  redis.on('close', () => {
    console. log('🔴 Redis connection closed');
  });

  return redis;
}

export default createRedisClient;