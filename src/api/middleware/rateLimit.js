import rateLimit from 'express-rate-limit';
import { recordRateLimitHit } from './metrics.js';

/**
 * Generic rate limiter for API routes.
 * Tunable via env vars.
 */
export const apiRateLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logRateLimitHit(req);
        recordRateLimitHit(req.path);
        res.status(429).json({
            error: 'Too many requests',
            retryAfterSeconds: req.rateLimit?.resetTime
                ? Math.ceil((req.rateLimit.resetTime.getTime() - Date.now()) / 1000)
                : undefined
        });
    }
});

/**
 * Dedicated limiter for batch endpoint (optional tighter limit).
 */
export const batchRateLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    max: parseInt(process.env.RATE_LIMIT_BATCH_MAX || '20', 10),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logRateLimitHit(req);
        recordRateLimitHit(req.path);
        res.status(429).json({
            error: 'Too many batch requests',
            retryAfterSeconds: req.rateLimit?.resetTime
                ? Math.ceil((req.rateLimit.resetTime.getTime() - Date.now()) / 1000)
                : undefined
        });
    }
});

function logRateLimitHit(req) {
    console.warn('[RateLimit] Hit', {
        path: req.path,
        ip: req.ip,
        ts: new Date().toISOString()
    });
}
