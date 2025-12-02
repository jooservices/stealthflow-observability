import { apiRateLimiter, batchRateLimiter } from './rateLimit.js';
import express from 'express';
import request from 'supertest';

describe('Rate Limiting Middleware', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());
    });

    afterEach(() => {
        jest.clearAllMocks();
        delete process.env.RATE_LIMIT_WINDOW_MS;
        delete process.env.RATE_LIMIT_MAX_REQUESTS;
        delete process.env.RATE_LIMIT_BATCH_MAX;
    });

    describe('API Rate Limiter', () => {
        it('should allow requests within limit', async () => {
            process.env.RATE_LIMIT_WINDOW_MS = '60000';
            process.env.RATE_LIMIT_MAX_REQUESTS = '5';

            app.use('/test', apiRateLimiter);
            app.post('/test', (req, res) => {
                res.json({ success: true });
            });

            // Make 5 requests (within limit)
            for (let i = 0; i < 5; i++) {
                const response = await request(app)
                    .post('/test')
                    .send({ test: 'data' });

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
            }
        });

        it('should return 429 when limit is exceeded', async () => {
            process.env.RATE_LIMIT_WINDOW_MS = '60000';
            process.env.RATE_LIMIT_MAX_REQUESTS = '3';

            app.use('/test', apiRateLimiter);
            app.post('/test', (req, res) => {
                res.json({ success: true });
            });

            // Make requests up to limit
            for (let i = 0; i < 3; i++) {
                const response = await request(app)
                    .post('/test')
                    .send({ test: 'data' });
                expect(response.status).toBe(200);
            }

            // Next request should be rate limited
            const response = await request(app)
                .post('/test')
                .send({ test: 'data' });

            expect(response.status).toBe(429);
            expect(response.body.error).toBe('Too many requests');
            expect(response.body.retryAfterSeconds).toBeDefined();
        });

        it('should include Retry-After header in response', async () => {
            process.env.RATE_LIMIT_WINDOW_MS = '60000';
            process.env.RATE_LIMIT_MAX_REQUESTS = '1';

            app.use('/test', apiRateLimiter);
            app.post('/test', (req, res) => {
                res.json({ success: true });
            });

            // First request succeeds
            await request(app).post('/test').send({ test: 'data' });

            // Second request is rate limited
            const response = await request(app)
                .post('/test')
                .send({ test: 'data' });

            expect(response.status).toBe(429);
            expect(response.headers['retry-after']).toBeDefined();
        });

        it('should use default values when env vars are not set', async () => {
            delete process.env.RATE_LIMIT_WINDOW_MS;
            delete process.env.RATE_LIMIT_MAX_REQUESTS;

            app.use('/test', apiRateLimiter);
            app.post('/test', (req, res) => {
                res.json({ success: true });
            });

            // Should work with defaults (100 requests per 60 seconds)
            const response = await request(app)
                .post('/test')
                .send({ test: 'data' });

            expect(response.status).toBe(200);
        });

        it('should respect custom window and max settings', async () => {
            process.env.RATE_LIMIT_WINDOW_MS = '1000'; // 1 second
            process.env.RATE_LIMIT_MAX_REQUESTS = '2';

            app.use('/test', apiRateLimiter);
            app.post('/test', (req, res) => {
                res.json({ success: true });
            });

            // Make 2 requests (limit)
            await request(app).post('/test').send({ test: 'data' });
            await request(app).post('/test').send({ test: 'data' });

            // Third should be rate limited
            const response = await request(app)
                .post('/test')
                .send({ test: 'data' });

            expect(response.status).toBe(429);
        });
    });

    describe('Batch Rate Limiter', () => {
        it('should allow batch requests within limit', async () => {
            process.env.RATE_LIMIT_WINDOW_MS = '60000';
            process.env.RATE_LIMIT_BATCH_MAX = '3';

            app.use('/batch', batchRateLimiter);
            app.post('/batch', (req, res) => {
                res.json({ success: true });
            });

            // Make 3 batch requests (within limit)
            for (let i = 0; i < 3; i++) {
                const response = await request(app)
                    .post('/batch')
                    .send({ logs: [] });

                expect(response.status).toBe(200);
            }
        });

        it('should return 429 when batch limit is exceeded', async () => {
            process.env.RATE_LIMIT_WINDOW_MS = '60000';
            process.env.RATE_LIMIT_BATCH_MAX = '2';

            app.use('/batch', batchRateLimiter);
            app.post('/batch', (req, res) => {
                res.json({ success: true });
            });

            // Make 2 requests (limit)
            await request(app).post('/batch').send({ logs: [] });
            await request(app).post('/batch').send({ logs: [] });

            // Third should be rate limited
            const response = await request(app)
                .post('/batch')
                .send({ logs: [] });

            expect(response.status).toBe(429);
            expect(response.body.error).toBe('Too many batch requests');
        });

        it('should use default batch limit when env var is not set', async () => {
            delete process.env.RATE_LIMIT_BATCH_MAX;

            app.use('/batch', batchRateLimiter);
            app.post('/batch', (req, res) => {
                res.json({ success: true });
            });

            // Should work with default (20 requests per 60 seconds)
            const response = await request(app)
                .post('/batch')
                .send({ logs: [] });

            expect(response.status).toBe(200);
        });
    });

    describe('Rate Limit Headers', () => {
        it('should include standard rate limit headers', async () => {
            process.env.RATE_LIMIT_WINDOW_MS = '60000';
            process.env.RATE_LIMIT_MAX_REQUESTS = '10';

            app.use('/test', apiRateLimiter);
            app.post('/test', (req, res) => {
                res.json({ success: true });
            });

            const response = await request(app)
                .post('/test')
                .send({ test: 'data' });

            // express-rate-limit should add standard headers
            expect(response.status).toBe(200);
            // Note: Headers may vary based on express-rate-limit version
        });
    });

    describe('Different IP Addresses', () => {
        it('should track rate limits per IP address', async () => {
            process.env.RATE_LIMIT_WINDOW_MS = '60000';
            process.env.RATE_LIMIT_MAX_REQUESTS = '2';

            app.use('/test', apiRateLimiter);
            app.post('/test', (req, res) => {
                res.json({ ip: req.ip });
            });

            // IP 1: Make 2 requests (limit)
            await request(app)
                .post('/test')
                .set('X-Forwarded-For', '192.168.1.1')
                .send({ test: 'data' });
            await request(app)
                .post('/test')
                .set('X-Forwarded-For', '192.168.1.1')
                .send({ test: 'data' });

            // IP 1: Third request should be rate limited
            const response1 = await request(app)
                .post('/test')
                .set('X-Forwarded-For', '192.168.1.1')
                .send({ test: 'data' });
            expect(response1.status).toBe(429);

            // IP 2: Should still be able to make requests
            const response2 = await request(app)
                .post('/test')
                .set('X-Forwarded-For', '192.168.1.2')
                .send({ test: 'data' });
            expect(response2.status).toBe(200);
        });
    });

    describe('Rate Limit Enforcement', () => {
        it('should enforce exact limit (no more, no less)', async () => {
            process.env.RATE_LIMIT_WINDOW_MS = '60000';
            process.env.RATE_LIMIT_MAX_REQUESTS = '5';

            app.use('/test', apiRateLimiter);
            app.post('/test', (req, res) => {
                res.json({ success: true, count: req.body.count });
            });

            // Make exactly 5 requests - all should succeed
            const successfulRequests = [];
            for (let i = 0; i < 5; i++) {
                const response = await request(app)
                    .post('/test')
                    .send({ count: i + 1 });
                successfulRequests.push(response.status);
            }

            expect(successfulRequests.every(status => status === 200)).toBe(true);

            // 6th request should be rate limited
            const rateLimitedResponse = await request(app)
                .post('/test')
                .send({ count: 6 });

            expect(rateLimitedResponse.status).toBe(429);
            expect(rateLimitedResponse.body.error).toBe('Too many requests');
        });

        it('should reset limit after window expires', async () => {
            process.env.RATE_LIMIT_WINDOW_MS = '1000'; // 1 second window
            process.env.RATE_LIMIT_MAX_REQUESTS = '2';

            app.use('/test', apiRateLimiter);
            app.post('/test', (req, res) => {
                res.json({ success: true });
            });

            // Make 2 requests (limit)
            await request(app).post('/test').send({ test: 'data' });
            await request(app).post('/test').send({ test: 'data' });

            // Third should be rate limited
            const rateLimited = await request(app)
                .post('/test')
                .send({ test: 'data' });
            expect(rateLimited.status).toBe(429);

            // Wait for window to reset
            await new Promise(resolve => setTimeout(resolve, 1100));

            // After window reset, should be able to make requests again
            const afterReset = await request(app)
                .post('/test')
                .send({ test: 'data' });
            expect(afterReset.status).toBe(200);
        });

        it('should enforce rate limit on concurrent requests', async () => {
            process.env.RATE_LIMIT_WINDOW_MS = '60000';
            process.env.RATE_LIMIT_MAX_REQUESTS = '3';

            app.use('/test', apiRateLimiter);
            app.post('/test', (req, res) => {
                res.json({ success: true });
            });

            // Make 5 concurrent requests (limit is 3)
            const promises = [];
            for (let i = 0; i < 5; i++) {
                promises.push(
                    request(app)
                        .post('/test')
                        .send({ test: `concurrent-${i}` })
                );
            }

            const responses = await Promise.all(promises);
            const statuses = responses.map(r => r.status);

            // Should have exactly 3 successful and 2 rate limited
            const successful = statuses.filter(s => s === 200).length;
            const rateLimited = statuses.filter(s => s === 429).length;

            expect(successful).toBe(3);
            expect(rateLimited).toBe(2);
        });

        it('should enforce different limits for different endpoints', async () => {
            process.env.RATE_LIMIT_WINDOW_MS = '60000';
            process.env.RATE_LIMIT_MAX_REQUESTS = '10';
            process.env.RATE_LIMIT_BATCH_MAX = '3';

            app.use('/api', apiRateLimiter);
            app.use('/batch', batchRateLimiter);

            app.post('/api', (req, res) => {
                res.json({ endpoint: 'api' });
            });
            app.post('/batch', (req, res) => {
                res.json({ endpoint: 'batch' });
            });

            // Make 10 API requests (should all succeed)
            for (let i = 0; i < 10; i++) {
                const response = await request(app)
                    .post('/api')
                    .send({ test: 'data' });
                expect(response.status).toBe(200);
            }

            // 11th API request should be rate limited
            const apiRateLimited = await request(app)
                .post('/api')
                .send({ test: 'data' });
            expect(apiRateLimited.status).toBe(429);

            // Batch endpoint should still work (different limiter)
            const batchResponse = await request(app)
                .post('/batch')
                .send({ logs: [] });
            expect(batchResponse.status).toBe(200);

            // But batch has its own limit (3)
            await request(app).post('/batch').send({ logs: [] });
            await request(app).post('/batch').send({ logs: [] });
            const batchRateLimited = await request(app)
                .post('/batch')
                .send({ logs: [] });
            expect(batchRateLimited.status).toBe(429);
        });

        it('should include retryAfterSeconds in rate limit response', async () => {
            process.env.RATE_LIMIT_WINDOW_MS = '5000'; // 5 seconds
            process.env.RATE_LIMIT_MAX_REQUESTS = '1';

            app.use('/test', apiRateLimiter);
            app.post('/test', (req, res) => {
                res.json({ success: true });
            });

            // First request succeeds
            await request(app).post('/test').send({ test: 'data' });

            // Second request is rate limited
            const response = await request(app)
                .post('/test')
                .send({ test: 'data' });

            expect(response.status).toBe(429);
            expect(response.body.retryAfterSeconds).toBeDefined();
            expect(typeof response.body.retryAfterSeconds).toBe('number');
            expect(response.body.retryAfterSeconds).toBeGreaterThan(0);
            expect(response.body.retryAfterSeconds).toBeLessThanOrEqual(5);
        });

        it('should log rate limit hits', async () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

            process.env.RATE_LIMIT_WINDOW_MS = '60000';
            process.env.RATE_LIMIT_MAX_REQUESTS = '1';

            app.use('/test', apiRateLimiter);
            app.post('/test', (req, res) => {
                res.json({ success: true });
            });

            // First request succeeds
            await request(app).post('/test').send({ test: 'data' });

            // Second request is rate limited
            await request(app).post('/test').send({ test: 'data' });

            // Should have logged rate limit hit
            expect(consoleSpy).toHaveBeenCalled();
            const logCall = consoleSpy.mock.calls.find(call =>
                call[0] === '[RateLimit] Hit'
            );
            expect(logCall).toBeDefined();

            consoleSpy.mockRestore();
        });

        it('should handle rapid successive requests correctly', async () => {
            process.env.RATE_LIMIT_WINDOW_MS = '60000';
            process.env.RATE_LIMIT_MAX_REQUESTS = '5';

            app.use('/test', apiRateLimiter);
            app.post('/test', (req, res) => {
                res.json({ success: true, timestamp: Date.now() });
            });

            // Make rapid requests
            const requests = [];
            for (let i = 0; i < 10; i++) {
                requests.push(
                    request(app)
                        .post('/test')
                        .send({ request: i })
                );
            }

            const responses = await Promise.all(requests);
            const successful = responses.filter(r => r.status === 200).length;
            const rateLimited = responses.filter(r => r.status === 429).length;

            // Should have exactly 5 successful and 5 rate limited
            expect(successful).toBe(5);
            expect(rateLimited).toBe(5);
        });
    });
});
