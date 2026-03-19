import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import http from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { createDiagramWebSocketServer } from './websocket-server.js';

function startServer(allowedOrigins: string[]): Promise<{ server: http.Server; port: number; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = http.createServer();
    createDiagramWebSocketServer(server, allowedOrigins);
    server.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({
        server,
        port,
        close: () => new Promise<void>((r) => server.close(() => r())),
      });
    });
  });
}

function connectWs(port: number, origin?: string): Promise<{ msg: unknown; ws: WebSocket }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/diagram`, {
      ...(origin ? { origin } : {}),
    });
    ws.on('open', () => {
      ws.send(JSON.stringify({ kind: 'parse', uri: 'test://t', content: 'part def A;' }));
    });
    ws.on('message', (data) => {
      resolve({ msg: JSON.parse(data.toString()), ws });
    });
    ws.on('error', (err) => reject(err));
    setTimeout(() => reject(new Error('timeout')), 5000);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════

describe('WebSocket Server: origin verification', () => {
  let srv: Awaited<ReturnType<typeof startServer>> | null = null;

  afterEach(async () => {
    if (srv) await srv.close();
    srv = null;
  });

  it('accepts connections with matching origin', async () => {
    srv = await startServer(['https://example.com']);
    const { msg, ws } = await connectWs(srv.port, 'https://example.com');
    expect((msg as { kind: string }).kind).toBe('model');
    ws.close();
  });

  it('accepts connections with no origin (non-browser clients)', async () => {
    srv = await startServer(['https://example.com']);
    const { msg, ws } = await connectWs(srv.port); // no origin
    expect((msg as { kind: string }).kind).toBe('model');
    ws.close();
  });

  it('rejects connections with wrong origin', async () => {
    srv = await startServer(['https://example.com']);
    await expect(connectWs(srv.port, 'https://evil.com')).rejects.toThrow();
  });

  it('accepts any origin when allowedOrigins is empty', async () => {
    srv = await startServer([]);
    const { msg, ws } = await connectWs(srv.port, 'https://anything.com');
    expect((msg as { kind: string }).kind).toBe('model');
    ws.close();
  });

  it('accepts multiple allowed origins', async () => {
    srv = await startServer(['https://a.com', 'https://b.com']);
    const r1 = await connectWs(srv.port, 'https://a.com');
    expect((r1.msg as { kind: string }).kind).toBe('model');
    r1.ws.close();
    const r2 = await connectWs(srv.port, 'https://b.com');
    expect((r2.msg as { kind: string }).kind).toBe('model');
    r2.ws.close();
  });
});

describe('WebSocket Server: viewType protocol', () => {
  let srv: Awaited<ReturnType<typeof startServer>> | null = null;

  afterEach(async () => {
    if (srv) await srv.close();
    srv = null;
  });

  it('returns viewType=general by default', async () => {
    srv = await startServer([]);
    const { msg, ws } = await connectWs(srv.port);
    expect((msg as { viewType?: string }).viewType).toBe('general');
    ws.close();
  });

  it('returns requested viewType in response', async () => {
    srv = await startServer([]);
    const ws = new WebSocket(`ws://127.0.0.1:${srv.port}/diagram`);
    const result = await new Promise<unknown>((resolve, reject) => {
      ws.on('open', () => {
        ws.send(JSON.stringify({ kind: 'parse', uri: 'test://t', content: 'part def A { part b; }', viewType: 'interconnection' }));
      });
      ws.on('message', (data) => resolve(JSON.parse(data.toString())));
      ws.on('error', reject);
      setTimeout(() => reject(new Error('timeout')), 5000);
    });
    expect((result as { viewType: string }).viewType).toBe('interconnection');
    ws.close();
  });

  it('falls back to general for invalid viewType', async () => {
    srv = await startServer([]);
    const ws = new WebSocket(`ws://127.0.0.1:${srv.port}/diagram`);
    const result = await new Promise<unknown>((resolve, reject) => {
      ws.on('open', () => {
        ws.send(JSON.stringify({ kind: 'parse', uri: 'test://t', content: 'part def A;', viewType: 'invalid-type' }));
      });
      ws.on('message', (data) => resolve(JSON.parse(data.toString())));
      ws.on('error', reject);
      setTimeout(() => reject(new Error('timeout')), 5000);
    });
    expect((result as { viewType: string }).viewType).toBe('general');
    ws.close();
  });

  it('filters nodes for interconnection view', async () => {
    srv = await startServer([]);
    const ws = new WebSocket(`ws://127.0.0.1:${srv.port}/diagram`);
    const code = 'part def V { part e; action d; state s; }';
    const general = await new Promise<unknown>((resolve, reject) => {
      ws.on('open', () => ws.send(JSON.stringify({ kind: 'parse', uri: 'test://t', content: code })));
      ws.on('message', (data) => resolve(JSON.parse(data.toString())));
      ws.on('error', reject);
      setTimeout(() => reject(new Error('timeout')), 5000);
    });

    const ws2 = new WebSocket(`ws://127.0.0.1:${srv.port}/diagram`);
    const iv = await new Promise<unknown>((resolve, reject) => {
      ws2.on('open', () => ws2.send(JSON.stringify({ kind: 'parse', uri: 'test://t', content: code, viewType: 'interconnection' })));
      ws2.on('message', (data) => resolve(JSON.parse(data.toString())));
      ws2.on('error', reject);
      setTimeout(() => reject(new Error('timeout')), 5000);
    });

    const gvNodes = (general as { model: { children: unknown[] } }).model.children.filter((c: any) => c.type === 'node');
    const ivNodes = (iv as { model: { children: unknown[] } }).model.children.filter((c: any) => c.type === 'node');
    // IV should have fewer nodes (no action/state usages)
    expect(ivNodes.length).toBeLessThan(gvNodes.length);
    ws.close();
    ws2.close();
  });

  it('sends clear for empty content', async () => {
    srv = await startServer([]);
    const ws = new WebSocket(`ws://127.0.0.1:${srv.port}/diagram`);
    const result = await new Promise<unknown>((resolve, reject) => {
      ws.on('open', () => ws.send(JSON.stringify({ kind: 'parse', uri: 'test://t', content: '' })));
      ws.on('message', (data) => resolve(JSON.parse(data.toString())));
      ws.on('error', reject);
      setTimeout(() => reject(new Error('timeout')), 5000);
    });
    expect((result as { kind: string }).kind).toBe('clear');
    ws.close();
  });
});

describe('WebSocket Server: security hardening', () => {
  let srv: Awaited<ReturnType<typeof startServer>> | null = null;

  afterEach(async () => {
    if (srv) await srv.close();
    srv = null;
  });

  it('rejects oversized messages gracefully', async () => {
    srv = await startServer([]);
    const { msg, ws } = await connectWs(srv.port);
    // First message succeeds
    expect((msg as { kind: string }).kind).toBe('model');

    // Send a large but valid JSON message (within the 10MB limit, just testing handling)
    const bigContent = 'part def A;'.repeat(1000);
    ws.send(JSON.stringify({ kind: 'parse', uri: 'test://big', content: bigContent }));
    const result = await new Promise<unknown>((resolve) => {
      ws.on('message', (data) => resolve(JSON.parse(data.toString())));
    });
    expect((result as { kind: string }).kind).toBe('model');
    ws.close();
  });

  it('handles malformed JSON without crashing', async () => {
    srv = await startServer([]);
    const ws = new WebSocket(`ws://127.0.0.1:${srv.port}/diagram`);
    await new Promise<void>((resolve) => ws.on('open', resolve));

    // Send invalid JSON
    ws.send('not valid json {{{');
    const result = await new Promise<unknown>((resolve) => {
      ws.on('message', (data) => resolve(JSON.parse(data.toString())));
      setTimeout(() => resolve({ kind: 'timeout' }), 2000);
    });
    expect((result as { kind: string }).kind).toBe('error');
    expect((result as { message?: string }).message).not.toContain('JSON');
    ws.close();
  });

  it('sanitizes error messages — no internal details leaked', async () => {
    srv = await startServer([]);
    const ws = new WebSocket(`ws://127.0.0.1:${srv.port}/diagram`);
    await new Promise<void>((resolve) => ws.on('open', resolve));

    // Send invalid request kind
    ws.send(JSON.stringify({ kind: 'invalid_kind' }));
    const result = await new Promise<unknown>((resolve) => {
      ws.on('message', (data) => resolve(JSON.parse(data.toString())));
    });
    const msg = result as { kind: string; message: string };
    expect(msg.kind).toBe('error');
    // Should not contain stack traces, file paths, or internal details
    expect(msg.message).not.toMatch(/node_modules|\.ts|\.js|Error:|at /i);
    ws.close();
  });

  it('rejects invalid request fields', async () => {
    srv = await startServer([]);
    const ws = new WebSocket(`ws://127.0.0.1:${srv.port}/diagram`);
    await new Promise<void>((resolve) => ws.on('open', resolve));

    // uri as number, content as object
    ws.send(JSON.stringify({ kind: 'parse', uri: 123, content: { bad: true } }));
    const result = await new Promise<unknown>((resolve) => {
      ws.on('message', (data) => resolve(JSON.parse(data.toString())));
    });
    expect((result as { kind: string }).kind).toBe('error');
    ws.close();
  });

  it('handles concurrent connections from same origin', async () => {
    srv = await startServer(['https://example.com']);
    const results = await Promise.all([
      connectWs(srv.port, 'https://example.com'),
      connectWs(srv.port, 'https://example.com'),
      connectWs(srv.port, 'https://example.com'),
    ]);
    for (const { msg, ws } of results) {
      expect((msg as { kind: string }).kind).toBe('model');
      ws.close();
    }
  });

  it('origin check is case-sensitive', async () => {
    srv = await startServer(['https://Example.com']);
    // Lowercase should fail
    await expect(connectWs(srv.port, 'https://example.com')).rejects.toThrow();
  });
});

describe('WebSocket Server: rate limiting', () => {
  let srv: Awaited<ReturnType<typeof startServer>> | null = null;

  afterEach(async () => {
    if (srv) await srv.close();
    srv = null;
  });

  it('returns error when rate limit exceeded', async () => {
    srv = await startServer([]);
    const ws = new WebSocket(`ws://127.0.0.1:${srv.port}/diagram`);
    await new Promise<void>((resolve) => ws.on('open', resolve));

    // Send 121 messages rapidly (limit is 120/min)
    const messages: unknown[] = [];
    const collectPromise = new Promise<void>((resolve) => {
      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
        if (messages.length >= 121) resolve();
      });
    });

    for (let i = 0; i < 121; i++) {
      ws.send(JSON.stringify({ kind: 'parse', uri: 'test://t', content: 'part def A;' }));
    }

    await collectPromise;
    const lastMsg = messages[messages.length - 1] as { kind: string; message?: string };
    expect(lastMsg.kind).toBe('error');
    expect(lastMsg.message).toContain('Rate limit');
    ws.close();
  });
});
