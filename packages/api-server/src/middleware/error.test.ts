import { describe, it, expect, vi } from 'vitest';
import { errorHandler } from './error.js';
import { AppError } from '../lib/errors.js';

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
    const err = new Error('Validation failed');
    err.name = 'ZodError';
    const res = mockRes();
    errorHandler(err, mockReq, res, mockNext);
    expect((res as any).statusCode).toBe(400);
    expect((res as any).body.error).toBe('ValidationError');
  });

  it('returns 500 with generic message for unknown errors', () => {
    const err = new Error('DB connection failed');
    const res = mockRes();
    errorHandler(err, mockReq, res, mockNext);
    expect((res as any).statusCode).toBe(500);
    expect((res as any).body.message).toBe('Internal server error');
    expect((res as any).body.message).not.toContain('DB connection');
  });

  it('returns correct status for AppError', () => {
    const err = new AppError(404, 'Not Found', 'Project not found');
    const res = mockRes();
    errorHandler(err, mockReq, res, mockNext);
    expect((res as any).statusCode).toBe(404);
    expect((res as any).body.message).toBe('Project not found');
    expect((res as any).body.error).toBe('Not Found');
  });

  it('returns generic message for 500+ errors even with custom message', () => {
    const err = new Error('Prisma query failed: SELECT * FROM users') as Error & { statusCode?: number };
    err.statusCode = 502;
    const res = mockRes();
    errorHandler(err, mockReq, res, mockNext);
    expect((res as any).statusCode).toBe(502);
    expect((res as any).body.message).toBe('Internal server error');
    expect((res as any).body.message).not.toContain('Prisma');
  });
});
