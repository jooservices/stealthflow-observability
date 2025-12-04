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

Complete guide for setting up development environment.

---

## Prerequisites

- **Node.js** >= 20.0.0
- **npm** >= 10.0.0
- **Docker** & Docker Compose (optional, for local services)
- **Git**

---

## Initial Setup

### 1. Clone Repository

```bash
git clone git@github.com:jooservices/stealthflow.git
cd stealthflow-observability
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your configuration:
- Redis connection (REDIS_HOST, REDIS_PORT)
- Elasticsearch URL (ELASTICSEARCH_URL)

### 4. Test Connections

```bash
npm run test:connections
```

This verifies connectivity to Container #1 infrastructure.

---

## Running Locally

### Start API Server

```bash
npm run dev
```

Server runs on http://localhost:3000

### Start LogWorker

In another terminal:

```bash
npm run worker
```

LogWorker processes logs from Redis Stream to Elasticsearch.

---

## Development Commands

### Run Tests

```bash
# All tests
npm test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage
```

### Code Quality

```bash
# Lint
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check

# Validate all (lint + format + test)
npm run validate
```

### Test Connections

```bash
npm run test:connections
```

---

## Project Structure

```
src/
├── api/                    # REST API
│   ├── server.js          # Express server
│   └── routes/
│       ├── logs.js        # Log endpoints
│       └── health.js      # Health endpoints
├── infrastructure/         # External services
│   └── logging/
│       ├── redisClient.js      # Redis connection
│       ├── esClient.js         # Elasticsearch connection
│       └── FallbackLogger.js   # File fallback
└── shared/                # Shared utilities

scripts/
├── deploy.sh              # Automated deployment script
├── test.sh                 # Comprehensive E2E test suite
├── demo.sh                 # Demo script (floods test data)
└── cleanup.sh              # Cleanup script (stop/remove containers)

client/
└── observability.js       # Client library
```

---

## Development Workflow

### 1. Create Feature Branch

```bash
git checkout -b feature/my-feature
```

### 2. Make Changes

- Write code
- Add tests
- Update documentation

### 3. Test Locally

```bash
# Run tests
npm test

# Lint
npm run lint

# Format
npm run format

# Validate all
npm run validate
```

### 4. Test Integration

```bash
# Start API
npm run dev

# Start worker (another terminal)
npm run worker

# Test API
curl http://localhost:3000/health
```

### 5. Commit Changes

```bash
git add .
git commit -m "feat: add new feature"
```

Use [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `chore:` - Maintenance

### 6. Push and Create PR

```bash
git push origin feature/my-feature
```

Create pull request on GitHub/GitLab.

---

## Debugging

### API Server

```bash
# Run with debug logging
DEBUG=* npm run dev

# Or use Node.js debugger
node --inspect src/api/server.js
```

### LogWorker

```bash
# Run with verbose logging
LOG_LEVEL=debug npm run worker
```

### Check Logs

```bash
# API logs
tail -f api.log

# Worker logs
tail -f log-worker.log

# Docker logs
docker logs observability-api
docker logs log-worker
```

---

## Testing

### Unit Tests

```bash
npm test
```

Tests are located in:
- `src/**/*.test.js`
- `scripts/**/*.test.js`

### Integration Tests

```bash
npm run test:integration
```

Integration tests verify:
- API endpoints
- Redis Stream operations
- Elasticsearch indexing

### Test Coverage

```bash
npm run test:coverage
```

Coverage target: 70%+

---

## Environment Variables

Key environment variables for development:

```bash
# Server
NODE_ENV=development
PORT=3000

# Redis
REDIS_HOST=your-redis-host
REDIS_PORT=6380

# Elasticsearch
ELASTICSEARCH_URL=http://your-elasticsearch-host:9201

# Logging
LOG_STREAM_NAME=logs:stream
LOG_CONSUMER_GROUP=stealthflow-log-workers
LOG_BATCH_SIZE=200
LOG_INDEX_ALIAS=stealthflow_develop_logs
```

See `.env.example` for complete list.

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
# Test connections
npm run test:connections

# Verify .env configuration
cat .env
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

- [Architecture Guide](architecture.md) - Understand the architecture
- [Contributing Guide](contributing.md) - How to contribute
- [API Reference](../api/reference.md) - API documentation

---

## See Also

- [Deployment Guide](../guides/deployment.md) - Production deployment
- [User Guide](../guides/user-guide.md) - How to use the service
- [Troubleshooting](../operations/troubleshooting.md) - Common issues

