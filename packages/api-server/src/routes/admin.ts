import { Router } from 'express';
import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { resolve, dirname, basename, join } from 'path';
import { fileURLToPath } from 'url';
import { prisma } from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';
import { asyncHandler, BadRequest } from '../lib/errors.js';
import { generateProjectDisplayId, generateFileDisplayId } from '../lib/id-generator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = resolve(__dirname, '../../prisma/examples');

const router: Router = Router();
router.use(requireAuth);
router.use(requireAdmin);

// POST /api/admin/sync-examples — re-import examples from prisma/examples/ directory
router.post('/sync-examples', asyncHandler(async (_req: AuthRequest, res) => {
  if (!existsSync(EXAMPLES_DIR)) {
    throw BadRequest('Examples directory not found on server');
  }

  // Find or create system user
  let systemUser = await prisma.user.findFirst({ where: { email: 'system@systemodel.com' } });
  if (!systemUser) {
    systemUser = await prisma.user.create({
      data: { email: 'system@systemodel.com', name: 'System', emailVerified: true, role: 'ADMIN' },
    });
  }

  // Find or create root "Examples" project
  let root = await prisma.project.findFirst({
    where: { name: 'Examples', parentId: null, isSystem: true, ownerId: systemUser.id },
  });
  if (!root) {
    root = await prisma.project.create({
      data: { name: 'Examples', displayId: generateProjectDisplayId('SYSTEM', '0001'), ownerId: systemUser.id, parentId: null, depth: 0, isSystem: true, projectType: 'SYSTEM' },
    });
  }

  const dirs = readdirSync(EXAMPLES_DIR).filter(e => statSync(join(EXAMPLES_DIR, e)).isDirectory());
  let totalFiles = 0;

  for (const dirName of dirs) {
    const dirPath = resolve(EXAMPLES_DIR, dirName);
    if (!dirPath.startsWith(EXAMPLES_DIR)) continue;

    let sub = await prisma.project.findFirst({
      where: { name: dirName, parentId: root.id, isSystem: true, ownerId: systemUser.id },
    });
    if (sub) {
      await prisma.sysMLFile.deleteMany({ where: { projectId: sub.id } });
    } else {
      sub = await prisma.project.create({
        data: { name: dirName, displayId: generateProjectDisplayId('SYSTEM', '0001'), ownerId: systemUser.id, parentId: root.id, depth: 1, isSystem: true, projectType: 'SYSTEM' },
      });
    }

    const files = readdirSync(dirPath).filter(f => f.endsWith('.sysml'));
    const fileData = files.map(fileName => {
      const filePath = resolve(dirPath, fileName);
      if (!filePath.startsWith(EXAMPLES_DIR)) return null;
      const content = readFileSync(filePath, 'utf-8');
      return { name: basename(fileName, '.sysml'), content, size: Buffer.byteLength(content, 'utf-8'), projectId: sub!.id, displayId: generateFileDisplayId() };
    }).filter(Boolean) as { name: string; content: string; size: number; projectId: string; displayId: string }[];

    if (fileData.length > 0) await prisma.sysMLFile.createMany({ data: fileData });
    totalFiles += fileData.length;
  }

  res.json({ data: { message: `Examples synced: ${dirs.length} subprojects, ${totalFiles} files` } });
}));

// GET /api/admin/users — list all users (read-only, no passwords)
router.get('/users', asyncHandler(async (_req: AuthRequest, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, emailVerified: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: users });
}));

// GET /api/admin/users/:userId/projects — list a specific user's personal projects (read-only)
router.get('/users/:userId/projects', asyncHandler(async (req: AuthRequest, res) => {
  const { userId } = req.params;

  // Verify the target user exists
  const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } });
  if (!targetUser) throw BadRequest('User not found');

  const projects = await prisma.project.findMany({
    where: { ownerId: userId, projectType: 'USER' },
    orderBy: { name: 'asc' },
    select: { id: true, displayId: true, name: true, description: true, projectType: true, createdAt: true, updatedAt: true, _count: { select: { files: true, children: true } } },
  });
  res.json({ data: { user: targetUser, projects } });
}));

// GET /api/admin/projects/:projectId/files — list files in any project (read-only)
router.get('/projects/:projectId/files', asyncHandler(async (req: AuthRequest, res) => {
  const { projectId } = req.params;

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, name: true, ownerId: true } });
  if (!project) throw BadRequest('Project not found');

  const files = await prisma.sysMLFile.findMany({
    where: { projectId },
    orderBy: { name: 'asc' },
    select: { id: true, displayId: true, name: true, size: true, createdAt: true, updatedAt: true },
  });
  res.json({ data: files });
}));

// GET /api/admin/files/:fileId — read a single file's content (read-only)
router.get('/files/:fileId', asyncHandler(async (req: AuthRequest, res) => {
  const { fileId } = req.params;

  const file = await prisma.sysMLFile.findUnique({
    where: { id: fileId },
    select: { id: true, displayId: true, name: true, content: true, size: true, createdAt: true, updatedAt: true, projectId: true },
  });
  if (!file) throw BadRequest('File not found');

  res.json({ data: file });
}));

export default router;
