import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';
import { isAdmin } from '../lib/auth-helpers.js';
import { asyncHandler, NotFound, Forbidden, BadRequest } from '../lib/errors.js';
import { MAX_PROJECT_DEPTH } from '../config/constants.js';
import { generateProjectDisplayId, userOwnerRef } from '../lib/id-generator.js';

const router: IRouter = Router();

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  parentId: z.string().optional(),
  projectType: z.enum(['SYSTEM', 'STARTUP', 'USER']).optional(),
  startupId: z.string().optional(),
});

router.use(requireAuth);

/** Build a tree from a flat list of projects. */
interface ProjectRow { id: string; parentId: string | null; [key: string]: unknown }
interface ProjectTreeNode extends ProjectRow { children: ProjectTreeNode[] }

function buildTree(projects: ProjectRow[]): ProjectTreeNode[] {
  const map = new Map(projects.map((p) => [p.id, { ...p, children: [] as ProjectTreeNode[] }]));
  const roots: ProjectTreeNode[] = [];
  for (const p of map.values()) {
    if (p.parentId && map.has(p.parentId)) {
      map.get(p.parentId)!.children.push(p);
    } else {
      roots.push(p);
    }
  }
  return roots;
}

// List all projects as a tree (user's own + system + startup projects where member)
router.get('/', asyncHandler(async (req: AuthRequest, res) => {
  const admin = isAdmin(req.userRole);

  // Get user's startup memberships
  const memberships = await prisma.startupMember.findMany({
    where: { userId: req.userId },
    select: { startupId: true },
  });
  const startupIds = memberships.map(m => m.startupId);

  const whereClause = admin
    ? {} // Site admins see all projects
    : {
        OR: [
          { ownerId: req.userId, projectType: 'USER' as const },
          { isSystem: true },
          ...(startupIds.length > 0 ? [{ startupId: { in: startupIds }, projectType: 'STARTUP' as const }] : []),
        ],
      };

  const projects = await prisma.project.findMany({
    where: whereClause,
    orderBy: { name: 'asc' },
    include: { _count: { select: { files: true, children: true } } },
  });
  res.json({ data: buildTree(projects) });
}));

// Create project (optionally nested under parentId)
router.post('/', asyncHandler(async (req: AuthRequest, res) => {
  const body = createSchema.parse(req.body);
  let depth = 0;
  let isSystem = false;
  let ownerId = req.userId!;
  const admin = isAdmin(req.userRole);
  let projectType = body.projectType ?? 'USER';
  let startupId = body.startupId ?? null;

  if (body.parentId) {
    const parent = await prisma.project.findFirst({
      where: { id: body.parentId },
    });
    if (!parent) throw NotFound('Parent project');

    // Verify access to parent project
    if (parent.projectType === 'STARTUP' && parent.startupId) {
      if (!admin) {
        const membership = await prisma.startupMember.findUnique({
          where: { startupId_userId: { startupId: parent.startupId, userId: req.userId! } },
        });
        if (!membership) throw NotFound('Parent project');
        if (membership.role === 'STARTUP_USER') throw Forbidden('Startup users cannot create projects');
      }
      startupId = parent.startupId;
      projectType = 'STARTUP';
    } else if (parent.isSystem) {
      if (!admin) throw Forbidden();
      isSystem = true;
      ownerId = parent.ownerId;
      projectType = 'SYSTEM';
    } else if (parent.ownerId !== req.userId && !admin) {
      throw NotFound('Parent project');
    }

    if (parent.depth >= MAX_PROJECT_DEPTH) throw BadRequest(`Maximum nesting depth (${MAX_PROJECT_DEPTH + 1} levels) reached`);
    depth = parent.depth + 1;
  }

  // Startup project creation requires valid startup membership
  if (projectType === 'STARTUP' && startupId && !body.parentId) {
    if (!admin) {
      const membership = await prisma.startupMember.findUnique({
        where: { startupId_userId: { startupId, userId: req.userId! } },
      });
      if (!membership) throw NotFound('Startup');
      if (membership.role === 'STARTUP_USER') throw Forbidden('Startup users cannot create projects');
    }
  }

  // Generate owner reference for display ID
  let ownerRef: string;
  if (projectType === 'SYSTEM') {
    ownerRef = '0001';
  } else if (projectType === 'STARTUP' && startupId) {
    // Extract short name from startup ID (e.g. "ENT-NUMERIC-001" → "NUMERIC")
    const parts = startupId.split('-');
    ownerRef = parts.length >= 2 ? parts[1] : startupId;
  } else {
    ownerRef = userOwnerRef(req.userId!);
  }

  const displayId = generateProjectDisplayId(projectType as 'SYSTEM' | 'STARTUP' | 'USER', ownerRef);

  const project = await prisma.project.create({
    data: {
      name: body.name,
      displayId,
      description: body.description,
      parentId: body.parentId,
      ownerId,
      depth,
      isSystem,
      projectType: projectType as 'SYSTEM' | 'STARTUP' | 'USER',
      startupId,
    },
  });
  res.status(201).json({ data: project });
}));

// Get single project (own, system, or startup member)
router.get('/:id', asyncHandler(async (req: AuthRequest, res) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: {
      files: { select: { id: true, displayId: true, name: true, size: true, createdAt: true, updatedAt: true } },
      _count: { select: { children: true } },
    },
  });
  if (!project) throw NotFound('Project');

  // Access check
  const admin = isAdmin(req.userRole);
  if (!admin && !project.isSystem) {
    if (project.projectType === 'STARTUP' && project.startupId) {
      const membership = await prisma.startupMember.findUnique({
        where: { startupId_userId: { startupId: project.startupId, userId: req.userId! } },
      });
      if (!membership) throw NotFound('Project');
    } else if (project.ownerId !== req.userId) {
      throw NotFound('Project');
    }
  }

  res.json({ data: project });
}));

// Rename project (blocked for system projects unless admin)
router.patch('/:id', asyncHandler(async (req: AuthRequest, res) => {
  const admin = isAdmin(req.userRole);
  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project) throw NotFound('Project');

  // Access check
  if (project.isSystem && !admin) throw Forbidden();
  if (project.projectType === 'STARTUP' && project.startupId && !admin) {
    const membership = await prisma.startupMember.findUnique({
      where: { startupId_userId: { startupId: project.startupId, userId: req.userId! } },
    });
    if (!membership) throw NotFound('Project');
    if (membership.role === 'STARTUP_USER') throw Forbidden('Startup users cannot rename projects');
  } else if (!project.isSystem && project.ownerId !== req.userId && !admin) {
    throw NotFound('Project');
  }

  const body = createSchema.pick({ name: true, description: true }).partial().parse(req.body);
  const updated = await prisma.project.update({
    where: { id: req.params.id },
    data: { name: body.name, description: body.description },
  });
  res.json({ data: updated });
}));

// Download project (allowed for system projects)
router.get('/:id/download', asyncHandler(async (req: AuthRequest, res) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: { files: { select: { name: true, content: true } } },
  });
  if (!project) throw NotFound('Project');

  // Access check
  const admin = isAdmin(req.userRole);
  if (!admin && !project.isSystem) {
    if (project.projectType === 'STARTUP' && project.startupId) {
      const membership = await prisma.startupMember.findUnique({
        where: { startupId_userId: { startupId: project.startupId, userId: req.userId! } },
      });
      if (!membership) throw NotFound('Project');
    } else if (project.ownerId !== req.userId) {
      throw NotFound('Project');
    }
  }

  if (project.files.length === 1) {
    const file = project.files[0];
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`);
    res.send(file.content);
  } else {
    const bundle = { project: project.name, files: project.files };
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(project.name)}.json"`);
    res.send(JSON.stringify(bundle, null, 2));
  }
}));

// Delete project (blocked for system projects unless admin)
router.delete('/:id', asyncHandler(async (req: AuthRequest, res) => {
  const admin = isAdmin(req.userRole);
  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project) throw NotFound('Project');

  if (project.isSystem && !admin) throw Forbidden();
  if (project.projectType === 'STARTUP' && project.startupId && !admin) {
    const membership = await prisma.startupMember.findUnique({
      where: { startupId_userId: { startupId: project.startupId, userId: req.userId! } },
    });
    if (!membership) throw NotFound('Project');
    if (membership.role === 'STARTUP_USER') throw Forbidden('Startup users cannot delete projects');
  } else if (!project.isSystem && project.ownerId !== req.userId && !admin) {
    throw NotFound('Project');
  }

  await prisma.project.delete({ where: { id: req.params.id } });
  res.status(204).send();
}));

// Clone a system project (copy all files to a new user-owned project)
router.post('/:id/clone', asyncHandler(async (req: AuthRequest, res) => {
  const source = await prisma.project.findFirst({
    where: { id: req.params.id, isSystem: true },
    include: { files: { select: { name: true, content: true, size: true } } },
  });
  if (!source) throw NotFound('System project');

  const displayId = generateProjectDisplayId('USER', userOwnerRef(req.userId!));

  const clonedProject = await prisma.project.create({
    data: { name: source.name, displayId, ownerId: req.userId!, depth: 0, projectType: 'USER' },
  });

  if (source.files.length > 0) {
    const { generateFileDisplayId } = await import('../lib/id-generator.js');
    await prisma.sysMLFile.createMany({
      data: source.files.map((f: { name: string; content: string; size: number }) => ({
        name: f.name, content: f.content, size: f.size, projectId: clonedProject.id,
        displayId: generateFileDisplayId(),
      })),
    });
  }

  res.status(201).json({ data: clonedProject });
}));

export default router;
