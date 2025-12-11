---
title: "User Guide"
type: "guide"
scope: "project"
project: "stealthflow-observability"
what: "User guide for using StealthFlow Observability Microservice"
why: "Help users understand how to use the service"
how: "Follow this guide to use the observability service"
owner: "StealthFlow Team"
status: "approved"
last_updated: "2025-12-05"
tags: ['user-guide', 'usage', 'stealthflow-observability']
ai_semantics:
  layer: "guides"
  relates_to: ['usage', 'user-guide']
---

# User Guide - How to Use Observability Microservice

## Quick Start

### Submit a log (schema v1)
```bash
curl -X POST http://localhost:3100/api/v1/logs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "schema_version": 1,
    "level": "INFO",
    "service": "checkout-api",
    "environment": "staging",
    "kind": "BUSINESS",
    "category": "orders.checkout",
    "event": "payment_authorized",
    "message": "Payment authorized",
    "context": { "workflowId": "wf-123", "requestId": "req-42" },
    "payload": { "orderId": "ORD-001", "amount": 49.99 }
  }'
```

### Batch submit
```bash
curl -X POST http://localhost:3100/api/v1/logs/batch \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '[{ "schema_version": 1, "level": "INFO", "service": "svc", "environment": "dev", "kind": "SYSTEM", "category": "deploy", "event": "started", "message": "Deployment started" }]'
```

## Schema essentials
- Required: `schema_version`, `log_id` (auto-generated if omitted), `timestamp` (auto-generated), `level`, `service`, `environment`, `kind`, `category`, `event`, `message`.
- Optional: `trace` (trace/span IDs), `context` (metadata such as workflowId/requestId/user), `payload` (business payload), `host`, `tags`, `extra`, `tenant_id`.
- Legacy payloads `{ category, operation, metadata, options }` are still accepted and normalized internally.

## Best practices
- Use correlation IDs (`workflowId`, `requestId`) in `context` to stitch multi-step flows.
- Keep `category` stable and use `event` for specific actions; avoid generic names like `"doWork"`.
- Capture durations in `payload` (e.g., `{ "durationMs": 132 }`) instead of free text.
- Never log secrets, API keys, tokens, passwords, or full PII.

## Querying in Kibana (default http://localhost:5601)
```
event: "payment_authorized" AND service: "checkout-api"
context.workflowId: "wf-123"
kind: "BUSINESS" AND level: "ERROR"
```

## Support
- Health: http://localhost:3100/health
- Metrics: http://localhost:3100/metrics
- Kibana: http://localhost:5601
