#!/usr/bin/env node

/**
 * Test connections to Container #1 infrastructure
 */

import Redis from 'ioredis';
import { Client } from '@elastic/elasticsearch';

console.log('🔍 Testing connections to Container #1 infrastructure...\n');

const results = {
    redis: false,
    elasticsearch: false
};

// Test Redis
try {
    console.log('📍 Testing Redis...');
    const redisHost = process.env.REDIS_HOST || '192.168.1.13';
    const redisPort = parseInt(process.env.REDIS_PORT || '6380');

    const redis = new Redis({
        host: redisHost,
        port: redisPort,
        connectTimeout: 5000
    });

    const pong = await redis.ping();
    console.log(`✅ Redis: ${pong} (${redisHost}:${redisPort})`);

    // Test stream operations
    await redis.xadd('test:stream', '*', 'test', 'hello');
    console.log('✅ Redis Stream write: OK');

    await redis.quit();
    results.redis = true;
} catch (err) {
    console.error(`❌ Redis failed: ${err.message}`);
}

console.log('');

// Test Elasticsearch
try {
    console.log('📍 Testing Elasticsearch...');
    const esUrl = process.env.ELASTICSEARCH_URL || 'http://192.168.1.13:9201';

    const es = new Client({ node: esUrl });
    const health = await es.cluster.health();
    console.log(`✅ Elasticsearch: ${health.cluster_name} (${health.status})`);

    // Test index
    const indexAlias = process.env.LOG_INDEX_ALIAS || 'stealthflow_develop_logs';
    const exists = await es.indices.exists({ index: indexAlias });
    console.log(`✅ Index "${indexAlias}": ${exists ? 'EXISTS' : 'NOT FOUND'}`);

    await es.close();
    results.elasticsearch = true;
} catch (err) {
    console.error(`❌ Elasticsearch failed: ${err.message}`);
}

console.log('\n' + '='.repeat(60));
console.log('📊 Connection Test Results:');
console.log('='.repeat(60));
console.log(`Redis:         ${results.redis ? '✅ PASS' : '❌ FAIL'}`);
console.log(`Elasticsearch: ${results.elasticsearch ? '✅ PASS' : '❌ FAIL'}`);
console.log('='.repeat(60));

const allPass = Object.values(results).every(r => r);
console.log(allPass ? '\n🎉 All connections OK!' : '\n⚠️  Some connections failed');

process.exit(allPass ? 0 : 1);
