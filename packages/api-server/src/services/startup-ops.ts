import { prisma } from '../db.js';
import { NotFound, BadRequest, Forbidden } from '../lib/errors.js';
import { generateStartupId } from '../lib/id-generator.js';
import type { StartupRole } from '@prisma/client';

// ── Startup CRUD ────────────────────────────────────────────────────────────

export async function createStartup(name: string, slug: string, createdByUserId: string) {
  const existing = await prisma.startup.findUnique({ where: { slug } });
  if (existing) throw BadRequest('Startup slug already exists');

  // Find next sequence number
  const count = await prisma.startup.count();
  const startupId = generateStartupId(slug, count + 1);

  const startup = await prisma.startup.create({
    data: { id: startupId, name, slug },
  });

  // Creator becomes STARTUP_ADMIN
  await prisma.startupMember.create({
    data: { startupId: startup.id, userId: createdByUserId, role: 'STARTUP_ADMIN' },
  });

  return startup;
}

export async function getStartup(startupId: string) {
  const startup = await prisma.startup.findUnique({
    where: { id: startupId },
    include: { _count: { select: { members: true, projects: true } } },
  });
  if (!startup) throw NotFound('Startup');
  return startup;
}

export async function listStartups() {
  return prisma.startup.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { members: true, projects: true } } },
  });
}

export async function listUserStartups(userId: string) {
  const memberships = await prisma.startupMember.findMany({
    where: { userId },
    include: {
      startup: {
        include: { _count: { select: { members: true, projects: true } } },
      },
    },
  });
  return memberships.map(m => ({ ...m.startup, memberRole: m.role }));
}

export async function updateStartup(startupId: string, data: { name?: string; slug?: string }) {
  const startup = await prisma.startup.findUnique({ where: { id: startupId } });
  if (!startup) throw NotFound('Startup');

  if (data.slug) {
    const existing = await prisma.startup.findUnique({ where: { slug: data.slug } });
    if (existing && existing.id !== startupId) throw BadRequest('Slug already in use');
  }

  return prisma.startup.update({ where: { id: startupId }, data });
}

export async function deleteStartup(startupId: string) {
  const startup = await prisma.startup.findUnique({ where: { id: startupId } });
  if (!startup) throw NotFound('Startup');
  await prisma.startup.delete({ where: { id: startupId } });
}

// ── Member Management ───────────────────────────────────────────────────────

export async function addMember(startupId: string, userId: string, role: StartupRole) {
  const startup = await prisma.startup.findUnique({ where: { id: startupId } });
  if (!startup) throw NotFound('Startup');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw NotFound('User');

  const existing = await prisma.startupMember.findUnique({
    where: { startupId_userId: { startupId, userId } },
  });
  if (existing) throw BadRequest('User is already a member of this startup');

  return prisma.startupMember.create({
    data: { startupId, userId, role },
  });
}

export async function updateMemberRole(startupId: string, userId: string, role: StartupRole) {
  const member = await prisma.startupMember.findUnique({
    where: { startupId_userId: { startupId, userId } },
  });
  if (!member) throw NotFound('Member');

  return prisma.startupMember.update({
    where: { startupId_userId: { startupId, userId } },
    data: { role },
  });
}

export async function removeMember(startupId: string, userId: string) {
  const member = await prisma.startupMember.findUnique({
    where: { startupId_userId: { startupId, userId } },
  });
  if (!member) throw NotFound('Member');

  await prisma.startupMember.delete({
    where: { startupId_userId: { startupId, userId } },
  });
}

export async function listMembers(startupId: string) {
  return prisma.startupMember.findMany({
    where: { startupId },
    include: { user: { select: { id: true, email: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  });
}

// ── Access Checks ───────────────────────────────────────────────────────────

export async function getStartupMembership(startupId: string, userId: string) {
  return prisma.startupMember.findUnique({
    where: { startupId_userId: { startupId, userId } },
  });
}

export async function assertStartupAccess(startupId: string, userId: string, userRole?: string) {
  // Site admins can access all startups
  if (userRole?.toUpperCase() === 'ADMIN') {
    return { allowed: true, memberRole: 'SITE_ADMIN' as StartupRole, isSiteAdmin: true };
  }

  const membership = await getStartupMembership(startupId, userId);
  if (!membership) return { allowed: false, memberRole: null, isSiteAdmin: false };
  return { allowed: true, memberRole: membership.role, isSiteAdmin: false };
}

export function assertStartupWriteAccess(access: { allowed: boolean; memberRole: StartupRole | null; isSiteAdmin: boolean }) {
  if (!access.allowed) throw NotFound('Startup');
  if (access.memberRole === 'STARTUP_USER') {
    throw Forbidden('Startup users cannot modify startup settings');
  }
}
