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

Use any HTTP client. Example with `node:fetch` (Node 22+):

```javascript
import fetch from 'node-fetch';

const API_URL = process.env.OBS_API_URL || 'http://localhost:3100';
const API_KEY = process.env.OBS_API_KEY;

export async function logEvent(payload) {
  const res = await fetch(`${API_URL}/api/v1/logs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY
    },
    body: JSON.stringify({
      schema_version: 1,
      level: 'INFO',
      service: 'checkout-api',
      environment: 'staging',
      kind: 'BUSINESS',
      category: 'orders.checkout',
      event: 'payment_authorized',
      message: 'Payment authorized',
      ...payload
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to log: ${res.status} ${text}`);
  }
}
```

## Environment Variables

```bash
OBS_API_URL=http://localhost:3100   # Or your deployed URL
OBS_API_KEY=<your-api-key>
```

## Payload shape (schema v1)
- Required: `schema_version`, `log_id` (optional; generated if absent), `timestamp` (generated if absent), `level`, `service`, `environment`, `kind`, `category`, `event`, `message`.
- Optional: `trace`, `context` (workflowId/requestId/user), `payload`, `host`, `tags`, `extra`, `tenant_id`.
- Legacy shape `{ category, operation, metadata, options }` remains supported.

## Integration patterns

### Express middleware example
```javascript
import { logEvent } from './observability.js'; // wrapper around fetch above

app.use(async (req, res, next) => {
  req.requestId = `req-${Date.now()}`;
  try {
    await logEvent({
      context: { requestId: req.requestId },
      payload: { method: req.method, path: req.path },
      event: 'http_request',
      category: 'api.gateway',
      message: 'Incoming request'
    });
  } catch (err) {
    console.error('Log failed', err.message);
  }
  next();
});
```

### Batch sending
Collect logs and send once:
```javascript
await fetch(`${API_URL}/api/v1/logs/batch`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY
  },
  body: JSON.stringify(logsArray) // up to 1000 entries
});
```

## Viewing & troubleshooting
- Kibana (default): http://localhost:5601  
  Example query: `category: "orders.checkout" AND event: "payment_authorized"`.
- Health: http://localhost:3100/health  
- Metrics: http://localhost:3100/metrics
