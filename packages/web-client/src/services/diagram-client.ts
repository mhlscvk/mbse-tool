import type { SysMLModel, DiagramMessage, SModelRoot } from '@systemodel/shared-types';

const DIAGRAM_URL = import.meta.env.VITE_DIAGRAM_URL ?? 'ws://localhost:3002/diagram';

type DiagramListener = (model: SModelRoot) => void;
type ErrorListener = (message: string) => void;
type ClearListener = () => void;

export class DiagramClient {
  private ws: WebSocket | null = null;
  private listeners: DiagramListener[] = [];
  private errorListeners: ErrorListener[] = [];
  private clearListeners: ClearListener[] = [];
  private reconnectDelay = 2000;
  private pendingText: { uri: string; content: string } | null = null;

  connect(): void {
    this.ws = new WebSocket(DIAGRAM_URL);

    this.ws.onopen = () => {
      console.log('[Diagram] Connected to diagram service');
      this.reconnectDelay = 2000;
      // Flush any pending text that arrived before connection was ready
      if (this.pendingText) {
        this.sendText(this.pendingText.uri, this.pendingText.content);
        this.pendingText = null;
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: DiagramMessage = JSON.parse(event.data as string);
        if (msg.kind === 'model') {
          this.listeners.forEach((l) => l(msg.model));
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
      console.log(`[Diagram] Disconnected — reconnecting in ${this.reconnectDelay}ms`);
      setTimeout(() => {
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
        this.connect();
      }, this.reconnectDelay);
    };

    this.ws.onerror = (e) => {
      console.error('[Diagram] WebSocket error', e);
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
    this.ws?.close();
  }
}

export const diagramClient = new DiagramClient();
