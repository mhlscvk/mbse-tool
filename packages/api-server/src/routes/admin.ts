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
    }).filter(Boolean) as { name: string; content: string; size: number; projectId: string }[];

    if (fileData.length > 0) await prisma.sysMLFile.createMany({ data: fileData });
    totalFiles += fileData.length;
  }

  res.json({ data: { message: `Examples synced: ${dirs.length} subprojects, ${totalFiles} files` } });
}));

export default router;
