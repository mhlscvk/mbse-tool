# Monitoring Setup — Systemodel Platform

## 1. Health Endpoints

All three backend services expose `/health` (liveness) and `/ready` (readiness) endpoints.

| Service | Health | Ready | Port |
|---|---|---|---|
| api-server | `GET /health` | `GET /ready` | 3003 |
| diagram-service | `GET /health` | `GET /ready` | 3002 |
| lsp-server | `GET /health` | `GET /ready` | 3001 |

### `/health` (Liveness)
Returns `200 OK` immediately. No dependency checks. Safe to call at high frequency.

```json
{
  "status": "ok",
  "service": "api-server",
  "version": "0.1.0",
  "uptime_seconds": 86400
}
```

### `/ready` (Readiness)
Checks downstream dependencies. Returns `200` if all checks pass, `503` if any fail.

```json
{
  "status": "ok | degraded",
  "checks": {
    "database": "ok | fail"
  }
}
```

**Dependency checks per service:**
- **api-server**: PostgreSQL (`SELECT 1` via Prisma)
- **diagram-service**: SysML parser self-test (parses a minimal snippet)
- **lsp-server**: HTTP server availability

## 2. Nginx Configuration

Add these location blocks to the existing Nginx config on the production VPS (typically `/etc/nginx/sites-available/systemodel`):

```nginx
# Health endpoints — api-server (proxied under /api/)
# /api/health and /api/ready are already covered by the existing /api/ proxy_pass block.
# No changes needed if your config already has:
#   location /api/ { proxy_pass http://127.0.0.1:3003/; }

# Health endpoints — diagram-service
location = /diagram/health {
    proxy_pass http://127.0.0.1:3002/health;
    proxy_set_header Host $host;
    access_log off;
}
location = /diagram/ready {
    proxy_pass http://127.0.0.1:3002/ready;
    proxy_set_header Host $host;
    access_log off;
}

# Health endpoints — lsp-server
location = /lsp-health {
    proxy_pass http://127.0.0.1:3001/health;
    proxy_set_header Host $host;
    access_log off;
}
location = /lsp-ready {
    proxy_pass http://127.0.0.1:3001/ready;
    proxy_set_header Host $host;
    access_log off;
}
```

After editing, test and reload:
```bash
nginx -t && systemctl reload nginx
```

## 3. UptimeRobot Setup

Create a free account at [uptimerobot.com](https://uptimerobot.com) and add these monitors:

| # | Monitor Name | Type | URL / Host | Interval | Alert |
|---|---|---|---|---|---|
| 1 | Systemodel Frontend | HTTP(s) | `https://systemodel.com/` | 5 min | 2 failures |
| 2 | API Health | HTTP(s) - Keyword "ok" | `https://systemodel.com/api/health` | 5 min | 2 failures |
| 3 | API Ready (deep) | HTTP(s) - Keyword "ok" | `https://systemodel.com/api/ready` | 5 min | 2 failures |
| 4 | Diagram Health | HTTP(s) - Keyword "ok" | `https://systemodel.com/diagram/health` | 5 min | 2 failures |
| 5 | LSP Health | HTTP(s) - Keyword "ok" | `https://systemodel.com/lsp-health` | 5 min | 2 failures |

### Alert Configuration
1. Go to **My Settings > Alert Contacts**
2. Add email: Platform Owner's email address
3. Set alert threshold: **2 consecutive failures** (reduces false positives)
4. Enable **SSL Expiry** monitoring on monitor #1 (built into UptimeRobot free tier)
   - Set alert threshold: **14 days before expiry**

## 4. SSL Expiry Monitoring

### UptimeRobot (Primary)
UptimeRobot's free tier automatically monitors SSL certificate expiry for HTTPS monitors. Set the alert to trigger at 14 days remaining.

### Server-side (Backup)
Verify certbot auto-renewal is working on the VPS:

```bash
# Test renewal (dry run — no changes)
certbot renew --dry-run

# Check current cert expiry
openssl s_client -connect systemodel.com:443 -servername systemodel.com 2>/dev/null \
  | openssl x509 -noout -dates

# Verify certbot timer is active
systemctl status certbot.timer
```

If certbot timer is not active:
```bash
systemctl enable --now certbot.timer
```

## 5. Verification Checklist

After deployment, verify each endpoint:

```bash
# API server
curl -s https://systemodel.com/api/health | jq .
curl -s https://systemodel.com/api/ready | jq .

# Diagram service
curl -s https://systemodel.com/diagram/health | jq .
curl -s https://systemodel.com/diagram/ready | jq .

# LSP server
curl -s https://systemodel.com/lsp-health | jq .
curl -s https://systemodel.com/lsp-ready | jq .
```

All should return `{"status": "ok", ...}` with HTTP 200.
