import { prisma } from '../db.js';
import { NotFound, BadRequest, Forbidden } from '../lib/errors.js';
import { generateElementDisplayId } from '../lib/id-generator.js';
import { MAX_ELEMENT_NAME_LENGTH } from '../config/constants.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Verify file exists and belongs to the given project. */
async function verifyFileInProject(fileId: string, projectId: string) {
  const file = await prisma.sysMLFile.findUnique({
    where: { id: fileId },
    include: { project: { select: { id: true, name: true } } },
  });
  if (!file) throw NotFound('File');
  if (file.project.id !== projectId) throw NotFound('File');
  return file;
}

/** Sanitize element name — strip control chars, enforce length. */
function sanitizeElementName(name: string): string {
  // Strip control characters and null bytes
  const safe = name.replace(/[\x00-\x1f\x7f]/g, '').trim();
  if (!safe || safe.length > MAX_ELEMENT_NAME_LENGTH) {
    throw BadRequest(`Element name must be 1-${MAX_ELEMENT_NAME_LENGTH} characters`);
  }
  return safe;
}

// ── Element Check-out / Check-in ────────────────────────────────────────────

export async function checkOutElement(
  fileId: string,
  projectId: string,
  elementName: string,
  userId: string,
) {
  const safeName = sanitizeElementName(elementName);
  const file = await verifyFileInProject(fileId, projectId);

  // Use a transaction to prevent TOCTOU race conditions.
  // If two users try to check out the same element simultaneously,
  // the unique constraint will cause one to fail — we catch that cleanly.
  try {
    const displayId = generateElementDisplayId();

    const lock = await prisma.elementLock.create({
      data: { displayId, fileId, elementName: safeName, lockedBy: userId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        projectId: file.project.id,
        fileId,
        elementName: safeName,
        userId,
        operation: 'CHECK_OUT',
      },
    });

    return lock;
  } catch (err: unknown) {
    // Handle unique constraint violation (concurrent checkout or already checked out)
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
      // Look up who holds the lock to give a useful error
      const existing = await prisma.elementLock.findUnique({
        where: { fileId_elementName: { fileId, elementName: safeName } },
        include: { user: { select: { id: true, name: true } } },
      });
      if (existing?.lockedBy === userId) {
        throw BadRequest('You already have this element checked out');
      }
      throw Forbidden(`Element is checked out by ${existing?.user.name ?? 'another user'}`);
    }
    throw err;
  }
}

export async function checkInElement(
  fileId: string,
  projectId: string,
  elementName: string,
  userId: string,
) {
  const safeName = sanitizeElementName(elementName);
  const file = await verifyFileInProject(fileId, projectId);

  const lock = await prisma.elementLock.findUnique({
    where: { fileId_elementName: { fileId, elementName: safeName } },
  });
  if (!lock) throw NotFound('Element lock');
  if (lock.lockedBy !== userId) {
    throw Forbidden('You can only check in elements you have checked out');
  }

  await prisma.elementLock.delete({
    where: { fileId_elementName: { fileId, elementName: safeName } },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      projectId: file.project.id,
      fileId,
      elementName: safeName,
      userId,
      operation: 'CHECK_IN',
    },
  });

  return { elementName: safeName, status: 'checked_in' };
}

export async function forceCheckIn(
  fileId: string,
  projectId: string,
  elementName: string,
  adminUserId: string,
) {
  const safeName = sanitizeElementName(elementName);
  const file = await verifyFileInProject(fileId, projectId);

  const lock = await prisma.elementLock.findUnique({
    where: { fileId_elementName: { fileId, elementName: safeName } },
  });
  if (!lock) throw NotFound('Element lock');

  await prisma.elementLock.delete({
    where: { fileId_elementName: { fileId, elementName: safeName } },
  });

  // Log with admin's userId
  await prisma.auditLog.create({
    data: {
      projectId: file.project.id,
      fileId,
      elementName: safeName,
      userId: adminUserId,
      operation: 'CHECK_IN',
    },
  });

  return { elementName: safeName, status: 'force_checked_in' };
}

export async function listFileLocks(fileId: string, projectId: string) {
  // Verify file belongs to project
  await verifyFileInProject(fileId, projectId);

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

export async function getElementLockStatus(fileId: string, projectId: string, elementName: string) {
  const safeName = sanitizeElementName(elementName);

  // Verify file belongs to project
  await verifyFileInProject(fileId, projectId);

  const lock = await prisma.elementLock.findUnique({
    where: { fileId_elementName: { fileId, elementName: safeName } },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  if (!lock) return { status: 'available', elementName: safeName };
  return {
    status: 'checked_out',
    elementName: safeName,
    lockedBy: lock.user,
    lockedAt: lock.lockedAt,
    displayId: lock.displayId,
  };
}
