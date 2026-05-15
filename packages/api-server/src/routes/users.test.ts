import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db.js', () => ({
  prisma: { user: { update: vi.fn() } },
}));

// Bypass auth middleware: stamp a userId on the request and let the handler run.
vi.mock('../middleware/auth.js', () => ({
  requireAuth: (req: any, _res: any, next: any) => { req.userId = 'u1'; next(); },
}));

import { prisma } from '../db.js';
import router from './users.js';

const mock = prisma as unknown as { user: { update: ReturnType<typeof vi.fn> } };

// Run all middleware + handler in order, resolving when res.json fires
// or when next() is called with an error.
function dispatch(method: string, path: string, body: unknown): Promise<{ statusCode: number; body: unknown }> {
  const stack = (router as any).stack;
  const route = stack.find((l: any) => l.route?.path === path && l.route?.methods[method])?.route;
  if (!route) throw new Error(`No route for ${method.toUpperCase()} ${path}`);

  const req: any = { body, headers: {} };
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PATCH /users/me/preferences', () => {
  it("accepts 'tr' and persists preferredLanguage", async () => {
    mock.user.update.mockResolvedValue({ id: 'u1', preferredLanguage: 'tr' });
    const res = await dispatch('patch', '/me/preferences', { preferredLanguage: 'tr' });
    expect(mock.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'u1' },
      data: { preferredLanguage: 'tr' },
    }));
    expect(res.body).toEqual({ data: { id: 'u1', preferredLanguage: 'tr' } });
  });

  it("accepts 'en' and persists preferredLanguage", async () => {
    mock.user.update.mockResolvedValue({ id: 'u1', preferredLanguage: 'en' });
    const res = await dispatch('patch', '/me/preferences', { preferredLanguage: 'en' });
    expect(mock.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { preferredLanguage: 'en' },
    }));
    expect((res.body as any).data.preferredLanguage).toBe('en');
  });

  it('rejects unknown language with Zod validation error', async () => {
    await expect(dispatch('patch', '/me/preferences', { preferredLanguage: 'fr' }))
      .rejects.toThrow();
    expect(mock.user.update).not.toHaveBeenCalled();
  });

  it('rejects missing preferredLanguage with Zod validation error', async () => {
    await expect(dispatch('patch', '/me/preferences', {})).rejects.toThrow();
    expect(mock.user.update).not.toHaveBeenCalled();
  });

  it('returns 404 when the user row is missing', async () => {
    mock.user.update.mockResolvedValue(null);
    await expect(dispatch('patch', '/me/preferences', { preferredLanguage: 'tr' }))
      .rejects.toMatchObject({ status: 404 });
  });
});
