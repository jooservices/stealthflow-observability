import { Counter, Histogram, Registry } from 'prom-client';

/**
 * Prometheus metrics registry for security and API metrics
 */
export const metricsRegistry = new Registry();

/**
 * Security Metrics
 */

// Authentication failures counter
export const authFailuresCounter = new Counter({
    name: 'api_auth_failures_total',
    help: 'Total number of API authentication failures',
    labelNames: ['reason'], // missing_key, invalid_key
    registers: [metricsRegistry]
});

// Rate limit hits counter
export const rateLimitHitsCounter = new Counter({
    name: 'api_rate_limit_hits_total',
    help: 'Total number of rate limit hits',
    labelNames: ['endpoint'], // /api/v1/logs, /api/v1/logs/batch
    registers: [metricsRegistry]
});

// Successful authentications counter
export const authSuccessCounter = new Counter({
    name: 'api_auth_success_total',
    help: 'Total number of successful API authentications',
    registers: [metricsRegistry]
});

// API requests counter
export const apiRequestsCounter = new Counter({
    name: 'api_requests_total',
    help: 'Total number of API requests',
    labelNames: ['method', 'endpoint', 'status'], // GET, POST, /api/v1/logs, 200, 401, etc.
    registers: [metricsRegistry]
});

// API request duration histogram
export const apiRequestDuration = new Histogram({
    name: 'api_request_duration_seconds',
    help: 'Duration of API requests in seconds',
    labelNames: ['method', 'endpoint'],
    buckets: [0.1, 0.5, 1, 2, 5, 10],
    registers: [metricsRegistry]
});

/**
 * Helper functions to record metrics
 */

export function recordAuthFailure(reason) {
    authFailuresCounter.inc({ reason });
}

export function recordAuthSuccess() {
    authSuccessCounter.inc();
}

export function recordRateLimitHit(endpoint) {
    rateLimitHitsCounter.inc({ endpoint });
}

export function recordApiRequest(method, endpoint, status, duration) {
    apiRequestsCounter.inc({ method, endpoint, status });
    if (duration !== undefined) {
        apiRequestDuration.observe({ method, endpoint }, duration);
    }
}

/**
 * Get metrics in Prometheus format
 */
export async function getMetrics() {
    return await metricsRegistry.metrics();
}

