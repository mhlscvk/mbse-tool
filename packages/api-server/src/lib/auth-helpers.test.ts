import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db.js', () => ({
  prisma: {
    project: { findUnique: vi.fn() },
    startupMember: { findUnique: vi.fn() },
  },
}));

import { prisma } from '../db.js';
import { isAdmin, assertProjectAccess, assertWriteAccess, type ProjectAccess } from './auth-helpers.js';

const mock = prisma as any;

beforeEach(() => {
  vi.clearAllMocks();
});

// ── isAdmin ─────────────────────────────────────────────────────────────────

describe('isAdmin', () => {
  it('returns true for ADMIN', () => {
    expect(isAdmin('ADMIN')).toBe(true);
  });

  it('returns true for admin (case-insensitive)', () => {
    expect(isAdmin('admin')).toBe(true);
  });

  it('returns false for EDITOR', () => {
    expect(isAdmin('EDITOR')).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isAdmin(undefined)).toBe(false);
  });
});

// ── assertProjectAccess ─────────────────────────────────────────────────────

describe('assertProjectAccess', () => {
  it('returns allowed:false when project not found', async () => {
    mock.project.findUnique.mockResolvedValue(null);
    const result = await assertProjectAccess('proj1', 'user1');
    expect(result.allowed).toBe(false);
  });

  it('allows any user to access system projects', async () => {
    mock.project.findUnique.mockResolvedValue({ id: 'p1', isSystem: true });
    const result = await assertProjectAccess('p1', 'user1');
    expect(result).toEqual({ allowed: true, isSystem: true, isAdmin: false });
  });

  it('sets isAdmin for admin user on system project', async () => {
    mock.project.findUnique.mockResolvedValue({ id: 'p1', isSystem: true });
    const result = await assertProjectAccess('p1', 'user1', 'ADMIN');
    expect(result.isAdmin).toBe(true);
  });

  it('allows USER project owner', async () => {
    mock.project.findUnique.mockResolvedValue({ id: 'p1', isSystem: false, projectType: 'USER', ownerId: 'user1' });
    const result = await assertProjectAccess('p1', 'user1');
    expect(result.allowed).toBe(true);
  });

  it('denies non-owner on USER project', async () => {
    mock.project.findUnique.mockResolvedValue({ id: 'p1', isSystem: false, projectType: 'USER', ownerId: 'other' });
    const result = await assertProjectAccess('p1', 'user1');
    expect(result.allowed).toBe(false);
  });

  it('allows site admin on USER project they do not own', async () => {
    mock.project.findUnique.mockResolvedValue({ id: 'p1', isSystem: false, projectType: 'USER', ownerId: 'other' });
    const result = await assertProjectAccess('p1', 'user1', 'ADMIN');
    expect(result.allowed).toBe(true);
    expect(result.isAdmin).toBe(true);
  });

  it('allows site admin on STARTUP project with SITE_ADMIN role', async () => {
    mock.project.findUnique.mockResolvedValue({ id: 'p1', isSystem: false, projectType: 'STARTUP', startupId: 's1', ownerId: 'other' });
    const result = await assertProjectAccess('p1', 'user1', 'ADMIN');
    expect(result).toEqual({ allowed: true, isSystem: false, isAdmin: true, startupRole: 'SITE_ADMIN' });
  });

  it('allows startup member on STARTUP project', async () => {
    mock.project.findUnique.mockResolvedValue({ id: 'p1', isSystem: false, projectType: 'STARTUP', startupId: 's1', ownerId: 'other' });
    mock.startupMember.findUnique.mockResolvedValue({ role: 'STARTUP_USER' });
    const result = await assertProjectAccess('p1', 'user1');
    expect(result).toEqual({ allowed: true, isSystem: false, isAdmin: false, startupRole: 'STARTUP_USER' });
  });

  it('denies non-member on STARTUP project', async () => {
    mock.project.findUnique.mockResolvedValue({ id: 'p1', isSystem: false, projectType: 'STARTUP', startupId: 's1', ownerId: 'other' });
    mock.startupMember.findUnique.mockResolvedValue(null);
    const result = await assertProjectAccess('p1', 'user1');
    expect(result.allowed).toBe(false);
  });

  it('falls back to owner check for unknown project types', async () => {
    mock.project.findUnique.mockResolvedValue({ id: 'p1', isSystem: false, projectType: 'UNKNOWN', ownerId: 'user1' });
    const result = await assertProjectAccess('p1', 'user1');
    expect(result.allowed).toBe(true);
  });

  it('denies non-owner for unknown project types', async () => {
    mock.project.findUnique.mockResolvedValue({ id: 'p1', isSystem: false, projectType: 'UNKNOWN', ownerId: 'other' });
    const result = await assertProjectAccess('p1', 'user1');
    expect(result.allowed).toBe(false);
  });
});

// ── assertWriteAccess ───────────────────────────────────────────────────────

describe('assertWriteAccess', () => {
  it('throws NotFound when access is not allowed', () => {
    const access: ProjectAccess = { allowed: false, isSystem: false, isAdmin: false };
    expect(() => assertWriteAccess(access)).toThrow('not found');
  });

  it('throws Forbidden for system project when user is not admin', () => {
    const access: ProjectAccess = { allowed: true, isSystem: true, isAdmin: false };
    expect(() => assertWriteAccess(access)).toThrow('read-only');
  });

  it('does not throw for allowed non-system access', () => {
    const access: ProjectAccess = { allowed: true, isSystem: false, isAdmin: false };
    expect(() => assertWriteAccess(access)).not.toThrow();
  });

  it('does not throw for system project when user is admin', () => {
    const access: ProjectAccess = { allowed: true, isSystem: true, isAdmin: true };
    expect(() => assertWriteAccess(access)).not.toThrow();
  });
});
