import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db.js', () => ({
  prisma: {
    elementLock: { findUnique: vi.fn() },
    sysMLFile: { findUnique: vi.fn() },
    lockNotification: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('../lib/id-generator.js', () => ({
  generateNotificationDisplayId: vi.fn(() => 'NTF-TEST1'),
}));

import { prisma } from '../db.js';
import {
  createLockNotification,
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadCount,
} from './notification-ops.js';

const mock = prisma as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createLockNotification', () => {
  it('creates a notification for the lock holder', async () => {
    mock.elementLock.findUnique.mockResolvedValue({ lockedBy: 'holder1' });
    mock.sysMLFile.findUnique.mockResolvedValue({
      id: 'f1', name: 'Vehicle.sysml',
      project: { id: 'p1', name: 'MyProject' },
    });
    mock.lockNotification.create.mockResolvedValue({
      id: 'n1', displayId: 'NTF-TEST1', elementName: 'Engine',
      holderId: 'holder1', requesterId: 'req1',
      requester: { id: 'req1', name: 'Alice', email: 'alice@test.com' },
      holder: { id: 'holder1', name: 'Bob', email: 'bob@test.com' },
    });

    const result = await createLockNotification('Engine', 'f1', 'req1');
    expect(result.displayId).toBe('NTF-TEST1');
    expect(mock.lockNotification.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        holderId: 'holder1',
        requesterId: 'req1',
        elementName: 'Engine',
        projectName: 'MyProject',
        fileName: 'Vehicle.sysml',
      }),
    }));
  });

  it('throws when element is not locked', async () => {
    mock.elementLock.findUnique.mockResolvedValue(null);
    await expect(createLockNotification('Engine', 'f1', 'req1')).rejects.toThrow('not found');
  });

  it('throws when file not found', async () => {
    mock.elementLock.findUnique.mockResolvedValue({ lockedBy: 'holder1' });
    mock.sysMLFile.findUnique.mockResolvedValue(null);
    await expect(createLockNotification('Engine', 'f1', 'req1')).rejects.toThrow('not found');
  });
});

describe('listNotifications', () => {
  it('lists all notifications for a user', async () => {
    mock.lockNotification.findMany.mockResolvedValue([{ id: 'n1' }, { id: 'n2' }]);
    const result = await listNotifications('u1');
    expect(result).toHaveLength(2);
    expect(mock.lockNotification.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { holderId: 'u1' },
    }));
  });

  it('filters to unread only when requested', async () => {
    mock.lockNotification.findMany.mockResolvedValue([]);
    await listNotifications('u1', true);
    expect(mock.lockNotification.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { holderId: 'u1', read: false },
    }));
  });
});

describe('markNotificationRead', () => {
  it('marks notification as read', async () => {
    mock.lockNotification.findUnique.mockResolvedValue({ id: 'n1', holderId: 'u1' });
    mock.lockNotification.update.mockResolvedValue({ id: 'n1', read: true });
    const result = await markNotificationRead('n1', 'u1');
    expect(result.read).toBe(true);
  });

  it('throws when notification not found', async () => {
    mock.lockNotification.findUnique.mockResolvedValue(null);
    await expect(markNotificationRead('n1', 'u1')).rejects.toThrow('not found');
  });

  it('throws when user is not the holder', async () => {
    mock.lockNotification.findUnique.mockResolvedValue({ id: 'n1', holderId: 'u2' });
    await expect(markNotificationRead('n1', 'u1')).rejects.toThrow('not found');
  });
});

describe('markAllNotificationsRead', () => {
  it('updates all unread notifications for user', async () => {
    mock.lockNotification.updateMany.mockResolvedValue({ count: 5 });
    await markAllNotificationsRead('u1');
    expect(mock.lockNotification.updateMany).toHaveBeenCalledWith({
      where: { holderId: 'u1', read: false },
      data: { read: true },
    });
  });
});

describe('getUnreadCount', () => {
  it('returns count of unread notifications', async () => {
    mock.lockNotification.count.mockResolvedValue(3);
    const count = await getUnreadCount('u1');
    expect(count).toBe(3);
  });
});
