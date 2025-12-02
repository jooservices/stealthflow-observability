import request from 'supertest';
import express from 'express';
import { apiRateLimiter, batchRateLimiter } from './rateLimit.js';
import { apiKeyAuth } from './auth.js';

/**
 * Load tests for rate limiting
 * Tests system behavior under high load
 */

describe('Rate Limiting Load Tests', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        process.env.API_KEYS = 'load-test-key-1,load-test-key-2';
    });

    afterEach(() => {
        delete process.env.API_KEYS;
        delete process.env.RATE_LIMIT_WINDOW_MS;
        delete process.env.RATE_LIMIT_MAX_REQUESTS;
        delete process.env.RATE_LIMIT_BATCH_MAX;
    });

    describe('High Volume Requests', () => {
        it('should handle 1000 requests and enforce rate limit correctly', async () => {
            process.env.RATE_LIMIT_WINDOW_MS = '60000';
            process.env.RATE_LIMIT_MAX_REQUESTS = '100';

            app.use('/api/v1/logs', apiRateLimiter, apiKeyAuth);
            app.post('/api/v1/logs', (req, res) => {
                res.status(202).json({ success: true });
            });

            const validKey = 'load-test-key-1';
            const totalRequests = 1000;
            const requests = [];

            // Create all requests
            for (let i = 0; i < totalRequests; i++) {
                requests.push(
                    request(app)
                        .post('/api/v1/logs')
                        .set('X-API-Key', validKey)
                        .send({ category: 'LOAD_TEST', operation: `request-${i}` })
                );
            }

            // Execute all requests
            const startTime = Date.now();
            const responses = await Promise.all(requests);
            const endTime = Date.now();
            const duration = endTime - startTime;

            // Analyze results
            const statuses = responses.map(r => r.status);
            const successful = statuses.filter(s => s === 202).length;
            const rateLimited = statuses.filter(s => s === 429).length;
            const authFailed = statuses.filter(s => s === 401).length;

            console.log(`Load Test Results:`);
            console.log(`  Total requests: ${totalRequests}`);
            console.log(`  Successful: ${successful}`);
            console.log(`  Rate limited: ${rateLimited}`);
            console.log(`  Auth failed: ${authFailed}`);
            console.log(`  Duration: ${duration}ms`);
            console.log(`  Throughput: ${(totalRequests / (duration / 1000)).toFixed(2)} req/s`);

            // Should have exactly 100 successful (limit) and 900 rate limited
            expect(successful).toBe(100);
            expect(rateLimited).toBe(900);
            expect(authFailed).toBe(0);
        }, 30000); // 30 second timeout

        it('should handle burst of 500 concurrent requests', async () => {
            process.env.RATE_LIMIT_WINDOW_MS = '60000';
            process.env.RATE_LIMIT_MAX_REQUESTS = '50';

            app.use('/api/v1/logs', apiRateLimiter, apiKeyAuth);
            app.post('/api/v1/logs', (req, res) => {
                res.status(202).json({ success: true });
            });

            const validKey = 'load-test-key-1';
            const burstSize = 500;
            const requests = [];

            // Create burst of concurrent requests
            for (let i = 0; i < burstSize; i++) {
                requests.push(
                    request(app)
                        .post('/api/v1/logs')
                        .set('X-API-Key', validKey)
                        .send({ category: 'BURST_TEST', operation: `burst-${i}` })
                );
            }

            const startTime = Date.now();
            const responses = await Promise.all(requests);
            const endTime = Date.now();

            const statuses = responses.map(r => r.status);
            const successful = statuses.filter(s => s === 202).length;
            const rateLimited = statuses.filter(s => s === 429).length;

            console.log(`Burst Test Results:`);
            console.log(`  Burst size: ${burstSize}`);
            console.log(`  Successful: ${successful}`);
            console.log(`  Rate limited: ${rateLimited}`);
            console.log(`  Duration: ${endTime - startTime}ms`);

            // Should have exactly 50 successful and 450 rate limited
            expect(successful).toBe(50);
            expect(rateLimited).toBe(450);
        }, 30000);
    });

    describe('Sustained Load', () => {
        it('should maintain rate limit over multiple windows', async () => {
            process.env.RATE_LIMIT_WINDOW_MS = '2000'; // 2 second window
            process.env.RATE_LIMIT_MAX_REQUESTS = '10';

            app.use('/api/v1/logs', apiRateLimiter, apiKeyAuth);
            app.post('/api/v1/logs', (req, res) => {
                res.status(202).json({ success: true });
            });

            const validKey = 'load-test-key-1';
            const windows = 3;
            const requestsPerWindow = 15; // Exceed limit

            let totalSuccessful = 0;
            let totalRateLimited = 0;

            for (let window = 0; window < windows; window++) {
                const windowRequests = [];
                for (let i = 0; i < requestsPerWindow; i++) {
                    windowRequests.push(
                        request(app)
                            .post('/api/v1/logs')
                            .set('X-API-Key', validKey)
                            .send({ category: 'SUSTAINED_TEST', operation: `window-${window}-req-${i}` })
                    );
                }

                const responses = await Promise.all(windowRequests);
                const successful = responses.filter(r => r.status === 202).length;
                const rateLimited = responses.filter(r => r.status === 429).length;

                totalSuccessful += successful;
                totalRateLimited += rateLimited;

                console.log(`Window ${window + 1}: ${successful} successful, ${rateLimited} rate limited`);

                // Wait for next window (if not last)
                if (window < windows - 1) {
                    await new Promise(resolve => setTimeout(resolve, 2100)); // Wait for window reset
                }
            }

            console.log(`Sustained Load Results:`);
            console.log(`  Total successful: ${totalSuccessful}`);
            console.log(`  Total rate limited: ${totalRateLimited}`);

            // Each window should allow 10 requests
            expect(totalSuccessful).toBe(30); // 10 per window * 3 windows
            expect(totalRateLimited).toBe(15); // 5 per window * 3 windows (15 requests - 10 limit)
        }, 20000);
    });

    describe('Batch Endpoint Load', () => {
        it('should handle high volume batch requests', async () => {
            process.env.RATE_LIMIT_WINDOW_MS = '60000';
            process.env.RATE_LIMIT_BATCH_MAX = '20';

            app.use('/api/v1/logs/batch', batchRateLimiter, apiKeyAuth);
            app.post('/api/v1/logs/batch', (req, res) => {
                res.status(202).json({ success: true, received: req.body.logs.length });
            });

            const validKey = 'load-test-key-1';
            const totalBatches = 100;
            const requests = [];

            for (let i = 0; i < totalBatches; i++) {
                requests.push(
                    request(app)
                        .post('/api/v1/logs/batch')
                        .set('X-API-Key', validKey)
                        .send({
                            logs: Array.from({ length: 10 }, (_, j) => ({
                                category: 'BATCH_LOAD_TEST',
                                operation: `batch-${i}-log-${j}`
                            }))
                        })
                );
            }

            const responses = await Promise.all(requests);
            const statuses = responses.map(r => r.status);
            const successful = statuses.filter(s => s === 202).length;
            const rateLimited = statuses.filter(s => s === 429).length;

            console.log(`Batch Load Test Results:`);
            console.log(`  Total batches: ${totalBatches}`);
            console.log(`  Successful: ${successful}`);
            console.log(`  Rate limited: ${rateLimited}`);

            // Should have exactly 20 successful and 80 rate limited
            expect(successful).toBe(20);
            expect(rateLimited).toBe(80);
        }, 30000);
    });
});

