import Redis from 'ioredis';

let redisClient = null;

/**
 * Get singleton Redis client
 * @returns {Redis} Redis client instance
 */
export function getRedisClient() {
    if (!redisClient) {
        const config = {
            host: process.env.REDIS_HOST || '192.168.1.13',
            port: parseInt(process.env.REDIS_PORT || '6380'),
            password: process.env.REDIS_PASSWORD,
            db: parseInt(process.env.REDIS_DB || '0'),

            // Connection pool
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            enableOfflineQueue: true,

            // Reconnect strategy
            retryStrategy: (times) => {
                if (times > 10) {
                    console.error('[Redis] Max reconnection attempts reached');
                    return null;
                }
                const delay = Math.min(times * 100, 3000);
                console.log(`[Redis] Reconnecting in ${delay}ms (attempt ${times})`);
                return delay;
            },

            // Timeouts
            connectTimeout: 10000,
            commandTimeout: 5000
        };

        redisClient = new Redis(config);

        // Event handlers
        redisClient.on('connect', () => {
            console.log('[Redis] Connected');
        });

        redisClient.on('ready', () => {
            console.log('[Redis] Ready');
        });

        redisClient.on('error', (err) => {
            console.error('[Redis] Error:', err.message);
        });

        redisClient.on('close', () => {
            console.warn('[Redis] Connection closed');
        });

        redisClient.on('reconnecting', () => {
            console.log('[Redis] Reconnecting...');
        });
    }

    return redisClient;
}

/**
 * Close Redis connection
 */
export async function closeRedisClient() {
    if (redisClient) {
        await redisClient.quit();
        redisClient = null;
        console.log('[Redis] Connection closed gracefully');
    }
}
