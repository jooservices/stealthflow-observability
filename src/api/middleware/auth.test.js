import { apiKeyAuth } from './auth.js';

describe('API Key Authentication Middleware', () => {
    let req, res, next;

    beforeEach(() => {
        // Mock request
        req = {
            headers: {},
            ip: '127.0.0.1',
            path: '/api/v1/logs'
        };

        // Mock response
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };

        // Mock next function
        next = jest.fn();

        // Clear environment variables
        delete process.env.API_KEYS;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Missing API Key', () => {
        it('should return 401 when X-API-Key header is missing', () => {
            req.headers = {};

            apiKeyAuth(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                error: 'API key required'
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('should return 401 when X-API-Key header is empty', () => {
            req.headers = { 'x-api-key': '' };

            apiKeyAuth(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                error: 'API key required'
            });
            expect(next).not.toHaveBeenCalled();
        });
    });

    describe('Invalid API Key', () => {
        it('should return 401 when API key is not in valid keys list', () => {
            process.env.API_KEYS = 'valid-key-1,valid-key-2';
            req.headers = { 'x-api-key': 'invalid-key' };

            apiKeyAuth(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Invalid API key'
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('should return 401 when no valid keys are configured', () => {
            process.env.API_KEYS = '';
            req.headers = { 'x-api-key': 'any-key' };

            apiKeyAuth(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Invalid API key'
            });
            expect(next).not.toHaveBeenCalled();
        });
    });

    describe('Valid API Key', () => {
        it('should call next() when API key is valid (single key)', () => {
            process.env.API_KEYS = 'valid-key-1';
            req.headers = { 'x-api-key': 'valid-key-1' };

            apiKeyAuth(req, res, next);

            expect(res.status).not.toHaveBeenCalled();
            expect(res.json).not.toHaveBeenCalled();
            expect(next).toHaveBeenCalled();
            expect(req.apiKeyId).toBeDefined();
            expect(req.apiKeyId).toMatch(/^key_\d+$/);
        });

        it('should call next() when API key is valid (multiple keys)', () => {
            process.env.API_KEYS = 'key1,key2,key3';
            req.headers = { 'x-api-key': 'key2' };

            apiKeyAuth(req, res, next);

            expect(res.status).not.toHaveBeenCalled();
            expect(res.json).not.toHaveBeenCalled();
            expect(next).toHaveBeenCalled();
            expect(req.apiKeyId).toBeDefined();
        });

        it('should handle keys with whitespace', () => {
            process.env.API_KEYS = ' key1 , key2 , key3 ';
            req.headers = { 'x-api-key': 'key2' };

            apiKeyAuth(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('should handle case-sensitive keys', () => {
            process.env.API_KEYS = 'Key1,Key2';
            req.headers = { 'x-api-key': 'key1' }; // lowercase

            apiKeyAuth(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Invalid API key'
            });
        });
    });

    describe('API Key Hashing', () => {
        it('should attach hashed key identifier to request', () => {
            process.env.API_KEYS = 'test-key-123';
            req.headers = { 'x-api-key': 'test-key-123' };

            apiKeyAuth(req, res, next);

            expect(req.apiKeyId).toBeDefined();
            expect(typeof req.apiKeyId).toBe('string');
            expect(req.apiKeyId).toMatch(/^key_/);
        });

        it('should generate consistent hash for same key', () => {
            process.env.API_KEYS = 'test-key';
            req.headers = { 'x-api-key': 'test-key' };

            apiKeyAuth(req, res, next);
            const hash1 = req.apiKeyId;

            // Reset and call again
            req.apiKeyId = undefined;
            apiKeyAuth(req, res, next);
            const hash2 = req.apiKeyId;

            expect(hash1).toBe(hash2);
        });
    });

    describe('Edge Cases', () => {
        it('should handle very long API keys', () => {
            const longKey = 'a'.repeat(1000);
            process.env.API_KEYS = longKey;
            req.headers = { 'x-api-key': longKey };

            apiKeyAuth(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('should handle special characters in keys', () => {
            process.env.API_KEYS = 'key-with-special-chars-!@#$%^&*()';
            req.headers = { 'x-api-key': 'key-with-special-chars-!@#$%^&*()' };

            apiKeyAuth(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('should handle empty API_KEYS environment variable', () => {
            process.env.API_KEYS = '';
            req.headers = { 'x-api-key': 'any-key' };

            apiKeyAuth(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
        });

        it('should handle undefined API_KEYS environment variable', () => {
            delete process.env.API_KEYS;
            req.headers = { 'x-api-key': 'any-key' };

            apiKeyAuth(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
        });
    });
});
