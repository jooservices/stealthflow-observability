---
title: "Security Best Practices"
type: "system-doc"
scope: "project"
project: "stealthflow-observability"
what: "Security best practices and guidelines for StealthFlow Observability"
why: "Ensure secure logging and data handling"
how: "Follow security guidelines when using the service"
owner: "StealthFlow Team"
status: "approved"
last_updated: "2025-12-05"
tags: ['security', 'best-practices', 'stealthflow-observability']
ai_semantics:
  layer: "system"
  relates_to: ['security', 'best-practices']
---

# Security Best Practices

## Logging Hygiene
- Do **not** log secrets, API keys, passwords, tokens, PII, or full cookies. Redact/omit sensitive fields before sending.
- Prefer structured payloads in `context`/`payload` over free-form strings for safer filtering and auditing.

## Service Controls
- **Authentication:** `X-API-Key` header validated against `API_KEYS` (comma-separated) in `.env`.
- **Rate limiting:** Defaults are 100 req/min for `/api/v1/logs` and 20 req/min for `/api/v1/logs/batch`. Tune via `RATE_LIMIT_MAX_REQUESTS`, `RATE_LIMIT_BATCH_MAX`, and `RATE_LIMIT_WINDOW_MS`.
- **Metrics:** `/metrics` exposes auth successes/failures and rate-limit hits; place behind a proxy if the network is untrusted.
- **Fallback + DLQ:** If Redis is unavailable, the API writes to `FALLBACK_LOG_DIR` and returns `500`. Worker sends malformed/failed records to `logs:failed`.

## Network Expectations
- In `docker-compose.yml`, only the API (`3100` host → `3000` container) and Kibana (`5601`) are exposed. Redis/Elasticsearch/MongoDB stay on the internal network; keep them private in all environments.
- Terminate TLS at the load balancer/reverse proxy in front of the API.

## Key Management
- Generate strong keys: `openssl rand -hex 32`.
- Rotate by updating `API_KEYS` in the environment, redeploying/restarting the API, and updating clients. Multiple keys are supported simultaneously for zero-downtime rotation.
- Never commit keys; keep `.env` private.

## Monitoring
- **Auth health:** Check `api_auth_failures_total` and `api_auth_success_total` at `/metrics`.
- **Dependency health:** `/health` and `/health/detailed` report Redis/Elasticsearch status and stream lengths (`logs:stream`, `logs:failed`).
