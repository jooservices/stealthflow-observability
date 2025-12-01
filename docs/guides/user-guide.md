# User Guide - How to Use Observability Microservice

## Quick Start

### Submit a Log
```javascript
import { logAction, CATEGORY } from './shared/logging/actionLogger.js';

await logAction(
  CATEGORY.SYSTEM,
  'my_operation',
  { data: 'my data' },
  { serviceName: 'MyService' }
);
```

### View Logs
1. Open Kibana: http://192.168.1.13:5602
2. Search: `operation: "my_operation"`

## API Reference

### Categories
- `CRAWL`, `DOWNLOAD`, `AUTH`, `STATE`, `BROWSER`
- `CONFIG`, `PERFORMANCE`, `SECURITY`, `SYSTEM`, `WORKFLOW`

### Correlation IDs
```javascript
const workflowId = generateWorkflowId();

// Use in all related logs
await logAction(CATEGORY.AUTH, 'step1', {}, { workflowId, serviceName: 'MyService' });
await logAction(CATEGORY.AUTH, 'step2', {}, { workflowId, serviceName: 'MyService' });

// Query in Kibana: workflowId: "wf-..."
```

### Error Logging
```javascript
try {
  await operation();
} catch (error) {
  await logError(error, {
    category: CATEGORY.SYSTEM,
    operation: 'operation_failed',
    serviceName: 'MyService'
  });
}
```

## Best Practices

✅ **DO:**
- Use correlation IDs (workflowId, requestId)
- Log start and end of operations
- Include duration: `{ durationMs: Date.now() - start }`
- Use appropriate categories

❌ **DON'T:**
- Log passwords, API keys, credit cards
- Log excessively (every loop)
- Use generic operation names

## Querying in Kibana

```
# By operation
operation: "user_login"

# By service
serviceName: "AuthService"

# By workflow
workflowId: "wf-123"

# Errors only
level: "error"

# Combined
category: "AUTH" AND level: "error"
```

## Support

- Health: http://192.168.1.13:3100/health
- Metrics: http://192.168.1.13:3100/metrics
- Kibana: http://192.168.1.13:5602
