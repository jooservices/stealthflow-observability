# Cloudflare Origin Certificate for HAProxy

Plan to secure `log.jooservices.com` with Cloudflare Full (Strict) using an origin certificate.

## Steps

1) Prepare
- Domain: `log.jooservices.com`
- Access: Cloudflare dashboard + SSH to server running HAProxy

2) Create Origin Cert in Cloudflare
- Navigate: SSL/TLS → Origin Server → Create Certificate
- Key type: RSA; Validity: default (e.g., 15 years)
- SAN: `log.jooservices.com` (add wildcard if needed)
- Download `origin.pem` (cert) and `origin.key` (private key); keep secure

3) Install on Server
- Copy to `/etc/haproxy/certs/` (restrict permissions)
- Concatenate if needed: `cat origin.pem origin.key > /etc/haproxy/certs/log.jooservices.com.pem`
- Permissions: `chmod 600 /etc/haproxy/certs/log.jooservices.com.pem` (owned by haproxy user)

4) Configure HAProxy 443 Listener
- Bind: `bind *:443 ssl crt /etc/haproxy/certs/log.jooservices.com.pem`
- Optional: redirect HTTP→HTTPS
- Backend: forward HTTP to app (e.g., `server api 127.0.0.1:3100` or container:3000)

5) Switch Cloudflare Mode
- Set SSL/TLS mode to **Full (Strict)**
- Ensure proxy (orange cloud) enabled for `log.jooservices.com`

6) Verify
- From internet: `curl -I https://log.jooservices.com` (expect 200/301)
- Check HAProxy logs for TLS errors; origin handshake should succeed

7) Secure Storage
- Keep cert/key backup in a secure vault
- Renew by reissuing in Cloudflare if needed
