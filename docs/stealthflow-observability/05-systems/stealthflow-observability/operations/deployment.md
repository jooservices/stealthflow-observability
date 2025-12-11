---
title: "Deployment Guide"
type: "system-doc"
scope: "project"
project: "stealthflow-observability"
what: "Deploy StealthFlow Observability with Docker Compose"
why: "Stand up the full stack quickly and consistently"
how: "Use the provided scripts or docker-compose directly"
owner: "StealthFlow Team"
status: "approved"
last_updated: "2025-12-05"
tags: ['deployment', 'operations', 'stealthflow-observability']
ai_semantics:
  layer: "system"
  relates_to: ['deployment', 'operations']
---

# Deployment Guide

Deploy the observability stack (Redis, Elasticsearch, MongoDB, Kibana, API, Worker) using the provided scripts.

## Quick Start

> **Important:** Use Docker Compose V2 (`docker compose`). The legacy `docker-compose` v1 binary is incompatible with recent Docker Engine releases and causes `KeyError: 'ContainerConfig'` during `up`. Replace any `docker-compose` commands with `docker compose`.

```bash
./scripts/deploy.sh
```

The script will create `.env` if missing, generate API keys when `API_KEYS` is empty, start the full Docker Compose stack, and print service URLs:
- API: `http://localhost:3100`
- Health: `http://localhost:3100/health`
- Metrics: `http://localhost:3100/metrics`
- Kibana: `http://localhost:5601`

## Prerequisites
- Docker and Docker Compose installed
- Host ports `3100` (API) and `5601` (Kibana) available
- `.env` based on `.env.example` (set `API_KEYS` or let the script generate them)

### Required Infrastructure

The deployment requires Container #1 infrastructure running at `192.168.1.13` with:

| Service | Host | Port | Purpose |
|---------|------|------|---------|
| **Redis** | 192.168.1.13 | 6380 | Log streaming queue |
| **Elasticsearch** | 192.168.1.13 | 9201 | Log storage and search |
| **MongoDB** | 192.168.1.13 | 27018 | Metadata storage (optional) |

### Local Requirements

- **Docker**: Version 20.10 or higher
- **Docker Compose**: V2 plugin (`docker compose`). Legacy `docker-compose` v1 is not supported on Docker 25+.
- **Port 3100**: Must be available (API server)
- **Disk Space**: At least 1GB free
- **openssl**: For API key generation

### Verify Prerequisites

```bash
# Check Docker
docker --version
docker info

# Check Docker Compose V2
docker compose version
```

## Manual Deployment

```bash
cp .env.example .env           # if needed; set API_KEYS
docker compose up -d           # start full stack
docker compose ps              # confirm health checks
```

## Post-Deployment Verification

```bash
curl http://localhost:3100/health            # dependency status
curl http://localhost:3100/metrics | head    # Prometheus exposition
./scripts/test.sh <API_KEY>                  # optional E2E (auth, rate-limit, functional)
```

Kibana is available at `http://localhost:5601` (index alias: `LOG_INDEX_ALIAS`, default `stealthflow_develop_logs`).

## API Smoke Test (schema v1)

```bash
curl -X POST http://localhost:3100/api/v1/logs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "schema_version": 1,
    "level": "INFO",
    "service": "smoke-test",
    "environment": "local",
    "kind": "SYSTEM",
    "category": "smoke.test",
    "event": "deployment_check",
    "message": "Deployment validation",
    "context": { "requestId": "deploy-1" }
  }'
```

## Management Commands

```bash
docker compose logs -f observability-api log-worker   # tail app logs
docker compose restart observability-api log-worker   # restart services
docker compose down                                   # stop stack (data persisted in volumes)
./scripts/cleanup.sh                                  # optional: tear down + remove volumes
```

## Notes
- Only the API (3100) and Kibana (5601) are exposed externally; Redis/Elasticsearch/MongoDB remain on the internal compose network.
- Tune worker and routing via `.env` (`LOG_BATCH_SIZE`, `LOG_STREAM_NAME`, `LOG_CONSUMER_GROUP`, `LOG_INDEX_ALIAS`) and `src/config/routingRules.js`.
- All API calls require `X-API-Key` matching `API_KEYS` in `.env`.

## Support
- Owner: Viet Vu — [jooservices@gmail.com](mailto:jooservices@gmail.com)
