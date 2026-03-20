import { describe, it, expect } from 'vitest';

// Test the CSRF protection logic as a pure function (mirrors the middleware in index.ts)
function shouldBlockRequest(method: string, contentType: string | undefined, path: string): boolean {
  if (path.startsWith('/mcp')) return false;
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const ct = contentType ?? '';
    if (method === 'DELETE' && !ct) return false;
    if (!ct.includes('application/json') && !ct.includes('text/event-stream')) {
      return true;
    }
  }
  return false;
}

describe('CSRF Content-Type enforcement', () => {
  it('allows GET requests without Content-Type', () => {
    expect(shouldBlockRequest('GET', undefined, '/api/projects')).toBe(false);
  });

  it('allows POST with application/json', () => {
    expect(shouldBlockRequest('POST', 'application/json', '/api/projects')).toBe(false);
  });

  it('allows POST with application/json; charset=utf-8', () => {
    expect(shouldBlockRequest('POST', 'application/json; charset=utf-8', '/api/projects')).toBe(false);
  });

  it('blocks POST with application/x-www-form-urlencoded (CSRF vector)', () => {
    expect(shouldBlockRequest('POST', 'application/x-www-form-urlencoded', '/api/auth/login')).toBe(true);
  });

  it('blocks POST with multipart/form-data (CSRF vector)', () => {
    expect(shouldBlockRequest('POST', 'multipart/form-data', '/api/projects')).toBe(true);
  });

  it('blocks POST with text/plain (CSRF vector)', () => {
    expect(shouldBlockRequest('POST', 'text/plain', '/api/projects')).toBe(true);
  });

  it('blocks PUT with no Content-Type', () => {
    expect(shouldBlockRequest('PUT', undefined, '/api/projects/1')).toBe(true);
  });

  it('blocks PATCH with wrong Content-Type', () => {
    expect(shouldBlockRequest('PATCH', 'text/html', '/api/projects/1')).toBe(true);
  });

  it('allows DELETE with no Content-Type (no body expected)', () => {
    expect(shouldBlockRequest('DELETE', undefined, '/api/projects/1')).toBe(false);
  });

  it('allows DELETE with application/json Content-Type', () => {
    expect(shouldBlockRequest('DELETE', 'application/json', '/api/projects/1')).toBe(false);
  });

  it('blocks DELETE with form Content-Type', () => {
    expect(shouldBlockRequest('DELETE', 'application/x-www-form-urlencoded', '/api/projects/1')).toBe(true);
  });

  it('allows POST to /mcp (MCP has own auth)', () => {
    expect(shouldBlockRequest('POST', 'application/x-www-form-urlencoded', '/mcp')).toBe(false);
  });

  it('allows text/event-stream for SSE endpoints', () => {
    expect(shouldBlockRequest('POST', 'text/event-stream', '/api/ai/chat')).toBe(false);
  });
});
