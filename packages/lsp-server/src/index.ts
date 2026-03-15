import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { createLspWebSocketServer } from './websocket-server.js';

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173').split(',');

const app = express();
app.use(cors({ origin: ALLOWED_ORIGINS }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'lsp-server', port: PORT });
});

const server = http.createServer(app);
server.listen(PORT, () => {
  console.log(`[LSP] HTTP health server running on http://localhost:${PORT}`);
});

createLspWebSocketServer(PORT + 0); // WS on same conceptual service, different path
