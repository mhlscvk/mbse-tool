import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { createDiagramWebSocketServer } from './websocket-server.js';

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

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'diagram-service', port: PORT });
});

const server = http.createServer(app);
createDiagramWebSocketServer(server, ALLOWED_ORIGINS);

server.listen(PORT, () => {
  console.log(`[Diagram] Service running on http://localhost:${PORT} (WS: ws://localhost:${PORT}/diagram)`);
});
