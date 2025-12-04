# Security Best Practices

## What NOT to Log

**Never log sensitive data:**
- ❌ Passwords or authentication tokens
- ❌ API keys or secrets
- ❌ Personal Identifiable Information (PII)
- ❌ Cookie values (log count, not content)
- ❌ Credit card numbers, SSNs, etc.

## Best Practices

1. ✅ **Never log passwords, tokens, or secrets**
2. ✅ **Sanitize data before logging**
3. ✅ **Use authentication for Elasticsearch/Kibana**
4. ✅ **Enable TLS in production**
5. ✅ **Implement access control (RBAC)**
6. ✅ **Set up log retention policies**

## Network Security

- **Internal Network Only:** Ensure infrastructure service ports (Redis, Elasticsearch) are not exposed to the internet.
- **Firewall Rules:** Restrict access to known IPs.

For network hardening details, see [Network Hardening](network-hardening.md).

## Key Management

- **Rotation:** Rotate API keys regularly.
- **Storage:** Store keys in environment variables, never in code.

For key rotation details, see [Key Rotation](key-rotation.md).
# Network Hardening Guide

Complete guide for securing network access to the Observability microservice.

---

## Overview

This guide covers:
- Firewall configuration
- Cloudflare IP whitelisting
- Internal service protection
- Docker network isolation

---

## Firewall Configuration

### Port 3100 (API Server)

**Goal:** Allow only Cloudflare IPs (if using Cloudflare) or your load balancer.

#### Option 1: Cloudflare IP Whitelisting

**Get Cloudflare IP Ranges:**
```bash
# IPv4 ranges
curl https://www.cloudflare.com/ips-v4

# IPv6 ranges
curl https://www.cloudflare.com/ips-v6
```

**iptables Example:**
```bash
# Allow Cloudflare IPv4 ranges
iptables -A INPUT -p tcp --dport 3100 -s 173.245.48.0/20 -j ACCEPT
iptables -A INPUT -p tcp --dport 3100 -s 103.21.244.0/22 -j ACCEPT
iptables -A INPUT -p tcp --dport 3100 -s 103.22.200.0/22 -j ACCEPT
iptables -A INPUT -p tcp --dport 3100 -s 103.31.4.0/22 -j ACCEPT
iptables -A INPUT -p tcp --dport 3100 -s 141.101.64.0/18 -j ACCEPT
iptables -A INPUT -p tcp --dport 3100 -s 108.162.192.0/18 -j ACCEPT
iptables -A INPUT -p tcp --dport 3100 -s 190.93.240.0/20 -j ACCEPT
iptables -A INPUT -p tcp --dport 3100 -s 188.114.96.0/20 -j ACCEPT
iptables -A INPUT -p tcp --dport 3100 -s 197.234.240.0/22 -j ACCEPT
iptables -A INPUT -p tcp --dport 3100 -s 198.41.128.0/17 -j ACCEPT
iptables -A INPUT -p tcp --dport 3100 -s 162.158.0.0/15 -j ACCEPT
iptables -A INPUT -p tcp --dport 3100 -s 104.16.0.0/13 -j ACCEPT
iptables -A INPUT -p tcp --dport 3100 -s 104.24.0.0/14 -j ACCEPT
iptables -A INPUT -p tcp --dport 3100 -s 172.64.0.0/13 -j ACCEPT
iptables -A INPUT -p tcp --dport 3100 -s 131.0.72.0/22 -j ACCEPT

# Deny all other access to port 3100
iptables -A INPUT -p tcp --dport 3100 -j DROP
```

**ufw Example:**
```bash
# Allow Cloudflare ranges (example - add all ranges)
ufw allow from 173.245.48.0/20 to any port 3100
ufw allow from 103.21.244.0/22 to any port 3100
# ... add all Cloudflare ranges

# Deny all other access
ufw deny 3100/tcp
```

#### Option 2: Load Balancer IP Whitelisting

If using a different load balancer (HAProxy, Traefik, etc.):

```bash
# Allow only your load balancer IP
iptables -A INPUT -p tcp --dport 3100 -s <your-lb-ip> -j ACCEPT

# Deny all other access
iptables -A INPUT -p tcp --dport 3100 -j DROP
```

### Internal Services (Block from Internet)

**Redis (Port 6380):**
```bash
# Allow only internal network
iptables -A INPUT -p tcp --dport 6380 -s 192.168.0.0/16 -j ACCEPT
iptables -A INPUT -p tcp --dport 6380 -s 10.0.0.0/8 -j ACCEPT
iptables -A INPUT -p tcp --dport 6380 -s 172.16.0.0/12 -j ACCEPT

# Deny from internet
iptables -A INPUT -p tcp --dport 6380 -j DROP
```

**Elasticsearch (Port 9201):**
```bash
# Allow only internal network
iptables -A INPUT -p tcp --dport 9201 -s 192.168.0.0/16 -j ACCEPT
iptables -A INPUT -p tcp --dport 9201 -s 10.0.0.0/8 -j ACCEPT
iptables -A INPUT -p tcp --dport 9201 -s 172.16.0.0/12 -j ACCEPT

# Deny from internet
iptables -A INPUT -p tcp --dport 9201 -j DROP
```

**MongoDB (Port 27018):**
```bash
# Allow only internal network
iptables -A INPUT -p tcp --dport 27018 -s 192.168.0.0/16 -j ACCEPT
iptables -A INPUT -p tcp --dport 27018 -s 10.0.0.0/8 -j ACCEPT
iptables -A INPUT -p tcp --dport 27018 -s 172.16.0.0/12 -j ACCEPT

# Deny from internet
iptables -A INPUT -p tcp --dport 27018 -j DROP
```

---

## Docker Network Isolation

### docker-compose.yml

Update network configuration:

```yaml
services:
  observability-api:
    # ... existing config ...
    networks:
      - observability-net
      - infrastructure-net

networks:
  observability-net:
    driver: bridge
    # Allow external access only to API port
    ipam:
      config:
        - subnet: 172.20.0.0/16

  infrastructure-net:
    driver: bridge
    internal: true  # No external access
    ipam:
      config:
        - subnet: 172.21.0.0/16
```

---

## Testing Firewall Rules

### Test Port 3100 Access

```bash
# From Cloudflare IP (should succeed)
curl -I http://your-server:3100/health

# From other IP (should fail/timeout)
curl -I http://your-server:3100/health
```

### Test Internal Services

```bash
# From internal network (should succeed)
redis-cli -h <redis-host> -p 6380 ping

# From external network (should fail/timeout)
redis-cli -h <redis-host> -p 6380 ping
```

---

## Cloudflare Configuration

### Full (Strict) SSL/TLS Mode

1. **Cloudflare Dashboard:**
   - SSL/TLS → Overview → Set to "Full (strict)"
   - SSL/TLS → Origin Server → Create Origin Certificate

2. **Install Origin Certificate:**
   - Download certificate and key
   - Configure in Traefik/Nginx/HAProxy

3. **Verify:**
   - Test HTTPS connection
   - Verify certificate chain

---

## Monitoring

### Check Firewall Rules

```bash
# List iptables rules
iptables -L -n -v

# Check specific port
iptables -L INPUT -n | grep 3100
```

### Monitor Blocked Connections

```bash
# View firewall logs
tail -f /var/log/kern.log | grep DROP

# Or use fail2ban for automated blocking
```

---

## Best Practices

1. **Principle of Least Privilege:**
   - Only allow necessary IPs/ranges
   - Block everything else by default

2. **Regular Updates:**
   - Keep Cloudflare IP ranges updated
   - Review firewall rules periodically

3. **Documentation:**
   - Document all allowed IPs/ranges
   - Keep network diagrams updated

4. **Testing:**
   - Test firewall rules before production
   - Verify from different networks

5. **Monitoring:**
   - Monitor blocked connection attempts
   - Set up alerts for suspicious activity

---

## Troubleshooting

### Can't Access API from Cloudflare

1. Check Cloudflare IP ranges are up to date
2. Verify iptables rules are correct
3. Check if rules are being applied
4. Test from Cloudflare IP directly

### Internal Services Not Accessible

1. Verify internal network ranges in firewall rules
2. Check Docker network configuration
3. Test connectivity from internal network
4. Review network routing

---

## See Also

- [Security Implementation Plan](../SECURITY_IMPLEMENTATION_PLAN.md)
- [Deployment Guide](../guides/deployment.md)
- [TLS Setup Guide](../guides/tls-setup.md)

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

