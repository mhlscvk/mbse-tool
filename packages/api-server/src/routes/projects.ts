import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';

const router: IRouter = Router();

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  parentId: z.string().optional(),
});

router.use(requireAuth);

/** Build a tree from a flat list of projects. */
function buildTree(projects: any[]): any[] {
  const map = new Map(projects.map((p: any) => [p.id, { ...p, children: [] as any[] }]));
  const roots: any[] = [];
  for (const p of map.values()) {
    if (p.parentId && map.has(p.parentId)) {
      map.get(p.parentId)!.children.push(p);
    } else {
      roots.push(p);
    }
  }
  return roots;
}

// List all projects as a tree (user's own + system projects)
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const projects = await prisma.project.findMany({
      where: { OR: [{ ownerId: req.userId }, { isSystem: true }] },
      orderBy: { name: 'asc' },
      include: { _count: { select: { files: true, children: true } } },
    });
    res.json({ data: buildTree(projects) });
  } catch (err) { next(err); }
});

// Create project (optionally nested under parentId)
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    let depth = 0;
    let isSystem = false;
    let ownerId = req.userId!;

    if (body.parentId) {
      const parent = await prisma.project.findFirst({
        where: { id: body.parentId, OR: [{ ownerId: req.userId }, { isSystem: true }] },
      });
      if (!parent) {
        res.status(404).json({ error: 'Not Found', message: 'Parent project not found' }); return;
      }
      if (parent.isSystem) {
        res.status(403).json({ error: 'Forbidden', message: 'System projects are read-only' }); return;
      }
      if (parent.depth >= 2) {
        res.status(400).json({ error: 'Bad Request', message: 'Maximum nesting depth (3 levels) reached' }); return;
      }
      depth = parent.depth + 1;
      if (parent.isSystem) {
        isSystem = true;
        ownerId = parent.ownerId;
      }
    }

    const project = await prisma.project.create({
      data: { name: body.name, description: body.description, parentId: body.parentId, ownerId, depth, isSystem },
    });
    res.status(201).json({ data: project });
  } catch (err) { next(err); }
});

// Get single project (own or system)
router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, OR: [{ ownerId: req.userId }, { isSystem: true }] },
      include: {
        files: { select: { id: true, name: true, size: true, createdAt: true, updatedAt: true } },
        _count: { select: { children: true } },
      },
    });
    if (!project) { res.status(404).json({ error: 'Not Found', message: 'Project not found' }); return; }
    res.json({ data: project });
  } catch (err) { next(err); }
});

// Rename project (blocked for system projects unless admin)
router.patch('/:id', async (req: AuthRequest, res, next) => {
  try {
    const isAdmin = req.userRole?.toUpperCase() === 'ADMIN';
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, OR: [{ ownerId: req.userId }, { isSystem: true }] },
    });
    if (!project) { res.status(404).json({ error: 'Not Found', message: 'Project not found' }); return; }
    if (project.isSystem) {
      res.status(403).json({ error: 'Forbidden', message: 'System projects are read-only' }); return;
    }
    const body = createSchema.pick({ name: true, description: true }).partial().parse(req.body);
    const updated = await prisma.project.update({
      where: { id: req.params.id },
      data: { name: body.name, description: body.description },
    });
    res.json({ data: updated });
  } catch (err) { next(err); }
});

// Download project (allowed for system projects)
router.get('/:id/download', async (req: AuthRequest, res, next) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, OR: [{ ownerId: req.userId }, { isSystem: true }] },
      include: { files: { select: { name: true, content: true } } },
    });
    if (!project) { res.status(404).json({ error: 'Not Found', message: 'Project not found' }); return; }
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
  } catch (err) { next(err); }
});

// Delete project (blocked for system projects unless admin)
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const isAdmin = req.userRole?.toUpperCase() === 'ADMIN';
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, OR: [{ ownerId: req.userId }, { isSystem: true }] },
    });
    if (!project) { res.status(404).json({ error: 'Not Found', message: 'Project not found' }); return; }
    if (project.isSystem) {
      res.status(403).json({ error: 'Forbidden', message: 'System projects are read-only' }); return;
    }
    await prisma.project.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) { next(err); }
});

// Clone a system project (copy all files to a new user-owned project)
router.post('/:id/clone', async (req: AuthRequest, res, next) => {
  try {
    const source = await prisma.project.findFirst({
      where: { id: req.params.id, isSystem: true },
      include: { files: { select: { name: true, content: true, size: true } } },
    });
    if (!source) { res.status(404).json({ error: 'Not Found', message: 'System project not found' }); return; }

    const clonedProject = await prisma.project.create({
      data: { name: source.name, ownerId: req.userId!, depth: 0 },
    });

    if (source.files.length > 0) {
      await prisma.sysMLFile.createMany({
        data: source.files.map(f => ({
          name: f.name, content: f.content, size: f.size, projectId: clonedProject.id,
        })),
      });
    }

    res.status(201).json({ data: clonedProject });
  } catch (err) { next(err); }
});

export default router;
