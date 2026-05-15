import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../db.js', () => ({ prisma: {} }));

vi.mock('../middleware/auth.js', () => ({
  requireAuth: (req: any, _res: any, next: any) => { req.userId = 'admin1'; next(); },
  requireAdmin: (_req: any, _res: any, next: any) => next(),
}));

import router from './admin.js';

function dispatch(method: string, path: string): Promise<{ statusCode: number; body: unknown }> {
  const stack = (router as any).stack;
  const route = stack.find((l: any) => l.route?.path === path && l.route?.methods[method])?.route;
  if (!route) throw new Error(`No route for ${method.toUpperCase()} ${path}`);

  const req: any = { body: {}, headers: {}, params: {} };
  return new Promise((resolve, reject) => {
    const res: any = {
      statusCode: 200,
      body: null,
      status(code: number) { this.statusCode = code; return this; },
      json(data: unknown) { this.body = data; resolve({ statusCode: this.statusCode, body: this.body }); return this; },
    };
    let i = 0;
    const next = (err?: unknown) => {
      if (err) { reject(err); return; }
      if (i >= route.stack.length) return;
      const layer = route.stack[i++];
      try {
        layer.handle(req, res, next);
      } catch (e) {
        reject(e);
      }
    };
    next();
  });
}

describe('GET /admin/renderer-stats', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.DIAGRAM_SERVICE_INTERNAL_URL;
    delete process.env.INTERNAL_API_TOKEN;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns status=live with the upstream snapshot when fetch succeeds', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          totalRenders: 4,
          byViewType: { 'state-machine': { new: 4 } },
          unmapped: 0,
        };
      },
    })) as unknown as typeof fetch;

    const res = await dispatch('get', '/renderer-stats');
    expect((res.body as any).data).toMatchObject({
      status: 'live',
      totalRenders: 4,
      byViewType: { 'state-machine': { new: 4 } },
      unmapped: 0,
    });
  });

  it('returns status=unavailable when upstream returns non-2xx', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 502,
      async json() { return {}; },
    })) as unknown as typeof fetch;

    const res = await dispatch('get', '/renderer-stats');
    expect((res.body as any).data).toMatchObject({
      status: 'unavailable',
      upstreamStatus: 502,
    });
  });

  it('returns status=unavailable when fetch throws (diagram-service down)', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('ECONNREFUSED 127.0.0.1:3002');
    }) as unknown as typeof fetch;

    const res = await dispatch('get', '/renderer-stats');
    expect((res.body as any).data.status).toBe('unavailable');
    expect((res.body as any).data.error).toContain('ECONNREFUSED');
  });

  it('passes INTERNAL_API_TOKEN through as x-internal-token header when set', async () => {
    process.env.INTERNAL_API_TOKEN = 'shh-secret';
    const fetchMock = vi.fn(async () => ({
      ok: true, status: 200,
      async json() { return { totalRenders: 0, byViewType: {}, unmapped: 0 }; },
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await dispatch('get', '/renderer-stats');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-internal-token': 'shh-secret' }),
      }),
    );
  });

  it('omits the auth header when INTERNAL_API_TOKEN is unset', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true, status: 200,
      async json() { return { totalRenders: 0, byViewType: {}, unmapped: 0 }; },
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await dispatch('get', '/renderer-stats');

    const call = fetchMock.mock.calls[0] as unknown as [string, { headers: Record<string, string> }];
    expect(call[1].headers).toEqual({});
  });
});
