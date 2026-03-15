import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { createWebSocketConnection } from 'vscode-ws-jsonrpc';
import { createConnection } from 'vscode-languageserver/node.js';
import { spawnLanguageServer } from './lsp-process.js';

export function createLspWebSocketServer(port: number): WebSocketServer {
  const wss = new WebSocketServer({ port, path: '/lsp' });

  console.log(`[LSP WS] WebSocket server listening on ws://localhost:${port}/lsp`);

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const clientIp = req.socket.remoteAddress ?? 'unknown';
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

    // Pipe: WebSocket → LSP process stdin
    ws.on('message', (msg) => {
      const msgStr = msg.toString();
      const contentLength = Buffer.byteLength(msgStr, 'utf8');
      const header = `Content-Length: ${contentLength}\r\n\r\n`;
      serverProcess.stdin!.write(header + msgStr);
    });

    // Pipe: LSP process stdout → WebSocket
    let buffer = '';
    serverProcess.stdout!.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      // Parse LSP header-delimited messages
      while (true) {
        const headerEnd = buffer.indexOf('\r\n\r\n');
        if (headerEnd === -1) break;

        const header = buffer.slice(0, headerEnd);
        const lengthMatch = header.match(/Content-Length: (\d+)/);
        if (!lengthMatch) { buffer = buffer.slice(headerEnd + 4); break; }

        const contentLength = parseInt(lengthMatch[1], 10);
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
      serverProcess.kill();
    });

    ws.on('error', (err) => {
      console.error(`[LSP WS] WebSocket error for ${clientIp}:`, err.message);
      serverProcess.kill();
    });
  });

  return wss;
}
