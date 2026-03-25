import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage, Server } from 'http';
import type { SysMLModel, DiagramMessage, ViewType } from '@systemodel/shared-types';
import { transformToBDD } from './transformer/bdd-transformer.js';
import { parseSysMLText } from './parser/sysml-text-parser.js';

// Incoming message from browser
type DiagramRequest =
  | { kind: 'parse'; uri: string; content: string; viewType?: ViewType; showInherited?: boolean }   // text → parse server-side
  | { kind: 'model'; model: SysMLModel; viewType?: ViewType; showInherited?: boolean };              // pre-built AST (future: from LSP)

const MAX_PAYLOAD = 10 * 1024 * 1024; // 10 MB
const MAX_CONNECTIONS_PER_IP = 20;
const MAX_MESSAGES_PER_MINUTE = 120;

export function createDiagramWebSocketServer(server: Server, allowedOrigins: string[] = []): WebSocketServer {
  const wss = new WebSocketServer({
    server,
    path: '/diagram',
    maxPayload: MAX_PAYLOAD,
    verifyClient: ({ origin }, cb) => {
      if (origin && allowedOrigins.length > 0 && !allowedOrigins.includes(origin)) {
        cb(false, 403, 'Origin not allowed');
        return;
      }
      cb(true);
    },
  });

  // Track connections per IP for basic abuse prevention
  const connectionsPerIp = new Map<string, number>();

  console.log(`[Diagram WS] WebSocket server attached on /diagram`);

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const clientIp = req.socket.remoteAddress ?? 'unknown';

    // Connection-per-IP limit
    const current = connectionsPerIp.get(clientIp) ?? 0;
    if (current >= MAX_CONNECTIONS_PER_IP) {
      ws.close(1008, 'Too many connections');
      return;
    }
    connectionsPerIp.set(clientIp, current + 1);

    // Per-connection rate limiting
    let messageCount = 0;
    const rateLimitInterval = setInterval(() => { messageCount = 0; }, 60_000);

    const send = (msg: DiagramMessage) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    };

    ws.on('message', async (raw) => {
      // Rate limit
      messageCount++;
      if (messageCount > MAX_MESSAGES_PER_MINUTE) {
        send({ kind: 'error', message: 'Rate limit exceeded' });
        return;
      }

      try {
        const rawStr = raw.toString();
        // Reject oversized messages that somehow bypass maxPayload
        if (rawStr.length > MAX_PAYLOAD) {
          send({ kind: 'error', message: 'Message too large' });
          return;
        }

        const request: DiagramRequest = JSON.parse(rawStr);

        let model: SysMLModel;
        let diagnostics: import('@systemodel/shared-types').DiagramDiagnostic[] = [];
        const VALID_VIEW_TYPES = new Set(['general', 'interconnection', 'action-flow', 'state-transition', 'sequence', 'grid', 'browser', 'geometry']);
        const viewType: ViewType = (request.viewType && VALID_VIEW_TYPES.has(request.viewType))
          ? request.viewType : 'general';

        if (request.kind === 'parse') {
          // Validate parse request fields
          if (typeof request.uri !== 'string' || typeof request.content !== 'string') {
            send({ kind: 'error', message: 'Invalid request: uri and content must be strings' });
            return;
          }
          const result = parseSysMLText(request.uri, request.content);
          model = result.model;
          diagnostics = result.diagnostics;
        } else if (request.kind === 'model') {
          if (!request.model || !Array.isArray(request.model.nodes)) {
            send({ kind: 'error', message: 'Invalid request: model must have nodes array' });
            return;
          }
          model = request.model;
        } else {
          send({ kind: 'error', message: 'Unknown request kind' });
          return;
        }

        if (model.nodes.length === 0) {
          send({ kind: 'clear' });
          return;
        }

        // Transform AST to diagram model; client handles compound layout
        const showInherited = request.showInherited === true;
        const sModel = transformToBDD(model, viewType, showInherited);
        send({ kind: 'model', model: sModel, diagnostics, viewType });

      } catch (err) {
        // Sanitize error — never leak internal details to client
        const internal = err instanceof Error ? err.message : String(err);
        console.error('[Diagram WS] Error processing request:', internal);
        send({ kind: 'error', message: 'Failed to process request' });
      }
    });

    ws.on('close', () => {
      clearInterval(rateLimitInterval);
      const count = connectionsPerIp.get(clientIp) ?? 1;
      if (count <= 1) connectionsPerIp.delete(clientIp);
      else connectionsPerIp.set(clientIp, count - 1);
    });

    ws.on('error', () => {
      clearInterval(rateLimitInterval);
    });
  });

  return wss;
}
