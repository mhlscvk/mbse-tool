import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import type { SysMLModel, DiagramMessage } from '@systemodel/shared-types';
import { transformToBDD } from './transformer/bdd-transformer.js';
import { applyLayout } from './layout/elk-layout.js';
import { parseSysMLText } from './parser/sysml-text-parser.js';

// Incoming message from browser
type DiagramRequest =
  | { kind: 'parse'; uri: string; content: string }   // text → parse server-side
  | { kind: 'model'; model: SysMLModel };              // pre-built AST (future: from LSP)

export function createDiagramWebSocketServer(port: number): WebSocketServer {
  const wss = new WebSocketServer({ port, path: '/diagram' });

  console.log(`[Diagram WS] WebSocket server listening on ws://localhost:${port}/diagram`);

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const clientIp = req.socket.remoteAddress ?? 'unknown';
    console.log(`[Diagram WS] Client connected from ${clientIp}`);

    const send = (msg: DiagramMessage) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    };

    ws.on('message', async (raw) => {
      try {
        const request: DiagramRequest = JSON.parse(raw.toString());

        let model: SysMLModel;

        if (request.kind === 'parse') {
          // Parse SysML text server-side
          model = parseSysMLText(request.uri, request.content);
        } else if (request.kind === 'model') {
          // Accept pre-built model (for future LSP integration)
          model = request.model;
        } else {
          send({ kind: 'error', message: 'Unknown request kind' });
          return;
        }

        if (model.nodes.length === 0) {
          send({ kind: 'clear' });
          return;
        }

        const sModel = transformToBDD(model);
        const laid = await applyLayout(sModel);
        send({ kind: 'model', model: laid });

      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[Diagram WS] Error processing request:', message);
        send({ kind: 'error', message });
      }
    });

    ws.on('close', () => {
      console.log(`[Diagram WS] Client ${clientIp} disconnected`);
    });
  });

  return wss;
}
