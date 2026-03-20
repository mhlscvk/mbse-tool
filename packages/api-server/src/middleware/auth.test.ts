import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { requireAuth, requireAdmin, type AuthRequest } from './auth.js';

const JWT_SECRET = 'test-secret-for-unit-tests';

function mockReqRes(headers: Record<string, string> = {}) {
  const req = { headers, userId: undefined, userRole: undefined } as unknown as AuthRequest;
  const res = {
    statusCode: 200,
    body: null as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(data: unknown) { this.body = data; return this; },
  } as unknown as import('express').Response;
  const next = vi.fn();
  return { req, res, next };
}

describe('requireAuth middleware', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = JWT_SECRET;
  });

  it('rejects request with no Authorization header', () => {
    const { req, res, next } = mockReqRes();
    requireAuth(req, res, next);
    expect((res as any).statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects request with non-Bearer token', () => {
    const { req, res, next } = mockReqRes({ authorization: 'Basic abc123' });
    requireAuth(req, res, next);
    expect((res as any).statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects request with invalid JWT', () => {
    const { req, res, next } = mockReqRes({ authorization: 'Bearer invalid.jwt.token' });
    requireAuth(req, res, next);
    expect((res as any).statusCode).toBe(401);
    expect((res as any).body.message).toBe('Invalid or expired token');
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects request with expired JWT', () => {
    const token = jwt.sign({ userId: 'u1', role: 'editor' }, JWT_SECRET, { expiresIn: '-1s', algorithm: 'HS256' });
    const { req, res, next } = mockReqRes({ authorization: `Bearer ${token}` });
    requireAuth(req, res, next);
    expect((res as any).statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects JWT signed with wrong secret', () => {
    const token = jwt.sign({ userId: 'u1', role: 'editor' }, 'wrong-secret', { algorithm: 'HS256' });
    const { req, res, next } = mockReqRes({ authorization: `Bearer ${token}` });
    requireAuth(req, res, next);
    expect((res as any).statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts valid JWT and sets userId/userRole', () => {
    const token = jwt.sign({ userId: 'user123', role: 'editor' }, JWT_SECRET, { algorithm: 'HS256' });
    const { req, res, next } = mockReqRes({ authorization: `Bearer ${token}` });
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.userId).toBe('user123');
    expect(req.userRole).toBe('editor');
  });

  it('accepts admin role JWT', () => {
    const token = jwt.sign({ userId: 'admin1', role: 'admin' }, JWT_SECRET, { algorithm: 'HS256' });
    const { req, res, next } = mockReqRes({ authorization: `Bearer ${token}` });
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.userRole).toBe('admin');
  });
});

describe('requireAdmin middleware', () => {
  it('allows admin users', () => {
    const req = { userRole: 'ADMIN' } as AuthRequest;
    const { res, next } = mockReqRes();
    requireAdmin(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('allows lowercase admin role', () => {
    const req = { userRole: 'admin' } as AuthRequest;
    const { res, next } = mockReqRes();
    requireAdmin(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('rejects editor users', () => {
    const req = { userRole: 'editor' } as AuthRequest;
    const { res, next } = mockReqRes();
    requireAdmin(req, res, next);
    expect((res as any).statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects viewer users', () => {
    const req = { userRole: 'viewer' } as AuthRequest;
    const { res, next } = mockReqRes();
    requireAdmin(req, res, next);
    expect((res as any).statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects undefined role', () => {
    const req = { userRole: undefined } as AuthRequest;
    const { res, next } = mockReqRes();
    requireAdmin(req, res, next);
    expect((res as any).statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });
});
