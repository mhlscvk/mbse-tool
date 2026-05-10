import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

// Mock prisma before importing the router
vi.mock('../db.js', () => ({
  prisma: {
    $queryRawUnsafe: vi.fn(),
  },
}));

import { prisma } from '../db.js';

// Import the router and extract handler functions
import router from './health.js';

// Extract route handlers from the Express router
function getHandler(method: string, path: string) {
  for (const layer of (router as any).stack) {
    if (layer.route?.path === path && layer.route?.methods[method]) {
      return layer.route.stack[0].handle;
    }
  }
  throw new Error(`No handler for ${method.toUpperCase()} ${path}`);
}

function mockRes() {
  const res = {
    statusCode: 200,
    body: null as unknown,
    status(code: number) { res.statusCode = code; return res; },
    json(data: unknown) { res.body = data; return res; },
  } as unknown as Response;
  return res;
}

describe('Health endpoints', () => {
  describe('GET /health', () => {
    it('returns status ok with service name, version, and uptime', () => {
      const handler = getHandler('get', '/health');
      const res = mockRes();
      handler({} as Request, res);
      expect((res as any).body).toMatchObject({
        status: 'ok',
        service: 'api-server',
      });
      expect((res as any).body.version).toBeDefined();
      expect(typeof (res as any).body.uptime_seconds).toBe('number');
    });
  });

  describe('GET /ready', () => {
    beforeEach(() => {
      vi.mocked(prisma.$queryRawUnsafe).mockReset();
    });

    it('returns 200 with checks.database=ok when DB is reachable', async () => {
      vi.mocked(prisma.$queryRawUnsafe).mockResolvedValue([{ '?column?': 1 }]);
      const handler = getHandler('get', '/ready');
      const res = mockRes();
      await handler({} as Request, res);
      expect((res as any).statusCode).toBe(200);
      expect((res as any).body.status).toBe('ok');
      expect((res as any).body.checks.database).toBe('ok');
    });

    it('returns 503 with checks.database=fail when DB is unreachable', async () => {
      vi.mocked(prisma.$queryRawUnsafe).mockRejectedValue(new Error('Connection refused'));
      const handler = getHandler('get', '/ready');
      const res = mockRes();
      await handler({} as Request, res);
      expect((res as any).statusCode).toBe(503);
      expect((res as any).body.status).toBe('degraded');
      expect((res as any).body.checks.database).toBe('fail');
    });
  });
});
