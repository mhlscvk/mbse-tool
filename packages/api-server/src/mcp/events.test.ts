import { describe, it, expect, vi } from 'vitest';
import { mcpEvents, type FileChangeEvent } from './events.js';

describe('McpEventBus', () => {
  it('emits and receives file change events', () => {
    const handler = vi.fn();
    mcpEvents.onFileChange(handler);
    mcpEvents.emitFileChange({ fileId: 'f1', userId: 'u1', action: 'updated' });
    expect(handler).toHaveBeenCalledWith({ fileId: 'f1', userId: 'u1', action: 'updated' });
    mcpEvents.offFileChange(handler);
  });

  it('passes source field in events', () => {
    const handler = vi.fn();
    mcpEvents.onFileChange(handler);
    mcpEvents.emitFileChange({ fileId: 'f1', userId: 'u1', action: 'updated', source: 'mcp' });
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ source: 'mcp' }));
    mcpEvents.offFileChange(handler);
  });

  it('supports all source types', () => {
    const handler = vi.fn();
    mcpEvents.onFileChange(handler);
    const sources: FileChangeEvent['source'][] = ['mcp', 'ai_chat', 'rest', undefined];
    for (const source of sources) {
      mcpEvents.emitFileChange({ fileId: 'f1', userId: 'u1', action: 'created', source });
    }
    expect(handler).toHaveBeenCalledTimes(4);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ source: 'mcp' }));
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ source: 'ai_chat' }));
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ source: 'rest' }));
    mcpEvents.offFileChange(handler);
  });

  it('removes handler with offFileChange', () => {
    const handler = vi.fn();
    mcpEvents.onFileChange(handler);
    mcpEvents.offFileChange(handler);
    mcpEvents.emitFileChange({ fileId: 'f1', userId: 'u1', action: 'deleted' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('supports multiple concurrent listeners', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    mcpEvents.onFileChange(h1);
    mcpEvents.onFileChange(h2);
    mcpEvents.emitFileChange({ fileId: 'f1', userId: 'u1', action: 'updated' });
    expect(h1).toHaveBeenCalledTimes(1);
    expect(h2).toHaveBeenCalledTimes(1);
    mcpEvents.offFileChange(h1);
    mcpEvents.offFileChange(h2);
  });

  it('supports all action types', () => {
    const handler = vi.fn();
    mcpEvents.onFileChange(handler);
    mcpEvents.emitFileChange({ fileId: 'f1', userId: 'u1', action: 'created' });
    mcpEvents.emitFileChange({ fileId: 'f2', userId: 'u1', action: 'updated' });
    mcpEvents.emitFileChange({ fileId: 'f3', userId: 'u1', action: 'deleted' });
    expect(handler).toHaveBeenCalledTimes(3);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ action: 'created' }));
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ action: 'updated' }));
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ action: 'deleted' }));
    mcpEvents.offFileChange(handler);
  });
});
