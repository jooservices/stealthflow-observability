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

StealthFlow Observability ingests structured logs over HTTP, buffers them in Redis Streams, and ships them to Elasticsearch and/or MongoDB via a background worker that applies routing rules.

## Overview

```
Application → API (Express, auth + rate limit) → Redis Stream (logs:stream)
           → Log Worker (routing rules) → Elasticsearch (LOG_INDEX_ALIAS or profile prefix)
                                         → MongoDB (when profile requires)
                                         → Kibana (5601) for search/visualization
```

## ASCII Flow

```
                  +--------------------+
                  |  Client Services   |
                  | (apps, workers)    |
                  +---------+----------+
                            |
                            | HTTP POST /api/v1/logs (X-API-Key)
                            v
                  +--------------------+
                  |   API (Express)    |
                  | auth + rate limit  |
                  +---------+----------+
                            |
                            | XADD logs:stream (Redis)
                            v
                  +--------------------+
                  |   Redis Stream     |
                  |   logs:stream      |
                  +---------+----------+
                            |
                            | XREADGROUP (batch, consumer group)
                            v
                  +--------------------+
                  |    Log Worker      |
                  | routing profiles   |
                  +-----+------+-------+
                        |      |
                        |      |
         bulk index     |      | direct write
         to ES          |      | to Mongo (profiles)
                        |      |
              v---------+      +---------v
          +----------------+  +----------------+
          | Elasticsearch  |  |   MongoDB     |
          |  index alias   |  | (profile col) |
          +--------+-------+  +--------+------+
                   |                   |
                   | search/visualize  |
                   v                   |
          +----------------+           |
          |    Kibana      |<----------+
          +----------------+
```

### Components
- **API Server** (`src/api/server.js`): Express app with JSON parsing, API key auth (`X-API-Key`), rate limiting, metrics (`/metrics`), and health endpoints (`/health`, `/health/detailed`). Submits logs to Redis Streams with file-based fallback when Redis is down.
- **Redis Stream** (`LOG_STREAM_NAME`, default `logs:stream`): Buffer that decouples ingestion from storage; consumer group `LOG_CONSUMER_GROUP` (default `stealthflow-log-workers`).
- **Log Worker** (`src/workers/log-worker.js`): Consumer that batches stream messages (default 200), resolves storage profiles from `src/config/routingRules.js`, and writes to Elasticsearch and/or MongoDB. Failed/parsing items are moved to DLQ `logs:failed`.
- **Routing Profiles** (`src/config/storageProfiles.js`, `src/config/routingRules.js`, `src/config/routing.js`): Map log kind/category/level → storage profile. Profiles define destinations, TTL hints, and index prefixes/collections.
- **Storage**: Elasticsearch bulk indexing using `LOG_INDEX_ALIAS` (or profile prefixes + date suffix). MongoDB collections when a profile lists `mongodb`.
- **Fallback Logger** (`src/infrastructure/logging/FallbackLogger.js`): Writes logs to files under `FALLBACK_LOG_DIR` when Redis is unavailable.
- **Kibana**: Port `5601` in `docker-compose.yml` for searching indexed logs.

## Data Flow
1. Client sends `POST /api/v1/logs` (or `/batch`) with schema v1 or legacy payload.
2. API validates payload, enforces rate limits/auth, and appends to Redis stream.
3. Worker reads from the consumer group, batches records, resolves storage profile, and writes to the configured destinations.
4. Successful messages are acknowledged; parse/index failures are sent to the DLQ stream (`logs:failed`).
5. Indexed logs are queryable via Kibana using `LOG_INDEX_ALIAS` or per-profile index prefixes.

## Resilience & Observability
- **Fallback**: If Redis is unavailable, the API writes to `FALLBACK_LOG_DIR` and returns `500`.
- **DLQ**: Bad records are pushed to `logs:failed` for inspection/replay.
- **Health**: `/health` (summary) and `/health/detailed` (Redis/ES stats, stream lengths, process metrics).
- **Metrics**: Prometheus metrics at `/metrics` (auth successes/failures, rate-limit hits, request counts/durations).

## Infrastructure Notes
- **Ports**: API listens on `PORT` (default `3000`; mapped to host `3100` in `docker-compose.yml`). Kibana is exposed on `5601`. Redis/Elasticsearch/MongoDB are internal to the compose network.
- **Environment**: Key settings in `.env` — `API_KEYS`, `LOG_STREAM_NAME`, `LOG_CONSUMER_GROUP`, `LOG_BATCH_SIZE`, `LOG_INDEX_ALIAS`, `FALLBACK_LOG_DIR`, rate-limit env vars.
- **Scaling**: Increase workers with `docker-compose up -d --scale log-worker=N`. Tune batch size with `LOG_BATCH_SIZE`.

## See Also
- API contract: `../api/endpoints.md`
- Setup: `../../07-guides/onboarding/local-setup.md`
- Security: `./security.md`
