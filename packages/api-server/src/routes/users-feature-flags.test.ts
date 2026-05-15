import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('../middleware/auth.js', () => ({
  requireAuth: (req: any, _res: any, next: any) => { req.userId = 'u1'; next(); },
}));

import { prisma } from '../db.js';
import router from './users.js';

const mock = prisma as unknown as {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

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
  mock.user.findUnique.mockReset();
  mock.user.update.mockReset();
});

describe('GET /users/me/feature-flags', () => {
  it('returns empty object when no flags stored', async () => {
    mock.user.findUnique.mockResolvedValue({ featureFlags: null });
    const res = await dispatch('get', '/me/feature-flags', undefined);
    expect(res.body).toEqual({ data: {} });
  });

  it('returns stored flags', async () => {
    mock.user.findUnique.mockResolvedValue({
      featureFlags: { 'state-machine-new-renderer': true },
    });
    const res = await dispatch('get', '/me/feature-flags', undefined);
    expect(res.body).toEqual({
      data: { 'state-machine-new-renderer': true },
    });
  });
});

describe('PATCH /users/me/feature-flags', () => {
  it('writes the new flag and returns the merged set', async () => {
    mock.user.findUnique.mockResolvedValue({ featureFlags: null });
    mock.user.update.mockImplementation(async (args: any) => ({
      id: 'u1', featureFlags: args.data.featureFlags,
    }));

    const res = await dispatch('patch', '/me/feature-flags', {
      'state-machine-new-renderer': true,
    });

    expect(res.body).toEqual({ data: { 'state-machine-new-renderer': true } });
    expect(mock.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'u1' },
      data: { featureFlags: { 'state-machine-new-renderer': true } },
    }));
  });

  it('merges with existing flags rather than replacing them', async () => {
    mock.user.findUnique.mockResolvedValue({
      featureFlags: { 'state-machine-new-renderer': true },
    });
    mock.user.update.mockImplementation(async (args: any) => ({
      id: 'u1', featureFlags: args.data.featureFlags,
    }));

    const res = await dispatch('patch', '/me/feature-flags', {
      'requirement-new-renderer': false,
    });

    expect((res.body as any).data).toEqual({
      'state-machine-new-renderer': true,
      'requirement-new-renderer': false,
    });
  });

  it('deletes the key when value is null', async () => {
    mock.user.findUnique.mockResolvedValue({
      featureFlags: { 'state-machine-new-renderer': true },
    });
    mock.user.update.mockImplementation(async (args: any) => ({
      id: 'u1', featureFlags: args.data.featureFlags,
    }));

    const res = await dispatch('patch', '/me/feature-flags', {
      'state-machine-new-renderer': null,
    });

    expect((res.body as any).data).toEqual({});
    const writtenFlags = mock.user.update.mock.calls[0][0].data.featureFlags;
    expect(writtenFlags).not.toHaveProperty('state-machine-new-renderer');
  });

  it('rejects unknown flag key with ZodError (handler throws, error middleware turns into 400)', async () => {
    mock.user.findUnique.mockResolvedValue({ featureFlags: null });
    await expect(dispatch('patch', '/me/feature-flags', {
      'pixel-doubler': true,
    })).rejects.toBeDefined();
    expect(mock.user.update).not.toHaveBeenCalled();
  });
});
