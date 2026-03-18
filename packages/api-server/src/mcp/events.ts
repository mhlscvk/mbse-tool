import { EventEmitter } from 'events';

export interface FileChangeEvent {
  fileId: string;
  userId: string;
  action: 'created' | 'updated' | 'deleted';
}

/**
 * Singleton event bus for bridging file mutations to MCP sessions.
 *
 * Emitters:  file routes (REST), MCP tools
 * Listeners: MCP server instances (send resource/updated notifications)
 */
class McpEventBus extends EventEmitter {
  emitFileChange(event: FileChangeEvent): void {
    this.emit('file:change', event);
  }

  onFileChange(handler: (event: FileChangeEvent) => void): void {
    this.on('file:change', handler);
  }

  offFileChange(handler: (event: FileChangeEvent) => void): void {
    this.off('file:change', handler);
  }
}

export const mcpEvents = new McpEventBus();
