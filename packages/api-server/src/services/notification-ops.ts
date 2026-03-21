import { prisma } from '../db.js';
import { NotFound } from '../lib/errors.js';
import { generateNotificationDisplayId } from '../lib/id-generator.js';

export async function createLockNotification(
  elementName: string,
  fileId: string,
  requesterId: string,
) {
  // Find the lock holder
  const lock = await prisma.elementLock.findUnique({
    where: { fileId_elementName: { fileId, elementName } },
  });
  if (!lock) throw NotFound('Element lock');

  // Get file and project info
  const file = await prisma.sysMLFile.findUnique({
    where: { id: fileId },
    include: { project: { select: { id: true, name: true } } },
  });
  if (!file) throw NotFound('File');

  const displayId = generateNotificationDisplayId();

  return prisma.lockNotification.create({
    data: {
      displayId,
      elementName,
      projectId: file.project.id,
      projectName: file.project.name,
      fileId,
      fileName: file.name,
      requesterId,
      holderId: lock.lockedBy,
    },
    include: {
      requester: { select: { id: true, name: true, email: true } },
      holder: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function listNotifications(userId: string, unreadOnly = false) {
  const where: { holderId: string; read?: boolean } = { holderId: userId };
  if (unreadOnly) where.read = false;

  return prisma.lockNotification.findMany({
    where,
    include: {
      requester: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function markNotificationRead(notificationId: string, userId: string) {
  const notification = await prisma.lockNotification.findUnique({
    where: { id: notificationId },
  });
  if (!notification || notification.holderId !== userId) throw NotFound('Notification');

  return prisma.lockNotification.update({
    where: { id: notificationId },
    data: { read: true },
  });
}

export async function markAllNotificationsRead(userId: string) {
  return prisma.lockNotification.updateMany({
    where: { holderId: userId, read: false },
    data: { read: true },
  });
}

export async function getUnreadCount(userId: string) {
  return prisma.lockNotification.count({
    where: { holderId: userId, read: false },
  });
}
