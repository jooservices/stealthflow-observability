# Troubleshooting Guide

Common issues and solutions for StealthFlow Observability Microservice.

---

## Quick Diagnostic Checklist

- [ ] Health check: `curl http://localhost:3100/health`
- [ ] LogWorker running: `docker ps | grep log-worker`
- [ ] Stream depth: `redis-cli -h 192.168.1.13 -p 6380 XLEN logs:stream`
- [ ] DLQ depth: `redis-cli -h 192.168.1.13 -p 6380 XLEN logs:failed`
- [ ] Elasticsearch: `curl http://192.168.1.13:9201/_cluster/health`
- [ ] Redis: `redis-cli -h 192.168.1.13 -p 6380 PING`

---

## Common Issues

### Issue 1: Logs Not Appearing in Elasticsearch

**Symptoms:**
- Logs submitted successfully (202 response)
- Logs not visible in Kibana
- Stream depth is high

**Diagnosis:**

1. **Check LogWorker is running**
   ```bash
   docker ps | grep log-worker
   # Or
   ps aux | grep log-worker
   ```

2. **Check stream depth**
   ```bash
   redis-cli -h 192.168.1.13 -p 6380 XLEN logs:stream
   ```
   - If high (> 10,000): LogWorker not processing
   - If 0: Logs not reaching Redis

3. **Check LogWorker logs**
   ```bash
   docker logs log-worker
   # Look for errors
   ```

4. **Check Elasticsearch**
   ```bash
   curl http://192.168.1.13:9201/_cluster/health
   ```

**Solutions:**

1. **Start LogWorker**
   ```bash
   npm run worker
   # Or
   docker-compose -f docker-compose.yml up -d log-worker
   ```

2. **Check Elasticsearch connection**
   - Verify ELASTICSEARCH_URL in .env
   - Test connectivity: `curl http://192.168.1.13:9201/_cluster/health`

3. **Restart LogWorker**
   ```bash
   docker-compose -f docker-compose.yml restart log-worker
   ```

---

### Issue 2: High Stream Backlog

**Symptoms:**
- Stream depth > 10,000
- Logs accumulating in Redis
- Slow processing

**Diagnosis:**

```bash
redis-cli -h 192.168.1.13 -p 6380 XLEN logs:stream
```

**Solutions:**

1. **Scale LogWorker**
   ```bash
   docker-compose -f docker-compose.yml up -d --scale log-worker=2
   ```

2. **Increase batch size**
   Edit `docker-compose.yml`:
   ```yaml
   environment:
     LOG_BATCH_SIZE: 500  # Default: 200
   ```

3. **Check LogWorker performance**
   ```bash
   docker logs log-worker
   # Look for slow processing
   ```

4. **Verify Elasticsearch performance**
   ```bash
   curl http://192.168.1.13:9201/_cluster/health
   ```

---

### Issue 3: Connection Errors

**Symptoms:**
- Health check fails
- Connection timeout errors
- Cannot connect to Redis/Elasticsearch

**Diagnosis:**

1. **Verify Container #1 is running**
   ```bash
   docker ps | grep -E "redis|elasticsearch"
   ```

2. **Test connectivity**
   ```bash
   nc -zv 192.168.1.13 6380  # Redis
   nc -zv 192.168.1.13 9201  # Elasticsearch
   ```

3. **Check environment variables**
   ```bash
   cat .env
   # Verify REDIS_HOST, ELASTICSEARCH_URL
   ```

**Solutions:**

1. **Check network connectivity**
   - Verify server 192.168.1.13 is accessible
   - Check firewall rules
   - Verify ports are open

2. **Verify environment configuration**
   - Check .env file
   - Verify REDIS_HOST, REDIS_PORT
   - Verify ELASTICSEARCH_URL

3. **Restart services**
   ```bash
   docker-compose -f docker-compose.yml restart
   ```

---

### Issue 4: Health Check Fails

**Symptoms:**
- `/health` returns 503
- Status: "degraded"
- One or more connections failed

**Diagnosis:**

```bash
curl http://localhost:3100/health
```

Check which connection failed:
- Redis: Check REDIS_HOST, REDIS_PORT
- Elasticsearch: Check ELASTICSEARCH_URL

**Solutions:**

1. **Check container logs**
   ```bash
   docker logs observability-api
   ```

2. **Verify connections**
   ```bash
   npm run test:connections
   ```

3. **Check environment variables**
   ```bash
   docker exec observability-api env | grep -E "REDIS|ELASTICSEARCH"
   ```

4. **Restart API service**
   ```bash
   docker-compose -f docker-compose.yml restart observability-api
   ```

---

### Issue 5: Dead Letter Queue (DLQ) Growing

**Symptoms:**
- DLQ depth > 0
- Failed logs accumulating
- LogWorker errors

**Diagnosis:**

```bash
redis-cli -h 192.168.1.13 -p 6380 XLEN logs:failed
```

**Check DLQ entries:**
```bash
redis-cli -h 192.168.1.13 -p 6380 XREAD COUNT 10 STREAMS logs:failed 0
```

**Solutions:**

1. **Check LogWorker logs**
   ```bash
   docker logs log-worker
   # Look for error patterns
   ```

2. **Verify Elasticsearch**
   - Check if Elasticsearch is accessible
   - Verify index exists
   - Check Elasticsearch logs

3. **Review failed entries**
   - Check why logs are failing
   - Fix data format issues
   - Retry failed logs (manual process)

---

### Issue 6: API Returns 500 Error

**Symptoms:**
- API returns 500 Internal Server Error
- Error in response body
- Service logs show errors

**Diagnosis:**

1. **Check API logs**
   ```bash
   docker logs observability-api
   # Or
   tail -f api.log
   ```

2. **Check error response**
   ```bash
   curl -v http://localhost:3100/api/v1/logs
   ```

**Solutions:**

1. **Check Redis connection**
   - Verify Redis is running
   - Check REDIS_HOST, REDIS_PORT
   - Test: `redis-cli -h 192.168.1.13 -p 6380 PING`

2. **Check request format**
   - Verify JSON is valid
   - Check required fields (category, operation)
   - Review API documentation

3. **Check fallback logging**
   - If Redis fails, logs should go to fallback
   - Check `logs/fallback/` directory

4. **Restart API service**
   ```bash
   docker-compose -f docker-compose.yml restart observability-api
   ```

---

### Issue 7: Port Already in Use

**Symptoms:**
- Cannot start service
- Port 3100 already in use
- Docker container fails to start

**Solutions:**

1. **Find process using port**
   ```bash
   lsof -i :3100
   # Or
   netstat -an | grep 3100
   ```

2. **Kill process**
   ```bash
   kill -9 <PID>
   ```

3. **Change port**
   Edit `.env`:
   ```bash
   PORT=3101
   ```

4. **Or stop existing container**
   ```bash
   docker-compose -f docker-compose.yml down
   ```

---

## Advanced Troubleshooting

### Check Consumer Group Status

```bash
redis-cli -h 192.168.1.13 -p 6380 XINFO GROUPS logs:stream
```

Shows:
- Consumer group name
- Pending messages
- Last delivered ID

### Check Pending Messages

```bash
redis-cli -h 192.168.1.13 -p 6380 XPENDING logs:stream stealthflow-log-workers
```

### Reset Consumer Group (if needed)

```bash
# Delete consumer group
redis-cli -h 192.168.1.13 -p 6380 XGROUP DESTROY logs:stream stealthflow-log-workers

# LogWorker will recreate it on next start
```

### Check Elasticsearch Index

```bash
# List indices
curl http://192.168.1.13:9201/_cat/indices

# Check index stats
curl http://192.168.1.13:9201/stealthflow_develop_logs/_stats
```

---

## Getting Help

If issues persist:

1. **Collect diagnostic information:**
   ```bash
   # Health check
   curl http://localhost:3100/health/detailed > health.json
   
   # Stream depth
   redis-cli -h 192.168.1.13 -p 6380 XLEN logs:stream
   
   # LogWorker logs
   docker logs log-worker > log-worker.log
   ```

2. **Check documentation:**
   - [Monitoring Guide](monitoring.md)
   - [Deployment Guide](../guides/deployment.md)
   - [API Reference](../api/reference.md)

3. **Contact maintainers:**
   - See README.md for contact information

---

## Prevention

To prevent issues:

1. **Regular monitoring**
   - Check health daily
   - Monitor stream depth
   - Review LogWorker logs

2. **Proper configuration**
   - Use .env.example as template
   - Verify all environment variables
   - Test connections before deployment

3. **Resource management**
   - Monitor memory usage
   - Check disk space for fallback logs
   - Scale LogWorker as needed

---

## See Also

- [Monitoring Guide](monitoring.md) - How to monitor the service
- [Deployment Guide](../guides/deployment.md) - Deployment instructions
- [API Reference](../api/reference.md) - API documentation

