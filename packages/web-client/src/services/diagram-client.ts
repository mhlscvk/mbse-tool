import type { SysMLModel, DiagramMessage, SModelRoot, DiagramDiagnostic } from '@systemodel/shared-types';

const DIAGRAM_URL = import.meta.env.VITE_DIAGRAM_URL ?? 'ws://localhost:3002/diagram';

type DiagramListener = (model: SModelRoot, diagnostics: DiagramDiagnostic[]) => void;
type ErrorListener = (message: string) => void;
type ClearListener = () => void;

export class DiagramClient {
  private ws: WebSocket | null = null;
  private listeners: DiagramListener[] = [];
  private errorListeners: ErrorListener[] = [];
  private clearListeners: ClearListener[] = [];
  private reconnectDelay = 2000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;
  private pendingText: { uri: string; content: string } | null = null;

  connect(): void {
    // Clean up any pending reconnect
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Close existing connection cleanly before opening a new one
    if (this.ws) {
      this.intentionalClose = true;
      this.ws.close();
      this.ws = null;
    }

    this.intentionalClose = false;
    this.ws = new WebSocket(DIAGRAM_URL);

    this.ws.onopen = () => {
      console.log('[Diagram] Connected to diagram service');
      this.reconnectDelay = 2000;
      if (this.pendingText) {
        this.sendText(this.pendingText.uri, this.pendingText.content);
        this.pendingText = null;
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: DiagramMessage = JSON.parse(event.data as string);
        if (msg.kind === 'model') {
          this.listeners.forEach((l) => l(msg.model, msg.diagnostics ?? []));
        } else if (msg.kind === 'error') {
          this.errorListeners.forEach((l) => l(msg.message));
        } else if (msg.kind === 'clear') {
          this.clearListeners.forEach((l) => l());
        }
      } catch {
        console.error('[Diagram] Failed to parse message');
      }
    };

    this.ws.onclose = () => {
      if (this.intentionalClose) return;
      console.log(`[Diagram] Disconnected — reconnecting in ${this.reconnectDelay}ms`);
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
        this.connect();
      }, this.reconnectDelay);
    };

    this.ws.onerror = () => {
      // onclose will fire after this — let it handle reconnect
    };
  }

  /** Send SysML text content to be parsed server-side */
  sendText(uri: string, content: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.pendingText = { uri, content };
      return;
    }
    this.ws.send(JSON.stringify({ kind: 'parse', uri, content }));
  }

  /** Send a pre-built AST model (future: from LSP) */
  sendModel(model: SysMLModel): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ kind: 'model', model }));
    }
  }

  onModel(listener: DiagramListener): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter((l) => l !== listener); };
  }

  onError(listener: ErrorListener): () => void {
    this.errorListeners.push(listener);
    return () => { this.errorListeners = this.errorListeners.filter((l) => l !== listener); };
  }

  onClear(listener: ClearListener): () => void {
    this.clearListeners.push(listener);
    return () => { this.clearListeners = this.clearListeners.filter((l) => l !== listener); };
  }

  disconnect(): void {
    this.intentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }
}

export const diagramClient = new DiagramClient();
