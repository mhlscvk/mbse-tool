import { prisma } from '../db.js';
import { NotFound, BadRequest, Forbidden } from '../lib/errors.js';
import { generateElementDisplayId } from '../lib/id-generator.js';

// ── Element Check-out / Check-in ────────────────────────────────────────────

export async function checkOutElement(
  fileId: string,
  elementName: string,
  userId: string,
) {
  // Verify file exists
  const file = await prisma.sysMLFile.findUnique({
    where: { id: fileId },
    include: { project: { select: { id: true, name: true } } },
  });
  if (!file) throw NotFound('File');

  // Check if element is already locked
  const existing = await prisma.elementLock.findUnique({
    where: { fileId_elementName: { fileId, elementName } },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  if (existing) {
    if (existing.lockedBy === userId) {
      throw BadRequest('You already have this element checked out');
    }
    throw Forbidden(`Element "${elementName}" is checked out by ${existing.user.name}`);
  }

  const displayId = generateElementDisplayId();

  const lock = await prisma.elementLock.create({
    data: { displayId, fileId, elementName, lockedBy: userId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      projectId: file.project.id,
      fileId,
      elementName,
      userId,
      operation: 'CHECK_OUT',
    },
  });

  return lock;
}

export async function checkInElement(
  fileId: string,
  elementName: string,
  userId: string,
) {
  const file = await prisma.sysMLFile.findUnique({
    where: { id: fileId },
    include: { project: { select: { id: true } } },
  });
  if (!file) throw NotFound('File');

  const lock = await prisma.elementLock.findUnique({
    where: { fileId_elementName: { fileId, elementName } },
  });
  if (!lock) throw NotFound('Element lock');
  if (lock.lockedBy !== userId) {
    throw Forbidden('You can only check in elements you have checked out');
  }

  await prisma.elementLock.delete({
    where: { fileId_elementName: { fileId, elementName } },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      projectId: file.project.id,
      fileId,
      elementName,
      userId,
      operation: 'CHECK_IN',
    },
  });

  return { elementName, status: 'checked_in' };
}

export async function forceCheckIn(
  fileId: string,
  elementName: string,
  adminUserId: string,
) {
  const file = await prisma.sysMLFile.findUnique({
    where: { id: fileId },
    include: { project: { select: { id: true } } },
  });
  if (!file) throw NotFound('File');

  const lock = await prisma.elementLock.findUnique({
    where: { fileId_elementName: { fileId, elementName } },
  });
  if (!lock) throw NotFound('Element lock');

  await prisma.elementLock.delete({
    where: { fileId_elementName: { fileId, elementName } },
  });

  // Log with admin's userId
  await prisma.auditLog.create({
    data: {
      projectId: file.project.id,
      fileId,
      elementName,
      userId: adminUserId,
      operation: 'CHECK_IN',
    },
  });

  return { elementName, status: 'force_checked_in' };
}

export async function listFileLocks(fileId: string) {
  return prisma.elementLock.findMany({
    where: { fileId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { lockedAt: 'asc' },
  });
}

export async function listUserLocks(userId: string) {
  return prisma.elementLock.findMany({
    where: { lockedBy: userId },
    include: {
      file: { select: { id: true, name: true, projectId: true } },
      user: { select: { id: true, name: true } },
    },
    orderBy: { lockedAt: 'desc' },
  });
}

export async function getElementLockStatus(fileId: string, elementName: string) {
  const lock = await prisma.elementLock.findUnique({
    where: { fileId_elementName: { fileId, elementName } },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  if (!lock) return { status: 'available', elementName };
  return {
    status: 'checked_out',
    elementName,
    lockedBy: lock.user,
    lockedAt: lock.lockedAt,
    displayId: lock.displayId,
  };
}
