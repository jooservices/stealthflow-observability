# StealthFlow Observability Microservice

Internal logging and observability microservice for the StealthFlow ecosystem.

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment config
cp .env.example .env

# Run locally (connects to 192.168.1.13)
npm run dev

# Or with Docker
docker-compose -f docker-compose.observability.yml up -d
```

## Architecture

**Container #2** on server 192.168.1.13, connects to **Container #1** infrastructure:
- Redis (6380)
- Elasticsearch (9201)
- MongoDB (27018)

## API Endpoints

```bash
# Submit log
POST /api/v1/logs
{
  "category": "SYSTEM",
  "operation": "test",
  "metadata": {},
  "options": {}
}

# Health check
GET /health

# Metrics (Prometheus)
GET /metrics

# Admin tools
GET /admin/redis/streams/logs:stream/info
GET /admin/dlq/stats
POST /admin/dlq/retry
```

## Development

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format

# Validate all (lint + format + test)
npm run validate
```

## Project Structure

```
src/
├── api/                    # REST API
│   ├── server.js
│   ├── routes/
│   └── middleware/
├── infrastructure/         # External services
│   └── logging/
└── shared/                # Shared utilities
    ├── logging/
    └── validation/

scripts/
├── log-worker.mjs         # Background worker
└── test-connections.js    # Connection test
```

## Documentation

- [Final Implementation Guide](docs/final-implementation-guide.md)
- [Code Standards](docs/code-standards.md)
- [Infrastructure Review](docs/infrastructure-review.md)

## Deployment

See [Final Implementation Guide](docs/final-implementation-guide.md) for complete deployment instructions.

```bash
# On server 192.168.1.13
docker-compose -f docker-compose.observability.yml up -d

# Check logs
docker logs observability-api
docker logs log-worker

# Verify health
curl http://192.168.1.13:3100/health
```

## License

MIT
