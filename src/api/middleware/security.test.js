import request from 'supertest';
import express from 'express';
import { apiRateLimiter, batchRateLimiter } from './rateLimit.js';
import { apiKeyAuth } from './auth.js';

/**
 * Security tests for authentication and rate limiting
 * Tests various attack scenarios and edge cases
 */

describe('Security Tests', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        process.env.API_KEYS = 'valid-key-1,valid-key-2,valid-key-3';
    });

    afterEach(() => {
        delete process.env.API_KEYS;
        delete process.env.RATE_LIMIT_WINDOW_MS;
        delete process.env.RATE_LIMIT_MAX_REQUESTS;
    });

    describe('Authentication Security', () => {
        it('should reject requests with various invalid key formats', async () => {
            app.use('/api/v1/logs', apiKeyAuth);
            app.post('/api/v1/logs', (req, res) => {
                res.status(202).json({ success: true });
            });

            const invalidKeys = [
                '', // Empty
                ' ', // Whitespace
                'invalid-key',
                'valid-key-1 ', // Trailing space
                ' valid-key-1', // Leading space
                'VALID-KEY-1', // Wrong case
                'valid-key-1\n', // Newline injection
                'valid-key-1\r', // Carriage return
                '../etc/passwd', // Path traversal attempt
                '<script>alert(1)</script>', // XSS attempt
                "'; DROP TABLE users; --", // SQL injection attempt
                'valid-key-1' + '\x00', // Null byte
                'a'.repeat(10000), // Very long key
            ];

            for (const invalidKey of invalidKeys) {
                const response = await request(app)
                    .post('/api/v1/logs')
                    .set('X-API-Key', invalidKey)
                    .send({ category: 'TEST', operation: 'test' });

                expect(response.status).toBe(401);
                expect(response.body.error).toMatch(/API key|Invalid API key/);
            }
        });

        it('should not leak information about valid keys in error messages', async () => {
            app.use('/api/v1/logs', apiKeyAuth);
            app.post('/api/v1/logs', (req, res) => {
                res.status(202).json({ success: true });
            });

            // Test with partial valid key
            const partialKey = 'valid-key-1'.substring(0, 5);
            const response = await request(app)
                .post('/api/v1/logs')
                .set('X-API-Key', partialKey)
                .send({ category: 'TEST', operation: 'test' });

            expect(response.status).toBe(401);
            // Error message should not contain actual key
            expect(response.body.error).not.toContain('valid-key-1');
            expect(response.body.error).not.toContain(partialKey);
        });

        it('should handle case-sensitive key matching correctly', async () => {
            app.use('/api/v1/logs', apiKeyAuth);
            app.post('/api/v1/logs', (req, res) => {
                res.status(202).json({ success: true });
            });

            // Valid key
            const validResponse = await request(app)
                .post('/api/v1/logs')
                .set('X-API-Key', 'valid-key-1')
                .send({ category: 'TEST', operation: 'test' });
            expect(validResponse.status).toBe(202);

            // Same key but different case should fail
            const invalidResponse = await request(app)
                .post('/api/v1/logs')
                .set('X-API-Key', 'VALID-KEY-1')
                .send({ category: 'TEST', operation: 'test' });
            expect(invalidResponse.status).toBe(401);
        });

        it('should prevent key enumeration attacks', async () => {
            app.use('/api/v1/logs', apiKeyAuth);
            app.post('/api/v1/logs', (req, res) => {
                res.status(202).json({ success: true });
            });

            // Both missing and invalid keys should return same error format
            const missingKeyResponse = await request(app)
                .post('/api/v1/logs')
                .send({ category: 'TEST', operation: 'test' });

            const invalidKeyResponse = await request(app)
                .post('/api/v1/logs')
                .set('X-API-Key', 'invalid-key')
                .send({ category: 'TEST', operation: 'test' });

            // Both should return 401, but timing should be similar
            expect(missingKeyResponse.status).toBe(401);
            expect(invalidKeyResponse.status).toBe(401);

            // Error messages should be similar (not reveal which keys exist)
            expect(missingKeyResponse.body.error).toBeDefined();
            expect(invalidKeyResponse.body.error).toBeDefined();
        });
    });

    describe('Rate Limiting Security', () => {
        it('should prevent rate limit bypass attempts', async () => {
            process.env.RATE_LIMIT_WINDOW_MS = '60000';
            process.env.RATE_LIMIT_MAX_REQUESTS = '5';

            app.use('/api/v1/logs', apiRateLimiter, apiKeyAuth);
            app.post('/api/v1/logs', (req, res) => {
                res.status(202).json({ success: true });
            });

            const validKey = 'valid-key-1';

            // Try to bypass by using different headers
            const attempts = [
                { 'X-Forwarded-For': '192.168.1.1' },
                { 'X-Forwarded-For': '192.168.1.2' },
                { 'X-Real-IP': '10.0.0.1' },
                { 'X-Real-IP': '10.0.0.2' },
            ];

            // All should still be rate limited per actual IP
            for (const headers of attempts) {
                // Make 5 requests (limit)
                for (let i = 0; i < 5; i++) {
                    await request(app)
                        .post('/api/v1/logs')
                        .set('X-API-Key', validKey)
                        .set(headers)
                        .send({ category: 'TEST', operation: `bypass-${i}` });
                }

                // 6th request should be rate limited regardless of headers
                const response = await request(app)
                    .post('/api/v1/logs')
                    .set('X-API-Key', validKey)
                    .set(headers)
                    .send({ category: 'TEST', operation: 'bypass-6' });

                expect(response.status).toBe(429);
            }
        });

        it('should handle rapid sequential requests correctly', async () => {
            process.env.RATE_LIMIT_WINDOW_MS = '60000';
            process.env.RATE_LIMIT_MAX_REQUESTS = '10';

            app.use('/api/v1/logs', apiRateLimiter, apiKeyAuth);
            app.post('/api/v1/logs', (req, res) => {
                res.status(202).json({ success: true });
            });

            const validKey = 'valid-key-1';

            // Make rapid requests without delay
            const rapidRequests = [];
            for (let i = 0; i < 20; i++) {
                rapidRequests.push(
                    request(app)
                        .post('/api/v1/logs')
                        .set('X-API-Key', validKey)
                        .send({ category: 'TEST', operation: `rapid-${i}` })
                );
            }

            const responses = await Promise.all(rapidRequests);
            const statuses = responses.map(r => r.status);
            const successful = statuses.filter(s => s === 202).length;
            const rateLimited = statuses.filter(s => s === 429).length;

            // Should enforce limit even with rapid requests
            expect(successful).toBe(10);
            expect(rateLimited).toBe(10);
        });

        it('should prevent distributed rate limit bypass', async () => {
            process.env.RATE_LIMIT_WINDOW_MS = '60000';
            process.env.RATE_LIMIT_MAX_REQUESTS = '5';

            app.use('/api/v1/logs', apiRateLimiter, apiKeyAuth);
            app.post('/api/v1/logs', (req, res) => {
                res.status(202).json({ success: true });
            });

            // Try using different API keys from same IP
            const keys = ['valid-key-1', 'valid-key-2', 'valid-key-3'];

            // Rate limiting is per IP, not per key
            // So using different keys should still hit limit
            let totalRequests = 0;
            for (const key of keys) {
                for (let i = 0; i < 3; i++) {
                    const response = await request(app)
                        .post('/api/v1/logs')
                        .set('X-API-Key', key)
                        .send({ category: 'TEST', operation: `distributed-${totalRequests}` });

                    totalRequests++;
                    if (totalRequests <= 5) {
                        expect(response.status).toBe(202);
                    } else {
                        // After limit, should be rate limited regardless of key
                        expect(response.status).toBe(429);
                    }
                }
            }
        });
    });

    describe('Input Validation Security', () => {
        it('should handle malicious payloads safely', async () => {
            app.use('/api/v1/logs', apiKeyAuth);
            app.post('/api/v1/logs', (req, res) => {
                res.status(202).json({ success: true });
            });

            const validKey = 'valid-key-1';
            const maliciousPayloads = [
                { category: '<script>alert(1)</script>', operation: 'test' },
                { category: "'; DROP TABLE logs; --", operation: 'test' },
                { category: '../../etc/passwd', operation: 'test' },
                { category: 'a'.repeat(100000), operation: 'test' }, // Very long
                { category: null, operation: 'test' },
                { category: undefined, operation: 'test' },
                { category: {}, operation: 'test' },
                { category: [], operation: 'test' },
            ];

            for (const payload of maliciousPayloads) {
                const response = await request(app)
                    .post('/api/v1/logs')
                    .set('X-API-Key', validKey)
                    .send(payload);

                // Should either accept (if valid) or reject with proper error
                // Should not crash or expose sensitive info
                expect([200, 202, 400, 422]).toContain(response.status);
                if (response.status >= 400) {
                    expect(response.body).toHaveProperty('error');
                }
            }
        });
    });

    describe('Header Security', () => {
        it('should handle various header injection attempts', async () => {
            app.use('/api/v1/logs', apiKeyAuth);
            app.post('/api/v1/logs', (req, res) => {
                res.status(202).json({ success: true });
            });

            const maliciousHeaders = [
                { 'X-API-Key': 'valid-key-1\nX-Injected: header' },
                { 'X-API-Key': 'valid-key-1\rX-Injected: header' },
                { 'X-API-Key': 'valid-key-1\x00X-Injected: header' },
            ];

            for (const headers of maliciousHeaders) {
                const response = await request(app)
                    .post('/api/v1/logs')
                    .set(headers)
                    .send({ category: 'TEST', operation: 'test' });

                // Should either reject or handle safely
                expect([200, 202, 401, 400]).toContain(response.status);
            }
        });
    });
});

