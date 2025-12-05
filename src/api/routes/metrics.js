import { Router } from 'express';
import { getMetrics } from '../middleware/metrics.js';

const router = Router();

/**
 * GET /metrics
 * Expose Prometheus metrics
 * No authentication required (for monitoring systems)
 */
router.get('/', async (req, res) => {
    try {
        const metrics = await getMetrics();
        res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
        res.send(metrics);
    } catch (error) {
        console.error('[Metrics] Error generating metrics:', error);
        res.status(500).json({ error: 'Failed to generate metrics' });
    }
});

export default router;



