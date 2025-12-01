# API Reference

Complete API documentation for StealthFlow Observability Microservice.

---

## Base URL

- **Local:** http://localhost:3000
- **Development/Production:** Configure via your deployment (default port 3100)

---

## Authentication

Currently, no authentication is required (internal network only).

---

## Endpoints

### Submit Single Log

**POST** `/api/v1/logs`

Submit a single log entry.

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
- `category` (string, required) - Log category (SYSTEM, AUTH, WORKFLOW, etc.)
- `operation` (string, required) - Operation name
- `metadata` (object, optional) - Additional data (namespaced by category)
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

## See Also

- [User Guide](../guides/user-guide.md) - How to use the service
- [Client Integration](../guides/client-integration.md) - Client library usage
- [Deployment Guide](../guides/deployment.md) - Deployment instructions

