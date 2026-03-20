import { describe, it, expect, vi } from 'vitest';
import { errorHandler, type AppError } from './error.js';

function mockRes() {
  const res = {
    statusCode: 200,
    body: null as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(data: unknown) { this.body = data; return this; },
  };
  return res as unknown as import('express').Response;
}

const mockReq = {} as import('express').Request;
const mockNext = vi.fn();

describe('errorHandler middleware', () => {
  it('returns 400 for ZodError', () => {
    const err = new Error('Validation failed') as AppError;
    err.name = 'ZodError';
    const res = mockRes();
    errorHandler(err, mockReq, res, mockNext);
    expect((res as any).statusCode).toBe(400);
    expect((res as any).body.error).toBe('ValidationError');
  });

  it('returns 500 with generic message for unknown errors', () => {
    const err = new Error('DB connection failed') as AppError;
    const res = mockRes();
    errorHandler(err, mockReq, res, mockNext);
    expect((res as any).statusCode).toBe(500);
    expect((res as any).body.message).toBe('Internal server error');
    // Should NOT leak internal error details
    expect((res as any).body.message).not.toContain('DB connection');
  });

  it('returns custom status code for AppError', () => {
    const err = new Error('Not found') as AppError;
    err.statusCode = 404;
    const res = mockRes();
    errorHandler(err, mockReq, res, mockNext);
    expect((res as any).statusCode).toBe(404);
    expect((res as any).body.message).toBe('Not found');
  });

  it('returns generic message for 500+ errors even with custom message', () => {
    const err = new Error('Prisma query failed: SELECT * FROM users') as AppError;
    err.statusCode = 502;
    const res = mockRes();
    errorHandler(err, mockReq, res, mockNext);
    expect((res as any).statusCode).toBe(502);
    expect((res as any).body.message).toBe('Internal server error');
    // Should NOT leak Prisma query details
    expect((res as any).body.message).not.toContain('Prisma');
  });
});
