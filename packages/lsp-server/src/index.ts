import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import { createLspWebSocketServer } from './websocket-server.js';

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map(o => o.trim())
  .filter(o => /^https?:\/\//.test(o));

const app = express();
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({ origin: ALLOWED_ORIGINS }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'lsp-server', port: PORT });
});

const server = http.createServer(app);
createLspWebSocketServer(server, ALLOWED_ORIGINS);

server.listen(PORT, () => {
  console.log(`[LSP] Service running on http://localhost:${PORT} (WS: ws://localhost:${PORT}/lsp)`);
});
