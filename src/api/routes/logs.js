import express from 'express';
import os from 'os';
import { getRedisClient } from '../../infrastructure/logging/redisClient.js';
import { FallbackLogger } from '../../infrastructure/logging/FallbackLogger.js';

const router = express.Router();

// Initialize fallback logger
const fallbackLogger = new FallbackLogger({
    logDir: process.env.FALLBACK_LOG_DIR || './logs/fallback',
    retentionDays: parseInt(process.env.FALLBACK_RETENTION_DAYS || '7')
});

/**
 * Submit single log entry
 * POST /api/v1/logs
 */
router.post('/', async (req, res) => {
    try {
        const { category, operation, metadata = {}, options = {} } = req.body;

        // Basic validation
        if (!category || !operation) {
            return res.status(400).json({
                error: 'category and operation are required'
            });
        }

        // Build log entry
        const logEntry = buildLogEntry(category, operation, metadata, options);

        // Submit to Redis Stream
        await submitToRedis(logEntry);

        res.status(202).json({
            status: 'accepted',
            timestamp: logEntry.timestamp
        });

    } catch (error) {
        console.error('[API] Log submission error:', error);
        res.status(500).json({
            error: 'Failed to submit log',
            message: error.message
        });
    }
});

/**
 * Submit batch of logs
 * POST /api/v1/logs/batch
 */
router.post('/batch', async (req, res) => {
    try {
        const logs = req.body;

        if (!Array.isArray(logs)) {
            return res.status(400).json({ error: 'Body must be array' });
        }

        if (logs.length > 1000) {
            return res.status(400).json({ error: 'Max 1000 logs per batch' });
        }

        // Submit all logs
        const results = await Promise.allSettled(
            logs.map(log => {
                const entry = buildLogEntry(
                    log.category,
                    log.operation,
                    log.metadata || {},
                    log.options || {}
                );
                return submitToRedis(entry);
            })
        );

        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        res.status(202).json({
            status: 'accepted',
            succeeded,
            failed,
            total: logs.length
        });

    } catch (error) {
        console.error('[API] Batch submission error:', error);
        res.status(500).json({
            error: 'Failed to submit batch',
            message: error.message
        });
    }
});

/**
 * Build log entry with proper structure
 */
function buildLogEntry(category, operation, metadata, options) {
    const now = new Date();

    return {
        timestamp: now.toISOString(),
        level: options.level || 'info',
        category,
        operation,

        // Correlation IDs
        workflowId: options.workflowId || null,
        requestId: options.requestId || generateRequestId(),
        nodeName: options.nodeName || 'UnknownNode',
        serviceName: options.serviceName || 'UnknownService',

        // Entity IDs
        accountUID: options.accountUID || metadata.accountUID || null,
        targetUID: options.targetUID || metadata.targetUID || null,

        // Metadata (namespace by category)
        metadata: {
            [category.toLowerCase()]: metadata
        },

        // Runtime
        host: options.host || os.hostname(),
        env: process.env.NODE_ENV || 'local',
        durationMs: options.durationMs || metadata.durationMs || null
    };
}

/**
 * Submit log to Redis Stream with fallback
 */
async function submitToRedis(logEntry) {
    const streamName = process.env.LOG_STREAM_NAME || 'logs:stream';

    try {
        const redis = getRedisClient();
        await redis.xadd(streamName, '*', 'data', JSON.stringify(logEntry));
    } catch (error) {
        console.error('[Redis] Failed to push log entry:', error.message);

        // Fallback to file logging
        await fallbackLogger.logEntry(logEntry);

        throw error; // Re-throw to track failure
    }
}

/**
 * Generate request ID
 */
function generateRequestId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export default router;
