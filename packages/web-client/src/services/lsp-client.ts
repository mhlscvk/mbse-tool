import { MonacoLanguageClient } from 'monaco-languageclient';
import { toSocket, WebSocketMessageReader, WebSocketMessageWriter } from 'vscode-ws-jsonrpc';
import { CloseAction, ErrorAction } from 'vscode-languageclient';

const LSP_URL = import.meta.env.VITE_LSP_URL ?? 'ws://localhost:3001/lsp';

let client: MonacoLanguageClient | null = null;

export function createLspClient(): MonacoLanguageClient {
  const webSocket = new WebSocket(LSP_URL);

  const ipcSocket = toSocket(webSocket);
  const reader = new WebSocketMessageReader(ipcSocket);
  const writer = new WebSocketMessageWriter(ipcSocket);

  client = new MonacoLanguageClient({
    name: 'SysML v2 Language Client',
    clientOptions: {
      documentSelector: [{ language: 'sysml' }],
      errorHandler: {
        error: () => ({ action: ErrorAction.Continue }),
        closed: () => ({ action: CloseAction.DoNotRestart }),
      },
    },
    messageTransports: { reader, writer },
  });

  return client;
}

export function getLspClient(): MonacoLanguageClient | null {
  return client;
}
