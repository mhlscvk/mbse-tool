import { MonacoLanguageClient } from 'monaco-languageclient';
import { toSocket, WebSocketMessageReader, WebSocketMessageWriter } from 'vscode-ws-jsonrpc';
import { CloseAction, ErrorAction } from 'vscode-languageclient';

function getLspUrl(): string {
  if (import.meta.env.VITE_LSP_URL) return import.meta.env.VITE_LSP_URL;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/lsp`;
}

let client: MonacoLanguageClient | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = 2000;

export function createLspClient(): MonacoLanguageClient {
  // Clear any pending reconnect
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  const webSocket = new WebSocket(getLspUrl());

  const ipcSocket = toSocket(webSocket);
  const reader = new WebSocketMessageReader(ipcSocket);
  const writer = new WebSocketMessageWriter(ipcSocket);

  client = new MonacoLanguageClient({
    name: 'SysML v2 Language Client',
    clientOptions: {
      documentSelector: [{ language: 'sysml' }],
      errorHandler: {
        error: () => ({ action: ErrorAction.Continue }),
        closed: () => {
          console.warn('[LSP] Connection closed — will reconnect');
          scheduleReconnect();
          return { action: CloseAction.DoNotRestart };
        },
      },
    },
    messageTransports: { reader, writer },
  });

  // Reset delay on successful connection
  webSocket.addEventListener('open', () => {
    reconnectDelay = 2000;
  });

  return client;
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  console.log(`[LSP] Reconnecting in ${reconnectDelay}ms`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    reconnectDelay = Math.min(reconnectDelay * 2, 30000);
    try {
      createLspClient()?.start();
    } catch (err) {
      console.error('[LSP] Reconnect failed:', err);
      scheduleReconnect();
    }
  }, reconnectDelay);
}

export function getLspClient(): MonacoLanguageClient | null {
  return client;
}
