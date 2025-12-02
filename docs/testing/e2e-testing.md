# End-to-End Testing Guide

Complete guide for running end-to-end tests of the Observability microservice.

---

## Overview

The E2E test suite (`scripts/test.sh`) performs a complete integration test:

1. **Deploy** - Runs the deploy script to set up the environment
2. **Docker Up** - Starts Docker containers and waits for services
3. **API Tests** - Tests all API endpoints with authentication and rate limiting

---

## Quick Start

### Run E2E Tests

```bash
# Using npm script
npm run test:e2e

# Or directly
./scripts/test.sh
```

### With API Key

```bash
# Pass API key as argument (optional, will auto-detect from .env)
./scripts/test.sh <your-api-key>
```

---

## What Gets Tested

### 1. Deployment
- ✅ Deploy script execution
- ✅ API key generation (if not present)
- ✅ Docker image build
- ✅ Container startup

### 2. Service Health
- ✅ Health endpoint (`/health`)
- ✅ Detailed health endpoint (`/health/detailed`)
- ✅ Metrics endpoint (`/metrics`)
- ✅ Root endpoint (`/`)

### 3. Authentication
- ✅ Reject requests without API key (401)
- ✅ Reject requests with invalid API key (401)
- ✅ Accept requests with valid API key (202)

### 4. API Functionality
- ✅ Submit single log entry
- ✅ Submit batch logs
- ✅ Error handling (invalid payloads)
- ✅ 404 handling

### 5. Security Features
- ✅ Rate limiting enforcement
- ✅ Security metrics exposure
- ✅ Metrics content validation

---

## Test Output

The script provides color-coded output:

- 🟢 **Green (✅)** - Test passed
- 🔴 **Red (❌)** - Test failed
- 🟡 **Yellow (⚠️)** - Warning
- 🔵 **Blue (📋)** - Test in progress

### Example Output

```
========================================
  End-to-End Test Suite
========================================

========================================
  Step 1: Running Deploy Script
========================================
✅ Deploy script completed

========================================
  Step 2: Waiting for Docker Containers
========================================
✅ Containers are running
✅ Service is ready

========================================
  Step 3: Testing APIs
========================================
📋 Test 1: Health endpoint (no auth required)
✅ Health endpoint accessible
...
```

---

## Configuration

### Environment Variables

```bash
# API URL (default: http://localhost:3100)
export API_URL=http://localhost:3100

# Enable cleanup after tests (default: false)
export CLEANUP=true

# Run tests
./scripts/test.sh
```

### Custom API URL

```bash
API_URL=http://your-server:3100 ./scripts/test.sh
```

---

## Prerequisites

### Required
- Docker and Docker Compose installed
- Docker daemon running
- Network access to infrastructure services (if testing with real services)
- `curl` command available

### Optional
- Infrastructure services running (Redis, Elasticsearch)
  - If not available, some tests may fail but deployment will still be tested

---

## Test Flow

```
┌─────────────────────────────────────┐
│  1. Run deploy.sh                   │
│     - Generate API keys             │
│     - Build Docker images           │
│     - Start containers              │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  2. Wait for Services               │
│     - Check container status        │
│     - Wait for /health endpoint     │
│     - Verify readiness             │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  3. Test APIs                       │
│     - Health endpoints              │
│     - Metrics endpoint             │
│     - Authentication               │
│     - API functionality            │
│     - Rate limiting                │
│     - Error handling               │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  4. Summary                         │
│     - Test results                  │
│     - Next steps                    │
└─────────────────────────────────────┘
```

---

## Troubleshooting

### Containers Not Starting

```bash
# Check container status
docker-compose -f docker-compose.yml ps

# View logs
docker logs observability-api
docker logs log-worker

# Check for errors
docker-compose -f docker-compose.yml logs
```

### Health Endpoint Not Responding

```bash
# Check if port is accessible
curl http://localhost:3100/health

# Check container logs
docker logs observability-api --tail 50

# Verify container is running
docker ps | grep observability-api
```

### API Key Issues

```bash
# Check API keys in .env
grep API_KEYS .env

# Verify keys are passed to container
docker exec observability-api env | grep API_KEYS
```

### Rate Limiting Tests Failing

Rate limiting tests may fail if:
- Rate limit window hasn't reset
- Previous tests already exhausted limit

**Solution:** Wait a minute and re-run tests, or adjust rate limit settings in `.env`:

```bash
RATE_LIMIT_WINDOW_MS=1000
RATE_LIMIT_MAX_REQUESTS=10
```

---

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Docker
        uses: docker/setup-buildx-action@v2
      
      - name: Run E2E tests
        run: |
          chmod +x scripts/test.sh
          ./scripts/test.sh
      
      - name: Cleanup
        if: always()
        run: |
          docker-compose -f docker-compose.yml down
```

### GitLab CI Example

```yaml
e2e-tests:
  stage: test
  image: docker:latest
  services:
    - docker:dind
  before_script:
    - apk add --no-cache curl bash
  script:
    - chmod +x scripts/test.sh
    - ./scripts/test.sh
  after_script:
    - docker-compose -f docker-compose.yml down
```

---

## Manual Testing

After E2E tests pass, you can manually test:

### 1. Check Health

```bash
curl http://localhost:3100/health
```

### 2. View Metrics

```bash
curl http://localhost:3100/metrics | grep api_auth
```

### 3. Submit Log

```bash
# Get API key from .env
API_KEY=$(grep "^API_KEYS=" .env | cut -d'=' -f2 | cut -d',' -f1)

# Submit log
curl -X POST http://localhost:3100/api/v1/logs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{"category":"TEST","operation":"manual-test"}'
```

### 4. Test Rate Limiting

```bash
# Make multiple requests
for i in {1..105}; do
  curl -X POST http://localhost:3100/api/v1/logs \
    -H "X-API-Key: $API_KEY" \
    -d "{\"category\":\"TEST\",\"operation\":\"rate-test-$i\"}"
done
```

---

## Best Practices

1. **Run Before Deployment:**
   - Always run E2E tests before deploying to production
   - Verify all components work together

2. **Clean Environment:**
   - Start with clean Docker state
   - Remove old containers: `docker-compose down`

3. **Monitor Resources:**
   - Check Docker resource usage
   - Monitor infrastructure services

4. **Review Logs:**
   - Check container logs after tests
   - Look for warnings or errors

5. **Update Tests:**
   - Add new tests when adding features
   - Keep tests in sync with API changes

---

## See Also

- [Deployment Guide](../guides/deployment.md)
- [API Reference](../api/reference.md)
- [Security Testing](../SECURITY_IMPLEMENTATION_CHECKLIST.md)

