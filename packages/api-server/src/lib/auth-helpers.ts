import { prisma } from '../db.js';
import { NotFound, Forbidden } from './errors.js';

export interface ProjectAccess {
  allowed: boolean;
  isSystem: boolean;
  isAdmin: boolean;
  startupRole?: string | null;
}

export function isAdmin(role?: string): boolean {
  return role?.toUpperCase() === 'ADMIN';
}

export async function assertProjectAccess(
  projectId: string,
  userId: string,
  userRole?: string,
): Promise<ProjectAccess> {
  const admin = isAdmin(userRole);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) return { allowed: false, isSystem: false, isAdmin: admin };

  // System projects: readable by all authenticated users
  if (project.isSystem) {
    return { allowed: true, isSystem: true, isAdmin: admin };
  }

  // User projects: only owner
  if (project.projectType === 'USER') {
    if (project.ownerId === userId) {
      return { allowed: true, isSystem: false, isAdmin: admin };
    }
    // Site admins can access all
    if (admin) {
      return { allowed: true, isSystem: false, isAdmin: true };
    }
    return { allowed: false, isSystem: false, isAdmin: admin };
  }

  // Startup projects: check membership
  if (project.projectType === 'STARTUP' && project.startupId) {
    // Site admins can access all
    if (admin) {
      return { allowed: true, isSystem: false, isAdmin: true, startupRole: 'SITE_ADMIN' };
    }
    const membership = await prisma.startupMember.findUnique({
      where: { startupId_userId: { startupId: project.startupId, userId } },
    });
    if (!membership) return { allowed: false, isSystem: false, isAdmin: false };
    return { allowed: true, isSystem: false, isAdmin: false, startupRole: membership.role };
  }

  // Fallback: owner check (backward compatibility)
  if (project.ownerId === userId) {
    return { allowed: true, isSystem: false, isAdmin: admin };
  }

  return { allowed: false, isSystem: false, isAdmin: admin };
}

/** Throws NotFound or Forbidden if the user cannot write to this project. */
export function assertWriteAccess(access: ProjectAccess): void {
  if (!access.allowed) throw NotFound('Project');
  if (access.isSystem && !access.isAdmin) throw Forbidden();
  // Startup users with STARTUP_USER role can still write files (but not admin operations)
  // Element-level locking is handled separately
}
