---
title: "API Endpoints"
type: "system-doc"
scope: "project"
project: "stealthflow-observability"
what: "HTTP interface for submitting and observing logs"
why: "Document how to send logs, check health, and scrape metrics"
how: "Use these endpoints with API key authentication"
owner: "StealthFlow Team"
status: "approved"
last_updated: "2025-12-05"
tags: ['api', 'endpoints', 'logging', 'stealthflow-observability']
ai_semantics:
  layer: "system"
  relates_to: ['api', 'logging', 'health']
---

# API Endpoints

Base URL defaults to `http://localhost:3000` when running locally (`docker-compose` maps it to `http://localhost:3100`). All API routes require an `X-API-Key` header sourced from `API_KEYS` in `.env`.

**Rate limits**
- Single log endpoint: `RATE_LIMIT_MAX_REQUESTS` per `RATE_LIMIT_WINDOW_MS` (defaults: 100 requests per 60s)
- Batch endpoint: `RATE_LIMIT_BATCH_MAX` per `RATE_LIMIT_WINDOW_MS` (default: 20 requests per 60s)

## Submit Log — `POST /api/v1/logs`

Accepts either the v1 schema (preferred) or the legacy `{ category, operation, metadata, options }` shape.

### Required fields (v1)
- `schema_version`: `1`
- `log_id`: UUID v4 (auto-generated if omitted)
- `timestamp`: ISO-8601 (auto-generated if omitted)
- `level`: TRACE | DEBUG | INFO | WARN | ERROR | FATAL
- `service`: service name (string)
- `environment`: local | dev | development | staging | production
- `kind`: BUSINESS | SYSTEM | ANALYTICS | AUDIT | SECURITY
- `category`: domain/category (string)
- `event`: operation or event name (string)
- `message`: human-readable description

### Optional fields
- `trace` (e.g., `{ "trace_id": "...", "span_id": "...", "parent_span_id": "..." }`)
- `context` (object for metadata; `workflowId`, `requestId`, etc.)
- `payload` (object for structured payload)
- `host` (defaults to hostname and local IP)
- `tags` (array), `extra` (object), `tenant_id` (string|null)

### Field reference (v1 schema)
| Field | Type | Required | Notes/Constraints |
| --- | --- | --- | --- |
| `schema_version` | number | yes | Must be `1`. |
| `log_id` | UUID v4 | yes\* | Auto-generated if omitted. |
| `timestamp` | ISO-8601 string | yes\* | Auto-generated if omitted. |
| `level` | string | yes | One of `TRACE, DEBUG, INFO, WARN, ERROR, FATAL` (case-insensitive). |
| `service` | string | yes | Service emitting the log. |
| `environment` | string | yes | One of `local, dev, development, staging, production`. |
| `kind` | string | yes | One of `BUSINESS, SYSTEM, ANALYTICS, AUDIT, SECURITY`. |
| `category` | string | yes | Domain/category, used by routing rules (supports dot notation). |
| `event` | string | yes | Operation/event name. |
| `message` | string | yes | Human-readable summary. |
| `trace` | object | no | `{ trace_id, span_id, parent_span_id }` if available. |
| `context` | object | no | Metadata (common: `workflowId`, `requestId`, `user_id`, `accountUID`). |
| `payload` | object | no | Structured business payload (e.g., `orderId`, `durationMs`). |
| `host` | object | no | Defaults to container hostname + detected local IP. |
| `tags` | string[] | no | Free-form tags. |
| `extra` | object | no | Catch-all for additional attributes. |
| `tenant_id` | string | no | Tenant identifier when multi-tenant. |

*`log_id` and `timestamp` are filled by the API if omitted.

### Example
```bash
curl -X POST http://localhost:3000/api/v1/logs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "schema_version": 1,
    "level": "INFO",
    "service": "orders-api",
    "environment": "staging",
    "kind": "BUSINESS",
    "category": "orders.checkout",
    "event": "payment_authorized",
    "message": "Payment authorized",
    "context": { "workflowId": "wf-123", "requestId": "req-42" },
    "payload": { "orderId": "ORD-001", "amount": 49.99 }
  }'
```

**Response:** `202 Accepted` with generated `log_id` and `timestamp`.

## Submit Batch — `POST /api/v1/logs/batch`

Body: array of up to 1000 log objects (v1 or legacy format). Returns counts for succeeded/failed entries. Rate-limited separately via `RATE_LIMIT_BATCH_MAX`.

## Health — `GET /health`

Lightweight health summary with Redis/Elasticsearch connectivity. Returns HTTP 200 when all dependencies are OK, 503 when degraded.

## Detailed Health — `GET /health/detailed`

Extended diagnostics: process stats, Redis stream sizes (`logs:stream`, `logs:failed`), Elasticsearch cluster health, index stats (using `LOG_INDEX_ALIAS`).

## Metrics — `GET /metrics`

Prometheus metrics covering auth success/failures, rate-limit hits, request totals, and request durations. No authentication is applied by default.

## Root — `GET /`

Service info and advertised endpoints.

## Persistence & Routing Notes
- Requests are written to the Redis stream defined by `LOG_STREAM_NAME` (default `logs:stream`).
- The log worker consumes the stream and routes each log using `src/config/routingRules.js` + `src/config/storageProfiles.js`.
- Default destinations:
  - Elasticsearch bulk indexing using `LOG_INDEX_ALIAS` (or per-profile `indexPrefix` with date suffix).
  - Optional MongoDB write when the selected storage profile lists `mongodb`.
- If Redis is unavailable, the API writes to local fallback files at `FALLBACK_LOG_DIR` and responds with `500`.

## Legacy Format (still accepted)
```json
{
  "category": "SYSTEM",
  "operation": "startup",
  "metadata": { "nodeName": "api-1" },
  "options": {
    "serviceName": "orders-api",
    "level": "INFO",
    "workflowId": "wf-123",
    "requestId": "req-1"
  }
}
```
Legacy payloads are normalized into the v1 shape internally and routed with the same profiles.
