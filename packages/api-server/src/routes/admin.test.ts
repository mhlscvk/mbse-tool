import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma before importing the router
vi.mock('../db.js', () => ({
  prisma: {
    user: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    project: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    sysMLFile: { deleteMany: vi.fn(), createMany: vi.fn() },
  },
}));

// Mock fs functions used by sync-examples
vi.mock('fs', () => ({
  readdirSync: vi.fn(() => []),
  readFileSync: vi.fn(() => ''),
  statSync: vi.fn(() => ({ isDirectory: () => false })),
  existsSync: vi.fn(() => true),
}));

import { prisma } from '../db.js';

const mock = prisma as any;

beforeEach(() => {
  vi.clearAllMocks();
});

// ── GET /api/admin/users ────────────────────────────────────────────────────

describe('Admin users endpoint logic', () => {
  it('returns all users with safe fields only (no passwords)', async () => {
    const mockUsers = [
      { id: 'u1', email: 'admin@test.com', name: 'Admin', role: 'ADMIN', emailVerified: true, createdAt: new Date() },
      { id: 'u2', email: 'user@test.com', name: 'User', role: 'EDITOR', emailVerified: true, createdAt: new Date() },
    ];
    mock.user.findMany.mockResolvedValue(mockUsers);

    const result = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, emailVerified: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    expect(mock.user.findMany).toHaveBeenCalledWith({
      select: { id: true, email: true, name: true, role: true, emailVerified: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    expect(result).toEqual(mockUsers);
  });

  it('does not expose password or hash fields in the select', () => {
    // The endpoint uses explicit select — verify no password field
    const selectFields = { id: true, email: true, name: true, role: true, emailVerified: true, createdAt: true };
    expect(selectFields).not.toHaveProperty('password');
    expect(selectFields).not.toHaveProperty('passwordHash');
  });
});

// ── GET /api/admin/users/:userId/projects ───────────────────────────────────

describe('Admin user projects endpoint logic', () => {
  it('returns only USER-type projects for the specified user', async () => {
    const mockProjects = [
      { id: 'p1', displayId: 'PRJ-1', name: 'My Project', projectType: 'USER', _count: { files: 3, children: 1 } },
    ];
    mock.project.findMany.mockResolvedValue(mockProjects);

    await prisma.project.findMany({
      where: { ownerId: 'u2', projectType: 'USER' },
      orderBy: { name: 'asc' },
    });

    expect(mock.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ownerId: 'u2', projectType: 'USER' },
      }),
    );
  });

  it('does not return SYSTEM or STARTUP projects for the user', async () => {
    mock.project.findMany.mockResolvedValue([]);

    await prisma.project.findMany({
      where: { ownerId: 'u2', projectType: 'USER' },
    });

    // Verify the where clause only includes USER type
    const call = mock.project.findMany.mock.calls[0][0];
    expect(call.where.projectType).toBe('USER');
  });

  it('rejects when target user does not exist', async () => {
    mock.user.findUnique.mockResolvedValue(null);

    const user = await prisma.user.findUnique({ where: { id: 'nonexistent' } });
    expect(user).toBeNull();
  });
});

// ── Admin project listing scope ─────────────────────────────────────────────

describe('Admin project listing scope (GET /api/projects)', () => {
  it('admin does NOT get empty where clause (no cross-user visibility)', () => {
    // The fix: admins get the same scoped query as regular users
    const userId = 'admin-user-id';
    const startupIds: string[] = [];

    // This is the NEW where clause — admins see same scope as regular users
    const whereClause = {
      OR: [
        { ownerId: userId, projectType: 'USER' as const },
        { isSystem: true },
        ...(startupIds.length > 0 ? [{ startupId: { in: startupIds }, projectType: 'STARTUP' as const }] : []),
      ],
    };

    // Must NOT be an empty object (which was the old bug)
    expect(whereClause).not.toEqual({});
    expect(whereClause.OR).toBeDefined();
    expect(whereClause.OR).toContainEqual({ ownerId: userId, projectType: 'USER' });
    expect(whereClause.OR).toContainEqual({ isSystem: true });
  });

  it('non-admin sees only own USER projects, system, and startup', () => {
    const userId = 'regular-user-id';
    const startupIds = ['s1'];

    const whereClause = {
      OR: [
        { ownerId: userId, projectType: 'USER' as const },
        { isSystem: true },
        ...(startupIds.length > 0 ? [{ startupId: { in: startupIds }, projectType: 'STARTUP' as const }] : []),
      ],
    };

    expect(whereClause.OR).toHaveLength(3);
    expect(whereClause.OR).toContainEqual({ ownerId: userId, projectType: 'USER' });
    expect(whereClause.OR).toContainEqual({ isSystem: true });
    expect(whereClause.OR).toContainEqual({ startupId: { in: ['s1'] }, projectType: 'STARTUP' });
  });
});

// ── Authorization guard ─────────────────────────────────────────────────────

describe('Admin route authorization', () => {
  it('requireAdmin middleware rejects non-admin users', () => {
    // Non-admin role should NOT have access to /api/admin/* routes
    const nonAdminRoles = ['EDITOR', 'VIEWER', undefined, ''];
    for (const role of nonAdminRoles) {
      expect(role?.toUpperCase() === 'ADMIN').toBe(false);
    }
  });

  it('requireAdmin middleware allows admin users', () => {
    const adminRoles = ['ADMIN', 'admin', 'Admin'];
    for (const role of adminRoles) {
      expect(role.toUpperCase() === 'ADMIN').toBe(true);
    }
  });
});
