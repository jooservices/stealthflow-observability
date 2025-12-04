---
title: "Client Integration Guide"
type: "guide"
scope: "project"
project: "stealthflow-observability"
what: "Guide for integrating observability client into applications"
why: "Help developers integrate the observability service"
how: "Follow this guide to integrate the client"
owner: "StealthFlow Team"
status: "approved"
last_updated: "2025-12-05"
tags: ['integration', 'client', 'usage', 'stealthflow-observability']
ai_semantics:
  layer: "guides"
  relates_to: ['integration', 'client']
---

# Observability Client - Integration Guide

## Quick Start

Copy `observability.js` to your project and use:

```javascript
import logger from './observability.js';

// Simple log
await logger.log('AUTH', 'user_login', { userId: '123' });

// With workflow tracking
const workflowId = `order-${Date.now()}`;
await logger.workflow(workflowId, 'order_created', { orderId: 'ORD-001' });
await logger.workflow(workflowId, 'payment_processed', { amount: 100 });

// Error logging
try {
  await doSomething();
} catch (error) {
  await logger.error(error, { context: 'checkout', userId: '123' });
}
```

## Environment Variables

```bash
OBSERVABILITY_API_URL=http://localhost:3100  # Or your deployed URL
SERVICE_NAME=YourAppName
```

## Log Categories

- `SYSTEM` - System events, errors
- `AUTH` - Authentication, authorization
- `WORKFLOW` - Business workflows
- `CRAWL` - Web scraping
- `DOWNLOAD` - File downloads
- `PERFORMANCE` - Performance metrics
- `SECURITY` - Security events

## API Reference

### `logger.log(category, operation, metadata, options)`

Submit a single log entry.

**Parameters:**
- `category` (string): Log category
- `operation` (string): Operation name
- `metadata` (object): Additional data
- `options` (object): Options
  - `workflowId` - Workflow tracking ID
  - `requestId` - Request tracking ID
  - `level` - Log level (info, warn, error)

**Example:**
```javascript
await logger.log('AUTH', 'login_failed', {
  userId: '123',
  reason: 'invalid_password'
}, {
  level: 'warn',
  requestId: 'req-001'
});
```

### `logger.logBatch(logs)`

Submit multiple logs at once.

**Example:**
```javascript
await logger.logBatch([
  { category: 'AUTH', operation: 'login', metadata: { user: 'A' } },
  { category: 'AUTH', operation: 'logout', metadata: { user: 'B' } }
]);
```

### `logger.workflow(workflowId, operation, metadata)`

Log with workflow tracking.

**Example:**
```javascript
const wfId = `checkout-${Date.now()}`;
await logger.workflow(wfId, 'started', {});
await logger.workflow(wfId, 'payment_ok', { amount: 100 });
await logger.workflow(wfId, 'completed', {});
```

### `logger.error(error, context)`

Log an error.

**Example:**
```javascript
try {
  await riskyOperation();
} catch (err) {
  await logger.error(err, {
    operation: 'riskyOperation',
    userId: '123'
  });
}
```

### Helper Methods

- `logger.auth(operation, metadata, options)` - Auth logs
- `logger.system(operation, metadata, options)` - System logs

## Integration Examples

### Express.js Middleware

```javascript
import logger from './observability.js';

app.use(async (req, res, next) => {
  const requestId = `req-${Date.now()}`;
  req.requestId = requestId;
  
  await logger.system('api_request', {
    method: req.method,
    path: req.path
  }, { requestId });
  
  next();
});
```

### Error Handler

```javascript
app.use(async (err, req, res, next) => {
  await logger.error(err, {
    path: req.path,
    method: req.method,
    requestId: req.requestId
  });
  
  res.status(500).json({ error: err.message });
});
```

### Workflow Tracking

```javascript
async function processOrder(orderData) {
  const workflowId = `order-${Date.now()}`;
  
  await logger.workflow(workflowId, 'order_received', orderData);
  
  const payment = await processPayment(orderData);
  await logger.workflow(workflowId, 'payment_processed', { paymentId: payment.id });
  
  const shipping = await shipOrder(orderData);
  await logger.workflow(workflowId, 'order_shipped', { trackingId: shipping.id });
  
  await logger.workflow(workflowId, 'order_completed', {
    duration: Date.now() - parseInt(workflowId.split('-')[1])
  });
}
```

## Viewing Logs

1. **Kibana**: http://192.168.1.13:5602
   - Query: `operation: "your_operation"`
   - Query workflow: `workflowId: "workflow-id"`

2. **Health Check**: http://localhost:3100/health

## Best Practices

1. **Don't log sensitive data** (passwords, credit cards, API keys)
2. **Use workflow IDs** for tracking related operations
3. **Include context** in error logs
4. **Don't await logs in critical paths** (fire and forget)
5. **Use appropriate log levels**

## Performance Tips

```javascript
// Fire and forget (faster)
logger.log('SYSTEM', 'background_task', {}).catch(() => {});

// Or batch multiple logs
const logs = [];
logs.push({ category: 'SYSTEM', operation: 'step1', metadata: {} });
logs.push({ category: 'SYSTEM', operation: 'step2', metadata: {} });
await logger.logBatch(logs);
```

## Troubleshooting

**Logs not appearing:**
1. Check API is running: `curl http://localhost:3100/health`
2. Check network connectivity
3. Check browser console for errors

**High latency:**
1. Use batch submission
2. Don't await log calls
3. Check network speed

## Support

- Documentation: /docs
- Health: http://localhost:3100/health
- Kibana: http://192.168.1.13:5602
