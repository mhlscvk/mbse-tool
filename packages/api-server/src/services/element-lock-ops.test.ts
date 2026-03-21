import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db.js', () => ({
  prisma: {
    sysMLFile: { findUnique: vi.fn() },
    elementLock: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock('../lib/id-generator.js', () => ({
  generateElementDisplayId: vi.fn(() => 'ELM-TEST1'),
}));

import { prisma } from '../db.js';
import {
  checkOutElement,
  checkInElement,
  forceCheckIn,
  listFileLocks,
  getElementLockStatus,
} from './element-lock-ops.js';

const mock = prisma as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('checkOutElement', () => {
  const file = { id: 'f1', project: { id: 'p1', name: 'Test' } };
  const user = { id: 'u1', name: 'Alice', email: 'alice@test.com' };

  it('creates a lock when element is available', async () => {
    mock.sysMLFile.findUnique.mockResolvedValue(file);
    mock.elementLock.findUnique.mockResolvedValue(null);
    mock.elementLock.create.mockResolvedValue({
      id: 'lock1', displayId: 'ELM-TEST1', fileId: 'f1', elementName: 'Vehicle',
      lockedBy: 'u1', lockedAt: new Date(), user,
    });
    mock.auditLog.create.mockResolvedValue({});

    const result = await checkOutElement('f1', 'Vehicle', 'u1');
    expect(result.elementName).toBe('Vehicle');
    expect(result.displayId).toBe('ELM-TEST1');
    expect(mock.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ operation: 'CHECK_OUT', elementName: 'Vehicle' }),
    }));
  });

  it('throws when file not found', async () => {
    mock.sysMLFile.findUnique.mockResolvedValue(null);
    await expect(checkOutElement('f1', 'Vehicle', 'u1')).rejects.toThrow('not found');
  });

  it('throws when element already checked out by same user', async () => {
    mock.sysMLFile.findUnique.mockResolvedValue(file);
    mock.elementLock.findUnique.mockResolvedValue({ lockedBy: 'u1', user });
    await expect(checkOutElement('f1', 'Vehicle', 'u1')).rejects.toThrow('already');
  });

  it('throws when element checked out by another user', async () => {
    mock.sysMLFile.findUnique.mockResolvedValue(file);
    mock.elementLock.findUnique.mockResolvedValue({
      lockedBy: 'u2', user: { id: 'u2', name: 'Bob', email: 'bob@test.com' },
    });
    await expect(checkOutElement('f1', 'Vehicle', 'u1')).rejects.toThrow('Bob');
  });
});

describe('checkInElement', () => {
  it('deletes the lock and creates audit log', async () => {
    mock.sysMLFile.findUnique.mockResolvedValue({ id: 'f1', project: { id: 'p1' } });
    mock.elementLock.findUnique.mockResolvedValue({ fileId: 'f1', elementName: 'Engine', lockedBy: 'u1' });
    mock.elementLock.delete.mockResolvedValue({});
    mock.auditLog.create.mockResolvedValue({});

    const result = await checkInElement('f1', 'Engine', 'u1');
    expect(result.status).toBe('checked_in');
    expect(mock.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ operation: 'CHECK_IN' }),
    }));
  });

  it('throws when lock does not exist', async () => {
    mock.sysMLFile.findUnique.mockResolvedValue({ id: 'f1', project: { id: 'p1' } });
    mock.elementLock.findUnique.mockResolvedValue(null);
    await expect(checkInElement('f1', 'Engine', 'u1')).rejects.toThrow('not found');
  });

  it('throws when user does not own the lock', async () => {
    mock.sysMLFile.findUnique.mockResolvedValue({ id: 'f1', project: { id: 'p1' } });
    mock.elementLock.findUnique.mockResolvedValue({ fileId: 'f1', elementName: 'Engine', lockedBy: 'u2' });
    await expect(checkInElement('f1', 'Engine', 'u1')).rejects.toThrow('only check in');
  });
});

describe('forceCheckIn', () => {
  it('deletes lock regardless of owner and logs admin user', async () => {
    mock.sysMLFile.findUnique.mockResolvedValue({ id: 'f1', project: { id: 'p1' } });
    mock.elementLock.findUnique.mockResolvedValue({ fileId: 'f1', elementName: 'Engine', lockedBy: 'u2' });
    mock.elementLock.delete.mockResolvedValue({});
    mock.auditLog.create.mockResolvedValue({});

    const result = await forceCheckIn('f1', 'Engine', 'admin1');
    expect(result.status).toBe('force_checked_in');
    expect(mock.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'admin1', operation: 'CHECK_IN' }),
    }));
  });

  it('throws when no lock exists', async () => {
    mock.sysMLFile.findUnique.mockResolvedValue({ id: 'f1', project: { id: 'p1' } });
    mock.elementLock.findUnique.mockResolvedValue(null);
    await expect(forceCheckIn('f1', 'Engine', 'admin1')).rejects.toThrow('not found');
  });
});

describe('listFileLocks', () => {
  it('returns all locks for a file', async () => {
    const locks = [
      { id: 'l1', elementName: 'Vehicle', user: { id: 'u1', name: 'Alice' } },
      { id: 'l2', elementName: 'Engine', user: { id: 'u2', name: 'Bob' } },
    ];
    mock.elementLock.findMany.mockResolvedValue(locks);
    const result = await listFileLocks('f1');
    expect(result).toHaveLength(2);
    expect(mock.elementLock.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { fileId: 'f1' },
    }));
  });
});

describe('getElementLockStatus', () => {
  it('returns available when no lock', async () => {
    mock.elementLock.findUnique.mockResolvedValue(null);
    const result = await getElementLockStatus('f1', 'Vehicle');
    expect(result.status).toBe('available');
  });

  it('returns checked_out with user info when locked', async () => {
    mock.elementLock.findUnique.mockResolvedValue({
      displayId: 'ELM-ABC12',
      user: { id: 'u1', name: 'Alice', email: 'alice@test.com' },
      lockedAt: new Date('2026-03-21'),
    });
    const result = await getElementLockStatus('f1', 'Vehicle');
    expect(result.status).toBe('checked_out');
    expect(result.lockedBy).toEqual({ id: 'u1', name: 'Alice', email: 'alice@test.com' });
  });
});
