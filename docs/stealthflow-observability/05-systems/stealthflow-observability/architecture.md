---
title: "System Architecture"
type: "system-doc"
scope: "project"
project: "stealthflow-observability"
what: "Complete architecture documentation for StealthFlow Observability"
why: "Document system design, components, and data flows"
how: "Reference for understanding system architecture"
owner: "StealthFlow Team"
status: "approved"
last_updated: "2025-12-05"
tags: ['architecture', 'system', 'stealthflow-observability']
ai_semantics:
  layer: "system"
  scope: "project"
  project: "stealthflow-observability"
  priority: "high"
  relates_to: ['architecture', 'design', 'components']
  source: "project"
compliance:
  standards:
    - path: "../../../master/03-technical/principles/architectural-principles.md"
      required: true
---

# Architecture

Complete architecture documentation for StealthFlow Observability Microservice.

---

## Overview

StealthFlow Observability is a microservice designed to collect, buffer, and store structured logs from the StealthFlow ecosystem. It uses an asynchronous architecture with Redis Streams for buffering and Elasticsearch for storage.

---

## High-Level Architecture

```
┌─────────────────┐
│   Application   │
│     Services    │
└────────┬────────┘
         │
         │ HTTP POST /api/v1/logs
         ▼
┌─────────────────┐
│   API Server    │
│  (Express.js)   │
└────────┬────────┘
         │
         │ Redis Stream (async)
         ▼
┌─────────────────┐
│  Redis Stream   │
│  (logs:stream)  │
└────────┬────────┘
         │
         │ Consumer Group
         ▼
┌─────────────────┐
│   LogWorker     │
│ (Background)    │
└────────┬────────┘
         │
         │ Bulk API
         ▼
┌─────────────────┐
│ Elasticsearch   │
│  (Indexing)     │
└────────┬────────┘
         │
         │ Query API
         ▼
┌─────────────────┐
│     Kibana      │
│ (Visualization) │
└─────────────────┘
```

---

## Components

### 1. API Server

**Location:** `src/api/server.js`

**Responsibilities:**
- Receives log submissions via REST API
- Validates log entries
- Writes to Redis Stream (async, non-blocking)
- Provides health check endpoints
- Handles fallback logging when Redis fails

**Key Features:**
- Express.js REST API
- JSON request/response
- Async log submission (non-blocking)
- Health monitoring
- Error handling

### 2. Redis Stream

**Stream Name:** `logs:stream`

**Purpose:**
- Message queue buffer
- Handles backpressure
- Enables async processing
- Consumer group pattern for scaling

**Configuration:**
- Consumer group: `stealthflow-log-workers`
- Message format: `{ id: "...", data: "JSON string" }`

### 3. LogWorker

**Location:** `src/workers/log-worker.js`

**Responsibilities:**
- Consumes logs from Redis Stream
- Batch processes logs (200 per batch)
- Writes to Elasticsearch via Bulk API
- Handles errors and DLQ
- Acknowledges processed messages

**Key Features:**
- Consumer group pattern
- Batch processing
- Error handling
- Dead Letter Queue (DLQ)
- Graceful shutdown

### 4. Elasticsearch

**Index Alias:** `stealthflow_develop_logs`

**Purpose:**
- Log storage
- Full-text search
- Analytics and aggregation
- Dynamic mapping

### 5. Kibana

**URL:** Configure via your infrastructure setup (default port 5602)

**Purpose:**
- Log visualization
- Dashboards
- Query interface
- Analytics

---

## Data Flow

### Log Submission Flow

1. **Application** sends log via HTTP POST to `/api/v1/logs`
2. **API Server** validates and builds log entry
3. **API Server** writes to Redis Stream (async, non-blocking)
4. **API Server** returns 202 Accepted immediately
5. **LogWorker** consumes from Redis Stream (separate process)
6. **LogWorker** batches logs (200 per batch)
7. **LogWorker** writes to Elasticsearch via Bulk API
8. **LogWorker** acknowledges messages
9. **Logs** available in Kibana for querying

### Error Handling Flow

1. If Redis fails → Fallback to file logging (`logs/fallback/`)
2. If Elasticsearch fails → Message goes to DLQ (`logs:failed`)
3. If parsing fails → Message goes to DLQ
4. Failed messages can be retried manually

---

## Design Patterns

### 1. Producer-Consumer Pattern

- **Producer:** API Server (writes to Redis Stream)
- **Consumer:** LogWorker (reads from Redis Stream)
- **Queue:** Redis Stream

### 2. Consumer Group Pattern

- Multiple LogWorkers can run in parallel
- Each worker processes different messages
- Load balancing across workers
- Scalable architecture

### 3. Batch Processing

- Logs processed in batches (200 per batch)
- Reduces Elasticsearch write overhead
- Improves throughput
- Configurable batch size

### 4. Fallback Pattern

- Primary: Redis Stream
- Fallback: File logging
- Ensures no logs are lost

---

## Scalability

### Horizontal Scaling

**LogWorker Scaling:**
```bash
docker-compose up -d --scale log-worker=3
```

Multiple LogWorkers:
- Process logs in parallel
- Share workload via consumer group
- Increase throughput

### Vertical Scaling

**Increase Batch Size:**
```yaml
environment:
  LOG_BATCH_SIZE: 500  # Default: 200
```

Larger batches:
- More logs per Elasticsearch write
- Higher throughput
- More memory usage

---

## Resilience

### 1. Redis Failure

- Fallback to file logging
- Logs saved to `logs/fallback/`
- Can be replayed later
- Service continues operating

### 2. Elasticsearch Failure

- Messages go to DLQ
- Not lost, can be retried
- LogWorker continues processing other messages

### 3. LogWorker Failure

- Messages remain in Redis Stream
- New LogWorker picks up where left off
- No message loss

---

## Performance Considerations

### Async Processing

- API Server doesn't wait for Elasticsearch write
- Returns immediately after Redis write
- Non-blocking architecture

### Batch Processing

- Reduces Elasticsearch write overhead
- Improves throughput
- Configurable batch size

### Connection Pooling

- Redis: Connection pool via ioredis
- Elasticsearch: Connection pool via @elastic/elasticsearch
- Reuse connections

---

## Security

### Network Isolation

- Internal network only
- No authentication required (internal service)
- Firewall rules restrict access

### Data Protection

- No sensitive data in logs
- Input validation
- Error sanitization

---

## Infrastructure

### Infrastructure Services (Shared)

- **Redis:** Configure via REDIS_HOST and REDIS_PORT (default port 6380)
- **Elasticsearch:** Configure via ELASTICSEARCH_URL (default port 9201)
- **MongoDB:** Configure via MONGODB_URI (default port 27018, optional)
- **Kibana:** Configure via your infrastructure setup (default port 5602)

### Observability Service (This Microservice)

- **Observability API:** Port 3100 (configurable via PORT env var)
- **LogWorker:** Background process

---

## Monitoring

### Health Checks

- `/health` - Basic health check
- `/health/detailed` - Detailed diagnostics

### Key Metrics

- Redis Stream depth
- DLQ depth
- LogWorker processing rate
- API response time
- Error rate

**For monitoring details, see [operations/monitoring.md](../operations/monitoring.md)**

---

## Future Improvements

### Potential Enhancements

1. **Prometheus Metrics**
   - Expose `/metrics` endpoint
   - Integration with Grafana

2. **Authentication**
   - API key authentication
   - Rate limiting

3. **Index Lifecycle Management**
   - Automatic log rotation
   - Retention policies

4. **Alerting**
   - Stream depth alerts
   - Error rate alerts

---

## See Also

- [Setup Guide](setup.md) - Development setup
- [Contributing Guide](contributing.md) - How to contribute
- [API Reference](../api/reference.md) - API documentation
- [Monitoring Guide](../operations/monitoring.md) - Monitoring

