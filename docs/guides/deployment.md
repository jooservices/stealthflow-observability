# Deployment Guide

Complete guide for deploying the StealthFlow Observability microservice with 100% automation.

## Quick Start (One Command)

For a fully automated deployment with all security features enabled:

```bash
./scripts/deploy.sh
```

This script will:
- ✅ Auto-generate API keys if needed
- ✅ Configure rate limiting
- ✅ Deploy Docker containers
- ✅ Verify health and readiness
- ✅ Display all credentials and usage instructions

---

## Prerequisites

### Required Infrastructure

The deployment requires Container #1 infrastructure running at `192.168.1.13` with:

| Service | Host | Port | Purpose |
|---------|------|------|---------|
| **Redis** | 192.168.1.13 | 6380 | Log streaming queue |
| **Elasticsearch** | 192.168.1.13 | 9201 | Log storage and search |
| **MongoDB** | 192.168.1.13 | 27018 | Metadata storage (optional) |

### Local Requirements

- **Docker**: Version 20.10 or higher
- **docker-compose**: Version 1.29 or higher
- **Port 3100**: Must be available (API server)
- **Disk Space**: At least 1GB free
- **openssl**: For API key generation

### Verify Prerequisites

```bash
# Check Docker
docker --version
docker info

# Check docker-compose
docker-compose --version
```

---

## Deployment Methods

### Method 1: Automated Deployment (Recommended)

**100% automated, zero manual intervention required.**

```bash
./scripts/deploy.sh
```

#### What It Does

1. **Pre-flight Checks**
   - Verifies Docker is running
   - Tests Redis connectivity
   - Tests Elasticsearch connectivity
   - Checks port availability
   - Validates disk space

2. **Environment Setup**
   - Creates `.env` from `.env.example` if missing
   - Auto-generates 3 API keys (64 characters each)
   - Configures rate limiting defaults
   - Creates required directories

3. **Docker Deployment**
   - Builds Docker images
   - Starts API server and log worker
   - Waits for health checks to pass

4. **Post-Deployment**
   - Displays deployment summary
   - Shows generated API keys (SAVE THESE!)
   - Provides usage examples
   - Shows service URLs

#### Expected Output

```
═══════════════════════════════════════════════════════════════
 Deployment Complete!
═══════════════════════════════════════════════════════════════

✓ StealthFlow Observability services are running and ready to use!

Service URLs:
  • API Server:     http://localhost:3100
  • Health Check:   http://localhost:3100/health
  • Metrics:        http://localhost:3100/metrics

Container Status:
NAME                COMMAND                  SERVICE              STATUS          PORTS
observability-api   "docker-entrypoint.s…"   observability-api    Up (healthy)    0.0.0.0:3100->3000/tcp
log-worker          "docker-entrypoint.s…"   log-worker           Up              

═══════════════════════════════════════════════════════════════
  IMPORTANT: API Keys (Save These Securely!)
═══════════════════════════════════════════════════════════════

  Key 1: a1b2c3d4e5f6...
  Key 2: f6e5d4c3b2a1...
  Key 3: 123456789abc...

  These keys are saved in .env and will NOT be displayed again.
═══════════════════════════════════════════════════════════════
```

> [!CAUTION]
> **Save the API keys immediately!** They are displayed only once and required for all API requests.

---

### Method 2: Manual Deployment

If you prefer manual control:

#### Step 1: Create Environment File

```bash
cp .env.example .env
```

#### Step 2: Generate API Keys

```bash
# Generate 3 API keys
KEY1=$(openssl rand -hex 32)
KEY2=$(openssl rand -hex 32)
KEY3=$(openssl rand -hex 32)

# Add to .env
echo "API_KEYS=${KEY1},${KEY2},${KEY3}" >> .env

# Display keys (save these)
echo "Key 1: ${KEY1}"
echo "Key 2: ${KEY2}"
echo "Key 3: ${KEY3}"
```

#### Step 3: Configure Rate Limiting (Optional)

Edit `.env` and add:

```bash
RATE_LIMIT_WINDOW_MS=60000        # 1 minute window
RATE_LIMIT_MAX_REQUESTS=100       # Max 100 requests per minute
RATE_LIMIT_BATCH_MAX=20           # Max 20 batch requests per minute
```

#### Step 4: Create Directories

```bash
mkdir -p logs/fallback
```

#### Step 5: Deploy with Docker Compose

```bash
# Build images
docker-compose -f docker-compose.yml build

# Start services
docker-compose -f docker-compose.yml up -d

# Check status
docker-compose -f docker-compose.yml ps
```

#### Step 6: Verify Deployment

```bash
# Health check
curl http://localhost:3100/health

# Should return: {"status":"ok",...}
```

---

## Post-Deployment Verification

### 1. Check Container Status

```bash
docker-compose -f docker-compose.yml ps
```

Expected output: All 6 containers (Redis, Elasticsearch, MongoDB, Kibana, API, Worker) should be "Up" with "healthy" status.

### 2. Test Health Endpoint (No Auth Required)

```bash
curl http://localhost:3100/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-12-02T02:00:00.000Z",
  "services": {
    "redis": "connected",
    "elasticsearch": "connected"
  }
}
```

### 3. Test API Authentication

```bash
# Without API key (should fail with 401)
curl -X POST http://localhost:3100/api/v1/logs \
  -H "Content-Type: application/json" \
  -d '{"category":"TEST","operation":"test"}'

# With valid API key (should succeed with 202)
curl -X POST http://localhost:3100/api/v1/logs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <your-generated-key>" \
  -d '{"category":"TEST","operation":"test","metadata":{}}'
```

### 4. Test Rate Limiting

```bash
# Run comprehensive E2E test suite (includes rate limiting tests)
./scripts/test.sh
```

This will test:
- API key authentication
- Rate limiting (100 req/min)
- Batch rate limiting (20 req/min)
- Invalid key rejection
- Docker isolation
- Container health
- Functional operations

### 5. Verify Metrics

```bash
curl http://localhost:3100/metrics
```

Should show Prometheus metrics including:
- `api_auth_failures_total` - Authentication failures
- `api_rate_limit_hits_total` - Rate limit hits
- `http_requests_total` - Total HTTP requests

### 6. Check Logs in Kibana

1. Open Kibana: http://192.168.1.13:5602
2. Navigate to "Discover"
3. Select index pattern: `stealthflow_develop_logs*`
4. You should see your test logs

---

## API Usage

### Authentication

All `/api/v1/logs` endpoints require authentication via API key in the `X-API-Key` header.

```bash
curl -H "X-API-Key: your-api-key-here" http://localhost:3100/api/v1/logs
```

### Submit Single Log

```bash
curl -X POST http://localhost:3100/api/v1/logs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "category": "SYSTEM",
    "operation": "user_login",
    "metadata": {
      "userId": "12345",
      "ip": "192.168.1.100"
    },
    "options": {
      "serviceName": "auth-service",
      "environment": "production"
    }
  }'
```

### Submit Batch Logs

```bash
curl -X POST http://localhost:3100/api/v1/logs/batch \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "logs": [
      {"category":"SYSTEM","operation":"task_complete"},
      {"category":"ERROR","operation":"db_timeout"}
    ]
  }'
```

### Rate Limits

- **Single logs**: 100 requests per minute per IP
- **Batch logs**: 20 requests per minute per IP
- When rate limited, you'll receive HTTP 429 with `Retry-After` header

---

## Management Commands

### View Logs

```bash
# All logs
docker-compose -f docker-compose.yml logs -f

# API server only
docker-compose -f docker-compose.yml logs -f observability-api

# Worker only
docker-compose -f docker-compose.yml logs -f log-worker

# Last 100 lines
docker-compose -f docker-compose.yml logs --tail=100
```

### Restart Services

```bash
# Restart all
docker-compose -f docker-compose.yml restart

# Restart specific service
docker-compose -f docker-compose.yml restart observability-api
```

### Stop Services

```bash
docker-compose -f docker-compose.yml down
```

### Update and Redeploy

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose -f docker-compose.yml down
docker-compose -f docker-compose.yml build
docker-compose -f docker-compose.yml up -d
```

---

## Security Configuration

### API Key Management

#### Viewing Current Keys

```bash
grep "^API_KEYS=" .env
```

#### Rotating Keys

1. Generate new keys:
   ```bash
   NEW_KEY=$(openssl rand -hex 32)
   echo "New key: ${NEW_KEY}"
   ```

2. Add to existing keys in `.env`:
   ```bash
   API_KEYS=old_key1,old_key2,new_key
   ```

3. Restart services:
   ```bash
   docker-compose -f docker-compose.yml restart
   ```

4. Update clients to use new key

5. Remove old keys from `.env`

#### Emergency Key Revocation

To immediately revoke all keys and generate new ones:

```bash
# Remove old keys
sed -i.bak '/^API_KEYS=/d' .env

# Generate new keys
KEY1=$(openssl rand -hex 32)
KEY2=$(openssl rand -hex 32)
echo "API_KEYS=${KEY1},${KEY2}" >> .env

# Restart
docker-compose -f docker-compose.yml restart

# Display new keys
echo "New Key 1: ${KEY1}"
echo "New Key 2: ${KEY2}"
```

### Rate Limit Configuration

Edit `.env` to adjust rate limits:

```bash
# 1 minute window
RATE_LIMIT_WINDOW_MS=60000

# Max 100 requests per minute per IP
RATE_LIMIT_MAX_REQUESTS=100

# Max 20 batch requests per minute per IP
RATE_LIMIT_BATCH_MAX=20
```

After changes, restart services:
```bash
docker-compose -f docker-compose.yml restart
```

---

## Troubleshooting

### Deployment Fails at Pre-flight Checks

**Problem**: Cannot connect to Redis/Elasticsearch

**Solution**:
1. Verify Container #1 is running at 192.168.1.13
2. Test connectivity:
   ```bash
   # Test Redis
   nc -zv 192.168.1.13 6380
   
   # Test Elasticsearch
   curl http://192.168.1.13:9201
   ```
3. Check firewall rules
4. Update `.env` with correct host/port if different

### Containers Start But Health Check Fails

**Problem**: Health check timeout

**Solution**:
1. Check container logs:
   ```bash
   docker-compose -f docker-compose.yml logs observability-api
   ```
2. Common issues:
   - Redis connection failed
   - Elasticsearch connection failed
   - Port already in use
3. Verify services are reachable from inside container:
   ```bash
   docker exec observability-api nc -zv 192.168.1.13 6380
   ```

### Port 3100 Already in Use

**Problem**: Port conflict

**Solution**:
1. Find what's using the port:
   ```bash
   lsof -i :3100
   ```
2. Stop the conflicting service, or
3. Change port in `docker-compose.yml`:
   ```yaml
   ports:
     - "3101:3000"  # Use 3101 instead
   ```

### API Returns 401 Unauthorized

**Problem**: Invalid or missing API key

**Solution**:
1. Check your API key is correct
2. Verify key is in `.env`:
   ```bash
   grep "^API_KEYS=" .env
   ```
3. Ensure header format is correct:
   ```bash
   -H "X-API-Key: your-key-here"
   ```
   (not `X-Api-Key` or `API-Key`)

### Rate Limited Too Quickly

**Problem**: Getting 429 errors with normal usage

**Solution**:
1. Increase rate limits in `.env`:
   ```bash
   RATE_LIMIT_MAX_REQUESTS=500  # Increase from 100
   ```
2. Use batch endpoint for multiple logs
3. Implement client-side batching

### Logs Not Appearing in Elasticsearch

**Problem**: Logs submitted but not in Kibana

**Solution**:
1. Check log worker is running:
   ```bash
   docker-compose -f docker-compose.yml ps log-worker
   ```
2. Check worker logs:
   ```bash
   docker-compose -f docker-compose.yml logs log-worker
   ```
3. Verify Redis stream has data:
   ```bash
   docker exec observability-api redis-cli -h 192.168.1.13 -p 6380 XLEN logs:stream
   ```
4. Check Elasticsearch connection from worker

### Worker Crashes or Restarts Frequently

**Problem**: Log worker container keeps restarting

**Solution**:
1. Check logs for errors:
   ```bash
   docker-compose -f docker-compose.yml logs log-worker
   ```
2. Common causes:
   - Elasticsearch connection issues
   - Redis connection issues
   - Memory limits (increase if needed)
3. Check circuit breaker status in logs

---

## Security Features

### Enabled by Default

- ✅ **API Key Authentication**: All API endpoints require valid key
- ✅ **Rate Limiting**: Prevents abuse (100 req/min, 20 batch/min)
- ✅ **Security Metrics**: Tracks auth failures and rate limit hits
- ✅ **Health Endpoint**: Public (no auth) for monitoring

### Not Enabled (System-Level)

- ⏭️ **TLS/HTTPS**: Use Cloudflare, Traefik, or Nginx reverse proxy
- ⏭️ **Network Hardening**: Configure firewall rules at router/server level
- ⏭️ **IP Whitelisting**: Configure at reverse proxy or firewall

### Monitoring Security

View security metrics:
```bash
curl http://localhost:3100/metrics | grep -E "(auth_failures|rate_limit)"
```

Key metrics:
- `api_auth_failures_total`: Failed authentication attempts
- `api_rate_limit_hits_total`: Rate limit violations

---

## Environment Variables Reference

### Required

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | 192.168.1.13 | Redis server host |
| `REDIS_PORT` | 6380 | Redis server port |
| `ELASTICSEARCH_URL` | http://192.168.1.13:9201 | Elasticsearch URL |
| `API_KEYS` | *(auto-generated)* | Comma-separated API keys |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_WINDOW_MS` | 60000 | Rate limit window (ms) |
| `RATE_LIMIT_MAX_REQUESTS` | 100 | Max requests per window |
| `RATE_LIMIT_BATCH_MAX` | 20 | Max batch requests per window |
| `PORT` | 3000 | Internal container port |
| `NODE_ENV` | development | Node environment |
| `LOG_BATCH_SIZE` | 200 | Worker batch size |
| `CIRCUIT_BREAKER_THRESHOLD` | 5 | Failures before circuit opens |

---

## Additional Resources

- **API Documentation**: See `../api/reference.md`
- **Architecture**: See `../development/architecture.md`
- **Testing Guide**: See `../testing/e2e-testing.md`

---

## Support

For issues or questions:
1. Check logs: `docker-compose -f docker-compose.yml logs`
2. Review this troubleshooting guide
3. Check GitHub issues
4. Contact: jooservices@gmail.com
