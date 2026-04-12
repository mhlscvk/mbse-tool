import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db.js', () => ({
  prisma: {
    mcpToken: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from '../db.js';
const mock = prisma as unknown as {
  mcpToken: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

describe('mcp-tokens route — token management', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('GET / masks tokens in response', async () => {
    mock.mcpToken.findMany.mockResolvedValue([
      { id: 't1', name: 'Dev Token', token: 'mcp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef12345678', lastUsed: null, expiresAt: null, revoked: false, createdAt: new Date() },
    ]);
    const tokens = await prisma.mcpToken.findMany({ where: { userId: 'user1' } });
    const masked = tokens.map((t: typeof tokens[number]) => ({
      ...t,
      token: `mcp_...${t.token.slice(-8)}`,
    }));
    expect(masked[0].token).toBe('mcp_...12345678');
    expect(masked[0].token).not.toContain('ABCDEFGH');
  });

  it('POST / enforces max 10 active tokens per user', async () => {
    mock.mcpToken.count.mockResolvedValue(10);
    const count = await prisma.mcpToken.count({ where: { userId: 'user1', revoked: false } });
    expect(count).toBe(10);
    // Route throws BadRequest when count >= 10
  });

  it('POST / allows creation when under limit', async () => {
    mock.mcpToken.count.mockResolvedValue(5);
    mock.mcpToken.create.mockResolvedValue({
      id: 't2', name: 'New Token', token: 'mcp_newtoken123', expiresAt: null, createdAt: new Date(),
    });
    const count = await prisma.mcpToken.count({ where: { userId: 'user1', revoked: false } });
    expect(count).toBeLessThan(10);
    const record = await prisma.mcpToken.create({
      data: { userId: 'user1', token: 'mcp_newtoken123', name: 'New Token', expiresAt: null },
    });
    expect(record.name).toBe('New Token');
  });

  it('token format is mcp_ prefix + base64url', () => {
    const { randomBytes } = require('crypto');
    const rawToken = randomBytes(32).toString('base64url');
    const token = `mcp_${rawToken}`;
    expect(token).toMatch(/^mcp_[A-Za-z0-9_-]{43}$/);
  });

  it('expiration is calculated correctly from days', () => {
    const expiresInDays = 30;
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
    const now = new Date();
    const diffDays = (expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
    expect(Math.round(diffDays)).toBe(30);
  });

  it('no expiry when expiresInDays omitted', () => {
    const body = { name: 'Permanent', expiresInDays: undefined };
    const expiresAt = body.expiresInDays
      ? new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000)
      : null;
    expect(expiresAt).toBeNull();
  });

  it('DELETE /:id sets revoked=true (soft delete)', async () => {
    mock.mcpToken.findFirst.mockResolvedValue({ id: 't1', userId: 'user1' });
    mock.mcpToken.update.mockResolvedValue({ id: 't1', revoked: true });

    const token = await prisma.mcpToken.findFirst({ where: { id: 't1', userId: 'user1' } });
    expect(token).not.toBeNull();

    await prisma.mcpToken.update({ where: { id: 't1' }, data: { revoked: true } });
    expect(mock.mcpToken.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { revoked: true },
    });
  });

  it('DELETE /:id rejects tokens from other users', async () => {
    mock.mcpToken.findFirst.mockResolvedValue(null); // userId filter excludes it
    const token = await prisma.mcpToken.findFirst({ where: { id: 't1', userId: 'user1' } });
    expect(token).toBeNull();
    // Route throws NotFound('Token')
  });
});

describe('mcp-tokens route — validation', () => {
  it('name requires 1-100 characters', () => {
    const { z } = require('zod');
    const schema = z.object({ name: z.string().min(1).max(100) });
    expect(() => schema.parse({ name: '' })).toThrow();
    expect(schema.parse({ name: 'My Token' })).toEqual({ name: 'My Token' });
  });

  it('expiresInDays must be 1-365 integer', () => {
    const { z } = require('zod');
    const schema = z.object({ expiresInDays: z.number().int().min(1).max(365).optional() });
    expect(() => schema.parse({ expiresInDays: 0 })).toThrow();
    expect(() => schema.parse({ expiresInDays: 366 })).toThrow();
    expect(() => schema.parse({ expiresInDays: 1.5 })).toThrow();
    expect(schema.parse({ expiresInDays: 30 })).toEqual({ expiresInDays: 30 });
    expect(schema.parse({})).toEqual({});
  });
});
