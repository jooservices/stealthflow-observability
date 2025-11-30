import express from 'express';
import logsRouter from './routes/logs.js';
import healthRouter from './routes/health.js';
import { getRedisClient } from '../infrastructure/logging/redisClient.js';
import { getElasticsearchClient } from '../infrastructure/logging/esClient.js';

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    next();
});

// Routes
app.use('/api/v1/logs', logsRouter);
app.use('/health', healthRouter);

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        service: 'StealthFlow Observability API',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            health: '/health',
            healthDetailed: '/health/detailed',
            submitLog: 'POST /api/v1/logs',
            submitBatch: 'POST /api/v1/logs/batch'
        }
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        path: req.path
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('[API Error]', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        timestamp: new Date().toISOString()
    });
});

// Initialize connections
async function initialize() {
    try {
        console.log('[Server] Initializing connections...');

        // Test Redis
        const redis = getRedisClient();
        await redis.ping();
        console.log('[Server] ✓ Redis connected');

        // Test Elasticsearch
        const es = getElasticsearchClient();
        const health = await es.cluster.health();
        console.log(`[Server] ✓ Elasticsearch connected (${health.status})`);

        console.log('[Server] All connections initialized');
    } catch (error) {
        console.error('[Server] Initialization error:', error);
        console.log('[Server] Continuing anyway (degraded mode)');
    }
}

// Start server
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

initialize().then(() => {
    app.listen(PORT, HOST, () => {
        console.log('='.repeat(60));
        console.log('  StealthFlow Observability API');
        console.log('='.repeat(60));
        console.log(`  Server:      http://${HOST}:${PORT}`);
        console.log(`  Health:      http://${HOST}:${PORT}/health`);
        console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log('='.repeat(60));
    });
});

// Graceful shutdown
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown() {
    console.log('\n[Server] Shutting down gracefully...');

    // Close connections
    const { closeRedisClient } = await import('../infrastructure/logging/redisClient.js');
    const { closeElasticsearchClient } = await import('../infrastructure/logging/esClient.js');

    await closeRedisClient();
    await closeElasticsearchClient();

    console.log('[Server] Shutdown complete');
    process.exit(0);
}

export default app;
