/**
 * Observability Logger Client
 * Simple wrapper for logging to observability microservice
 * 
 * Usage:
 *   import logger from './observability.js';
 *   await logger.log('AUTH', 'user_login', { userId: '123' });
 */

const OBSERVABILITY_API_URL = process.env.OBSERVABILITY_API_URL || 'http://localhost:3100';
const SERVICE_NAME = process.env.SERVICE_NAME || 'UnknownService';

class ObservabilityLogger {
    constructor(serviceName = SERVICE_NAME) {
        this.serviceName = serviceName;
        this.apiUrl = OBSERVABILITY_API_URL;
    }

    /**
     * Log an action/event
     * @param {string} category - SYSTEM, AUTH, WORKFLOW, CRAWL, etc.
     * @param {string} operation - Operation name (e.g., 'user_login')
     * @param {object} metadata - Additional data
     * @param {object} options - Logging options (workflowId, requestId, level)
     */
    async log(category, operation, metadata = {}, options = {}) {
        const payload = {
            category,
            operation,
            metadata,
            options: {
                serviceName: this.serviceName,
                ...options
            }
        };

        try {
            const response = await fetch(`${this.apiUrl}/api/v1/logs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                console.error('[Observability] Failed:', await response.text());
            }

            return await response.json();
        } catch (error) {
            // Silent fail - don't break app if logging fails
            console.error('[Observability] Error:', error.message);
            return null;
        }
    }

    /**
     * Log batch of events
     */
    async logBatch(logs) {
        const payload = logs.map(log => ({
            category: log.category,
            operation: log.operation,
            metadata: log.metadata || {},
            options: {
                serviceName: this.serviceName,
                ...log.options
            }
        }));

        try {
            const response = await fetch(`${this.apiUrl}/api/v1/logs/batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            return await response.json();
        } catch (error) {
            console.error('[Observability] Batch failed:', error.message);
            return null;
        }
    }

    /**
     * Log error
     */
    async error(error, context = {}) {
        return this.log('SYSTEM', 'error_occurred', {
            errorMessage: error.message,
            errorStack: error.stack,
            ...context
        }, { level: 'error' });
    }

    /**
     * Log with workflow tracking
     */
    async workflow(workflowId, operation, metadata = {}) {
        return this.log('WORKFLOW', operation, metadata, { workflowId });
    }

    /**
     * Helper: Auth logs
     */
    async auth(operation, metadata = {}, options = {}) {
        return this.log('AUTH', operation, metadata, options);
    }

    /**
     * Helper: System logs
     */
    async system(operation, metadata = {}, options = {}) {
        return this.log('SYSTEM', operation, metadata, options);
    }
}

// Export singleton
const logger = new ObservabilityLogger();
export default logger;

// Also export class for custom instances
export { ObservabilityLogger };
