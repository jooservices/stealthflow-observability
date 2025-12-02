# API Key Rotation Guide

Complete guide for rotating API keys without downtime.

---

## Overview

API key rotation allows you to:
- Update keys for security
- Revoke compromised keys
- Maintain service availability during rotation

**Key Principle:** Support multiple keys simultaneously during rotation period.

---

## Rotation Process

### Step 1: Add New Key

Add new key to `API_KEYS` environment variable:

**Before:**
```bash
API_KEYS=old-key-1,old-key-2,old-key-3
```

**After:**
```bash
API_KEYS=old-key-1,old-key-2,old-key-3,new-key-1
```

**Update .env file:**
```bash
# Edit .env
nano .env

# Or update docker-compose.yml
environment:
  API_KEYS: ${API_KEYS:-old-key-1,old-key-2,old-key-3,new-key-1}
```

**Restart service:**
```bash
docker-compose -f docker-compose.yml restart observability-api
```

### Step 2: Update Clients

Update all clients to use new key:

**Client Configuration:**
```javascript
// Update API key in client
const logger = new ObservabilityClient('MyService', 'new-key-1');
```

**Environment Variable:**
```bash
export OBSERVABILITY_API_KEY=new-key-1
```

**Test with new key:**
```bash
curl -X POST http://localhost:3100/api/v1/logs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: new-key-1" \
  -d '{"category":"TEST","operation":"rotation-test"}'
```

### Step 3: Monitor Migration

Monitor authentication metrics:

```bash
# Check metrics endpoint
curl http://localhost:3100/metrics | grep api_auth

# Look for:
# - api_auth_success_total (should increase)
# - api_auth_failures_total (should decrease after migration)
```

**Prometheus Query:**
```promql
# Success rate by key (if tracking by key)
rate(api_auth_success_total[5m])

# Failure rate
rate(api_auth_failures_total[5m])
```

### Step 4: Remove Old Keys

After all clients migrated (typically 1-2 weeks):

**Remove old keys:**
```bash
# Before
API_KEYS=old-key-1,old-key-2,old-key-3,new-key-1

# After
API_KEYS=new-key-1
```

**Restart service:**
```bash
docker-compose -f docker-compose.yml restart observability-api
```

**Verify old keys are rejected:**
```bash
# Should fail
curl -X POST http://localhost:3100/api/v1/logs \
  -H "X-API-Key: old-key-1" \
  -d '{"category":"TEST","operation":"test"}'
# Expected: 401 Unauthorized
```

---

## Emergency Key Rotation

If a key is compromised:

### Immediate Actions

1. **Remove compromised key immediately:**
   ```bash
   # Remove compromised key from API_KEYS
   API_KEYS=key-1,key-2  # Remove compromised key-3
   ```

2. **Restart service:**
   ```bash
   docker-compose -f docker-compose.yml restart observability-api
   ```

3. **Generate new key:**
   ```bash
   # Generate new secure key
   openssl rand -hex 32
   ```

4. **Add new key:**
   ```bash
   API_KEYS=key-1,key-2,new-emergency-key
   ```

5. **Update affected clients immediately**

6. **Monitor for unauthorized access:**
   ```bash
   # Check auth failure metrics
   curl http://localhost:3100/metrics | grep api_auth_failures_total
   ```

---

## Key Generation

### Generate Secure Keys

**Using OpenSSL:**
```bash
# Generate 32-byte (64 hex chars) key
openssl rand -hex 32

# Generate 64-byte (128 hex chars) key (more secure)
openssl rand -hex 64
```

**Using Node.js:**
```javascript
const crypto = require('crypto');
const key = crypto.randomBytes(32).toString('hex');
console.log(key);
```

**Using Python:**
```python
import secrets
key = secrets.token_hex(32)
print(key)
```

**Using deploy.sh:**
```bash
# Auto-generates 3 keys on first deployment
./scripts/deploy.sh
```

### Key Requirements

- **Minimum length:** 32 bytes (64 hex characters)
- **Recommended:** 64 bytes (128 hex characters)
- **Format:** Hexadecimal string
- **Storage:** Environment variable (never commit to git)

---

## Best Practices

### 1. Regular Rotation Schedule

- **Production:** Rotate every 90 days
- **Staging:** Rotate every 30 days
- **Development:** Rotate as needed

### 2. Key Management

- **Store securely:** Use secret management (Vault, AWS Secrets Manager, etc.)
- **Never commit:** Add `.env` to `.gitignore`
- **Limit access:** Only authorized personnel can view keys
- **Audit access:** Log who accessed keys and when

### 3. Rotation Strategy

- **Gradual migration:** Support multiple keys during transition
- **Monitor metrics:** Track success/failure rates
- **Test thoroughly:** Verify new keys work before removing old
- **Document changes:** Keep rotation log

### 4. Client Updates

- **Update all clients:** Ensure no client left behind
- **Test before production:** Verify in staging first
- **Rollback plan:** Keep old keys until migration complete

---

## Monitoring

### Key Metrics

**Prometheus Metrics:**
- `api_auth_success_total` - Successful authentications
- `api_auth_failures_total{reason="invalid_key"}` - Invalid key attempts
- `api_auth_failures_total{reason="missing_key"}` - Missing key attempts

**Alerts:**
```yaml
# Example Prometheus alert
- alert: HighAuthFailureRate
  expr: rate(api_auth_failures_total[5m]) > 10
  for: 5m
  annotations:
    summary: "High authentication failure rate detected"
```

### Logs

**Check authentication logs:**
```bash
# View auth failures
docker logs observability-api | grep "\[Auth\] Failure"

# Monitor in real-time
docker logs -f observability-api | grep "\[Auth\]"
```

---

## Troubleshooting

### Clients Can't Authenticate After Rotation

1. **Verify key is correct:**
   ```bash
   # Check key in environment
   docker exec observability-api env | grep API_KEYS
   ```

2. **Test key directly:**
   ```bash
   curl -X POST http://localhost:3100/api/v1/logs \
     -H "X-API-Key: <your-key>" \
     -d '{"category":"TEST","operation":"test"}'
   ```

3. **Check for typos:** Keys are case-sensitive

4. **Verify service restarted:** Changes require restart

### Old Keys Still Work After Removal

1. **Verify environment variable:**
   ```bash
   docker exec observability-api env | grep API_KEYS
   ```

2. **Check if service restarted:**
   ```bash
   docker ps | grep observability-api
   # Check uptime
   ```

3. **Force restart:**
   ```bash
   docker-compose -f docker-compose.yml restart observability-api
   ```

---

## Automation

### Automated Rotation Script

Create `scripts/rotate-keys.sh`:

```bash
#!/bin/bash
set -e

echo "Generating new API key..."
NEW_KEY=$(openssl rand -hex 32)

echo "Current keys: $API_KEYS"
echo "New key: $NEW_KEY"

# Add new key to environment
export API_KEYS="$API_KEYS,$NEW_KEY"

echo "Updated API_KEYS: $API_KEYS"
echo ""
echo "Next steps:"
echo "1. Update .env file with new API_KEYS"
echo "2. Restart service: docker-compose restart observability-api"
echo "3. Update clients to use new key: $NEW_KEY"
echo "4. Monitor migration"
echo "5. Remove old keys after migration complete"
```

---

## See Also

- [Security Implementation Plan](../SECURITY_IMPLEMENTATION_PLAN.md)
- [Deployment Guide](../guides/deployment.md)
- [API Reference](../api/reference.md)

