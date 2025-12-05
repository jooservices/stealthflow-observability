---
title: "StealthFlow Observability - System Overview"
type: "system-doc"
scope: "project"
project: "stealthflow-observability"
what: "Business overview and system introduction"
why: "Provide high-level understanding of the system"
how: "Read this first to understand the system's purpose and value"
owner: "StealthFlow Team"
status: "approved"
last_updated: "2025-12-05"
tags: ['system', 'overview', 'business', 'stealthflow-observability']
ai_semantics:
  layer: "system"
  scope: "project"
  project: "stealthflow-observability"
  priority: "high"
  relates_to: ['observability', 'logging']
  source: "project"
compliance:
  standards:
    - path: "../../../master/03-technical/standards/logging-standard.md"
      required: true
---

# StealthFlow Observability - Business Overview

## Executive Summary

StealthFlow Observability is the internal logging service that receives structured events over HTTP, buffers them in Redis Streams, and routes them to Elasticsearch and/or MongoDB based on configurable profiles. It adds API key authentication, rate limiting, and Prometheus metrics out of the box.

## Key Value
- **Fast triage:** Structured logs are indexed in Elasticsearch and queryable in Kibana (port `5601` by default).
- **Loss prevention:** Redis-backed queue with DLQ (`logs:failed`) plus file-based fallback when Redis is unavailable.
- **Flexible routing:** Storage profiles let you send specific kinds/categories to Elasticsearch or MongoDB.
- **Operational guardrails:** API key auth, per-endpoint rate limits, and health/metrics endpoints for monitoring.

## How It Works
1. Applications send logs to `POST /api/v1/logs` (or `/batch`) with schema v1 payloads.
2. API authenticates (`X-API-Key`), rate limits, validates, and appends to Redis stream `logs:stream`.
3. The log worker (`src/workers/log-worker.js`) reads from the consumer group, resolves a storage profile, and writes to Elasticsearch and/or MongoDB.
4. Indexed data is available through Kibana (`http://localhost:5601` in docker-compose).

## Integration & Adoption
- **HTTP-first:** Use the published JSON schema; legacy `{ category, operation, metadata, options }` payloads are still accepted.
- **Configuration:** Tune routing in `src/config/routingRules.js` and `src/config/storageProfiles.js`; environment in `.env`.
- **Authentication:** Set `API_KEYS` (comma-separated) and send requests with `X-API-Key`.

## Contact & Support
- **Owner:** Viet Vu
- **Email:** [jooservices@gmail.com](mailto:jooservices@gmail.com)
- **Docs Index:** [docs/stealthflow-observability/00-index/README.md](../00-index/README.md)
