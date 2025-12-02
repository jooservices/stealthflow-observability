#!/usr/bin/env node

/**
 * Log Worker - Processes logs from Redis Stream to Elasticsearch
 */

import { getRedisClient } from '../infrastructure/logging/redisClient.js';
import { getElasticsearchClient } from '../infrastructure/logging/esClient.js';
import { connectMongoDB, closeMongoDB } from '../infrastructure/db/mongoClient.js';
import { BusinessLog } from '../infrastructure/db/schemas/BusinessLog.js';
import { getDestinations, getStorageProfileForLog } from '../config/routing.js';

const STREAM_NAME = process.env.LOG_STREAM_NAME || 'logs:stream';
const CONSUMER_GROUP = process.env.LOG_CONSUMER_GROUP || 'stealthflow-log-workers';
const BATCH_SIZE = parseInt(process.env.LOG_BATCH_SIZE || '200');
const BLOCK_TIMEOUT = parseInt(process.env.LOG_BLOCK_TIMEOUT_MS || '2000');
const INDEX_ALIAS = process.env.LOG_INDEX_ALIAS || 'stealthflow_develop_logs';
const DLQ_STREAM = 'logs:failed';

// Generate unique consumer ID
const CONSUMER_ID = `worker-${process.pid}-${Math.random().toString(36).substr(2, 5)}`;

let isShuttingDown = false;
let currentBatchPromise = null;

console.log('='.repeat(60));
console.log('  StealthFlow Log Worker');
console.log('='.repeat(60));
console.log(`  Consumer ID:    ${CONSUMER_ID}`);
console.log(`  Stream:         ${STREAM_NAME}`);
console.log(`  Consumer Group: ${CONSUMER_GROUP}`);
console.log(`  Batch Size:     ${BATCH_SIZE}`);
console.log(`  Index:          ${INDEX_ALIAS}`);
console.log('='.repeat(60));

/**
 * Initialize consumer group
 */
async function initializeConsumerGroup() {
    const redis = getRedisClient();

    try {
        await redis.xgroup('CREATE', STREAM_NAME, CONSUMER_GROUP, '0', 'MKSTREAM');
        console.log('[Worker] Consumer group created');
    } catch (error) {
        const errorStr = error.toString();
        if (errorStr.includes('BUSYGROUP')) {
            console.log('[Worker] Consumer group already exists');
        } else {
            throw error;
        }
    }

    // Connect to MongoDB
    await connectMongoDB();
}

/**
 * Process batch of messages
 */
async function processBatch() {
    const redis = getRedisClient();
    const es = getElasticsearchClient();

    try {
        // Read from stream
        const messages = await redis.xreadgroup(
            'GROUP', CONSUMER_GROUP, CONSUMER_ID,
            'COUNT', BATCH_SIZE,
            'BLOCK', BLOCK_TIMEOUT,
            'STREAMS', STREAM_NAME, '>'
        );

        if (!messages || messages.length === 0) {
            return 0; // No messages
        }

        const streamMessages = messages[0][1]; // [streamName, [[id, fields], ...]]

        if (streamMessages.length === 0) {
            return 0;
        }

        console.log(`[Worker] Processing ${streamMessages.length} messages...`);

        // Parse log entries
        const bulkOps = [];
        const messageIds = [];

        for (const [messageId, fields] of streamMessages) {
            try {
                const data = fields[1]; // fields = ['data', '{"..."}']
                const logEntry = JSON.parse(data);

                // Get storage profile (new routing system)
                const profile = getStorageProfileForLog(logEntry);
                
                if (!profile) {
                    console.warn(`[Worker] No profile found for log, using fallback`);
                    // Fallback: send to ES with default index
                    bulkOps.push({ index: { _index: INDEX_ALIAS } });
                    bulkOps.push(logEntry);
                    messageIds.push(messageId);
                    continue;
                }

                const destinations = profile.destinations;

                // 1. Elasticsearch Buffer
                if (destinations.includes('elasticsearch')) {
                    // Use profile-specific index prefix if available
                    const indexName = profile.indexPrefix 
                        ? `${profile.indexPrefix}-${getDateSuffix()}`
                        : INDEX_ALIAS;
                    
                    bulkOps.push({ index: { _index: indexName } });
                    bulkOps.push(logEntry);
                }

                // 2. MongoDB Direct Write
                if (destinations.includes('mongodb')) {
                    const collectionName = profile.collection || 'logs_default';
                    await saveToMongoDB(logEntry, collectionName);
                }

                messageIds.push(messageId);
            } catch (error) {
                console.error('[Worker] Parse error:', error.message);

                // Send to DLQ
                await sendToDLQ(redis, { id: messageId, data: fields }, 'parse_error', error);

                // Ack to prevent reprocessing
                await redis.xack(STREAM_NAME, CONSUMER_GROUP, messageId);
            }
        }

        if (bulkOps.length === 0) {
            return 0;
        }

        // Bulk index to Elasticsearch (if any)
        if (bulkOps.length > 0) {
            const result = await es.bulk({ body: bulkOps });

            if (result.errors) {
                console.warn('[Worker] Some items failed to index in ES');
                await handlePartialFailures(redis, result, streamMessages);
            }
        }

        if (result.errors) {
            console.warn('[Worker] Some items failed to index');
            await handlePartialFailures(redis, result, streamMessages);
        }

        // Acknowledge all messages
        for (const messageId of messageIds) {
            await redis.xack(STREAM_NAME, CONSUMER_GROUP, messageId);
        }

        console.log(`[Worker] ✓ Processed ${messageIds.length} messages`);

        return messageIds.length;

    } catch (error) {
        console.error('[Worker] Batch processing error:', error.message);

        // Don't ack on error - messages will be retried
        await new Promise(resolve => setTimeout(resolve, 1000));

        return 0;
    }
}

/**
 * Send failed message to Dead Letter Queue
 */
async function sendToDLQ(redis, message, reason, errorData) {
    try {
        const dlqEntry = {
            originalMessage: message,
            failureReason: reason,
            error: errorData ? errorData.message : null,
            timestamp: new Date().toISOString(),
            retryCount: 0
        };

        await redis.xadd(DLQ_STREAM, '*', 'data', JSON.stringify(dlqEntry));

        console.log(`[Worker] Moved to DLQ: ${reason}`);
    } catch (error) {
        console.error('[Worker] Failed to send to DLQ:', error.message);
    }
}

/**
 * Handle partial failures in bulk operation
 */
async function handlePartialFailures(redis, result, messages) {
    const items = result.items;

    for (let i = 0; i < items.length; i++) {
        const item = items[i];

        if (item.index?.error) {
            const [messageId, fields] = messages[i];

            await sendToDLQ(
                redis,
                { id: messageId, data: fields },
                'elasticsearch_index_error',
                item.index.error
            );

            // Acknowledge the failed message
            await redis.xack(STREAM_NAME, CONSUMER_GROUP, messageId);
        }
    }
}

/**
 * Main worker loop
 */
async function mainLoop() {
    while (!isShuttingDown) {
        try {
            currentBatchPromise = processBatch();
            await currentBatchPromise;
            currentBatchPromise = null;
        } catch (error) {
            console.error('[Worker] Loop error:', error.message);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

/**
 * Graceful shutdown
 */
async function gracefulShutdown() {
    console.log('\n[Worker] Shutting down gracefully...');
    isShuttingDown = true;

    // Wait for current batch to finish
    if (currentBatchPromise) {
        console.log('[Worker] Waiting for current batch...');
        await currentBatchPromise;
    }

    // Close connections
    const { closeRedisClient } = await import('../infrastructure/logging/redisClient.js');
    const { closeElasticsearchClient } = await import('../infrastructure/logging/esClient.js');

    await closeRedisClient();
    await closeElasticsearchClient();
    await closeMongoDB();

    console.log('[Worker] Shutdown complete');
    process.exit(0);
}

// Handle signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start worker
(async () => {
    try {
        await initializeConsumerGroup();
        console.log('[Worker] Starting main loop...\n');
        await mainLoop();
    } catch (error) {
        console.error('[Worker] Fatal error:', error);
        process.exit(1);
    }
})();
/**
 * Get date suffix for index naming (YYYY.MM.DD)
 * @returns {string}
 */
function getDateSuffix() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
}

/**
 * Save log to MongoDB
 * @param {Object} logEntry - Log entry
 * @param {string} collectionName - Collection name (from profile)
 */
async function saveToMongoDB(logEntry, collectionName = 'logs_default') {
    try {
        // Support both new format and legacy format
        const isNewFormat = logEntry.schema_version === 1;

        if (isNewFormat) {
            // New format: use BusinessLog schema with new fields
            const doc = new BusinessLog({
                // Core fields
                log_id: logEntry.log_id,
                timestamp: logEntry.timestamp,
                level: logEntry.level,
                service: logEntry.service,
                environment: logEntry.environment,
                kind: logEntry.kind,
                category: logEntry.category,
                event: logEntry.event,
                message: logEntry.message,

                // Trace
                trace: logEntry.trace,

                // Context (map to metadata)
                userId: logEntry.context?.user_id || logEntry.context?.accountUID,
                accountUID: logEntry.context?.accountUID || logEntry.context?.user_id,
                metadata: logEntry.context || {},

                // Payload
                payload: logEntry.payload || {},

                // Host
                host: logEntry.host,

                // Tags
                tags: logEntry.tags || [],

                // Extra
                extra: logEntry.extra || {},

                // Tenant
                tenant_id: logEntry.tenant_id,

                // Legacy compatibility fields
                operation: logEntry.event,
                requestId: logEntry.trace?.span_id || logEntry.context?.requestId,
                serviceName: logEntry.service,
                env: logEntry.environment
            });

            // Use collection name from profile
            doc.collection = collectionName;
            await doc.save();
        } else {
            // Legacy format
            const doc = new BusinessLog({
                timestamp: logEntry.timestamp,
                category: logEntry.category,
                operation: logEntry.operation || logEntry.event,
                userId: logEntry.accountUID || logEntry.context?.accountUID,
                accountUID: logEntry.accountUID || logEntry.context?.accountUID,
                metadata: logEntry.metadata || logEntry.context || {},

                // Map optional top-level fields
                amount: logEntry.metadata?.amount || logEntry.context?.amount,
                currency: logEntry.metadata?.currency || logEntry.context?.currency,
                status: logEntry.metadata?.status || logEntry.context?.status,

                requestId: logEntry.requestId || logEntry.trace?.span_id,
                serviceName: logEntry.serviceName || logEntry.service,
                env: logEntry.env || logEntry.environment
            });

            doc.collection = collectionName;
            await doc.save();
        }
    } catch (error) {
        console.error(`[Worker] MongoDB save error (${collectionName}):`, error.message);
        // We don't throw here to avoid blocking the whole batch if Mongo fails
        // Ideally, we should have a separate DLQ or retry mechanism for Mongo
    }
}
