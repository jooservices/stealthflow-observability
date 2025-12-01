# Documentation Index

Complete technical documentation for StealthFlow Observability Microservice.

---

## 📚 Documentation Structure

### [Guides](guides/) - User-Facing Documentation

- **[Deployment Guide](guides/deployment.md)** - Complete deployment instructions
- **[User Guide](guides/user-guide.md)** - How to use the service
- **[Client Integration](guides/client-integration.md)** - Client library usage

### [API Reference](api/)

- **[API Reference](api/reference.md)** - Complete API documentation

### [Operations](operations/) - Operations & Maintenance

- **[Monitoring](operations/monitoring.md)** - Monitoring guide
- **[Troubleshooting](operations/troubleshooting.md)** - Troubleshooting guide

### [Development](development/) - Developer Documentation

- **[Setup](development/setup.md)** - Development setup
- **[Architecture](development/architecture.md)** - Architecture details
- **[Contributing](development/contributing.md)** - Contributing guidelines

---

## 🔍 Quick Search

### By Topic

**Getting Started:**
- [Deployment Guide](guides/deployment.md)
- [User Guide](guides/user-guide.md)
- [Development Setup](development/setup.md)

**Integration:**
- [Client Integration](guides/client-integration.md)
- [API Reference](api/reference.md)

**Operations:**
- [Monitoring](operations/monitoring.md)
- [Troubleshooting](operations/troubleshooting.md)

**Technical:**
- [Architecture](development/architecture.md)
- [Log Schema](#log-schema) (below)

---

## 📖 Technical Reference

### Log Schema

Complete log entry structure:

```javascript
{
  "timestamp": "2024-11-30T10:30:00.000Z",
  "level": "info",
  "category": "SYSTEM",
  "operation": "test_operation",
  "workflowId": "wf-123",
  "requestId": "req-456",
  "nodeName": "ServiceName.operation",
  "serviceName": "MyService",
  "accountUID": "100000563370253",
  "targetUID": "100000123456789",
  "metadata": {
    "system": {
      // Category-specific data
    }
  },
  "host": "hostname.local",
  "env": "development",
  "durationMs": 1234
}
```

**For complete schema documentation, see the full [Technical Reference](README.md) below.**

---

## 🔗 External Resources

- **Kibana:** Configure via your infrastructure setup (default port 5602)
- **Health Check:** http://your-server:3100/health
- **Elasticsearch:** Configure via ELASTICSEARCH_URL environment variable (default port 9201)

---

## 📝 Complete Technical Reference

The following sections provide complete technical documentation for the logging system.

---

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
Application → API Server → Redis Stream → LogWorker → Elasticsearch → Kibana
```

**For detailed architecture documentation, see [development/architecture.md](development/architecture.md)**

---

## Components

### 1. API Server
- Location: `src/api/server.js`
- Purpose: Receives logs via REST API
- Writes to Redis Stream (async, non-blocking)

### 2. Redis Stream
- Stream name: `logs:stream`
- Consumer group: `stealthflow-log-workers`
- Purpose: Message queue buffer

### 3. LogWorker
- Location: `scripts/log-worker.mjs`
- Purpose: Processes logs from Redis → Elasticsearch
- Batch size: 200 logs/batch

### 4. Elasticsearch
- Index alias: `stealthflow_develop_logs`
- Purpose: Log storage and search

### 5. Kibana
- URL: http://192.168.1.13:5602
- Purpose: Log visualization

---

## Log Schema

Complete log entry structure with all fields explained.

**For detailed schema documentation, see the full content in the original [README.md](README.md) file.**

---

## API Reference

**For complete API documentation, see [api/reference.md](api/reference.md)**

---

## Configuration

**For configuration details, see [guides/deployment.md#configuration](guides/deployment.md#configuration)**

---

## Usage Patterns

**For usage examples, see [guides/user-guide.md](guides/user-guide.md)**

---

## Troubleshooting

**For troubleshooting guide, see [operations/troubleshooting.md](operations/troubleshooting.md)**

---

## Security Considerations

### What NOT to Log

**Never log sensitive data:**
- ❌ Passwords or authentication tokens
- ❌ API keys or secrets
- ❌ Personal Identifiable Information (PII)
- ❌ Cookie values (log count, not content)
- ❌ Credit card numbers, SSNs, etc.

### Best Practices

1. ✅ **Never log passwords, tokens, or secrets**
2. ✅ **Sanitize data before logging**
3. ✅ **Use authentication for Elasticsearch/Kibana**
4. ✅ **Enable TLS in production**
5. ✅ **Implement access control (RBAC)**
6. ✅ **Set up log retention policies**

---

## Best Practices

1. **Always Include Correlation IDs**
2. **Use Appropriate Categories**
3. **Non-Blocking Writes**
4. **Structured Metadata**
5. **Error Context**

**For complete best practices, see the full documentation.**

---

*This is a summary. For complete technical reference, see the full documentation sections above.*
