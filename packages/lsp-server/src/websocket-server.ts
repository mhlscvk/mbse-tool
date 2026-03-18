import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage, Server } from 'http';
import { createWebSocketConnection } from 'vscode-ws-jsonrpc';
import { createConnection } from 'vscode-languageserver/node.js';
import { spawnLanguageServer } from './lsp-process.js';

const MAX_PAYLOAD = 10 * 1024 * 1024; // 10 MB — prevent memory exhaustion
const MAX_CONNECTIONS_PER_IP = 10;
const MAX_TOTAL_CONNECTIONS = 50;
const MAX_MESSAGES_PER_MINUTE = 120;
const MAX_BUFFER_SIZE = 50 * 1024 * 1024; // 50 MB — cap stdout buffer accumulation

export function createLspWebSocketServer(server: Server, allowedOrigins: string[] = []): WebSocketServer {
  const wss = new WebSocketServer({
    server,
    path: '/lsp',
    maxPayload: MAX_PAYLOAD,
    verifyClient: ({ origin, req }, cb) => {
      // Reject browser connections from unknown origins (WebSocket CSRF protection)
      if (origin && allowedOrigins.length > 0 && !allowedOrigins.includes(origin)) {
        cb(false, 403, 'Origin not allowed');
        return;
      }
      cb(true);
    },
  });

  const connectionsPerIp = new Map<string, number>();

  console.log(`[LSP WS] WebSocket server attached on /lsp`);

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const clientIp = req.socket.remoteAddress ?? 'unknown';

    // Global connection limit
    if (wss.clients.size > MAX_TOTAL_CONNECTIONS) {
      ws.close(1013, 'Server too busy');
      return;
    }

    // Per-IP connection limit — prevents single attacker from spawning many processes
    const current = connectionsPerIp.get(clientIp) ?? 0;
    if (current >= MAX_CONNECTIONS_PER_IP) {
      ws.close(1008, 'Too many connections');
      return;
    }
    connectionsPerIp.set(clientIp, current + 1);

    // Per-connection message rate limiting
    let messageCount = 0;
    const rateLimitInterval = setInterval(() => { messageCount = 0; }, 60_000);

    console.log(`[LSP WS] Client connected from ${clientIp}`);

    // Spawn a dedicated language server process per connection
    const serverProcess = spawnLanguageServer();

    if (!serverProcess.stdin || !serverProcess.stdout) {
      console.error('[LSP WS] Language server process has no stdio — check server path');
      ws.close(1011, 'Language server unavailable');
      return;
    }

    // Bridge WebSocket ↔ language server stdio using JSON-RPC
    const socket = {
      onMessage: (cb: (data: string) => void) => {
        ws.on('message', (msg) => cb(msg.toString()));
      },
      onClose: (cb: () => void) => ws.on('close', cb),
      onError: (cb: (err: Error) => void) => ws.on('error', cb),
      send: (data: string) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      },
      dispose: () => ws.close(),
    };

    // Pipe: WebSocket → LSP process stdin (with rate limiting)
    ws.on('message', (msg) => {
      messageCount++;
      if (messageCount > MAX_MESSAGES_PER_MINUTE) {
        // Silently drop — LSP protocol has no rate-limit error code
        return;
      }
      const msgStr = msg.toString();
      const contentLength = Buffer.byteLength(msgStr, 'utf8');
      const header = `Content-Length: ${contentLength}\r\n\r\n`;
      serverProcess.stdin!.write(header + msgStr);
    });

    // Pipe: LSP process stdout → WebSocket (with buffer size cap)
    let buffer = '';
    serverProcess.stdout!.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      // Prevent unbounded buffer accumulation from malicious Content-Length headers
      if (buffer.length > MAX_BUFFER_SIZE) {
        console.error(`[LSP WS] Buffer exceeded ${MAX_BUFFER_SIZE} bytes for ${clientIp} — killing`);
        serverProcess.kill();
        ws.close(1009, 'Message too big');
        return;
      }
      // Parse LSP header-delimited messages
      while (true) {
        const headerEnd = buffer.indexOf('\r\n\r\n');
        if (headerEnd === -1) break;

        const header = buffer.slice(0, headerEnd);
        const lengthMatch = header.match(/Content-Length: (\d+)/);
        if (!lengthMatch) { buffer = buffer.slice(headerEnd + 4); break; }

        const contentLength = parseInt(lengthMatch[1], 10);
        // Reject absurd Content-Length values before accumulating
        if (contentLength > MAX_PAYLOAD) {
          console.error(`[LSP WS] Content-Length ${contentLength} exceeds limit for ${clientIp}`);
          buffer = '';
          serverProcess.kill();
          ws.close(1009, 'Message too big');
          return;
        }
        const bodyStart = headerEnd + 4;

        if (buffer.length < bodyStart + contentLength) break;

        const body = buffer.slice(bodyStart, bodyStart + contentLength);
        buffer = buffer.slice(bodyStart + contentLength);

        if (ws.readyState === WebSocket.OPEN) {
          ws.send(body);
        }
      }
    });

    ws.on('close', () => {
      console.log(`[LSP WS] Client ${clientIp} disconnected — killing server process`);
      clearInterval(rateLimitInterval);
      serverProcess.kill();
      const count = connectionsPerIp.get(clientIp) ?? 1;
      if (count <= 1) connectionsPerIp.delete(clientIp);
      else connectionsPerIp.set(clientIp, count - 1);
    });

    ws.on('error', (err) => {
      console.error(`[LSP WS] WebSocket error for ${clientIp}:`, err.message);
      clearInterval(rateLimitInterval);
      serverProcess.kill();
      const count = connectionsPerIp.get(clientIp) ?? 1;
      if (count <= 1) connectionsPerIp.delete(clientIp);
      else connectionsPerIp.set(clientIp, count - 1);
    });
  });

  return wss;
}
