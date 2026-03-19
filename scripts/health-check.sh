#!/bin/bash
# Post-deploy health check — verifies API + Diagram WebSocket are functional.
# Usage: ssh root@<VPS> "cd /opt/systemodel && bash scripts/health-check.sh"

set -e

DOMAIN="${1:-https://systemodel.com}"
FAIL=0

echo "=== Health Check: $DOMAIN ==="

# 1. API health endpoint
echo -n "API /health ... "
API_STATUS=$(curl -s -o /dev/null -w '%{http_code}' "$DOMAIN/api/projects" 2>/dev/null)
if [ "$API_STATUS" = "401" ] || [ "$API_STATUS" = "200" ]; then
  echo "OK ($API_STATUS)"
else
  echo "FAIL ($API_STATUS)"
  FAIL=1
fi

# 2. Diagram WebSocket via health endpoint
echo -n "Diagram /health ... "
DIAG_RESP=$(curl -s http://localhost:3002/health 2>/dev/null)
if echo "$DIAG_RESP" | grep -q '"status":"ok"'; then
  echo "OK"
else
  echo "FAIL ($DIAG_RESP)"
  FAIL=1
fi

# 3. Diagram WebSocket connection test
echo -n "Diagram WS connect ... "
cd /opt/systemodel/packages/diagram-service
WS_RESULT=$(timeout 5 node -e "
const ws = new (require('ws'))('wss://systemodel.com/diagram', { origin: 'https://systemodel.com' });
ws.on('open', () => {
  ws.send(JSON.stringify({ kind: 'parse', uri: 'test://hc', content: 'part def A;' }));
});
ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.kind === 'model') { console.log('OK'); } else { console.log('FAIL: ' + msg.kind); }
  ws.close();
  process.exit(msg.kind === 'model' ? 0 : 1);
});
ws.on('error', (e) => { console.log('FAIL: ' + e.message); process.exit(1); });
" 2>&1)
echo "$WS_RESULT"
if [ "$WS_RESULT" != "OK" ]; then FAIL=1; fi

# 4. PM2 process status
echo -n "PM2 processes ... "
PM2_COUNT=$(pm2 jlist 2>/dev/null | node -e "
const d=require('fs').readFileSync('/dev/stdin','utf8');
const procs=JSON.parse(d);
const online=procs.filter(p=>p.pm2_env.status==='online').length;
console.log(online);
")
if [ "$PM2_COUNT" = "2" ]; then
  echo "OK (2 online)"
else
  echo "FAIL ($PM2_COUNT online, expected 2)"
  FAIL=1
fi

echo "==========================="
if [ "$FAIL" = "1" ]; then
  echo "HEALTH CHECK FAILED"
  exit 1
else
  echo "ALL CHECKS PASSED"
  exit 0
fi
