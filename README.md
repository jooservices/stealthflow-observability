# StealthFlow Observability Microservice

Internal logging and observability microservice for the StealthFlow ecosystem.

**Copyright © 2025 Viet Vu / JOOservices**  
Email: [jooservices@gmail.com](mailto:jooservices@gmail.com) | Website: [https://jooservices.com](https://jooservices.com)

---

## 1. Project Overview

**Project Name:** StealthFlow Observability  
**Version:** 1.0.0  
**Description:** Internal microservice for collecting, processing, and storing structured logs from the StealthFlow ecosystem. Provides asynchronous log submission via Redis Stream, batch processing via LogWorker, and full-text search via Elasticsearch/Kibana.

**Keywords:** Microservice, Observability, Logging, Elasticsearch, Redis, Node.js

---

## 2. Features

- 📊 **Structured Logging** - Consistent log schema with categories and operations
- 🔄 **Asynchronous Processing** - Non-blocking log submission via Redis Stream
- 📈 **Scalable Architecture** - Horizontal scaling with multiple LogWorkers
- 🔍 **Full-Text Search** - Query logs in Elasticsearch via Kibana
- 🔗 **Correlation IDs** - Track workflows with `workflowId` and `requestId`
- 🛡️ **Resilient** - Fallback file logging when Redis is unavailable
- 📦 **Batch Support** - Submit multiple logs in a single request
- 🏥 **Health Monitoring** - Built-in health check endpoints

---

## 3. System Architecture

### 3.1 High-Level Diagram

```
Application → API Server → Redis Stream → LogWorker → Elasticsearch → Kibana
```

### 3.2 Tech Stack

- **Backend:** Node.js 20+ (Express.js)
- **Database/Cache:** Redis (Streams)
- **Search Engine:** Elasticsearch 8.x
- **Message Queue:** Redis Streams
- **Monitoring:** Built-in health checks
- **Containerization:** Docker & Docker Compose

### 3.3 Infrastructure Setup

This microservice connects to shared infrastructure services and consists of two main components:

**Infrastructure Services (Shared Infrastructure):**
- **Redis** (port 6380) - Message queue and stream storage
- **Elasticsearch** (port 9201) - Log storage and search engine
- **MongoDB** (port 27018) - Optional, for future use
- **Kibana** (port 5602) - Log visualization dashboard

**Observability Service (This Microservice):**
- **API Server** (port 3100) - Receives and processes log submissions
- **LogWorker** - Background process that moves logs from Redis to Elasticsearch

### 3.4 Data Flow

Complete log processing flow from submission to visualization:

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Services                     │
│  (Your applications that need to log events)               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ HTTP POST /api/v1/logs
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Observability API Server                       │
│              (Port 3100 - This Service)                     │
│  • Validates log entries                                    │
│  • Writes to Redis Stream (async, non-blocking)             │
│  • Returns 202 Accepted immediately                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Redis Stream (logs:stream)
                     │ Consumer Group: stealthflow-log-workers
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Redis Stream Buffer                      │
│              (Infrastructure Service)                       │
│  • Message queue buffer                                     │
│  • Handles backpressure                                     │
│  • Port: 6380                                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ LogWorker (Background Process)
                     │ Batch processing (200 logs/batch)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    LogWorker Process                         │
│              (This Service - Background)                     │
│  • Consumes logs from Redis Stream                          │
│  • Batch processes logs                                     │
│  • Writes to Elasticsearch via Bulk API                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Elasticsearch Bulk API
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Elasticsearch Storage                       │
│              (Infrastructure Service)                       │
│  • Index: stealthflow_develop_logs                         │
│  • Full-text search and analytics                           │
│  • Port: 9201                                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Query API
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Kibana Dashboard                         │
│              (Infrastructure Service)                       │
│  • Log visualization                                        │
│  • Query interface                                          │
│  • Port: 5602                                               │
└─────────────────────────────────────────────────────────────┘
```

**Key Points:**
- **Asynchronous Processing:** API returns immediately after writing to Redis, doesn't wait for Elasticsearch
- **Scalable:** Multiple LogWorkers can run in parallel to increase throughput
- **Resilient:** Fallback file logging if Redis fails; Dead Letter Queue (DLQ) for failed Elasticsearch writes

**For detailed architecture documentation, see [docs/development/architecture.md](docs/development/architecture.md)**

---

## 4. Prerequisites

- **Node.js** >= 20.0.0
- **npm** >= 10.0.0
- **Docker** & Docker Compose (for containerized deployment)
- **Access to Infrastructure Services** (configure via environment variables):
  - Redis (default port 6380) - Required
  - Elasticsearch (default port 9201) - Required
  - MongoDB (default port 27018) - Optional

---

## 5. Quick Start

```bash
# Install dependencies
npm install

# Copy environment config
cp .env.example .env

# Run locally (configure .env with your infrastructure endpoints)
npm run dev

# In another terminal, start LogWorker
npm run worker

# Or with Docker
docker-compose -f docker-compose.observability.yml up -d
```

**For detailed setup instructions, see [docs/development/setup.md](docs/development/setup.md)**

---

## 6. Installation & Setup

### 6.1 Clone Project

```bash
git clone git@github.com:jooservices/stealthflow.git
cd stealthflow-observability
```

### 6.2 Install Dependencies

```bash
npm install
```

### 6.3 Configure Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 6.4 Test Connections

```bash
npm run test:connections
```

**For complete installation guide, see [docs/guides/deployment.md](docs/guides/deployment.md)**

---

## 7. Configuration

### 7.1 Environment Variables

Key environment variables (see `.env.example` for complete list):

```bash
# Redis Configuration
REDIS_HOST=your-redis-host
REDIS_PORT=6380

# Elasticsearch Configuration
ELASTICSEARCH_URL=http://your-elasticsearch-host:9201

# Stream Configuration
LOG_STREAM_NAME=logs:stream
LOG_CONSUMER_GROUP=stealthflow-log-workers
LOG_BATCH_SIZE=200
LOG_INDEX_ALIAS=stealthflow_develop_logs

# Server
NODE_ENV=development
PORT=3000
```

**For complete configuration reference, see [docs/guides/deployment.md#configuration](docs/guides/deployment.md#configuration)**

---

## 8. Usage

### 8.1 Using the Client Library

```javascript
import logger from './observability.js';

// Simple log
await logger.log('SYSTEM', 'app_started', {
  version: '1.0.0'
});

// With workflow tracking
const workflowId = `order-${Date.now()}`;
await logger.workflow(workflowId, 'order_created', { orderId: 'ORD-001' });

// Error logging
try {
  await operation();
} catch (error) {
  await logger.error(error, { operation: 'checkout' });
}
```

### 8.2 Using the REST API

```bash
# Submit single log
curl -X POST http://localhost:3100/api/v1/logs \
  -H "Content-Type: application/json" \
  -d '{
    "category": "SYSTEM",
    "operation": "test_operation",
    "metadata": {},
    "options": { "serviceName": "MyService" }
  }'
```

**For complete usage guide with examples, see [docs/guides/user-guide.md](docs/guides/user-guide.md)**  
**For client integration, see [docs/guides/client-integration.md](docs/guides/client-integration.md)**

---

## 9. API Documentation

### 9.1 REST Endpoints

**POST** `/api/v1/logs` - Submit single log entry  
**POST** `/api/v1/logs/batch` - Submit batch logs (max 1000)  
**GET** `/health` - Basic health check  
**GET** `/health/detailed` - Detailed diagnostics  
**GET** `/` - Service information

### 9.2 Request/Response Examples

**Submit Log:**
```json
POST /api/v1/logs
{
  "category": "SYSTEM",
  "operation": "test_operation",
  "metadata": {},
  "options": {
    "serviceName": "MyService",
    "workflowId": "wf-123"
  }
}

Response:
{
  "status": "accepted",
  "timestamp": "2024-11-30T10:30:00.000Z"
}
```

**For complete API reference, see [docs/api/reference.md](docs/api/reference.md)**

---

## 10. Log Categories

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

**For log schema details, see [docs/README.md#log-schema](docs/README.md#log-schema)**

---

## 11. Environments

| Environment | URL | Notes |
|------------|-----|-------|
| Local | http://localhost:3000 | Development work |
| Development | http://your-dev-server:3100 | Shared dev environment |
| Production | http://your-prod-server:3100 | Live environment |

**Note:** Configure infrastructure service endpoints via environment variables (REDIS_HOST, ELASTICSEARCH_URL, etc.)

---

## 12. Docker & Deployment

### 12.1 Docker Structure

```
docker-compose.observability.yml
Dockerfile
```

### 12.2 Commands

```bash
# Build
docker-compose -f docker-compose.observability.yml build

# Start
docker-compose -f docker-compose.observability.yml up -d

# View logs
docker logs observability-api
docker logs log-worker

# Stop
docker-compose -f docker-compose.observability.yml down
```

### 12.3 Deployment Strategy

- Zero-downtime deployment (with Docker Compose)
- Health checks before traffic
- Automatic restart on failure

**For complete deployment guide, see [docs/guides/deployment.md](docs/guides/deployment.md)**

---

## 13. Monitoring & Observability

### 13.1 Health Checks

```bash
# Basic health
curl http://localhost:3100/health

# Detailed diagnostics
curl http://localhost:3100/health/detailed
```

### 13.2 Key Metrics

- Redis Stream depth (should be < 1000)
- DLQ depth (should be 0 or low)
- LogWorker processing rate
- API response time
- Error rate

### 13.3 Viewing Logs

Access Kibana: http://your-kibana-host:5602 (configure via your infrastructure setup)

**For complete monitoring guide, see [docs/operations/monitoring.md](docs/operations/monitoring.md)**

---

## 14. Testing

### 14.1 Test Commands

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Test connections
npm run test:connections
```

### 14.2 Test Types

- Unit tests
- Integration tests
- Connection tests

### 14.3 Coverage

Coverage target: 70%+ (branches, functions, lines, statements)

---

## 15. Security

- **Internal Network Only** - No authentication required (internal service)
- **Network Isolation** - Ensure infrastructure service ports (Redis, Elasticsearch) are not exposed to internet
- **Input Validation** - All inputs validated
- **No Sensitive Data** - Never log passwords, API keys, credit cards
- **HTTPS** - Use HTTPS in production (if exposed)
- **Secrets Management** - Store credentials in environment variables

**For security best practices, see [docs/README.md#security-considerations](docs/README.md#security-considerations)**

---

## 16. Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Logs not appearing in ES | LogWorker not running | Start LogWorker: `npm run worker` |
| High stream backlog | LogWorker slow/stopped | Scale workers or increase batch size |
| Connection errors | Infrastructure services down | Check infrastructure: `npm run test:connections` |
| Health check fails | Service down | Check logs: `docker logs observability-api` |

**For detailed troubleshooting guide, see [docs/operations/troubleshooting.md](docs/operations/troubleshooting.md)**

---

## 17. Development

### 17.1 Project Structure

```
src/
├── api/                    # REST API
│   ├── server.js
│   └── routes/
├── infrastructure/         # External services
│   └── logging/
└── shared/                # Shared utilities

scripts/
├── log-worker.mjs
└── test-connections.js
```

### 17.2 Development Commands

```bash
# Development server
npm run dev

# Start worker
npm run worker

# Lint
npm run lint

# Format
npm run format

# Validate all
npm run validate
```

**For development setup, see [docs/development/setup.md](docs/development/setup.md)**

---

## 18. Contributing

### 18.1 Branch Strategy

- `main` - Production
- `develop` - Integration
- `feature/*` - New features
- `hotfix/*` - Critical fixes

### 18.2 Commit Rules

Use Conventional Commits:

```
feat: add new endpoint
fix: correct error handling
docs: update README
chore: update dependencies
```

### 18.3 Pull Request Checklist

- [ ] Code passes linting
- [ ] Tests pass
- [ ] No hardcoded secrets
- [ ] Documentation updated
- [ ] No breaking changes

**For contributing guidelines, see [docs/development/contributing.md](docs/development/contributing.md)**

---

## 19. Documentation

All documentation is located in the `docs/` directory:

- **[Guides](docs/guides/)** - User-facing guides
  - [Deployment Guide](docs/guides/deployment.md)
  - [User Guide](docs/guides/user-guide.md)
  - [Client Integration](docs/guides/client-integration.md)
- **[API Reference](docs/api/)** - API documentation
  - [API Reference](docs/api/reference.md)
- **[Operations](docs/operations/)** - Operations & maintenance
  - [Monitoring](docs/operations/monitoring.md)
  - [Troubleshooting](docs/operations/troubleshooting.md)
- **[Development](docs/development/)** - Developer docs
  - [Setup](docs/development/setup.md)
  - [Architecture](docs/development/architecture.md)
  - [Contributing](docs/development/contributing.md)
- **[Technical Reference](docs/README.md)** - Complete technical documentation

---

## 20. License

MIT

**Copyright © 2025 Viet Vu / JOOservices**

- Email: [jooservices@gmail.com](mailto:jooservices@gmail.com)
- Website: [https://jooservices.com](https://jooservices.com)

---

## 21. Maintainers

| Role | Contact |
|------|---------|
| Author | Viet Vu - [jooservices@gmail.com](mailto:jooservices@gmail.com) |
| Website | [https://jooservices.com](https://jooservices.com) |

---

## Quick Links

- 📖 [Complete Documentation](docs/README.md)
- 🚀 [Deployment Guide](docs/guides/deployment.md)
- 👤 [User Guide](docs/guides/user-guide.md)
- 🔌 [Client Integration](docs/guides/client-integration.md)
- 📊 [API Reference](docs/api/reference.md)
- 🔍 [Monitoring](docs/operations/monitoring.md)
- 🛠️ [Troubleshooting](docs/operations/troubleshooting.md)
