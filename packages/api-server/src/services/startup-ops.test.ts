import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db.js', () => ({
  prisma: {
    startup: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    startupMember: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    user: { findUnique: vi.fn() },
  },
}));

vi.mock('../lib/id-generator.js', () => ({
  generateStartupId: vi.fn((_name: string, seq: number) => `ENT-TEST-${String(seq).padStart(3, '0')}`),
}));

import { prisma } from '../db.js';
import {
  createStartup,
  getStartup,
  listStartups,
  listUserStartups,
  updateStartup,
  deleteStartup,
  addMember,
  updateMemberRole,
  removeMember,
  listMembers,
  assertStartupAccess,
  assertStartupWriteAccess,
} from './startup-ops.js';

const mock = prisma as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createStartup', () => {
  it('creates startup and adds creator as STARTUP_ADMIN', async () => {
    mock.startup.findUnique.mockResolvedValue(null);
    mock.startup.count.mockResolvedValue(0);
    mock.startup.create.mockResolvedValue({ id: 'ENT-TEST-001', name: 'Test', slug: 'test' });
    mock.startupMember.create.mockResolvedValue({});

    const result = await createStartup('Test', 'test', 'user1');
    expect(result.id).toBe('ENT-TEST-001');
    expect(mock.startupMember.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'user1', role: 'STARTUP_ADMIN' }),
    }));
  });

  it('throws when slug already exists', async () => {
    mock.startup.findUnique.mockResolvedValue({ id: 'existing' });
    await expect(createStartup('Test', 'test', 'user1')).rejects.toThrow('already exists');
  });
});

describe('getStartup', () => {
  it('returns startup with counts', async () => {
    mock.startup.findUnique.mockResolvedValue({ id: 's1', name: 'Test', _count: { members: 3, projects: 2 } });
    const result = await getStartup('s1');
    expect(result.name).toBe('Test');
  });

  it('throws when not found', async () => {
    mock.startup.findUnique.mockResolvedValue(null);
    await expect(getStartup('s1')).rejects.toThrow('not found');
  });
});

describe('updateStartup', () => {
  it('updates startup fields', async () => {
    mock.startup.findUnique.mockResolvedValue({ id: 's1' });
    mock.startup.update.mockResolvedValue({ id: 's1', name: 'Updated' });
    const result = await updateStartup('s1', { name: 'Updated' });
    expect(result.name).toBe('Updated');
  });

  it('throws when slug conflicts with another startup', async () => {
    mock.startup.findUnique
      .mockResolvedValueOnce({ id: 's1' }) // first call: check exists
      .mockResolvedValueOnce({ id: 's2' }); // second call: slug conflict
    await expect(updateStartup('s1', { slug: 'taken' })).rejects.toThrow('already in use');
  });

  it('allows keeping the same slug', async () => {
    mock.startup.findUnique
      .mockResolvedValueOnce({ id: 's1' })
      .mockResolvedValueOnce({ id: 's1' }); // same startup
    mock.startup.update.mockResolvedValue({ id: 's1' });
    await expect(updateStartup('s1', { slug: 'same' })).resolves.toBeDefined();
  });
});

describe('deleteStartup', () => {
  it('deletes the startup', async () => {
    mock.startup.findUnique.mockResolvedValue({ id: 's1' });
    mock.startup.delete.mockResolvedValue({});
    await expect(deleteStartup('s1')).resolves.not.toThrow();
  });

  it('throws when not found', async () => {
    mock.startup.findUnique.mockResolvedValue(null);
    await expect(deleteStartup('s1')).rejects.toThrow('not found');
  });
});

describe('addMember', () => {
  it('adds a user as member', async () => {
    mock.startup.findUnique.mockResolvedValue({ id: 's1' });
    mock.user.findUnique.mockResolvedValue({ id: 'u1' });
    mock.startupMember.findUnique.mockResolvedValue(null);
    mock.startupMember.create.mockResolvedValue({ startupId: 's1', userId: 'u1', role: 'STARTUP_USER' });

    const result = await addMember('s1', 'u1', 'STARTUP_USER');
    expect(result.role).toBe('STARTUP_USER');
  });

  it('throws when user already a member', async () => {
    mock.startup.findUnique.mockResolvedValue({ id: 's1' });
    mock.user.findUnique.mockResolvedValue({ id: 'u1' });
    mock.startupMember.findUnique.mockResolvedValue({ id: 'existing' });
    await expect(addMember('s1', 'u1', 'STARTUP_USER')).rejects.toThrow('already a member');
  });

  it('throws when user not found', async () => {
    mock.startup.findUnique.mockResolvedValue({ id: 's1' });
    mock.user.findUnique.mockResolvedValue(null);
    await expect(addMember('s1', 'u1', 'STARTUP_USER')).rejects.toThrow('not found');
  });
});

describe('updateMemberRole', () => {
  it('updates member role', async () => {
    mock.startupMember.findUnique.mockResolvedValue({ startupId: 's1', userId: 'u1' });
    mock.startupMember.update.mockResolvedValue({ role: 'STARTUP_ADMIN' });
    const result = await updateMemberRole('s1', 'u1', 'STARTUP_ADMIN');
    expect(result.role).toBe('STARTUP_ADMIN');
  });

  it('throws when member not found', async () => {
    mock.startupMember.findUnique.mockResolvedValue(null);
    await expect(updateMemberRole('s1', 'u1', 'STARTUP_ADMIN')).rejects.toThrow('not found');
  });
});

describe('removeMember', () => {
  it('removes member', async () => {
    mock.startupMember.findUnique.mockResolvedValue({ startupId: 's1', userId: 'u1' });
    mock.startupMember.delete.mockResolvedValue({});
    await expect(removeMember('s1', 'u1')).resolves.not.toThrow();
  });

  it('throws when member not found', async () => {
    mock.startupMember.findUnique.mockResolvedValue(null);
    await expect(removeMember('s1', 'u1')).rejects.toThrow('not found');
  });
});

describe('assertStartupAccess', () => {
  it('grants access for site admin', async () => {
    const result = await assertStartupAccess('s1', 'u1', 'ADMIN');
    expect(result.allowed).toBe(true);
    expect(result.isSiteAdmin).toBe(true);
  });

  it('grants access for startup member', async () => {
    mock.startupMember.findUnique.mockResolvedValue({ role: 'STARTUP_USER' });
    const result = await assertStartupAccess('s1', 'u1', 'EDITOR');
    expect(result.allowed).toBe(true);
    expect(result.memberRole).toBe('STARTUP_USER');
  });

  it('denies access for non-member', async () => {
    mock.startupMember.findUnique.mockResolvedValue(null);
    const result = await assertStartupAccess('s1', 'u1', 'EDITOR');
    expect(result.allowed).toBe(false);
  });
});

describe('assertStartupWriteAccess', () => {
  it('throws NotFound when not allowed', () => {
    expect(() => assertStartupWriteAccess({ allowed: false, memberRole: null, isSiteAdmin: false }))
      .toThrow('not found');
  });

  it('throws Forbidden for STARTUP_USER', () => {
    expect(() => assertStartupWriteAccess({ allowed: true, memberRole: 'STARTUP_USER', isSiteAdmin: false }))
      .toThrow('cannot modify');
  });

  it('allows STARTUP_ADMIN', () => {
    expect(() => assertStartupWriteAccess({ allowed: true, memberRole: 'STARTUP_ADMIN', isSiteAdmin: false }))
      .not.toThrow();
  });

  it('allows SITE_ADMIN', () => {
    expect(() => assertStartupWriteAccess({ allowed: true, memberRole: 'SITE_ADMIN', isSiteAdmin: true }))
      .not.toThrow();
  });
});
