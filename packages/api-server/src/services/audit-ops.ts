import { prisma } from '../db.js';

export async function getAuditLog(
  projectId: string,
  options: { fileId?: string; userId?: string; limit?: number; offset?: number } = {},
) {
  const where: { projectId: string; fileId?: string; userId?: string } = { projectId };
  if (options.fileId) where.fileId = options.fileId;
  if (options.userId) where.userId = options.userId;

  return prisma.auditLog.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: options.limit ?? 100,
    skip: options.offset ?? 0,
  });
}
