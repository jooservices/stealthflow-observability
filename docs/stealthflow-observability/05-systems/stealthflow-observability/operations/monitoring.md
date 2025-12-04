---
title: "Monitoring Guide"
type: "system-doc"
scope: "project"
project: "stealthflow-observability"
what: "Complete guide for monitoring StealthFlow Observability Microservice"
why: "Provide monitoring and observability instructions"
how: "Follow this guide to monitor the service"
owner: "StealthFlow Team"
status: "approved"
last_updated: "2025-12-05"
tags: ['monitoring', 'operations', 'stealthflow-observability']
ai_semantics:
  layer: "system"
  relates_to: ['monitoring', 'operations']
---

# Monitoring Guide

Complete guide for monitoring StealthFlow Observability Microservice.

---

## Health Checks

### Basic Health Check

```bash
curl http://localhost:3100/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-11-30T10:30:00.000Z",
  "uptime": 3600,
  "connections": {
    "redis": { "status": "ok", "latency": 5 },
    "elasticsearch": { "status": "ok", "clusterStatus": "green" }
  }
}
```

**Status Values:**
- `healthy` - All connections OK
- `degraded` - One or more connections failed

### Detailed Health Check

```bash
curl http://localhost:3100/health/detailed
```

Returns detailed diagnostics including:
- System metrics (memory, CPU, uptime)
- Redis status and stream depth
- Elasticsearch cluster health and index stats
- Environment configuration

---

## Key Metrics to Monitor

### 1. Redis Stream Depth

**What it measures:** Number of logs waiting to be processed

**Command:**
```bash
redis-cli -h 192.168.1.13 -p 6380 XLEN logs:stream
```

**Thresholds:**
- ✅ **Normal:** < 1,000
- ⚠️ **Warning:** 1,000 - 10,000
- 🔴 **Critical:** > 10,000

**Action if high:**
- Check if LogWorker is running
- Scale LogWorker instances
- Increase batch size

### 2. Dead Letter Queue (DLQ) Depth

**What it measures:** Number of failed logs

**Command:**
```bash
redis-cli -h 192.168.1.13 -p 6380 XLEN logs:failed
```

**Thresholds:**
- ✅ **Normal:** 0
- ⚠️ **Warning:** 1 - 100
- 🔴 **Critical:** > 100

**Action if high:**
- Check LogWorker logs for errors
- Verify Elasticsearch is accessible
- Review failed log entries

### 3. LogWorker Status

**Check if running:**
```bash
# Docker
docker ps | grep log-worker

# Process
ps aux | grep log-worker
```

**Check logs:**
```bash
docker logs log-worker
# Or
tail -f log-worker.log
```

### 4. Elasticsearch Health

**Check cluster health:**
```bash
curl http://192.168.1.13:9201/_cluster/health
```

**Status Values:**
- `green` - All good
- `yellow` - Some replicas missing (acceptable for single node)
- `red` - Critical issues

**Check index stats:**
```bash
curl http://192.168.1.13:9201/stealthflow_develop_logs/_stats
```

### 5. API Response Time

Monitor API endpoint response times:
- `/health` - Should be < 100ms
- `/api/v1/logs` - Should be < 200ms
- `/health/detailed` - Should be < 500ms

---

## Monitoring Commands

### Quick Status Check

```bash
#!/bin/bash
echo "=== Observability Status ==="
echo "Health:"
curl -s http://localhost:3100/health | jq '.status'
echo ""
echo "Stream Depth:"
redis-cli -h 192.168.1.13 -p 6380 XLEN logs:stream
echo ""
echo "DLQ Depth:"
redis-cli -h 192.168.1.13 -p 6380 XLEN logs:failed
echo ""
echo "LogWorker:"
docker ps | grep log-worker || echo "Not running"
```

### Check All Services

```bash
# Redis
redis-cli -h 192.168.1.13 -p 6380 PING

# Elasticsearch
curl http://192.168.1.13:9201/_cluster/health

# API
curl http://192.168.1.13:3100/health
```

---

## Viewing Logs in Kibana

### Access Kibana

URL: http://192.168.1.13:5602

### Common Queries

**By Operation:**
```
operation: "user_login"
```

**By Workflow:**
```
workflowId: "wf-123"
```

**By Service:**
```
serviceName: "MyService"
```

**Errors Only:**
```
level: "error"
```

**Combined:**
```
category: "AUTH" AND level: "error"
```

**Time Range:**
- Last 15 minutes
- Last hour
- Last 24 hours
- Custom range

### Creating Dashboards

1. Go to **Dashboard** in Kibana
2. Create new dashboard
3. Add visualizations:
   - Log count over time
   - Errors by category
   - Top operations
   - Service activity

---

## Alerting Recommendations

### Critical Alerts

1. **Health Check Fails**
   - Condition: `/health` returns 503
   - Action: Immediate notification

2. **High Stream Backlog**
   - Condition: Stream depth > 10,000
   - Action: Check LogWorker, scale if needed

3. **LogWorker Down**
   - Condition: LogWorker process not running
   - Action: Restart LogWorker

4. **Elasticsearch Red**
   - Condition: Cluster status = red
   - Action: Check Elasticsearch logs

### Warning Alerts

1. **Stream Depth Growing**
   - Condition: Stream depth > 1,000
   - Action: Monitor, prepare to scale

2. **DLQ Growing**
   - Condition: DLQ depth > 10
   - Action: Investigate failed logs

3. **High API Latency**
   - Condition: Response time > 1s
   - Action: Check system resources

---

## Performance Metrics

### Log Processing Rate

**Calculate:**
```bash
# Get stream depth at time T1
DEPTH1=$(redis-cli -h 192.168.1.13 -p 6380 XLEN logs:stream)

# Wait 60 seconds
sleep 60

# Get stream depth at time T2
DEPTH2=$(redis-cli -h 192.168.1.13 -p 6380 XLEN logs:stream)

# Calculate rate (logs per second)
RATE=$(( (DEPTH1 - DEPTH2) / 60 ))
echo "Processing rate: $RATE logs/second"
```

### Elasticsearch Write Performance

Check index write stats:
```bash
curl http://192.168.1.13:9201/stealthflow_develop_logs/_stats?pretty
```

Look for:
- `indexing.index_total` - Total documents indexed
- `indexing.index_time_in_millis` - Total indexing time
- `indexing.index_current` - Current indexing operations

---

## Monitoring Tools

### Built-in

- Health check endpoints
- Detailed diagnostics endpoint

### External (Optional)

- **Prometheus** - Metrics collection (if implemented)
- **Grafana** - Dashboards (if implemented)
- **ELK Stack** - Log aggregation (already using Elasticsearch)

---

## Daily Monitoring Checklist

- [ ] Health check passes
- [ ] Stream depth is normal (< 1,000)
- [ ] DLQ is empty or low
- [ ] LogWorker is running
- [ ] Elasticsearch cluster is green
- [ ] API response times are acceptable
- [ ] No errors in LogWorker logs

---

## Weekly Review

- Review error patterns in Kibana
- Check index size growth
- Review performance metrics
- Check for any recurring issues
- Review alert history

---

## See Also

- [Troubleshooting Guide](troubleshooting.md) - How to fix issues
- [Deployment Guide](../guides/deployment.md) - Deployment instructions
- [API Reference](../api/reference.md) - API documentation

