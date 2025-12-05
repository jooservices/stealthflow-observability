---
title: "Monitoring Guide"
type: "system-doc"
scope: "project"
project: "stealthflow-observability"
what: "Monitor health, queues, and storage targets for the observability stack"
why: "Ensure ingestion, routing, and storage are healthy"
how: "Use built-in health endpoints, Prometheus metrics, and Redis/ES checks"
owner: "StealthFlow Team"
status: "approved"
last_updated: "2025-12-05"
tags: ['monitoring', 'operations', 'stealthflow-observability']
ai_semantics:
  layer: "system"
  relates_to: ['monitoring', 'operations']
---

# Monitoring Guide

## Health Endpoints
- `GET /health` — Redis + Elasticsearch connectivity summary (`healthy` or `degraded`).
- `GET /health/detailed` — Process stats, Redis stream lengths (`logs:stream`, `logs:failed`), Elasticsearch cluster/index stats.
- `GET /metrics` — Prometheus metrics (unauthenticated by default).

## Key Metrics
- `api_auth_failures_total{reason}` — Watch for invalid/missing API keys.
- `api_rate_limit_hits_total{endpoint}` — Indicates clients hitting limits.
- `api_requests_total{method,endpoint,status}` and `api_request_duration_seconds` — Request volumes and latency.
- Stream depth (Redis):
  ```bash
  docker exec stealthflow-redis redis-cli XLEN logs:stream
  docker exec stealthflow-redis redis-cli XLEN logs:failed   # DLQ
  ```
- Elasticsearch health:
  ```bash
  docker exec stealthflow-elasticsearch curl -s http://localhost:9200/_cluster/health
  docker exec stealthflow-elasticsearch curl -s http://localhost:9200/${LOG_INDEX_ALIAS:-stealthflow_develop_logs}/_stats
  ```

## Kibana
- URL: `http://localhost:5601`
- Default index alias: `LOG_INDEX_ALIAS` (see `.env`, default `stealthflow_develop_logs`).
- Useful queries:
  ```
  event: "payment_authorized"
  context.workflowId: "wf-123"
  kind: "SYSTEM" AND level: "ERROR"
  ```

## Quick Status Check
```bash
curl -s http://localhost:3100/health | jq '.status'
docker exec stealthflow-redis redis-cli XLEN logs:stream
docker exec stealthflow-redis redis-cli XLEN logs:failed
docker-compose ps
```

## Alert Suggestions
- Health endpoint returns 503 (`status: degraded`).
- Stream depth above steady-state (e.g., >1,000 for more than 5 minutes).
- DLQ depth > 0.
- Elasticsearch cluster status = `red`.
- Sudden increase in `api_auth_failures_total`.

## Notes
- Redis/Elasticsearch/MongoDB are internal-only; use `docker exec` to inspect.
- Batch size and routing affect queue depth; tune `LOG_BATCH_SIZE` and routing profiles if backlog grows.
