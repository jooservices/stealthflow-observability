# Logging System - Complete Reference

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Components](#components)
4. [Log Schema](#log-schema)
5. [API Reference](#api-reference)
6. [Configuration](#configuration)
7. [Usage Patterns](#usage-patterns)
8. [Real-World Examples](#real-world-examples)
9. [Observers](#observers)
10. [LogWorker](#logworker)
11. [Quick Start](#quick-start)
12. [Viewing Logs](#viewing-logs)
13. [Frequently Asked Questions (FAQ)](#frequently-asked-questions-faq)
14. [Troubleshooting](#troubleshooting)
15. [Common Mistakes](#common-mistakes)
16. [Testing](#testing)
17. [Performance Considerations](#performance-considerations)
18. [Security Considerations](#security-considerations)
19. [Integration with Other Loggers](#integration-with-other-loggers)
20. [Best Practices](#best-practices)

---

## Overview

### What is the Logging System?

The StealthFlow logging system is a **structured, asynchronous logging infrastructure** that:
- Collects business events, errors, and metrics
- Buffers logs in Redis Stream (async, non-blocking)
- Processes logs via LogWorker (separate process)
- Stores logs in Elasticsearch for querying and analytics
- Provides visualization via Kibana

### Key Characteristics

- **Structured**: All logs follow a consistent schema
- **Asynchronous**: Non-blocking writes (Redis Stream buffer)
- **Correlated**: workflowId/requestId for log correlation
- **Scalable**: Redis Stream + Elasticsearch handle high volume
- **Queryable**: Full-text search and analytics in Elasticsearch

---

## Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Code                         │
│  (Observers, Steps, Services)                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ logAction() / logError() / logMetric()
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              actionLogger.js                                │
│  - Builds log entry with schema                            │
│  - Writes to Redis Stream                                  │
│  - Non-blocking (async)                                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Redis Stream (logs:stream)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Redis Stream Buffer                            │
│  - In-memory message queue                                 │
│  - Handles backpressure                                    │
│  - Consumer group: stealthflow-log-workers                 │
│  - Message format: { id: "...", message: { data: "..." } } │
│  - Data field: JSON string of log entry                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ LogWorker (separate process)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              LogWorker                                       │
│  - Consumes from Redis Stream                               │
│  - Batch processing (200 logs/batch)                        │
│  - Writes to Elasticsearch                                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Bulk API
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Elasticsearch                                  │
│  - Index: stealthflow_develop_logs                         │
│  - Full-text search                                         │
│  - Analytics & aggregation                                  │
│  - Dynamic mapping (auto-created, no explicit schema)      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Query API
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Kibana                                          │
│  - Data visualization                                       │
│  - Dashboards                                               │
│  - Discover (raw logs)                                      │
└─────────────────────────────────────────────────────────────┘
```

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Main Application                          │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Observers    │  │ Steps        │  │ Services     │     │
│  │ (4)          │  │ (6+)         │  │              │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                 │                  │              │
│         └─────────────────┴──────────────────┘             │
│                            │                                │
│                            ▼                                │
│                  ┌─────────────────┐                       │
│                  │ actionLogger.js  │                       │
│                  │ (Core API)      │                       │
│                  └────────┬─────────┘                       │
│                           │                                │
└───────────────────────────┼────────────────────────────────┘
                            │
                            │ Redis Stream
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Redis Stream                              │
│  Stream: logs:stream                                         │
│  Consumer Group: stealthflow-log-workers                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ LogWorker (separate process)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    LogWorker                                  │
│  - Batch size: 200                                           │
│  - Block timeout: 2000ms                                     │
│  - Consumer: worker-{pid}-{random}                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Bulk API
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Elasticsearch                             │
│  Index: stealthflow_develop_logs                             │
│  Schema: Structured log entries (dynamic mapping)           │
│  Note: Index auto-created, field types inferred from data    │
└─────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. actionLogger.js

**Location**: `src/shared/logging/actionLogger.js`

**Purpose**: Core logging API used throughout the application

**Exports**:
- `logAction(category, operation, metadata, options)` - Log business events
- `logError(error, context)` - Log errors
- `logMetric(name, value, tags)` - Log performance metrics
- `CATEGORY` - Log categories enum
- `LEVEL` - Log levels enum
- `ERROR_SEVERITY` - Error severity enum
- `generateWorkflowId()` - Generate workflow ID
- `generateRequestId()` - Generate request ID

**Dependencies**:
- Redis client (for Stream writes)
- Environment variables (LOG_STREAM_NAME)

**Usage**:
```javascript
import { logAction, CATEGORY } from '../../shared/logging/actionLogger.js';

await logAction(
  CATEGORY.AUTH,
  'export_start',
  { profileName: 'profile1' },
  {
    workflowId: 'wf-123',
    requestId: 'req-456',
    nodeName: 'ExportCookies.start',
    serviceName: 'ExportCookies'
  }
);
```

### 2. LogWorker

**Location**: `src/infrastructure/logging/logWorker.js`

**Purpose**: Background worker that processes logs from Redis Stream to Elasticsearch

**Features**:
- Consumer group pattern (multiple workers supported)
- Batch processing (200 logs per batch)
- Error handling and retry
- Automatic consumer group creation

**Configuration**:
- `LOG_STREAM_NAME` - Redis stream name (default: `logs:stream`)
- `LOG_CONSUMER_GROUP` - Consumer group name (default: `stealthflow-log-workers`)
- `LOG_BATCH_SIZE` - Batch size (default: `200`)
- `LOG_BLOCK_TIMEOUT_MS` - Block timeout (default: `2000ms`)
- `LOG_INDEX_ALIAS` - Elasticsearch index (default: `stealthflow_develop_logs`)

**Usage**:
```bash
# Start LogWorker
node scripts/log-worker.mjs

# Or in background
nohup node scripts/log-worker.mjs > log-worker.log 2>&1 &
```

### 3. Redis Client

**Location**: `src/infrastructure/logging/redisClient.js`

**Purpose**: Redis connection management for logging

**Functions**:
- `getRedisClient()` - Get shared Redis client (singleton)
- `createStreamClient()` - Create new Redis client for streams

**Configuration**:
- `LOG_REDIS_URL` or `REDIS_URL` - Redis connection URL
- Default: `redis://localhost:6379`

### 4. Elasticsearch Client

**Location**: `src/infrastructure/logging/esClientOptions.js`

**Purpose**: Elasticsearch connection configuration

**Configuration**:
- `ELASTICSEARCH_URL` - Elasticsearch URL (default: `http://127.0.0.1:9200`)
- `ELASTICSEARCH_API_KEY` - API key (optional)
- `ELASTICSEARCH_USERNAME` / `ELASTICSEARCH_PASSWORD` - Basic auth (optional)
- `ELASTICSEARCH_TLS_REJECT_UNAUTHORIZED` - TLS verification (default: true)

### 5. ElasticsearchLogger

**Location**: `src/infrastructure/logging/ElasticsearchLogger.js`

**Purpose**: Alternative logger implementation (implements ILogger interface)

**Usage**: Used by CrawlerServiceFactory for structured logging

**Note**: Currently not widely used, most code uses `actionLogger.js` directly

### 6. ILogger Interface

**Location**: `src/shared/logging/ILogger.js`

**Purpose**: Interface for logger implementations

**Methods**:
- `logAction(category, operation, metadata, options)`
- `logError(error, context)`

### 7. LoggingDecorator

**Location**: `src/shared/logging/LoggingDecorator.js`

**Purpose**: Decorator pattern for automatic logging of service methods

**Features**:
- Automatic start/success/error logging
- Duration tracking
- Context propagation (workflowId, requestId)
- AsyncLocalStorage for context

**Usage**: Used by CrawlerServiceFactory

---

## Log Schema

### Complete Log Entry Structure

```javascript
{
  // ===== TIMESTAMP & SEVERITY =====
  "timestamp": "2024-11-30T10:30:00.000Z",  // ISO 8601
  "level": "info",  // enum: "info" | "warn" | "error" | "fatal"
  
  // ===== TRACING (Correlation IDs) =====
  "workflowId": "wf-1234567890-abc123",  // Optional - for workflow correlation
  "requestId": "req-uuid-456",            // Required - request correlation ID
  "nodeName": "ExportCookies.start",      // Optional - logical step/node name
  "serviceName": "ExportCookies",         // Optional - service/module name
  
  // ===== CLASSIFICATION =====
  "category": "AUTH",  // enum: CRAWL | DOWNLOAD | AUTH | STATE | BROWSER | CONFIG | PERFORMANCE | SECURITY | SYSTEM | WORKFLOW
  "operation": "export_start",  // String (recommended format: {category}_{action}, e.g., "export_start", "crawl_success")
  
  // ===== ENTITY (Denormalized) =====
  "accountUID": "100000563370253",  // Optional - account/user ID
  "targetUID": "100000123456789",   // Optional - target entity ID
  
  // ===== RUNTIME / ENVIRONMENT =====
  "durationMs": 1234,  // Optional - operation duration in milliseconds
  "host": "hostname.local",  // Hostname where log was generated
  "env": "development",  // enum: "production" | "staging" | "development" | "local"
  
  // ===== METADATA (Namespaced by Category) =====
  "metadata": {
    // Category-specific namespace
    "auth": {
      "profileName": "profile1",
      "profilePath": "/path/to/profile",
      "cookieCount": 15,
      "readiness": { "ready": true }
    },
    // Or "crawl": { ... }, "download": { ... }, etc.
  },
  
  // ===== ERROR (Only if error occurred) =====
  "error": {
    "name": "Error",
    "message": "Error message",
    "stack": "Error stack trace",
    "code": "ERROR_CODE",
    "severity": "soft",  // enum: "fatal" | "retryable" | "soft"
    "phase": "AUTH"  // Category where error occurred
  }
}
```

### Schema Fields Explained

#### Timestamp & Severity
- **timestamp**: ISO 8601 format, always present
- **level**: Log severity level (info, warn, error, fatal)

#### Tracing Fields
- **workflowId**: Groups related operations (e.g., all steps in an export)
- **requestId**: Unique ID for each request (auto-generated if not provided)
- **nodeName**: Logical step/node name (format: `ServiceName.nodeName`)
- **serviceName**: Service/module name (e.g., `ExportCookies`, `Crawler`)

#### Classification
- **category**: High-level classification (CRAWL, AUTH, SYSTEM, etc.)
- **operation**: Specific action (e.g., `export_start`, `crawl_success`)

#### Entity Fields
- **accountUID**: Account/user identifier
- **targetUID**: Target entity identifier (e.g., target profile UID)

#### Runtime Fields
- **durationMs**: Operation duration (for performance tracking)
- **host**: Hostname where log was generated
- **env**: Environment (production, staging, development, local)

#### Metadata
- **metadata**: Category-specific data, namespaced by category
  - Example: `metadata.auth` for AUTH category
  - Example: `metadata.crawl` for CRAWL category
  - **Important**: The following fields are automatically extracted from metadata and placed at root level:
    - `accountUID` → moved to root `accountUID` field
    - `targetUID` → moved to root `targetUID` field
    - `durationMs` → moved to root `durationMs` field
  - These fields are removed from the namespaced metadata object to avoid duplication

#### Error Fields
- **error**: Present only when error occurred
  - **name**: Error type/name
  - **message**: Error message
  - **stack**: Stack trace
  - **code**: Error code
  - **severity**: Error severity (fatal, retryable, soft)
  - **phase**: Category where error occurred

---

## API Reference

### logAction()

**Signature**:
```javascript
async function logAction(
  category: string,
  operation: string,
  metadata: object = {},
  options: object = {}
): Promise<void>
```

**Parameters**:
- **category** (required): One of `CATEGORY.*` values
- **operation** (required): Operation name (e.g., `export_start`, `cookies_saved`)
- **metadata** (optional): Business data/metadata (will be namespaced by category)
- **options** (optional): Logging options
  - `workflowId`: Workflow correlation ID
  - `requestId`: Request correlation ID (auto-generated if not provided)
  - `nodeName`: Node/step name (format: `ServiceName.nodeName`)
  - `serviceName`: Service name
  - `level`: Log level (default: `LEVEL.INFO`)
  - `accountUID`: Account identifier
  - `targetUID`: Target identifier
  - `durationMs`: Operation duration
  - `host`: Hostname override
  - `errorSeverity`: Error severity (for errors)

**Returns**: `Promise<void>` (non-blocking, errors are caught internally)

**Default Values** (when options not provided):
- `requestId`: Auto-generated UUID (via `generateRequestId()`)
- `workflowId`: `null`
- `nodeName`: `"UnknownNode"`
- `serviceName`: `"UnknownService"`
- `level`: `LEVEL.INFO`
- `host`: `os.hostname()`
- `env`: `process.env.NODE_ENV || "local"`

**Error Handling**:
- If Redis write fails, error is logged to `console.error` with message: `"[logging] Failed to push log entry to Redis"`
- The log entry payload is also logged to console for debugging
- The application continues normally (non-blocking behavior)
- **Important**: Failed log entries are lost and not retried automatically

**Example**:
```javascript
import { logAction, CATEGORY } from '../../shared/logging/actionLogger.js';

await logAction(
  CATEGORY.AUTH,
  'export_start',
  {
    profileName: 'profile1',
    profilePath: '/path/to/profile',
    cookieCount: 15
  },
  {
    workflowId: 'wf-1234567890-abc123',
    requestId: 'req-uuid-456',
    nodeName: 'ExportCookies.start',
    serviceName: 'ExportCookies'
  }
);
```

### logError()

**Signature**:
```javascript
async function logError(
  error: Error,
  context: object = {}
): Promise<void>
```

**Parameters**:
- **error** (required): Error object
- **context** (optional): Error context
  - `category`: Error category (default: `CATEGORY.SYSTEM`)
  - `operation`: Operation name (default: `"error"`)
  - `workflowId`: Workflow ID
  - `requestId`: Request ID
  - `nodeName`: Node name
  - `serviceName`: Service name
  - `accountUID`: Account identifier
  - `targetUID`: Target identifier
  - `errorSeverity`: Error severity (default: `ERROR_SEVERITY.SOFT`)

**Returns**: `Promise<void>` (non-blocking, errors are caught internally)

**Difference from logAction with level ERROR**:
- `logError()` automatically extracts error fields: `error.name`, `error.message`, `error.stack`, `error.code`
- `logError()` sets `level: LEVEL.ERROR` automatically
- `logError()` includes error in the log entry's `error` field with proper structure
- Use `logError()` for actual errors, use `logAction()` with `level: LEVEL.ERROR` for error-like events that aren't exceptions

**Example**:
```javascript
import { logError, CATEGORY, ERROR_SEVERITY } from '../../shared/logging/actionLogger.js';

try {
  // ... operation ...
} catch (error) {
  await logError(error, {
    category: CATEGORY.AUTH,
    operation: 'export_failed',
    workflowId: 'wf-123',
    requestId: 'req-456',
    nodeName: 'ExportCookies.execute',
    serviceName: 'ExportCookies',
    errorSeverity: ERROR_SEVERITY.FATAL
  });
  throw error;
}
```

### logMetric()

**Signature**:
```javascript
async function logMetric(
  name: string,
  value: number,
  tags: object = {}
): Promise<void>
```

**Parameters**:
- **name** (required): Metric name
- **value** (required): Metric value
- **tags** (optional): Metric tags
  - `unit`: Unit (default: `"ms"`)
  - `nodeName`: Node name
  - `serviceName`: Service name
  - Other custom tags

**Returns**: `Promise<void>` (non-blocking, errors are caught)

**Note**: `logMetric()` is a wrapper around `logAction()` with `CATEGORY.PERFORMANCE` and `operation: "metric"`

**Resulting Log Entry Structure**:
```javascript
{
  category: "PERFORMANCE",
  operation: "metric",
  metadata: {
    performance: {
      metric: "export_duration",
      value: 1234,
      unit: "ms",
      // ... other tags (except nodeName, serviceName which are extracted)
    }
  },
  nodeName: "ExportCookies.execute",  // Extracted from tags
  serviceName: "ExportCookies"         // Extracted from tags
}
```

**Example**:
```javascript
import { logMetric } from '../../shared/logging/actionLogger.js';

await logMetric('export_duration', 1234, {
  unit: 'ms',
  nodeName: 'ExportCookies.execute',
  serviceName: 'ExportCookies'
});
```

### Constants

#### CATEGORY

```javascript
export const CATEGORY = {
  CRAWL: "CRAWL",
  DOWNLOAD: "DOWNLOAD",
  AUTH: "AUTH",
  STATE: "STATE",
  BROWSER: "BROWSER",
  CONFIG: "CONFIG",
  PERFORMANCE: "PERFORMANCE",
  SECURITY: "SECURITY",
  SYSTEM: "SYSTEM",
  WORKFLOW: "WORKFLOW"
};
```

#### LEVEL

```javascript
export const LEVEL = {
  INFO: "info",
  WARN: "warn",
  ERROR: "error",
  FATAL: "fatal"
};
```

#### ERROR_SEVERITY

```javascript
export const ERROR_SEVERITY = {
  FATAL: "fatal",
  RETRYABLE: "retryable",
  SOFT: "soft"
};
```

### ID Generation

#### generateWorkflowId()

```javascript
function generateWorkflowId(): string
```

**Returns**: Workflow ID in format `wf-{timestamp}-{random}`

**Example**: `wf-1234567890-abc123`

#### generateRequestId()

```javascript
function generateRequestId(): string
```

**Returns**: UUID v4 request ID (no prefix)

**Example**: `550e8400-e29b-41d4-a716-446655440000`

**Note**: The function returns a plain UUID without any prefix. If you need a prefix like `req-`, add it manually when using the ID.

---

## Configuration

### Environment Variables

#### Redis Configuration

```bash
# Redis connection URL (for logging)
LOG_REDIS_URL=redis://localhost:6380
# Or use general Redis URL
REDIS_URL=redis://localhost:6380
```

**Note**: Examples use **dev ports** from `docker-compose.dev.yml` (6380 for Redis). Default Redis port is 6379. Adjust ports based on your environment.

#### Redis Stream Configuration

```bash
# Stream name
LOG_STREAM_NAME=logs:stream

# Consumer group name
LOG_CONSUMER_GROUP=stealthflow-log-workers

# Batch size (logs per batch)
LOG_BATCH_SIZE=200

# Block timeout (ms)
LOG_BLOCK_TIMEOUT_MS=2000
```

#### Elasticsearch Configuration

```bash
# Elasticsearch URL
ELASTICSEARCH_URL=http://localhost:9201
```

**Note**: Examples use **dev port** 9201 from `docker-compose.dev.yml`. Default Elasticsearch port is 9200. Adjust ports based on your environment.

# Authentication (optional)
ELASTICSEARCH_API_KEY=your-api-key
# Or
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=changeme

# TLS (optional)
ELASTICSEARCH_TLS_REJECT_UNAUTHORIZED=false

# Index alias
LOG_INDEX_ALIAS=stealthflow_develop_logs
```

### Default Values

| Variable | Default |
|----------|---------|
| `LOG_STREAM_NAME` | `logs:stream` |
| `LOG_CONSUMER_GROUP` | `stealthflow-log-workers` |
| `LOG_BATCH_SIZE` | `200` |
| `LOG_BLOCK_TIMEOUT_MS` | `2000` |
| `LOG_INDEX_ALIAS` | `stealthflow_develop_logs` |
| `REDIS_URL` | `redis://localhost:6379` |
| `ELASTICSEARCH_URL` | `http://127.0.0.1:9200` |

---

## Usage Patterns

### Pattern 1: Observer Logging

**Use Case**: Log events from observers

**Real-World Pattern** (from `SystemInfoObserver.js`):
```javascript
import { BaseObserver } from '../../common/BaseObserver.js';
import { logAction, CATEGORY } from '../../../shared/logging/actionLogger.js';

export class MyObserver extends BaseObserver {
  async handleEvent(payload) {
    // Extract IDs from payload with fallbacks
    const context = payload.context || {};
    const workflowId = payload.workflowId || context.workflowId || null;
    const requestId = payload.requestId || context.requestId || null;
    
    // Complex nested metadata structure
    await logAction(
      CATEGORY.SYSTEM,
      'preflight_system_info',
      {
        // Nested objects are fully supported
        platform: systemInfo.platform,
        arch: systemInfo.arch,
        cpu: {
          model: systemInfo.cpu.model,
          cores: systemInfo.cpu.cores,
          speed: systemInfo.cpu.speed
        },
        memory: {
          total: systemInfo.memory.total,
          free: systemInfo.memory.free,
          used: systemInfo.memory.used,
          totalGB: this.formatMemory(systemInfo.memory.total),
          freeGB: this.formatMemory(systemInfo.memory.free)
        },
        screen: systemInfo.screen
      },
      {
        workflowId: workflowId || null,  // Explicit null handling
        requestId: requestId || null,
        nodeName: 'ServiceName.observerName',
        serviceName: 'ServiceName'
      }
    );
  }
}
```

**Simplified Pattern** (for simple cases):
```javascript
export class SimpleObserver extends BaseObserver {
  async handleEvent(payload) {
    const { workflowId, requestId, ...otherData } = payload;
    
    await logAction(
      CATEGORY.AUTH,
      'event_name',
      { ...otherData },
      {
        workflowId: workflowId || null,
        requestId: requestId || null,
        nodeName: 'ServiceName.observerName',
        serviceName: 'ServiceName'
      }
    );
  }
}
```

### Pattern 2: Step Logging

**Use Case**: Log from steps

```javascript
import { logAction, CATEGORY } from '../../../shared/logging/actionLogger.js';

export class MyStep extends BaseStep {
  async doExecute(context) {
    const { workflowId, requestId } = context;
    
    await logAction(
      CATEGORY.AUTH,
      'step_started',
      { stepName: 'MyStep' },
      {
        workflowId,
        requestId,
        nodeName: 'MyStep.execute',
        serviceName: 'ExportCookies'
      }
    );
    
    // ... step logic ...
  }
}
```

### Pattern 3: Service Logging

**Use Case**: Log from services

```javascript
import { logAction, CATEGORY, generateWorkflowId, generateRequestId } from '../../shared/logging/actionLogger.js';

export class MyService extends BaseUseCase {
  async doExecute(context) {
    const workflowId = context.workflowId || generateWorkflowId();
    const requestId = context.requestId || generateRequestId();
    
    await logAction(
      CATEGORY.SYSTEM,
      'service_started',
      { serviceName: 'MyService' },
      {
        workflowId,
        requestId,
        nodeName: 'MyService.start',
        serviceName: 'MyService'
      }
    );
    
    // ... service logic ...
  }
}
```

### Pattern 4: Error Logging

**Use Case**: Log errors

```javascript
import { logError, CATEGORY, ERROR_SEVERITY } from '../../shared/logging/actionLogger.js';

try {
  // ... operation ...
} catch (error) {
  await logError(error, {
    category: CATEGORY.AUTH,
    operation: 'operation_failed',
    workflowId: context.workflowId,
    requestId: context.requestId,
    nodeName: 'ServiceName.operation',
    serviceName: 'ServiceName',
    errorSeverity: ERROR_SEVERITY.FATAL
  });
  throw error;
}
```

### Pattern 5: Metric Logging

**Use Case**: Log performance metrics

```javascript
import { logMetric } from '../../shared/logging/actionLogger.js';

const startTime = Date.now();
// ... operation ...
const duration = Date.now() - startTime;

await logMetric('operation_duration', duration, {
  unit: 'ms',
  nodeName: 'ServiceName.operation',
  serviceName: 'ServiceName'
});
```

### Pattern 6: Context Propagation

**Use Case**: Propagate workflowId/requestId through async operations

```javascript
import { logAction, CATEGORY, generateWorkflowId, generateRequestId } from '../../shared/logging/actionLogger.js';

// Main workflow
async function executeWorkflow() {
  const context = {
    workflowId: generateWorkflowId(),
    requestId: generateRequestId()
  };
  
  await step1(context);
  await step2(context);
  await step3(context);
}

// Step 1
async function step1(context) {
  await logAction(
    CATEGORY.WORKFLOW,
    'step1_start',
    { stepName: 'step1' },
    {
      workflowId: context.workflowId,
      requestId: context.requestId,
      nodeName: 'Workflow.step1',
      serviceName: 'Workflow'
    }
  );
  
  // ... step logic ...
  
  // Pass context to nested operations
  await nestedOperation(context);
}

// Nested operation
async function nestedOperation(context) {
  await logAction(
    CATEGORY.WORKFLOW,
    'nested_operation',
    { operation: 'nested' },
    {
      workflowId: context.workflowId,  // Same workflowId
      requestId: context.requestId,     // Same requestId
      nodeName: 'Workflow.nested',
      serviceName: 'Workflow'
    }
  );
}
```

---

## Observers

### Observer Integration with Events

Observers receive events from the EventBus and extract correlation IDs from the event payload.

#### Event Payload Structure

Event payloads typically contain:
```javascript
{
  workflowId: "wf-1234567890-abc123",  // Optional - from service context
  requestId: "req-uuid-456",           // Optional - from service context
  context: {                            // Optional - service context object
    workflowId: "wf-1234567890-abc123",
    requestId: "req-uuid-456",
    // ... other context data
  },
  // ... other event-specific data
}
```

#### ID Extraction Pattern

**Best Practice**: Extract IDs with fallbacks to handle different event structures:

```javascript
async handleEvent(payload = {}) {
  // Pattern 1: Extract from payload directly, then from context
  const context = payload.context || {};
  const workflowId = payload.workflowId || context.workflowId || null;
  const requestId = payload.requestId || context.requestId || null;
  
  // Pattern 2: Use destructuring with defaults (simpler cases)
  const { workflowId, requestId } = payload;
  
  await logAction(
    CATEGORY.AUTH,
    'event_name',
    { /* metadata */ },
    {
      workflowId: workflowId || null,  // Explicit null if not found
      requestId: requestId || null,
      nodeName: 'ServiceName.observerName',
      serviceName: 'ServiceName'
    }
  );
}
```

#### Why Explicit Null?

Using `|| null` ensures:
- Consistent log structure (null instead of undefined)
- Better querying in Elasticsearch (null is searchable, undefined is not)
- Clear intent: "ID not available" vs "ID missing"

#### Example: SystemInfoObserver

```javascript
// Real code from SystemInfoObserver.js
async handlePreflight(payload = {}) {
  const context = payload.context || {};
  const workflowId = payload.workflowId || context.workflowId || null;
  const requestId = payload.requestId || context.requestId || null;
  
  // Prevent duplicate logging for same workflow
  const workflowKey = workflowId || '__no_workflow__';
  if (this.loggedWorkflows.has(workflowKey)) {
    return;
  }
  
  const systemInfo = this.collectSystemInfo();
  
  await logAction(
    CATEGORY.SYSTEM,
    'preflight_system_info',
    {
      platform: systemInfo.platform,
      arch: systemInfo.arch,
      cpu: { model: systemInfo.cpu.model, cores: systemInfo.cpu.cores },
      memory: { total: systemInfo.memory.total, free: systemInfo.memory.free }
    },
    {
      workflowId: workflowId || null,
      requestId: requestId || null,
      nodeName: 'ExportCookies.systemPreflight',
      serviceName: 'ExportCookies'
    }
  );
  
  this.loggedWorkflows.add(workflowKey);
}
```

---

### Current Observers

#### 1. SystemInfoObserver

**Location**: `src/application/export/observers/SystemInfoObserver.js`

**Purpose**: Collects system information at preflight

**Events**:
- `exportcookiesservice.preflight`

**Logs**:
- Operation: `preflight_system_info`
- Category: `SYSTEM`
- Data: Platform, CPU, memory, screen size

**Example**:
```javascript
// Logs system info when export starts
{
  category: "SYSTEM",
  operation: "preflight_system_info",
  metadata: {
    system: {
      platform: "darwin",
      arch: "arm64",
      cpu: { cores: 12, model: "Apple M2" },
      memory: { total: 36GB, free: 10GB },
      screen: { width: 3456, height: 2234 }
    }
  }
}
```

#### 2. TelemetryObserver

**Location**: `src/application/export/observers/TelemetryObserver.js`

**Purpose**: Comprehensive telemetry for export operations

**Events**:
- All `ExportEvents.*` events
- `EXPORT_COMPLETED`
- `EXPORT_FAILED`
- `EXPORT_ABORTED`

**Logs**:
- Event timeline
- Performance metrics
- Success/failure rates

#### 3. ReadinessObserver

**Location**: `src/application/export/observers/ReadinessObserver.js`

**Purpose**: Tracks readiness events

**Events**:
- `EXPORT_READY_CHECK`
- `EXPORT_READY`

**Logs**:
- Readiness checks
- Readiness status changes

#### 4. RiskObserver

**Location**: `src/application/export/observers/RiskObserver.js`

**Purpose**: Tracks risk calculations

**Events**:
- `EXPORT_RISK_CALCULATED`
- `EXPORT_READY_RISK_CHECK`

**Logs**:
- Risk levels
- Risk factors

---

## LogWorker

### Overview

LogWorker is a **separate process** that:
1. Consumes logs from Redis Stream
2. Batches logs (200 per batch)
3. Writes to Elasticsearch via Bulk API
4. Acknowledges processed messages

### Architecture

```
LogWorker Process
    │
    ├─► Connect to Redis
    ├─► Create/Join Consumer Group
    ├─► Connect to Elasticsearch
    │
    └─► Loop:
        ├─► Read batch from Redis Stream
        ├─► Parse JSON entries
        ├─► Build Elasticsearch bulk operations
        ├─► Execute bulk write
        ├─► Acknowledge messages
        └─► Repeat
```

### Consumer Group Pattern

- **Consumer Group**: `stealthflow-log-workers`
- **Consumer Name**: `worker-{pid}-{random}`
- **Benefits**: Multiple workers can run in parallel
- **Scaling**: Add more workers to increase throughput

### Error Handling

- **Parse Errors**: Logged to console, message skipped (not acknowledged, will retry)
- **Elasticsearch Errors**: Logged to console, message not acknowledged (will retry in next batch)
- **Connection Errors**: Logged to console, retry with 1000ms backoff delay
- **NOGROUP Error**: Automatically recreates consumer group, continues processing
- **Retry Behavior**: On any error, LogWorker waits 1 second before processing next batch

### Configuration

See [Configuration](#configuration) section for environment variables.

### Running LogWorker

```bash
# Foreground
node scripts/log-worker.mjs

# Background
nohup node scripts/log-worker.mjs > log-worker.log 2>&1 &

# With PM2
pm2 start scripts/log-worker.mjs --name log-worker
```

### Monitoring

```bash
# Check if running
ps aux | grep log-worker

# Check logs
tail -f log-worker.log

# Check Redis stream length
redis-cli -p 6380 XLEN logs:stream

# Check pending messages
redis-cli -p 6380 XINFO GROUPS logs:stream
```

---

## Real-World Examples

This section shows **actual code patterns** from the codebase, demonstrating how logging is used in practice.

### Example 1: SystemInfoObserver (Observer Pattern)

**File**: `src/application/export/observers/SystemInfoObserver.js`

**Pattern**: Extract IDs from event payload with fallbacks, log nested metadata

```javascript
import { BaseObserver } from '../../common/BaseObserver.js';
import { logAction, CATEGORY } from '../../../shared/logging/actionLogger.js';

export class SystemInfoObserver extends BaseObserver {
  async handlePreflight(payload = {}) {
    // Extract IDs with fallbacks
    const context = payload.context || {};
    const workflowId = payload.workflowId || context.workflowId || null;
    const requestId = payload.requestId || context.requestId || null;
    
    // Prevent duplicate logging
    const workflowKey = workflowId || '__no_workflow__';
    if (this.loggedWorkflows.has(workflowKey)) {
      return;
    }
    
    const systemInfo = this.collectSystemInfo();
    
    // Log with nested metadata structure
    await logAction(
      CATEGORY.SYSTEM,
      'preflight_system_info',
      {
        platform: systemInfo.platform,
        arch: systemInfo.arch,
        hostname: systemInfo.hostname,
        nodeVersion: systemInfo.nodeVersion,
        cpu: {
          model: systemInfo.cpu.model,
          cores: systemInfo.cpu.cores,
          speed: systemInfo.cpu.speed
        },
        memory: {
          total: systemInfo.memory.total,
          free: systemInfo.memory.free,
          used: systemInfo.memory.used,
          totalGB: this.formatMemory(systemInfo.memory.total),
          freeGB: this.formatMemory(systemInfo.memory.free)
        },
        screen: systemInfo.screen
      },
      {
        workflowId: workflowId || null,
        requestId: requestId || null,
        nodeName: 'ExportCookies.systemPreflight',
        serviceName: 'ExportCookies'
      }
    );
    
    this.loggedWorkflows.add(workflowKey);
  }
}
```

**Key Points**:
- ✅ Extract IDs from payload/context with fallbacks
- ✅ Use explicit `|| null` for consistent structure
- ✅ Support complex nested metadata objects
- ✅ Prevent duplicate logging with workflow tracking

### Example 2: ReadinessStep (Step Pattern)

**File**: `src/application/export/steps/ReadinessStep.js`

**Pattern**: Extract IDs from context, log step execution

```javascript
import { BaseStep } from '../../common/BaseStep.js';
import { logAction, CATEGORY } from '../../../shared/logging/actionLogger.js';

export class ReadinessStep extends BaseStep {
  async doExecute(context) {
    // Extract IDs from context
    const { workflowId, requestId, page, trackerName } = context;
    
    if (!page || !trackerName) {
      throw new Error('Page and trackerName are required');
    }
    
    // Log step start
    await logAction(
      CATEGORY.AUTH,
      'readiness_check_start',
      {
        trackerName,
        waitTime: waitTime
      },
      {
        workflowId,
        requestId,
        nodeName: 'ReadinessStep.execute',
        serviceName: 'ExportCookies'
      }
    );
    
    // ... step logic ...
    
    // Log step completion
    await logAction(
      CATEGORY.AUTH,
      'readiness_check_complete',
      {
        readiness: readinessResult,
        tracker: trackerData
      },
      {
        workflowId,
        requestId,
        nodeName: 'ReadinessStep.execute',
        serviceName: 'ExportCookies'
      }
    );
  }
}
```

**Key Points**:
- ✅ Extract IDs directly from context (simpler than observers)
- ✅ Log multiple events in same step (start, complete)
- ✅ Include step-specific metadata

### Example 3: ExportCookiesService (Service Pattern)

**File**: `src/application/export/ExportCookiesService.js`

**Pattern**: Generate IDs if not provided, log service lifecycle

```javascript
import { generateWorkflowId, generateRequestId, logAction, CATEGORY } from '../../shared/logging/actionLogger.js';

export class ExportCookiesService extends BaseUseCase {
  async doExecute(context) {
    // Generate IDs if not provided
    const workflowId = context.workflowId || generateWorkflowId();
    const requestId = context.requestId || generateRequestId();
    
    // Log service start
    await logAction(
      CATEGORY.AUTH,
      'export_start',
      {
        serviceName: 'ExportCookies'
      },
      {
        workflowId,
        requestId,
        nodeName: 'ExportCookies.start',
        serviceName: 'ExportCookies'
      }
    );
    
    // ... service logic ...
    
    // Log service completion
    await logAction(
      CATEGORY.AUTH,
      'export_complete',
      {
        profileName: result.profileName,
        cookieCount: result.cookies.length
      },
      {
        workflowId,
        requestId,
        nodeName: 'ExportCookies.complete',
        serviceName: 'ExportCookies'
      }
    );
  }
}
```

**Key Points**:
- ✅ Generate IDs if not in context
- ✅ Log service lifecycle events
- ✅ Include result metadata in completion log

---

## Quick Start

### 1. Start Services

```bash
# Start Redis and Elasticsearch
node scripts/init-services.mjs

# Start LogWorker (required for logs to appear in Elasticsearch)
node scripts/log-worker.mjs
# Or in background:
nohup node scripts/log-worker.mjs > log-worker.log 2>&1 &
```

### 2. Use in Code

```javascript
import { logAction, CATEGORY, generateWorkflowId, generateRequestId } from './shared/logging/actionLogger.js';

const workflowId = generateWorkflowId();
const requestId = generateRequestId();

await logAction(
  CATEGORY.SYSTEM,
  'test_operation',
  { testData: 'value' },
  {
    workflowId,
    requestId,
    nodeName: 'MyService.test',
    serviceName: 'MyService'
  }
);
```

### 3. View in Kibana

1. Open Kibana: http://localhost:5602
2. Go to **Discover**
3. Select data view: `stealthflow_develop_logs`
4. Query: `serviceName: "MyService"`

---

## Viewing Logs

### Option 1: Kibana Discover

1. Open Kibana: http://localhost:5602
2. Go to **Discover**
3. Select data view: `stealthflow_develop_logs`
4. Query logs using KQL

**Common Queries**:
```
# All logs
*

# By workflow
workflowId: "wf-1234567890-abc123"

# By operation
operation: "export_start"

# By category
category: "AUTH"

# By service
serviceName: "ExportCookies"

# By account
accountUID: "100000563370253"

# System info
operation: "preflight_system_info"

# Errors
level: "error"

# By workflow (correlate all related logs)
workflowId: "wf-1234567890-abc123"
```

### Option 2: Query Script

```bash
# Query logs
node scripts/query-logs.mjs --workflowId wf-1234567890-abc123

# Query by operation
node scripts/query-logs.mjs --operation export_start

# Query system info
node scripts/query-logs.mjs --operation preflight_system_info
```

### Option 3: Elasticsearch API

```bash
# Count logs
curl "http://localhost:9201/stealthflow_develop_logs/_count"

# Search logs
curl -X GET "http://localhost:9201/stealthflow_develop_logs/_search?pretty" \
  -H 'Content-Type: application/json' \
  -d '{
    "query": {
      "term": {
        "workflowId": "wf-1234567890-abc123"
      }
    },
    "sort": [
      { "timestamp": "asc" }
    ]
  }'
```

---

## Frequently Asked Questions (FAQ)

### 1. What if Redis is down?

**Answer**: 
- Logs are **lost** (not buffered in memory)
- Error is logged to `console.error`: `"[logging] Failed to push log entry to Redis"`
- The log entry payload is also logged to console for debugging
- **Application continues normally** (non-blocking behavior)
- **Recommendation**: Monitor Redis health and set up alerts

### 2. Can I use logAction synchronously?

**Answer**: 
- `logAction()` is **async** (returns `Promise<void>`)
- You can call it without `await` if you don't care about errors
- Errors are caught internally, so missing `await` won't crash your app
- **Best practice**: Use `await` if you want to ensure the log is written before continuing (though it's still non-blocking)

```javascript
// ✅ Both are valid
await logAction(...);  // Waits for Redis write (but errors are caught)
logAction(...);        // Fire-and-forget (errors still caught)
```

### 3. What's the difference between logError and logAction with level ERROR?

**Answer**:
- **`logError()`**: 
  - Automatically extracts error fields (`name`, `message`, `stack`, `code`)
  - Sets `level: LEVEL.ERROR` automatically
  - Includes structured `error` object in log entry
  - Use for actual JavaScript `Error` objects
- **`logAction()` with `level: LEVEL.ERROR`**:
  - Manual error information in metadata
  - Use for error-like events that aren't exceptions (e.g., validation failures, business logic errors)

```javascript
// ✅ Use logError for exceptions
try {
  await operation();
} catch (error) {
  await logError(error, { ... });
}

// ✅ Use logAction for error-like events
if (validationFailed) {
  await logAction(CATEGORY.AUTH, 'validation_failed', { reason: '...' }, {
    level: LEVEL.ERROR,
    ...
  });
}
```

### 4. How do I query logs by accountUID?

**Answer**: Use Kibana KQL or Elasticsearch query:

```bash
# Kibana KQL
accountUID: "100000563370253"

# Elasticsearch API
curl -X GET "http://localhost:9201/stealthflow_develop_logs/_search?pretty" \
  -H 'Content-Type: application/json' \
  -d '{
    "query": {
      "term": {
        "accountUID": "100000563370253"
      }
    }
  }'
```

### 5. What happens if LogWorker crashes?

**Answer**:
- Logs **accumulate in Redis Stream** (not lost)
- When LogWorker restarts, it processes all pending messages
- **Consumer group pattern** ensures messages are not lost
- **Recommendation**: Use process manager (PM2, systemd) to auto-restart LogWorker

```bash
# Check pending messages
redis-cli -p 6380 XINFO GROUPS logs:stream

# Restart LogWorker
pm2 restart log-worker
```

### 6. Can I have multiple LogWorkers?

**Answer**: 
- **Yes!** Consumer group pattern supports multiple workers
- Each worker processes different messages (load balancing)
- **Scaling**: Add more workers to increase throughput
- **Consumer name**: Each worker has unique name: `worker-{pid}-{random}`

```bash
# Run multiple workers
node scripts/log-worker.mjs &
node scripts/log-worker.mjs &
node scripts/log-worker.mjs &
```

### 7. What's the maximum Redis Stream length?

**Answer**:
- **No hard limit** (depends on Redis memory)
- Redis Stream uses memory, so monitor Redis memory usage
- **Recommendation**: 
  - Monitor stream length: `redis-cli XLEN logs:stream`
  - Set up alerts if length exceeds threshold (e.g., 10,000 messages)
  - Ensure LogWorker is running to process messages

### 8. How do I test logging without Elasticsearch?

**Answer**: 
- **Option 1**: Check Redis Stream directly
  ```bash
  redis-cli -p 6380 XREAD COUNT 10 STREAMS logs:stream 0
  ```
- **Option 2**: Mock `actionLogger` in tests
  ```javascript
  import { jest } from '@jest/globals';
  jest.mock('./shared/logging/actionLogger.js', () => ({
    logAction: jest.fn(),
    logError: jest.fn(),
    logMetric: jest.fn()
  }));
  ```
- **Option 3**: Start Elasticsearch in Docker for local testing
  ```bash
  docker-compose up elasticsearch
  ```

### 9. How do I propagate workflowId/requestId through async operations?

**Answer**: Pass context object through async chain:

```javascript
// ✅ Good: Pass context through async chain
async function executeWorkflow() {
  const context = {
    workflowId: generateWorkflowId(),
    requestId: generateRequestId()
  };
  
  await step1(context);
  await step2(context);
  await step3(context);
}

async function step1(context) {
  await logAction(CATEGORY.WORKFLOW, 'step1_start', {}, {
    workflowId: context.workflowId,
    requestId: context.requestId,
    nodeName: 'Workflow.step1',
    serviceName: 'Workflow'
  });
  // ... step logic ...
}
```

### 10. What's the Elasticsearch index mapping?

**Answer**:
- **Dynamic mapping**: Elasticsearch automatically infers field types from first document
- **No explicit mapping/template**: Index is created automatically when first log is written
- **Field types**: Determined by first document's structure
- **Recommendation**: For production, consider creating explicit mapping for better control

---

## Troubleshooting

### Diagnostic Checklist

Quick checklist to diagnose logging issues:

- [ ] **Redis running?** 
  ```bash
  redis-cli -p 6380 PING
  # Should return: PONG
  ```

- [ ] **Elasticsearch running?**
  ```bash
  curl http://localhost:9201/_cluster/health
  # Should return JSON with status
  ```

- [ ] **LogWorker running?**
  ```bash
  ps aux | grep log-worker
  # Should show log-worker process
  ```

- [ ] **Stream length normal?**
  ```bash
  redis-cli -p 6380 XLEN logs:stream
  # Should be low (< 1000). High = LogWorker not processing
  ```

- [ ] **ES index exists?**
  ```bash
  curl http://localhost:9201/stealthflow_develop_logs
  # Should return index info, not 404
  ```

- [ ] **Kibana data view configured?**
  - Open Kibana: http://localhost:5602
  - Go to Stack Management > Data Views
  - Check `stealthflow_develop_logs` exists

- [ ] **Pending messages in consumer group?**
  ```bash
  redis-cli -p 6380 XINFO GROUPS logs:stream
  # Check "pending" count. High = messages not processed
  ```

### Common Error Messages

#### Error: "Failed to push log entry to Redis"

**Cause**: Redis connection failed or Redis is down

**Solution**:
1. Check Redis is running: `redis-cli -p 6380 PING`
2. Check Redis URL in `.env`: `LOG_REDIS_URL` or `REDIS_URL`
3. Check network connectivity
4. Check Redis logs for errors

#### Error: "NOGROUP" in LogWorker

**Cause**: Consumer group doesn't exist

**Solution**: LogWorker will auto-create consumer group. If error persists:
1. Manually create: `redis-cli -p 6380 XGROUP CREATE logs:stream stealthflow-log-workers 0 MKSTREAM`
2. Restart LogWorker

#### Error: "Elasticsearch connection failed"

**Cause**: Elasticsearch is down or unreachable

**Solution**:
1. Check Elasticsearch is running: `curl http://localhost:9201/_cluster/health`
2. Check Elasticsearch URL in `.env`: `ELASTICSEARCH_URL`
3. Check Elasticsearch logs
4. Verify network connectivity

#### Error: "Index not found" in Kibana

**Cause**: No logs written to Elasticsearch yet, or index name mismatch

**Solution**:
1. Write a test log: `node -e "import('./src/shared/logging/actionLogger.js').then(({logAction, CATEGORY}) => logAction(CATEGORY.SYSTEM, 'test', {}, {serviceName: 'Test'}))"`
2. Wait for LogWorker to process (check stream length)
3. Refresh Kibana data view
4. Check index name matches `LOG_INDEX_ALIAS` in `.env`

---

### Issue: Logs Not Appearing in Elasticsearch

**Symptoms**: Logs written but not in Elasticsearch

**Diagnosis**:
```bash
# Check LogWorker is running
ps aux | grep log-worker

# Check Redis stream length
redis-cli -p 6380 XLEN logs:stream

# Check pending messages
redis-cli -p 6380 XINFO GROUPS logs:stream
```

**Solutions**:
1. Start LogWorker: `node scripts/log-worker.mjs`
2. Check LogWorker logs for errors
3. Verify Elasticsearch connection
4. Check Redis connection

### Issue: High Redis Stream Length

**Symptoms**: Stream length growing, logs not processed

**Solutions**:
1. Start more LogWorker instances
2. Increase `LOG_BATCH_SIZE`
3. Check LogWorker performance
4. Verify Elasticsearch is accessible

### Issue: LogWorker Crashes

**Symptoms**: LogWorker stops unexpectedly

**Diagnosis**:
```bash
# Check logs
tail -f log-worker.log

# Check for errors
grep -i error log-worker.log
```

**Common Causes**:
- Elasticsearch connection failed
- Redis connection lost
- Memory issues
- Network issues

**Solutions**:
1. Check Elasticsearch health
2. Check Redis health
3. Restart LogWorker
4. Use process manager (PM2)

### Issue: Duplicate Logs

**Symptoms**: Same log appears multiple times

**Causes**:
- Multiple LogWorker instances processing same messages
- Messages not acknowledged properly

**Solutions**:
1. Ensure only one consumer group
2. Check acknowledgment logic
3. Verify consumer group configuration

### Issue: Missing workflowId/requestId

**Symptoms**: Logs cannot be correlated

**Solutions**:
1. Ensure workflowId/requestId passed in options
2. Check context propagation
3. Verify event payloads include IDs

---

## Common Mistakes

### 1. Forgetting Correlation IDs

```javascript
// ❌ Bad: No correlation IDs
await logAction(CATEGORY.AUTH, 'export_start', { profileName: 'profile1' });

// ✅ Good: Always include correlation IDs
await logAction(CATEGORY.AUTH, 'export_start', { profileName: 'profile1' }, {
  workflowId: context.workflowId,
  requestId: context.requestId,
  nodeName: 'ExportCookies.start',
  serviceName: 'ExportCookies'
});
```

### 2. Putting accountUID in Metadata

```javascript
// ❌ Bad: accountUID in metadata (will be extracted anyway)
await logAction(CATEGORY.AUTH, 'export_start', {
  accountUID: '123',
  profileName: 'profile1'
}, options);

// ✅ Good: Use options.accountUID
await logAction(CATEGORY.AUTH, 'export_start', {
  profileName: 'profile1'
}, {
  ...options,
  accountUID: '123'
});
```

### 3. Awaiting logAction Unnecessarily

```javascript
// ❌ Bad: Unnecessary await (errors are caught anyway)
try {
  await logAction(...);
} catch (error) {
  // This will never catch - errors are caught internally
}

// ✅ Good: Simple await (or fire-and-forget)
await logAction(...);  // Errors caught internally
// Or
logAction(...);  // Fire-and-forget
```

### 4. Not Starting LogWorker

```javascript
// ❌ Bad: Logs written but never appear in Elasticsearch
await logAction(...);  // Goes to Redis Stream
// But LogWorker not running → logs stuck in Redis

// ✅ Good: Always start LogWorker
node scripts/log-worker.mjs
```

### 5. Using Wrong Category

```javascript
// ❌ Bad: Wrong category
await logAction(CATEGORY.SYSTEM, 'export_start', ...);  // Should be AUTH

// ✅ Good: Appropriate category
await logAction(CATEGORY.AUTH, 'export_start', ...);
```

---

## Testing

### Mock actionLogger in Tests

```javascript
import { jest } from '@jest/globals';
import { logAction, logError, logMetric } from './shared/logging/actionLogger.js';

jest.mock('./shared/logging/actionLogger.js', () => ({
  logAction: jest.fn(),
  logError: jest.fn(),
  logMetric: jest.fn(),
  CATEGORY: { AUTH: 'AUTH', SYSTEM: 'SYSTEM' },
  LEVEL: { INFO: 'info', ERROR: 'error' }
}));

test('should log action', async () => {
  await logAction(CATEGORY.AUTH, 'test', {}, {});
  expect(logAction).toHaveBeenCalledWith(CATEGORY.AUTH, 'test', {}, {});
});
```

### Check Redis Stream Directly

```bash
# Read last 10 messages
redis-cli -p 6380 XREAD COUNT 10 STREAMS logs:stream 0

# Read from specific ID
redis-cli -p 6380 XREAD COUNT 10 STREAMS logs:stream 1234567890-0

# Get stream info
redis-cli -p 6380 XINFO STREAM logs:stream
```

### Test LogWorker Locally

```bash
# Start Elasticsearch
docker-compose up elasticsearch

# Start LogWorker
node scripts/log-worker.mjs

# Write test log
node -e "
import('./src/shared/logging/actionLogger.js').then(({ logAction, CATEGORY }) => {
  logAction(CATEGORY.SYSTEM, 'test', {}, { serviceName: 'Test' });
});
"

# Check Elasticsearch
curl "http://localhost:9201/stealthflow_develop_logs/_search?pretty&q=operation:test"
```

---

## Performance Considerations

### Non-Blocking Writes

- `logAction()`, `logError()`, `logMetric()` are **async but non-blocking**
- Errors are caught internally, so logging failures won't crash your app
- **Trade-off**: Failed logs are lost (no retry mechanism)

### Redis Stream Backpressure

- Redis Stream automatically handles backpressure
- If LogWorker is slow, messages accumulate in Redis Stream
- **Monitor**: Check stream length: `redis-cli XLEN logs:stream`
- **Solution**: Add more LogWorkers or increase `LOG_BATCH_SIZE`

### LogWorker Batching

- LogWorker processes **200 logs per batch** (configurable via `LOG_BATCH_SIZE`)
- **Bulk API**: Writes to Elasticsearch in batches for efficiency
- **Block timeout**: Waits up to 2000ms for new messages before processing batch

### Scaling

- **Horizontal scaling**: Run multiple LogWorkers (consumer group pattern)
- **Vertical scaling**: Increase `LOG_BATCH_SIZE` for higher throughput
- **Elasticsearch**: Ensure Elasticsearch cluster can handle write volume

### Memory Usage

- **Redis Stream**: In-memory, monitor Redis memory usage
- **Elasticsearch**: Disk-based, but index size grows over time
- **Recommendation**: Set up index lifecycle management (ILM) for log rotation

---

## Security Considerations

### What NOT to Log

**Never log sensitive data**:
- ❌ Passwords or authentication tokens
- ❌ API keys or secrets
- ❌ Personal Identifiable Information (PII) - unless required and anonymized
- ❌ Cookie values (log cookie count, not content)
- ❌ Credit card numbers, SSNs, etc.
- ❌ Encryption keys

**Example - Bad**:
```javascript
// ❌ DON'T: Log sensitive data
await logAction(CATEGORY.AUTH, 'login', {
  password: userPassword,  // NEVER!
  apiKey: apiKey,          // NEVER!
  cookieValue: cookie.value  // NEVER!
}, options);
```

**Example - Good**:
```javascript
// ✅ DO: Log non-sensitive metadata
await logAction(CATEGORY.AUTH, 'login', {
  username: username,  // OK if not PII
  cookieCount: cookies.length,  // OK - count, not content
  hasApiKey: !!apiKey  // OK - boolean, not value
}, options);
```

### Data Sanitization

If you must log data that might contain sensitive information:

```javascript
function sanitizeForLogging(data) {
  const sanitized = { ...data };
  // Remove sensitive fields
  delete sanitized.password;
  delete sanitized.apiKey;
  delete sanitized.token;
  delete sanitized.cookieValue;
  // Mask PII if needed
  if (sanitized.email) {
    sanitized.email = sanitized.email.replace(/(.{2})(.*)(@.*)/, '$1***$3');
  }
  return sanitized;
}

await logAction(CATEGORY.AUTH, 'user_action', sanitizeForLogging(userData), options);
```

### Access Control

**Elasticsearch/Kibana Access**:
- ✅ Use authentication (API keys, username/password)
- ✅ Restrict network access (firewall rules)
- ✅ Use TLS/SSL in production
- ✅ Implement role-based access control (RBAC) in Kibana
- ✅ Regularly rotate API keys

**Configuration**:
```bash
# Enable Elasticsearch security
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=changeme
ELASTICSEARCH_API_KEY=your-api-key

# Use TLS in production
ELASTICSEARCH_URL=https://elasticsearch.example.com:9200
ELASTICSEARCH_TLS_REJECT_UNAUTHORIZED=true
```

### Encryption

**At Rest**:
- Elasticsearch supports encryption at rest (requires Elasticsearch Security)
- Enable disk encryption on Elasticsearch nodes

**In Transit**:
- Use HTTPS for Elasticsearch API
- Use TLS for Redis connections in production
- Use secure connections for Kibana

**Configuration**:
```bash
# TLS for Elasticsearch
ELASTICSEARCH_URL=https://elasticsearch.example.com:9200
ELASTICSEARCH_TLS_REJECT_UNAUTHORIZED=true

# TLS for Redis (if supported)
REDIS_URL=rediss://redis.example.com:6380
```

### Log Retention & Privacy

**Retention Policy**:
- Set up Index Lifecycle Management (ILM) to delete old logs
- Comply with data retention regulations (GDPR, etc.)
- Consider log anonymization for long-term storage

**Example ILM Policy** (Elasticsearch):
```json
{
  "policy": {
    "phases": {
      "hot": {
        "actions": {
          "rollover": {
            "max_size": "50GB",
            "max_age": "7d"
          }
        }
      },
      "delete": {
        "min_age": "30d",
        "actions": {
          "delete": {}
        }
      }
    }
  }
}
```

### Best Practices Summary

1. ✅ **Never log passwords, tokens, or secrets**
2. ✅ **Sanitize data before logging**
3. ✅ **Use authentication for Elasticsearch/Kibana**
4. ✅ **Enable TLS in production**
5. ✅ **Implement access control (RBAC)**
6. ✅ **Set up log retention policies**
7. ✅ **Monitor access logs for suspicious activity**
8. ✅ **Regularly audit what data is being logged**

---

## Integration with Other Loggers

### logAction vs console.log

**When to use `logAction()`**:
- ✅ Business events that need to be queried/analyzed
- ✅ Errors that need tracking
- ✅ Performance metrics
- ✅ Data that needs correlation (workflowId/requestId)

**When to use `console.log()`**:
- ✅ Immediate debugging output
- ✅ Development-time information
- ✅ User-facing progress messages
- ✅ Information that doesn't need persistence

**Real-World Pattern** (from `SystemInfoObserver.js`):
```javascript
// Log to DB/ES (structured, queryable)
await logAction(
  CATEGORY.SYSTEM,
  'preflight_system_info',
  { /* detailed system info */ },
  { workflowId, requestId, ... }
);

// Also log to console (immediate, user-facing)
console.log(`[${timestamp}] INFO: preflight | ${platform} ${arch} | ${cores} cores | ${ram}GB RAM`);
```

### Pino Integration

**Current Usage**: Pino is used for CLI logging (`scripts/utils/log.mjs`)

**Pattern**: Use both logAction (DB/ES) and Pino (console) when needed

```javascript
import { logAction, CATEGORY } from '../../shared/logging/actionLogger.js';
import { getLogger } from '../../shared/logging/index.js';

const pinoLogger = getLogger({ module: 'cli' });

// Log to DB/ES
await logAction(CATEGORY.SYSTEM, 'event', metadata, options);

// Also log to console via Pino (async, buffered)
pinoLogger.info('User-facing message');
```

**Note**: Pino is asynchronous and buffered, so output may be delayed. Use `console.log()` for immediate output.

### Dual Logging Best Practices

1. ✅ **Use logAction for structured, queryable data**
2. ✅ **Use console.log for immediate user feedback**
3. ✅ **Use Pino for formatted console output (if needed)**
4. ✅ **Don't duplicate logs unnecessarily**
5. ✅ **Keep console logs simple, detailed data in logAction**

**Example**:
```javascript
// ✅ Good: Different purposes
await logAction(CATEGORY.AUTH, 'export_start', {
  profileName: profileName,
  cookieCount: cookies.length,
  // ... detailed metadata
}, { workflowId, requestId, ... });

console.log(`Starting export for profile: ${profileName}`);  // User feedback

// ❌ Bad: Duplicate data
await logAction(CATEGORY.AUTH, 'export_start', { profileName }, options);
console.log(`Export started for profile: ${profileName}`);  // Redundant
```

---

## Best Practices

### 1. Always Include Correlation IDs

```javascript
// ✅ Good
await logAction(CATEGORY.AUTH, 'operation', {}, {
  workflowId: context.workflowId,
  requestId: context.requestId,
  nodeName: 'ServiceName.operation',
  serviceName: 'ServiceName'
});

// ❌ Bad
await logAction(CATEGORY.AUTH, 'operation', {});
```

### 2. Use Appropriate Categories

```javascript
// ✅ Good
await logAction(CATEGORY.AUTH, 'export_start', ...);
await logAction(CATEGORY.SYSTEM, 'system_info', ...);
await logAction(CATEGORY.PERFORMANCE, 'metric', ...);

// ❌ Bad
await logAction(CATEGORY.SYSTEM, 'export_start', ...); // Wrong category
```

### 3. Non-Blocking Writes

```javascript
// ✅ Good - Non-blocking
await logAction(...); // Errors are caught internally

// ❌ Bad - Blocking
try {
  await logAction(...);
} catch (error) {
  // Don't do this - errors are already handled
}
```

### 4. Structured Metadata

```javascript
// ✅ Good - Structured
await logAction(CATEGORY.AUTH, 'export_start', {
  profileName: 'profile1',
  cookieCount: 15,
  readiness: { ready: true }
}, options);

// ❌ Bad - Unstructured
await logAction(CATEGORY.AUTH, 'export_start', {
  data: 'profile1, 15 cookies, ready'
}, options);
```

### 5. Error Context

```javascript
// ✅ Good - Full context
await logError(error, {
  category: CATEGORY.AUTH,
  operation: 'export_failed',
  workflowId: context.workflowId,
  requestId: context.requestId,
  nodeName: 'ExportCookies.execute',
  serviceName: 'ExportCookies',
  errorSeverity: ERROR_SEVERITY.FATAL
});

// ❌ Bad - Missing context
await logError(error);
```

---

## Related Documentation

- [Logging Guide](../guides/logging.md) - How to use logging
- [Observer Pattern Guide](../guides/events/observer-pattern.md) - Observer pattern
- [Complete Log Tracking Plan](../plans/operations/complete-log-tracking.md) - Logging implementation plan
- [Elasticsearch Logging Plan](../plans/operations/elasticsearch-logging.md) - Elasticsearch setup
- [Kibana Troubleshooting](../runbooks/kibana-troubleshooting.md) - Troubleshooting guide

---

## Summary

The StealthFlow logging system provides:
- ✅ **Structured logging** with consistent schema
- ✅ **Asynchronous writes** via Redis Stream
- ✅ **Correlation** via workflowId/requestId
- ✅ **Scalability** via LogWorker and Elasticsearch
- ✅ **Queryability** via Elasticsearch and Kibana
- ✅ **Non-blocking** - logging failures don't crash app

**Key Components**:
1. `actionLogger.js` - Core API (logAction, logError, logMetric)
2. `LogWorker` - Background processor (Redis → Elasticsearch)
3. `Redis Stream` - Message queue buffer
4. `Elasticsearch` - Log storage and search
5. `Kibana` - Visualization and dashboards

**Usage**: Import `logAction`, `logError`, or `logMetric` from `actionLogger.js` and use throughout the application.
