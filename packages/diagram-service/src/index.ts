import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { createRequire } from 'module';
import { createDiagramWebSocketServer } from './websocket-server.js';
import { parseSysMLText } from './parser/sysml-text-parser.js';

const require = createRequire(import.meta.url);
const pkg = require('../../package.json');

const PORT = parseInt(process.env.PORT ?? '3002', 10);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map(o => o.trim())
  .filter(o => /^https?:\/\//.test(o));

// Startup validation: catch misconfigured dotenv (wrong cwd, missing .env)
if (process.env.NODE_ENV === 'production' && ALLOWED_ORIGINS.every(o => o.includes('localhost'))) {
  console.error('[Diagram] FATAL: ALLOWED_ORIGINS contains only localhost in production.');
  console.error('[Diagram] This usually means .env was not loaded — check PM2 cwd or dotenv path.');
  console.error('[Diagram] Expected: ALLOWED_ORIGINS=https://yourdomain.com');
  process.exit(1);
}

console.log(`[Diagram] ALLOWED_ORIGINS: ${ALLOWED_ORIGINS.join(', ')}`);

const app = express();
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}
app.use(cors({ origin: ALLOWED_ORIGINS }));

const startTime = Date.now();

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'diagram-service',
    version: pkg.version,
    uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
  });
});

app.get('/ready', (_req, res) => {
  const checks: Record<string, 'ok' | 'fail'> = {};

  // Parser self-test: can we parse a minimal SysML snippet?
  try {
    const result = parseSysMLText('healthcheck.sysml', 'package HealthCheck {}');
    checks.parser = result && result.model ? 'ok' : 'fail';
  } catch {
    checks.parser = 'fail';
    console.error('[Health] Parser self-test failed');
  }

  const allOk = Object.values(checks).every(v => v === 'ok');
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    checks,
  });
});

const server = http.createServer(app);
createDiagramWebSocketServer(server, ALLOWED_ORIGINS);

server.listen(PORT, () => {
  console.log(`[Diagram] Service running on http://localhost:${PORT} (WS: ws://localhost:${PORT}/diagram)`);
});
