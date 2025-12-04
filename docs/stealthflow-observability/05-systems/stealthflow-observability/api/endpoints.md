---
title: "API Endpoints"
type: "system-doc"
scope: "project"
project: "stealthflow-observability"
what: "Complete API documentation for StealthFlow Observability"
why: "Document all API endpoints, authentication, and usage"
how: "Reference for API integration"
owner: "StealthFlow Team"
status: "approved"
last_updated: "2025-12-05"
tags: ['api', 'endpoints', 'stealthflow-observability']
ai_semantics:
  layer: "system"
  scope: "project"
  project: "stealthflow-observability"
  priority: "high"
  relates_to: ['api', 'integration']
  source: "project"
compliance:
  standards:
    - path: "../../../../master/03-technical/standards/api-standard.md"
      required: true
      checked: "2025-12-05"
---

# API Reference

Complete API documentation for StealthFlow Observability Microservice.

## Standards Compliance

This document follows [API Standard](../../../../master/03-technical/standards/api-standard.md):
- ✅ Versioning: `/api/v1/...` (URI-based)
- ✅ Error format: Standardized JSON
- ✅ Auth: Bearer tokens (API keys)
- ✅ Date format: ISO 8601 UTC

---

## Base URL

- **Local:** http://localhost:3000
- **Development/Production:** Configure via your deployment (default port 3100)

---

## Authentication

### API Key Authentication

All API endpoints (except health and metrics) require an API key in the request header:

**Header:**
```
X-API-Key: <your-api-key>
```

**Configuration:**
- API keys are configured via the `API_KEYS` environment variable (comma-separated)
- Example: `API_KEYS=key1,key2,key3`
- Keys are case-sensitive
- Multiple keys are supported for key rotation

**Endpoints that require authentication:**
- `POST /api/v1/logs` - Submit single log
- `POST /api/v1/logs/batch` - Submit batch logs

**Endpoints that do NOT require authentication:**
- `GET /health` - Health check (for monitoring)
- `GET /health/detailed` - Detailed health (for monitoring)
- `GET /metrics` - Prometheus metrics (for monitoring)
- `GET /` - Service information

**Error Responses:**
- `401 Unauthorized` - Missing or invalid API key
  ```json
  {
    "error": "API key required"
  }
  ```
  or
  ```json
  {
    "error": "Invalid API key"
  }
  ```

### Rate Limiting

Rate limiting is enforced on all API endpoints to prevent abuse:

**Default Limits:**
- Regular endpoint (`/api/v1/logs`): 100 requests per 60 seconds
- Batch endpoint (`/api/v1/logs/batch`): 20 requests per 60 seconds

**Configuration:**
- `RATE_LIMIT_WINDOW_MS` - Time window in milliseconds (default: 60000)
- `RATE_LIMIT_MAX_REQUESTS` - Max requests per window (default: 100)
- `RATE_LIMIT_BATCH_MAX` - Max batch requests per window (default: 20)

**Rate Limit Response:**
- `429 Too Many Requests` - Rate limit exceeded
  ```json
  {
    "error": "Too many requests",
    "retryAfterSeconds": 45
  }
  ```

**Headers:**
- `Retry-After` - Seconds until rate limit resets
- Standard rate limit headers (X-RateLimit-*)

---

## Endpoints

### Submit Single Log

**POST** `/api/v1/logs`

Submit a single log entry. Supports both new format (schema_version: 1) and legacy format (backward compatible).

#### New Format (Recommended)

**Request Body:**
```json
{
  "schema_version": 1,
  "log_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-12-02T10:00:00.123Z",
  "level": "INFO",
  "service": "fbcrawler-worker",
  "environment": "production",
  "kind": "BUSINESS",
  "category": "facebook.graphapi",
  "event": "fb_api_call",
  "message": "Fetched Facebook photos",
  "trace": {
    "trace_id": "550e8400-e29b-41d4-a716-446655440001",
    "span_id": "550e8400-e29b-41d4-a716-446655440002",
    "parent_span_id": null
  },
  "context": {
    "user_id": 123456,
    "page_id": "999888777",
    "ip": "1.2.3.4",
    "route": "/photos"
  },
  "payload": {
    "endpoint": "/me/photos",
    "method": "GET",
    "response_code": 200,
    "response_time_ms": 140
  },
  "host": {
    "hostname": "node-01",
    "ip": "10.0.0.5",
    "vm_id": "log-vm-01",
    "container_id": "fbcrawler-worker-1"
  },
  "tags": ["facebook", "crawler", "api"],
  "extra": {},
  "tenant_id": "project-abc"
}
```

**Required Fields:**
- `schema_version` (number) - Must be `1`
- `log_id` (string) - UUID-4 format
- `timestamp` (string) - ISO 8601 format
- `level` (string) - `TRACE` | `DEBUG` | `INFO` | `WARN` | `ERROR` | `FATAL`
- `service` (string) - Service/app name
- `environment` (string) - `local` | `dev` | `staging` | `production`
- `kind` (string) - `BUSINESS` | `SYSTEM` | `ANALYTICS` | `AUDIT` | `SECURITY`
- `category` (string) - Domain/category (supports wildcard routing)
- `event` (string) - Concrete event name
- `message` (string) - Log message

**Optional Fields:**
- `trace` (object) - Distributed tracing info
- `context` (object) - Contextual data
- `payload` (object) - Event payload
- `host` (object) - Host information
- `tags` (array) - Tags for filtering
- `extra` (object) - Additional custom data
- `tenant_id` (string) - Multi-tenant identifier

#### Legacy Format (Backward Compatible)

**Request Body:**
```json
{
  "category": "SYSTEM",
  "operation": "test_operation",
  "metadata": {},
  "options": {
    "serviceName": "MyService",
    "workflowId": "wf-123",
    "requestId": "req-456",
    "level": "info"
  }
}
```

**Request Fields:**
- `category` (string, required) - Log category
- `operation` (string, required) - Operation name
- `metadata` (object, optional) - Additional data
- `options` (object, optional) - Logging options
  - `serviceName` (string) - Service name
  - `workflowId` (string) - Workflow correlation ID
  - `requestId` (string) - Request correlation ID
  - `level` (string) - Log level (info, warn, error, fatal)
  - `nodeName` (string) - Node/step name
  - `accountUID` (string) - Account identifier
  - `targetUID` (string) - Target identifier
  - `durationMs` (number) - Operation duration

**Response:**
```json
{
  "status": "accepted",
  "timestamp": "2024-11-30T10:30:00.000Z"
}
```

**Status Codes:**
- `202 Accepted` - Log accepted
- `400 Bad Request` - Invalid request (missing category/operation)
- `401 Unauthorized` - Missing or invalid API key
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

---

### Submit Batch Logs

**POST** `/api/v1/logs/batch`

Submit multiple logs at once (max 1000).

**Request Body:**
```json
[
  {
    "category": "SYSTEM",
    "operation": "task_1",
    "metadata": {},
    "options": { "serviceName": "MyService" }
  },
  {
    "category": "SYSTEM",
    "operation": "task_2",
    "metadata": {},
    "options": { "serviceName": "MyService" }
  }
]
```

**Response:**
```json
{
  "status": "accepted",
  "succeeded": 2,
  "failed": 0,
  "total": 2
}
```

**Status Codes:**
- `202 Accepted` - Batch accepted
- `400 Bad Request` - Invalid request (not array or > 1000 items)
- `500 Internal Server Error` - Server error

---

### Health Check

**GET** `/health`

Basic health check with connection status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-11-30T10:30:00.000Z",
  "uptime": 3600,
  "connections": {
    "redis": {
      "status": "ok",
      "latency": 5
    },
    "elasticsearch": {
      "status": "ok",
      "clusterStatus": "green",
      "numberOfNodes": 1
    }
  }
}
```

**Status Codes:**
- `200 OK` - All healthy
- `503 Service Unavailable` - Degraded (one or more connections failed)

---

### Detailed Health

**GET** `/health/detailed`

Detailed diagnostics including system metrics, stream depth, and index stats.

**Response:**
```json
{
  "timestamp": "2024-11-30T10:30:00.000Z",
  "system": {
    "memory": {
      "rss": 12345678,
      "heapTotal": 12345678,
      "heapUsed": 12345678,
      "external": 12345678
    },
    "cpu": {
      "user": 123456,
      "system": 123456
    },
    "uptime": 3600,
    "pid": 12345
  },
  "redis": {
    "status": "ready",
    "streamLength": 0,
    "dlqLength": 0
  },
  "elasticsearch": {
    "cluster": {
      "status": "green",
      "number_of_nodes": 1
    },
    "indexStats": {
      "docCount": 1000,
      "sizeBytes": 12345678,
      "sizeMB": 12
    }
  },
  "environment": {
    "nodeEnv": "development",
    "logIndexAlias": "stealthflow_develop_logs"
  }
}
```

**Status Codes:**
- `200 OK` - Always returns 200 (diagnostic info)

---

### Root Endpoint

**GET** `/`

Service information and available endpoints.

**Response:**
```json
{
  "service": "StealthFlow Observability API",
  "version": "1.0.0",
  "status": "running",
  "endpoints": {
    "health": "/health",
    "healthDetailed": "/health/detailed",
    "submitLog": "POST /api/v1/logs",
    "submitBatch": "POST /api/v1/logs/batch"
  }
}
```

---

## Log Categories

- `SYSTEM` - System events, errors, startup/shutdown
- `AUTH` - Authentication, authorization, login/logout
- `WORKFLOW` - Business workflows, multi-step processes
- `CRAWL` - Web scraping, crawling operations
- `DOWNLOAD` - File downloads, transfers
- `PERFORMANCE` - Performance metrics, timing data
- `SECURITY` - Security events, threats, violations
- `CONFIG` - Configuration changes
- `STATE` - State changes, transitions
- `BROWSER` - Browser-related events

---

## Log Levels

- `info` - Informational messages
- `warn` - Warning messages
- `error` - Error messages
- `fatal` - Fatal errors

---

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error message",
  "message": "Detailed error message",
  "timestamp": "2024-11-30T10:30:00.000Z"
}
```

---

## Rate Limiting

Currently, no rate limiting is implemented (internal network only).

---

## Examples

### Example 1: Simple Log

```bash
curl -X POST http://localhost:3100/api/v1/logs \
  -H "Content-Type: application/json" \
  -d '{
    "category": "SYSTEM",
    "operation": "app_started",
    "metadata": {
      "version": "1.0.0"
    },
    "options": {
      "serviceName": "MyService"
    }
  }'
```

### Example 2: Log with Workflow Tracking

```bash
curl -X POST http://localhost:3100/api/v1/logs \
  -H "Content-Type: application/json" \
  -d '{
    "category": "WORKFLOW",
    "operation": "order_created",
    "metadata": {
      "orderId": "ORD-001",
      "amount": 100
    },
    "options": {
      "serviceName": "OrderService",
      "workflowId": "wf-123",
      "requestId": "req-456"
    }
  }'
```

### Example 3: Error Log

```bash
curl -X POST http://localhost:3100/api/v1/logs \
  -H "Content-Type: application/json" \
  -d '{
    "category": "SYSTEM",
    "operation": "error_occurred",
    "metadata": {
      "errorMessage": "Database connection failed",
      "errorStack": "..."
    },
    "options": {
      "serviceName": "MyService",
      "level": "error"
    }
  }'
```

### Example 4: Batch Logs

```bash
curl -X POST http://localhost:3100/api/v1/logs/batch \
  -H "Content-Type: application/json" \
  -d '[
    {
      "category": "SYSTEM",
      "operation": "task_1",
      "metadata": {},
      "options": { "serviceName": "MyService" }
    },
    {
      "category": "SYSTEM",
      "operation": "task_2",
      "metadata": {},
      "options": { "serviceName": "MyService" }
    }
  ]'
```

---

- [Deployment Guide](../guides/deployment.md) - Deployment instructions

---

## Log Schema

### New Format (Schema Version 1)

Complete log entry structure as stored in Elasticsearch/MongoDB:

```json
{
  "schema_version": 1,
  "log_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-12-02T10:00:00.123Z",
  "level": "INFO",
  "service": "fbcrawler-worker",
  "environment": "production",
  "kind": "BUSINESS",
  "category": "facebook.graphapi",
  "event": "fb_api_call",
  "message": "Fetched Facebook photos",
  "trace": {
    "trace_id": "550e8400-e29b-41d4-a716-446655440001",
    "span_id": "550e8400-e29b-41d4-a716-446655440002",
    "parent_span_id": null
  },
  "context": {
    "user_id": 123456,
    "page_id": "999888777",
    "ip": "1.2.3.4",
    "route": "/photos"
  },
  "payload": {
    "endpoint": "/me/photos",
    "method": "GET",
    "response_code": 200,
    "response_time_ms": 140
  },
  "host": {
    "hostname": "node-01",
    "ip": "10.0.0.5",
    "vm_id": "log-vm-01",
    "container_id": "fbcrawler-worker-1"
  },
  "tags": ["facebook", "crawler", "api"],
  "extra": {},
  "tenant_id": "project-abc"
}
```

### Field Descriptions (New Format)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `schema_version` | number | Yes | Schema version (must be 1) | `1` |
| `log_id` | string (UUID-4) | Yes | Unique log identifier | `"550e8400-e29b-41d4-a716-446655440000"` |
| `timestamp` | string (ISO 8601) | Yes | Log entry timestamp | `"2025-12-02T10:00:00.123Z"` |
| `level` | string | Yes | Log level | `"TRACE"`, `"DEBUG"`, `"INFO"`, `"WARN"`, `"ERROR"`, `"FATAL"` |
| `service` | string | Yes | Service/app name | `"fbcrawler-worker"` |
| `environment` | string | Yes | Environment | `"local"`, `"dev"`, `"staging"`, `"production"` |
| `kind` | string | Yes | Log kind | `"BUSINESS"`, `"SYSTEM"`, `"ANALYTICS"`, `"AUDIT"`, `"SECURITY"` |
| `category` | string | Yes | Domain/category (supports wildcard routing) | `"facebook.graphapi"`, `"business.order"` |
| `event` | string | Yes | Concrete event name | `"fb_api_call"`, `"order_created"` |
| `message` | string | Yes | Log message | `"Fetched Facebook photos"` |
| `trace` | object | No | Distributed tracing info | `{"trace_id": "...", "span_id": "...", "parent_span_id": null}` |
| `context` | object | No | Contextual data | `{"user_id": 123456, "ip": "1.2.3.4"}` |
| `payload` | object | No | Event payload | `{"endpoint": "/me/photos", "response_code": 200}` |
| `host` | object | No | Host information | `{"hostname": "node-01", "ip": "10.0.0.5"}` |
| `tags` | array | No | Tags for filtering | `["facebook", "crawler", "api"]` |
| `extra` | object | No | Additional custom data | `{}` |
| `tenant_id` | string | No | Multi-tenant identifier | `"project-abc"` |

### Routing Rules & Storage Profiles

Logs are routed to different storage based on **kind**, **level**, and **category** using a priority-based routing system:

1. **Overrides** (highest priority) - Category pattern matching
   - `dlq.*` → DLQ profile (MongoDB, 90 days)
   - `audit.*` → AUDIT profile (MongoDB, 3650 days)

2. **By Category** - Domain-based routing
   - `facebook.*` → HOT_SEARCH (Elasticsearch, 30 days)
   - `flickr.*` → HOT_SEARCH (Elasticsearch, 30 days)
   - `stealthflow.*` → HOT_SEARCH (Elasticsearch, 30 days)
   - `business.*` → LONG_TERM (MongoDB, 365 days)
   - `analytics.*` → LONG_TERM (MongoDB, 365 days)

3. **By Kind + Level** - Business logic routing
   - **BUSINESS** + ERROR/WARN/FATAL → CRITICAL_DUAL (ES + MongoDB, 90 days)
   - **BUSINESS** + INFO → LONG_TERM (MongoDB, 365 days)
   - **BUSINESS** + DEBUG/TRACE → DEBUG_SHORT (Elasticsearch, 7 days)
   - **SYSTEM** + ERROR/WARN/INFO/FATAL → HOT_SEARCH (Elasticsearch, 30 days)
   - **SYSTEM** + DEBUG/TRACE → DEBUG_SHORT (Elasticsearch, 7 days)
   - **ANALYTICS** + * → LONG_TERM (MongoDB, 365 days)
   - **AUDIT** + * → AUDIT (MongoDB, 3650 days)
   - **SECURITY** + ERROR/WARN/FATAL → CRITICAL_DUAL (ES + MongoDB, 90 days)
   - **SECURITY** + INFO → HOT_SEARCH (Elasticsearch, 30 days)
   - **SECURITY** + DEBUG/TRACE → DEBUG_SHORT (Elasticsearch, 7 days)

4. **Fallback** → HOT_SEARCH (Elasticsearch, 30 days)

### Storage Profiles

| Profile | Destinations | TTL | Index/Collection |
|---------|-------------|-----|------------------|
| HOT_SEARCH | Elasticsearch | 30 days | `logs-hot-YYYY.MM.DD` |
| LONG_TERM | MongoDB | 365 days | `logs_long_term` |
| AUDIT | MongoDB | 3650 days | `logs_audit` |
| DEBUG_SHORT | Elasticsearch | 7 days | `logs-debug-YYYY.MM.DD` |
| CRITICAL_DUAL | Elasticsearch + MongoDB | 90 days | `logs-critical-YYYY.MM.DD` / `logs_critical` |
| DLQ | MongoDB | 90 days | `logs_dlq` |

See [Routing Configuration](../development/architecture.md#routing-configuration) for details.
