import express from 'express';
import { getRedisClient } from '../../infrastructure/logging/redisClient.js';
import { getElasticsearchClient } from '../../infrastructure/logging/esClient.js';

const router = express.Router();

/**
 * Basic health check
 * GET /health
 */
router.get('/', async (req, res) => {
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        connections: {
            redis: await checkRedis(),
            elasticsearch: await checkElasticsearch()
        }
    };

    const allHealthy = Object.values(health.connections)
        .every(c => c.status === 'ok');

    health.status = allHealthy ? 'healthy' : 'degraded';

    const statusCode = allHealthy ? 200 : 503;
    res.status(statusCode).json(health);
});

/**
 * Detailed health diagnostics
 * GET /health/detailed
 */
router.get('/detailed', async (req, res) => {
    const redis = getRedisClient();
    const es = getElasticsearchClient();

    const detailed = {
        timestamp: new Date().toISOString(),
        system: {
            memory: process.memoryUsage(),
            cpu: process.cpuUsage(),
            uptime: process.uptime(),
            pid: process.pid
        },
        redis: {
            status: redis.status,
            streamLength: await redis.xlen('logs:stream').catch(() => 'N/A'),
            dlqLength: await redis.xlen('logs:failed').catch(() => 'N/A')
        },
        elasticsearch: {
            cluster: await es.cluster.health().catch(err => ({ error: err.message })),
            indexStats: await getIndexStats(es).catch(err => ({ error: err.message }))
        },
        environment: {
            nodeEnv: process.env.NODE_ENV,
            logIndexAlias: process.env.LOG_INDEX_ALIAS
        }
    };

    res.json(detailed);
});

/**
 * Check Redis health
 */
async function checkRedis() {
    try {
        const redis = getRedisClient();
        const start = Date.now();
        await redis.ping();
        const latency = Date.now() - start;

        return { status: 'ok', latency };
    } catch (error) {
        return { status: 'error', error: error.message };
    }
}

/**
 * Check Elasticsearch health
 */
async function checkElasticsearch() {
    try {
        const es = getElasticsearchClient();
        const health = await es.cluster.health();

        return {
            status: health.status === 'red' ? 'error' : 'ok',
            clusterStatus: health.status,
            numberOfNodes: health.number_of_nodes
        };
    } catch (error) {
        return { status: 'error', error: error.message };
    }
}

/**
 * Get index statistics
 */
async function getIndexStats(es) {
    const indexName = process.env.LOG_INDEX_ALIAS || 'stealthflow_develop_logs';

    try {
        const stats = await es.indices.stats({ index: indexName });
        const indexStats = stats.indices[indexName];

        if (!indexStats) {
            return { error: 'Index not found' };
        }

        return {
            docCount: indexStats.primaries?.docs?.count || 0,
            sizeBytes: indexStats.primaries?.store?.size_in_bytes || 0,
            sizeMB: Math.round((indexStats.primaries?.store?.size_in_bytes || 0) / 1024 / 1024)
        };
    } catch (error) {
        return { error: error.message };
    }
}

export default router;
