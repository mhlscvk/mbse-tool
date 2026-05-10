import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import { createRequire } from 'module';
import { createLspWebSocketServer } from './websocket-server.js';

const require = createRequire(import.meta.url);
const pkg = require('../../package.json');

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map(o => o.trim())
  .filter(o => /^https?:\/\//.test(o));

const app = express();
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({ origin: ALLOWED_ORIGINS }));

const startTime = Date.now();

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'lsp-server',
    version: pkg.version,
    uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
  });
});

app.get('/ready', (_req, res) => {
  const checks: Record<string, 'ok' | 'fail'> = {};

  // LSP server is ready if it can accept WebSocket connections.
  // The actual language server process spawns per-connection, so we check
  // that the HTTP server itself is listening and functional.
  checks.http_server = 'ok';

  const allOk = Object.values(checks).every(v => v === 'ok');
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    checks,
  });
});

const server = http.createServer(app);
createLspWebSocketServer(server, ALLOWED_ORIGINS);

server.listen(PORT, () => {
  console.log(`[LSP] Service running on http://localhost:${PORT} (WS: ws://localhost:${PORT}/lsp)`);
});
