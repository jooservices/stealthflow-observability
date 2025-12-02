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

