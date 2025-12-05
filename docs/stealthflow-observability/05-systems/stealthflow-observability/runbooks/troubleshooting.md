---
title: "Troubleshooting Guide"
type: "system-doc"
scope: "project"
project: "stealthflow-observability"
what: "Common operational issues and quick fixes"
why: "Recover ingestion and indexing quickly"
how: "Run the checks/commands below"
owner: "StealthFlow Team"
status: "approved"
last_updated: "2025-12-05"
tags: ['troubleshooting', 'runbooks', 'stealthflow-observability']
ai_semantics:
  layer: "system"
  relates_to: ['troubleshooting', 'operations']
---

# Troubleshooting Guide

## Quick Checks
- API health: `curl http://localhost:3100/health`
- Containers: `docker-compose ps`
- Redis stream depth: `docker exec stealthflow-redis redis-cli XLEN logs:stream`
- DLQ depth: `docker exec stealthflow-redis redis-cli XLEN logs:failed`
- Elasticsearch health: `docker exec stealthflow-elasticsearch curl -s http://localhost:9200/_cluster/health`

## Logs not appearing in Kibana
1. Ensure worker is running:
   ```bash
   docker ps | grep log-worker
   ```
2. Check stream backlog:
   ```bash
   docker exec stealthflow-redis redis-cli XLEN logs:stream
   ```
3. Inspect worker logs:
   ```bash
   docker-compose logs --tail=100 log-worker
   ```
4. Verify Elasticsearch:
   ```bash
   docker exec stealthflow-elasticsearch curl -s http://localhost:9200/_cluster/health
   ```
**Fixes:** restart worker (`docker-compose restart log-worker`), increase `LOG_BATCH_SIZE`, or scale workers (`docker-compose up -d --scale log-worker=2`).

## DLQ growing
1. Check DLQ size and entries:
   ```bash
   docker exec stealthflow-redis redis-cli XLEN logs:failed
   docker exec stealthflow-redis redis-cli XREAD COUNT 5 STREAMS logs:failed 0
   ```
2. Look for parse/index errors in worker logs.
3. Confirm Elasticsearch availability and index alias (`LOG_INDEX_ALIAS`).
**Fixes:** resolve payload issues, ensure ES is reachable, then restart worker to continue processing.

## API returns 401
- Missing/invalid `X-API-Key`. Confirm `API_KEYS` in `.env` and restart the API if the value changed: `docker-compose restart observability-api`.

## API returns 429 (rate limited)
- Clients exceeded `RATE_LIMIT_MAX_REQUESTS` (single) or `RATE_LIMIT_BATCH_MAX` (batch). Tune values in `.env` if necessary and restart the API.

## API returns 500 on log submission
- Check API logs: `docker-compose logs --tail=100 observability-api`
- If Redis is down, requests write to `FALLBACK_LOG_DIR` and return 500. Bring Redis back up and retry.

## Health endpoint is degraded
- Look at connection statuses in `/health` and `/health/detailed`.
- Check environment for Redis/Elasticsearch hosts and ports (`docker exec observability-api env | grep -E "REDIS|ELASTICSEARCH"`).
- Restart the affected service (`docker-compose restart observability-api log-worker`).

## Port conflicts
- API: `lsof -i :3100` then stop the conflicting process or change `PORT` + host binding in `docker-compose.yml`.
- Kibana: `lsof -i :5601` similarly.

## Getting help
- Gather artifacts:
  ```bash
  curl -s http://localhost:3100/health/detailed > health.json
  docker-compose logs --tail=200 observability-api log-worker > service-logs.txt
  docker exec stealthflow-redis redis-cli XLEN logs:stream > stream_depth.txt
  ```
- Share with the maintainer (Viet Vu).
