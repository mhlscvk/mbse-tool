import { prisma } from '../db.js';
import { NotFound, Forbidden } from './errors.js';

export interface ProjectAccess {
  allowed: boolean;
  isSystem: boolean;
  isAdmin: boolean;
}

export function isAdmin(role?: string): boolean {
  return role?.toUpperCase() === 'ADMIN';
}

export async function assertProjectAccess(
  projectId: string,
  userId: string,
  userRole?: string,
): Promise<ProjectAccess> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, OR: [{ ownerId: userId }, { isSystem: true }] },
  });
  if (!project) return { allowed: false, isSystem: false, isAdmin: false };
  return { allowed: true, isSystem: project.isSystem, isAdmin: isAdmin(userRole) };
}

/** Throws NotFound or Forbidden if the user cannot write to this project. */
export function assertWriteAccess(access: ProjectAccess): void {
  if (!access.allowed) throw NotFound('Project');
  if (access.isSystem && !access.isAdmin) throw Forbidden();
}
