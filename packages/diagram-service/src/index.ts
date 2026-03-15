import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { createDiagramWebSocketServer } from './websocket-server.js';

const PORT = parseInt(process.env.PORT ?? '3002', 10);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173').split(',');

const app = express();
app.use(cors({ origin: ALLOWED_ORIGINS }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'diagram-service', port: PORT });
});

const server = http.createServer(app);
createDiagramWebSocketServer(server);

server.listen(PORT, () => {
  console.log(`[Diagram] Service running on http://localhost:${PORT} (WS: ws://localhost:${PORT}/diagram)`);
});
