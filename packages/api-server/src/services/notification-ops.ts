import { prisma } from '../db.js';
import { NotFound, BadRequest, Forbidden } from '../lib/errors.js';
import { generateNotificationDisplayId } from '../lib/id-generator.js';
import { MAX_NOTIFICATIONS_PER_QUERY } from '../config/constants.js';
import { assertProjectAccess } from '../lib/auth-helpers.js';

/** Cooldown: prevent duplicate notifications for the same element from the same requester within 5 minutes. */
const NOTIFICATION_COOLDOWN_MS = 5 * 60 * 1000;

export async function createLockNotification(
  elementName: string,
  fileId: string,
  requesterId: string,
  requesterRole?: string,
) {
  // Find the lock holder
  const lock = await prisma.elementLock.findUnique({
    where: { fileId_elementName: { fileId, elementName } },
  });
  if (!lock) throw NotFound('Element lock');

  // Prevent self-notification
  if (lock.lockedBy === requesterId) {
    throw BadRequest('Cannot send a lock request for an element you hold');
  }

  // Get file and project info — also validates the file exists
  const file = await prisma.sysMLFile.findUnique({
    where: { id: fileId },
    include: { project: { select: { id: true, name: true } } },
  });
  if (!file) throw NotFound('File');

  // Verify requester has access to the project this file belongs to
  const access = await assertProjectAccess(file.project.id, requesterId, requesterRole);
  if (!access.allowed) throw NotFound('File');

  // Deduplication: prevent spamming the same notification
  const cooldownCutoff = new Date(Date.now() - NOTIFICATION_COOLDOWN_MS);
  const recent = await prisma.lockNotification.findFirst({
    where: {
      fileId,
      elementName,
      requesterId,
      holderId: lock.lockedBy,
      createdAt: { gte: cooldownCutoff },
    },
  });
  if (recent) {
    throw BadRequest('A lock request for this element was already sent recently');
  }

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
    take: MAX_NOTIFICATIONS_PER_QUERY,
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
