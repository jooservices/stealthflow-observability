# Deployment Guide - Observability Microservice

## Prerequisites

- Docker & Docker Compose installed
- Access to your deployment server
- Infrastructure services running (Redis, Elasticsearch, MongoDB)
- Network access to infrastructure services

## Verify Infrastructure

```bash
# Check infrastructure services are accessible
# Replace with your actual hostnames/IPs
nc -zv <your-redis-host> 6380   # Redis
nc -zv <your-elasticsearch-host> 9201   # Elasticsearch
nc -zv <your-mongodb-host> 27018  # MongoDB
```

## Deployment Steps

### 1. Prepare Server

```bash
# SSH to your deployment server
ssh user@<your-server>

# Create project directory
mkdir -p ~/stealthflow-observability
cd ~/stealthflow-observability

# Clone repository (or copy files)
git clone git@github.com:jooservices/stealthflow.git .
# Or: scp -r ./observability user@<your-server>:~/stealthflow-observability
```

### 2. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit with your infrastructure endpoints
nano .env
```

**.env contents:**
```bash
# Redis (Infrastructure Service)
REDIS_HOST=<your-redis-host>
REDIS_PORT=6380
# Or use URL format:
# REDIS_URL=redis://<your-redis-host>:6380

# Elasticsearch (Infrastructure Service)
ELASTICSEARCH_URL=http://<your-elasticsearch-host>:9201

# MongoDB (Infrastructure Service - Optional)
MONGODB_URI=mongodb://<your-mongodb-host>:27018/observability

# Stream config
LOG_STREAM_NAME=logs:stream
LOG_CONSUMER_GROUP=stealthflow-log-workers
LOG_BATCH_SIZE=200
LOG_INDEX_ALIAS=stealthflow_develop_logs

# Server
NODE_ENV=development
PORT=3000
```

### 3. Build and Deploy

```bash
# Build Docker image
docker-compose -f docker-compose.observability.yml build

# Start services
docker-compose -f docker-compose.observability.yml up -d

# Check status
docker-compose -f docker-compose.observability.yml ps
```

### 4. Verify Deployment

```bash
# Check container logs
docker logs observability-api
docker logs log-worker

# Test health endpoint
curl http://localhost:3100/health
# Or if deployed remotely:
curl http://<your-server>:3100/health

# Expected response:
# {
#   "status": "healthy",
#   "connections": {
#     "redis": { "status": "ok" },
#     "elasticsearch": { "status": "ok" }
#   }
# }
```

### 5. Test Log Submission

```bash
# Submit test log
curl -X POST http://localhost:3100/api/v1/logs \
  -H "Content-Type: application/json" \
  -d '{
    "category": "SYSTEM",
    "operation": "deployment_test",
    "metadata": { "test": true },
    "options": { "serviceName": "DeploymentTest" }
  }'

# Expected response:
# {"status":"accepted","timestamp":"2024-11-30T..."}
```

### 6. Verify in Kibana

```bash
# Open browser (replace with your Kibana URL)
open http://<your-kibana-host>:5602

# In Kibana:
# 1. Go to Discover
# 2. Search: operation: "deployment_test"
# 3. Should see the test log
```

## Monitoring

### Health Checks

```bash
# Basic health
curl http://localhost:3100/health

# Detailed diagnostics
curl http://localhost:3100/health/detailed
```

### Metrics

```bash
# Prometheus metrics
curl http://192.168.1.13:3100/metrics

# Key metrics:
# - observability_redis_stream_depth
# - observability_dlq_depth
# - observability_logs_submitted_total
```

### Check Stream Depth

```bash
# Should be low (< 1000)
# Replace <your-redis-host> with your Redis hostname
docker exec observability-api sh -c \
  'redis-cli -h <your-redis-host> -p 6380 XLEN logs:stream'
```

### Check DLQ

```bash
# Should be 0 or low
# Replace <your-redis-host> with your Redis hostname
docker exec observability-api sh -c \
  'redis-cli -h <your-redis-host> -p 6380 XLEN logs:failed'
```

## Management

### Update Deployment

```bash
# Pull latest code
git pull

# Rebuild
docker-compose -f docker-compose.observability.yml build

# Restart (zero downtime not guaranteed)
docker-compose -f docker-compose.observability.yml up -d
```

### View Logs

```bash
# API logs
docker logs -f observability-api

# Worker logs
docker logs -f log-worker

# Last 100 lines
docker logs --tail 100 observability-api
```

### Restart Services

```bash
# Restart all
docker-compose -f docker-compose.observability.yml restart

# Restart specific service
docker-compose -f docker-compose.observability.yml restart log-worker
```

### Stop Services

```bash
# Stop all
docker-compose -f docker-compose.observability.yml down

# Stop without removing containers
docker-compose -f docker-compose.observability.yml stop
```

## Troubleshooting

### Containers won't start

```bash
# Check logs
docker logs observability-api

# Common issues:
# - Cannot connect to Redis/ES/MongoDB
# - Port 3100 already in use
# - Insufficient memory/disk
```

### Logs not appearing in Elasticsearch

1. **Check LogWorker is running**
   ```bash
   docker ps | grep log-worker
   ```

2. **Check stream depth**
   ```bash
   # Replace <your-redis-host> with your Redis hostname
   docker exec observability-api sh -c \
     'redis-cli -h <your-redis-host> -p 6380 XLEN logs:stream'
   ```
   - If high (> 10000): LogWorker not processing
   - If 0: Logs not reaching Redis

3. **Check LogWorker logs**
   ```bash
   docker logs log-worker
   ```

4. **Check Elasticsearch**
   ```bash
   # Replace <your-elasticsearch-host> with your Elasticsearch hostname
   curl http://<your-elasticsearch-host>:9201/_cluster/health
   ```

### High stream backlog

```bash
# Scale LogWorker
docker-compose -f docker-compose.observability.yml up -d --scale log-worker=2

# Or increase batch size
# Edit docker-compose.observability.yml:
# LOG_BATCH_SIZE=500
```

### Connection errors

1. **Verify infrastructure services are running**
   ```bash
   # Check your infrastructure services
   docker ps | grep -E "redis|elasticsearch"
   # Or check remote services
   ```

2. **Test connectivity**
   ```bash
   # Replace with your actual hostnames
   nc -zv <your-redis-host> 6380
   nc -zv <your-elasticsearch-host> 9201
   ```

3. **Check Docker network**
   ```bash
   docker network inspect observability-network
   ```

## Rollback

```bash
# Stop current deployment
docker-compose -f docker-compose.observability.yml down

# Checkout previous version
git checkout <previous-commit>

# Rebuild and deploy
docker-compose -f docker-compose.observability.yml up -d
```

## Backup & Recovery

### Fallback Logs

Logs are backed up to disk when Redis fails:
```bash
# Location
ls -lh ./logs/fallback/

# Replay fallback logs (manual)
# Parse JSONL files and resubmit to API
```

### Configuration Backup

```bash
# Backup configuration
cp .env .env.backup
cp docker-compose.observability.yml docker-compose.backup.yml
```

## Performance Tuning

### Increase Batch Size

```yaml
# docker-compose.observability.yml
environment:
  LOG_BATCH_SIZE: 500  # Default: 200
```

### Add More Workers

```bash
# Scale horizontally
docker-compose -f docker-compose.observability.yml up -d --scale log-worker=3
```

### Resource Limits

```yaml
# docker-compose.observability.yml
services:
  observability-api:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
```

## Security Notes

- No authentication (internal network only)
- Ensure infrastructure service ports (Redis, Elasticsearch) are not exposed to internet
- Consider VPN if accessing remotely
- Rotate .env credentials periodically

## Next Steps

1. ✅ Deploy successfully
2. ✅ Verify health checks pass
3. ✅ Submit test logs
4. ✅ Set up Grafana dashboards (optional)
5. ✅ Configure Prometheus alerts (optional)
6. ✅ Integrate with applications

## Support

- [Documentation Index](../README.md)
- [User Guide](user-guide.md)
- [Client Integration](client-integration.md)
- [API Reference](../api/reference.md)
- [Monitoring](../operations/monitoring.md)
- [Troubleshooting](../operations/troubleshooting.md)
