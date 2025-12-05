---
title: "Local Development Setup"
type: "guide"
scope: "project"
project: "stealthflow-observability"
what: "Complete guide for setting up local development environment"
why: "Help developers set up their local environment"
how: "Follow this guide to set up development environment"
owner: "StealthFlow Team"
status: "approved"
last_updated: "2025-12-05"
tags: ['development', 'setup', 'onboarding', 'stealthflow-observability']
ai_semantics:
  layer: "guides"
  relates_to: ['development', 'setup']
---

# Development Setup

Set up a local environment for the observability service and its dependencies.

---

## Prerequisites

- Node.js >= 22.0.0 (see `package.json` engines)
- npm >= 11.0.0
- Docker & Docker Compose (for Redis, Elasticsearch, MongoDB, Kibana)
- Git

---

## Initial Setup

### 1) Clone repository

```bash
git clone git@github.com:jooservices/stealthflow-observability.git
cd stealthflow-observability
```

### 2) Install dependencies

```bash
npm install
```

### 3) Configure environment

```bash
cp .env.example .env
```

Edit `.env` for your environment:
- `API_KEYS` (comma-separated); leave empty to let `./scripts/deploy.sh` auto-generate.
- Optional tuning: `LOG_STREAM_NAME`, `LOG_BATCH_SIZE`, rate limits, `LOG_INDEX_ALIAS`.

---

## Running Locally

### Option A: Full stack via Docker Compose (recommended)

```bash
docker-compose up -d
```

Brings up Redis, Elasticsearch, MongoDB, Kibana, API (`http://localhost:3100`), and the worker.

### Option B: API/worker from host

1) Start infrastructure with Docker Compose (keeps ports internal):
```bash
docker-compose up -d redis elasticsearch mongodb
```

2) Run the API:

```bash
npm run dev
```

API listens on `PORT` (default `3000`).

3) Run the log worker in another terminal:

```bash
npm run worker
```

Worker consumes `logs:stream` and applies routing profiles.

---

## Development Commands

```bash
# Unit/integration tests
npm test

# Lint + format checks
npm run lint
npm run lint:fix
npm run format
npm run format:check

# Validate all (lint + format:check + test)
npm run validate
```

---

## Project Structure

```
src/
├── api/             # Express server, routes, middleware
├── config/          # Routing rules + storage profiles
├── infrastructure/  # Redis, Elasticsearch, MongoDB clients, fallback logger
├── workers/         # Redis → storage worker
└── tests/           # API/worker tests

scripts/
├── deploy.sh        # Compose-based deployment + key generation
├── demo.sh          # Sends sample logs after deployment
└── cleanup.sh       # Stops/removes containers and data
```

---

## Development Workflow

1) Create a feature branch: `git checkout -b feature/my-feature`  
2) Make changes + tests/docs  
3) `npm run validate` before opening a PR  
4) Push and open PR following Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`)

---

## Debugging

### API Server

```bash
# Run with debug logging
DEBUG=* npm run dev

# Node inspector
node --inspect src/api/server.js
```

### LogWorker

```bash
# Run with verbose logging
LOG_LEVEL=debug npm run worker
```

---

## Testing

## Environment Variables

- `API_KEYS` — comma-separated API keys (required for authenticated endpoints)
- `LOG_STREAM_NAME`, `LOG_CONSUMER_GROUP`, `LOG_BATCH_SIZE` — ingestion and worker tuning
- `LOG_INDEX_ALIAS` — ES index alias used by the worker
- `FALLBACK_LOG_DIR`, `FALLBACK_RETENTION_DAYS` — local fallback settings
- Rate limiting: `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS`, `RATE_LIMIT_BATCH_MAX`

See `.env.example` for the full list and defaults.

---

## IDE Setup

### VS Code

Recommended extensions:
- ESLint
- Prettier
- Jest

Settings (`.vscode/settings.json`):
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "eslint.validate": ["javascript"]
}
```

---

## Common Issues

### Port Already in Use

```bash
# Find process
lsof -i :3000

# Kill process
kill -9 <PID>
```

### Cannot Connect to Redis/Elasticsearch

```bash
# Verify compose is running
docker ps --filter name=redis --filter name=elasticsearch
```

### Tests Failing

```bash
# Clear cache
npm test -- --clearCache

# Run specific test
npm test -- path/to/test.js
```

---

## Next Steps

- [Architecture](../../05-systems/stealthflow-observability/architecture.md)
- [API Endpoints](../../05-systems/stealthflow-observability/api/endpoints.md)
- [User Guide](../usage/user-guide.md)

---

## See Also

- [System Overview](../../05-systems/stealthflow-observability/README.md)
- [Client Integration](../usage/client-integration.md)
