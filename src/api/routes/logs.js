import express from 'express';
import os from 'os';
import crypto from 'crypto';
import { getRedisClient } from '../../infrastructure/logging/redisClient.js';
import { FallbackLogger } from '../../infrastructure/logging/FallbackLogger.js';

const router = express.Router();

// Initialize fallback logger
const fallbackLogger = new FallbackLogger({
    logDir: process.env.FALLBACK_LOG_DIR || './logs/fallback',
    retentionDays: parseInt(process.env.FALLBACK_RETENTION_DAYS || '7')
});

// Valid log levels
const VALID_LEVELS = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];

// Valid kinds
const VALID_KINDS = ['BUSINESS', 'SYSTEM', 'ANALYTICS', 'AUDIT', 'SECURITY'];

// Valid environments
const VALID_ENVIRONMENTS = ['local', 'dev', 'development', 'staging', 'production'];

/**
 * Submit single log entry
 * POST /api/v1/logs
 * 
 * Supports both new format (schema_version) and legacy format (backward compatibility)
 */
router.post('/', async (req, res) => {
    try {
        const body = req.body;

        // Check if new format (has schema_version)
        if (body.schema_version) {
            // Validate new format
            const validation = validateNewFormat(body);
            if (!validation.valid) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: validation.errors
                });
            }

            // Build log entry (new format)
            const logEntry = buildLogEntryNewFormat(body);
            await submitToRedis(logEntry);

            return res.status(202).json({
                status: 'accepted',
                log_id: logEntry.log_id,
                timestamp: logEntry.timestamp
            });
        } else {
            // Legacy format (backward compatibility)
            const { category, operation, metadata = {}, options = {} } = body;

            if (!category || !operation) {
                return res.status(400).json({
                    error: 'category and operation are required (or use new format with schema_version)'
                });
            }

            const logEntry = buildLogEntryLegacy(category, operation, metadata, options);
            await submitToRedis(logEntry);

            return res.status(202).json({
                status: 'accepted',
                timestamp: logEntry.timestamp
            });
        }

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
                if (log.schema_version) {
                    const validation = validateNewFormat(log);
                    if (!validation.valid) {
                        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
                    }
                    const entry = buildLogEntryNewFormat(log);
                    return submitToRedis(entry);
                } else {
                    // Legacy format
                    const entry = buildLogEntryLegacy(
                        log.category,
                        log.operation,
                        log.metadata || {},
                        log.options || {}
                    );
                    return submitToRedis(entry);
                }
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
 * Validate new format log entry
 * @param {Object} body - Request body
 * @returns {Object} Validation result
 */
function validateNewFormat(body) {
    const errors = [];
    const required = [
        'schema_version',
        'log_id',
        'timestamp',
        'level',
        'service',
        'environment',
        'kind',
        'category',
        'event',
        'message'
    ];

    // Check required fields
    for (const field of required) {
        if (body[field] === undefined || body[field] === null || body[field] === '') {
            errors.push(`Field '${field}' is required`);
        }
    }

    // Validate schema_version
    if (body.schema_version !== 1) {
        errors.push(`schema_version must be 1 (got ${body.schema_version})`);
    }

    // Validate log_id format (UUID-4)
    if (body.log_id) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(body.log_id)) {
            errors.push(`log_id must be a valid UUID-4 format`);
        }
    }

    // Validate level
    if (body.level && !VALID_LEVELS.includes(body.level.toUpperCase())) {
        errors.push(`level must be one of: ${VALID_LEVELS.join(', ')}`);
    }

    // Validate kind
    if (body.kind && !VALID_KINDS.includes(body.kind.toUpperCase())) {
        errors.push(`kind must be one of: ${VALID_KINDS.join(', ')}`);
    }

    // Validate environment
    if (body.environment && !VALID_ENVIRONMENTS.includes(body.environment.toLowerCase())) {
        errors.push(`environment must be one of: ${VALID_ENVIRONMENTS.join(', ')}`);
    }

    // Validate timestamp format (ISO 8601)
    if (body.timestamp) {
        const date = new Date(body.timestamp);
        if (isNaN(date.getTime())) {
            errors.push(`timestamp must be a valid ISO 8601 date string`);
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Build log entry in new format
 * @param {Object} body - Validated request body
 * @returns {Object} Log entry
 */
function buildLogEntryNewFormat(body) {
    const now = new Date();

    return {
        schema_version: body.schema_version || 1,
        log_id: body.log_id || generateUUID(),
        timestamp: body.timestamp || now.toISOString(),
        level: body.level.toUpperCase(),
        service: body.service,
        environment: body.environment.toLowerCase(),
        kind: body.kind.toUpperCase(),
        category: body.category,
        event: body.event,
        message: body.message,

        // Optional fields
        trace: body.trace || null,
        context: body.context || {},
        payload: body.payload || {},
        host: body.host || {
            hostname: os.hostname(),
            ip: getLocalIP()
        },
        tags: body.tags || [],
        extra: body.extra || {},
        tenant_id: body.tenant_id || null
    };
}

/**
 * Build log entry in legacy format (backward compatibility)
 * @param {string} category 
 * @param {string} operation 
 * @param {Object} metadata 
 * @param {Object} options 
 * @returns {Object} Log entry
 */
function buildLogEntryLegacy(category, operation, metadata, options) {
    const now = new Date();

    // Infer kind from category (for backward compatibility)
    let kind = 'SYSTEM';
    const catUpper = category.toUpperCase();
    if (catUpper === 'BUSINESS' || catUpper.startsWith('BUSINESS')) {
        kind = 'BUSINESS';
    } else if (catUpper === 'ANALYTICS' || catUpper.startsWith('ANALYTICS')) {
        kind = 'ANALYTICS';
    }

    // Map old format to new format structure
    return {
        schema_version: 1,
        log_id: generateUUID(),
        timestamp: now.toISOString(),
        level: (options.level || 'INFO').toUpperCase(),
        service: options.serviceName || 'UnknownService',
        environment: (process.env.NODE_ENV || 'local').toLowerCase(),
        kind: kind,
        category: category,
        event: operation,
        message: options.message || `${operation} in ${category}`,

        // Map legacy fields
        trace: options.trace || (options.workflowId ? {
            trace_id: options.workflowId,
            span_id: options.requestId || generateRequestId(),
            parent_span_id: null
        } : null),
        context: {
            ...metadata,
            requestId: options.requestId || generateRequestId(),
            nodeName: options.nodeName || 'UnknownNode',
            accountUID: options.accountUID || metadata.accountUID || null,
            targetUID: options.targetUID || metadata.targetUID || null
        },
        payload: {
            durationMs: options.durationMs || metadata.durationMs || null
        },
        host: {
            hostname: options.host || os.hostname(),
            ip: getLocalIP()
        },
        tags: [],
        extra: {
            // Legacy metadata structure
            [category.toLowerCase()]: metadata
        },
        tenant_id: options.tenant_id || null
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
 * Generate UUID-4
 * @returns {string} UUID-4
 */
function generateUUID() {
    return crypto.randomUUID();
}

/**
 * Generate request ID (legacy)
 * @returns {string} Request ID
 */
function generateRequestId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get local IP address
 * @returns {string} IP address
 */
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

export default router;
