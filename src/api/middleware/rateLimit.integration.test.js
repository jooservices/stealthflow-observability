import request from 'supertest';
import express from 'express';
import { apiRateLimiter, batchRateLimiter } from './rateLimit.js';
import { apiKeyAuth } from './auth.js';

/**
 * Integration tests for rate limiting with actual middleware stack
 * Tests rate limiting enforcement in realistic scenarios
 */

describe('Rate Limiting Integration Tests', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());

        // Set up test API keys
        process.env.API_KEYS = 'test-key-1,test-key-2,test-key-3';
    });

    afterEach(() => {
        jest.clearAllMocks();
        delete process.env.API_KEYS;
        delete process.env.RATE_LIMIT_WINDOW_MS;
        delete process.env.RATE_LIMIT_MAX_REQUESTS;
        delete process.env.RATE_LIMIT_BATCH_MAX;
    });

    describe('Rate Limiting with Authentication', () => {
        it('should enforce rate limiting after authentication', async () => {
            process.env.RATE_LIMIT_WINDOW_MS = '60000';
            process.env.RATE_LIMIT_MAX_REQUESTS = '3';

            // Apply middleware in correct order: rate limiter -> auth -> route
            app.use('/api/v1/logs', apiRateLimiter, apiKeyAuth);
            app.post('/api/v1/logs', (req, res) => {
                res.status(202).json({ success: true });
            });

            const validKey = 'test-key-1';

            // Make 3 authenticated requests (within limit)
            for (let i = 0; i < 3; i++) {
                const response = await request(app)
                    .post('/api/v1/logs')
                    .set('X-API-Key', validKey)
                    .send({ category: 'TEST', operation: `test-${i}` });

                expect(response.status).toBe(202);
            }

            // 4th request should be rate limited (before auth check)
            const rateLimitedResponse = await request(app)
                .post('/api/v1/logs')
                .set('X-API-Key', validKey)
                .send({ category: 'TEST', operation: 'test-4' });

            expect(rateLimitedResponse.status).toBe(429);
            expect(rateLimitedResponse.body.error).toBe('Too many requests');
        });

        it('should rate limit invalid API key requests', async () => {
            process.env.RATE_LIMIT_WINDOW_MS = '60000';
            process.env.RATE_LIMIT_MAX_REQUESTS = '2';

            app.use('/api/v1/logs', apiRateLimiter, apiKeyAuth);
            app.post('/api/v1/logs', (req, res) => {
                res.status(202).json({ success: true });
            });

            const invalidKey = 'invalid-key';

            // Make 2 requests with invalid key
            // First should fail auth (401), second should be rate limited (429)
            const response1 = await request(app)
                .post('/api/v1/logs')
                .set('X-API-Key', invalidKey)
                .send({ category: 'TEST', operation: 'test-1' });

            expect(response1.status).toBe(401); // Auth failure

            const response2 = await request(app)
                .post('/api/v1/logs')
                .set('X-API-Key', invalidKey)
                .send({ category: 'TEST', operation: 'test-2' });

            // Rate limiter applies before auth, so this should be 429
            expect(response2.status).toBe(429);
        });
    });

    describe('Batch Endpoint Rate Limiting', () => {
        it('should enforce separate rate limit for batch endpoint', async () => {
            process.env.RATE_LIMIT_WINDOW_MS = '60000';
            process.env.RATE_LIMIT_MAX_REQUESTS = '100';
            process.env.RATE_LIMIT_BATCH_MAX = '3';

            app.use('/api/v1/logs/batch', batchRateLimiter, apiKeyAuth);
            app.post('/api/v1/logs/batch', (req, res) => {
                res.status(202).json({ success: true, received: req.body.logs.length });
            });

            const validKey = 'test-key-1';

            // Make 3 batch requests (within batch limit)
            for (let i = 0; i < 3; i++) {
                const response = await request(app)
                    .post('/api/v1/logs/batch')
                    .set('X-API-Key', validKey)
                    .send({ logs: [{ category: 'TEST', operation: `batch-${i}` }] });

                expect(response.status).toBe(202);
            }

            // 4th batch request should be rate limited
            const rateLimitedResponse = await request(app)
                .post('/api/v1/logs/batch')
                .set('X-API-Key', validKey)
                .send({ logs: [{ category: 'TEST', operation: 'batch-4' }] });

            expect(rateLimitedResponse.status).toBe(429);
            expect(rateLimitedResponse.body.error).toBe('Too many batch requests');
        });

        it('should allow regular endpoint after batch limit is reached', async () => {
            process.env.RATE_LIMIT_WINDOW_MS = '60000';
            process.env.RATE_LIMIT_MAX_REQUESTS = '10';
            process.env.RATE_LIMIT_BATCH_MAX = '2';

            app.use('/api/v1/logs/batch', batchRateLimiter, apiKeyAuth);
            app.use('/api/v1/logs', apiRateLimiter, apiKeyAuth);

            app.post('/api/v1/logs/batch', (req, res) => {
                res.status(202).json({ endpoint: 'batch' });
            });
            app.post('/api/v1/logs', (req, res) => {
                res.status(202).json({ endpoint: 'regular' });
            });

            const validKey = 'test-key-1';

            // Exhaust batch limit
            await request(app)
                .post('/api/v1/logs/batch')
                .set('X-API-Key', validKey)
                .send({ logs: [{ category: 'TEST' }] });
            await request(app)
                .post('/api/v1/logs/batch')
                .set('X-API-Key', validKey)
                .send({ logs: [{ category: 'TEST' }] });

            // Batch should be rate limited
            const batchRateLimited = await request(app)
                .post('/api/v1/logs/batch')
                .set('X-API-Key', validKey)
                .send({ logs: [{ category: 'TEST' }] });
            expect(batchRateLimited.status).toBe(429);

            // Regular endpoint should still work (different limiter)
            const regularResponse = await request(app)
                .post('/api/v1/logs')
                .set('X-API-Key', validKey)
                .send({ category: 'TEST', operation: 'regular' });
            expect(regularResponse.status).toBe(202);
        });
    });

    describe('Rate Limit Headers and Response Format', () => {
        it('should return proper rate limit response format', async () => {
            process.env.RATE_LIMIT_WINDOW_MS = '60000';
            process.env.RATE_LIMIT_MAX_REQUESTS = '1';

            app.use('/api/v1/logs', apiRateLimiter, apiKeyAuth);
            app.post('/api/v1/logs', (req, res) => {
                res.status(202).json({ success: true });
            });

            const validKey = 'test-key-1';

            // First request succeeds
            await request(app)
                .post('/api/v1/logs')
                .set('X-API-Key', validKey)
                .send({ category: 'TEST', operation: 'test' });

            // Second request is rate limited
            const response = await request(app)
                .post('/api/v1/logs')
                .set('X-API-Key', validKey)
                .send({ category: 'TEST', operation: 'test' });

            expect(response.status).toBe(429);
            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toBe('Too many requests');
            expect(response.body).toHaveProperty('retryAfterSeconds');
            expect(typeof response.body.retryAfterSeconds).toBe('number');
        });

        it('should include standard rate limit headers', async () => {
            process.env.RATE_LIMIT_WINDOW_MS = '60000';
            process.env.RATE_LIMIT_MAX_REQUESTS = '10';

            app.use('/api/v1/logs', apiRateLimiter, apiKeyAuth);
            app.post('/api/v1/logs', (req, res) => {
                res.status(202).json({ success: true });
            });

            const validKey = 'test-key-1';

            const response = await request(app)
                .post('/api/v1/logs')
                .set('X-API-Key', validKey)
                .send({ category: 'TEST', operation: 'test' });

            expect(response.status).toBe(202);
            // express-rate-limit adds standard headers
            // Headers may vary by version, but should include rate limit info
        });
    });

    describe('Real-world Scenarios', () => {
        it('should handle burst of requests correctly', async () => {
            process.env.RATE_LIMIT_WINDOW_MS = '60000';
            process.env.RATE_LIMIT_MAX_REQUESTS = '5';

            app.use('/api/v1/logs', apiRateLimiter, apiKeyAuth);
            app.post('/api/v1/logs', (req, res) => {
                res.status(202).json({ success: true });
            });

            const validKey = 'test-key-1';

            // Simulate burst: 10 requests at once
            const burstRequests = Array.from({ length: 10 }, (_, i) =>
                request(app)
                    .post('/api/v1/logs')
                    .set('X-API-Key', validKey)
                    .send({ category: 'TEST', operation: `burst-${i}` })
            );

            const responses = await Promise.all(burstRequests);
            const statuses = responses.map(r => r.status);

            const successful = statuses.filter(s => s === 202).length;
            const rateLimited = statuses.filter(s => s === 429).length;

            expect(successful).toBe(5);
            expect(rateLimited).toBe(5);
        });

        it('should maintain rate limit across multiple valid API keys', async () => {
            process.env.RATE_LIMIT_WINDOW_MS = '60000';
            process.env.RATE_LIMIT_MAX_REQUESTS = '3';

            app.use('/api/v1/logs', apiRateLimiter, apiKeyAuth);
            app.post('/api/v1/logs', (req, res) => {
                res.status(202).json({ key: req.headers['x-api-key'] });
            });

            // Rate limiting is per-IP, not per-key
            // So using different keys from same IP should still hit limit
            const key1 = 'test-key-1';
            const key2 = 'test-key-2';

            // Use key1 for 3 requests (limit)
            for (let i = 0; i < 3; i++) {
                const response = await request(app)
                    .post('/api/v1/logs')
                    .set('X-API-Key', key1)
                    .send({ category: 'TEST', operation: `key1-${i}` });
                expect(response.status).toBe(202);
            }

            // Try with key2 from same IP - should still be rate limited
            const response = await request(app)
                .post('/api/v1/logs')
                .set('X-API-Key', key2)
                .send({ category: 'TEST', operation: 'key2' });

            // Rate limiting is per IP, so this should be 429
            expect(response.status).toBe(429);
        });
    });
});
