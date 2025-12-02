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
