import { recordAuthFailure, recordAuthSuccess } from './metrics.js';

/**
 * API key authentication middleware.
 * Reads comma-separated keys from env `API_KEYS`.
 */
export function apiKeyAuth(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    const validKeys = getValidApiKeys();

    if (!apiKey) {
        logAuthFailure(req, 'missing_key');
        recordAuthFailure('missing_key');
        return res.status(401).json({ error: 'API key required' });
    }

    if (!validKeys.includes(apiKey)) {
        logAuthFailure(req, 'invalid_key');
        recordAuthFailure('invalid_key');
        return res.status(401).json({ error: 'Invalid API key' });
    }

    // Attach hashed identifier if we need to tag metrics/logs
    req.apiKeyId = hashApiKey(apiKey);
    recordAuthSuccess();
    next();
}

function getValidApiKeys() {
    const keysEnv = process.env.API_KEYS || '';
    return keysEnv
        .split(',')
        .map(k => k.trim())
        .filter(Boolean);
}

function logAuthFailure(req, reason) {
    console.warn('[Auth] Failure', {
        reason,
        ip: req.ip,
        path: req.path,
        ts: new Date().toISOString()
    });
}

function hashApiKey(key) {
    // Lightweight hash to avoid logging raw key
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        hash = (hash << 5) - hash + key.charCodeAt(i);
        hash |= 0; // Convert to 32bit int
    }
    return `key_${Math.abs(hash)}`;
}
