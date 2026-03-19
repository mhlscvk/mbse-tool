import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';
import { mcpEvents } from '../mcp/events.js';

const router: IRouter = Router({ mergeParams: true });

router.use(requireAuth);

const MAX_CONTENT_BYTES = 10 * 1024 * 1024; // 10 MB

const fileCreateSchema = z.object({
  name: z.string().min(1).max(255),
  content: z.string().min(1),
});

const fileUpdateSchema = z.object({
  content: z.string().min(1),
});

const fileRenameSchema = z.object({
  name: z.string().min(1).max(255),
});

async function assertProjectAccess(projectId: string, userId: string, userRole?: string): Promise<{ allowed: boolean; isSystem: boolean; isAdmin: boolean }> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, OR: [{ ownerId: userId }, { isSystem: true }] },
  });
  if (!project) return { allowed: false, isSystem: false, isAdmin: false };
  const isAdmin = userRole?.toUpperCase() === 'ADMIN';
  return { allowed: true, isSystem: project.isSystem, isAdmin };
}

// List files (read — allowed for system projects)
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { allowed } = await assertProjectAccess(req.params.projectId, req.userId!);
    if (!allowed) { res.status(404).json({ error: 'Not Found', message: 'Project not found' }); return; }
    const files = await prisma.sysMLFile.findMany({
      where: { projectId: req.params.projectId },
      select: { id: true, name: true, size: true, createdAt: true, updatedAt: true },
    });
    res.json({ data: files });
  } catch (err) { next(err); }
});

// Create file (blocked for system projects unless admin)
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const { allowed, isSystem, isAdmin } = await assertProjectAccess(req.params.projectId, req.userId!, req.userRole);
    if (!allowed) { res.status(404).json({ error: 'Not Found', message: 'Project not found' }); return; }
    if (isSystem && !isAdmin) { res.status(403).json({ error: 'Forbidden', message: 'Cannot modify system project' }); return; }
    const { name, content } = fileCreateSchema.parse(req.body);
    const contentSize = Buffer.byteLength(content, 'utf8');
    if (contentSize > MAX_CONTENT_BYTES) {
      res.status(413).json({ error: 'Payload Too Large', message: `Content exceeds ${MAX_CONTENT_BYTES} byte limit` }); return;
    }
    const safeName = name.replace(/[\\/\0]/g, '').slice(0, 255);
    if (!safeName) { res.status(400).json({ error: 'Bad Request', message: 'Invalid file name' }); return; }
    const file = await prisma.sysMLFile.create({
      data: { name: safeName, content, size: contentSize, projectId: req.params.projectId },
    });
    mcpEvents.emitFileChange({ fileId: file.id, userId: req.userId!, action: 'created' });
    res.status(201).json({ data: file });
  } catch (err) { next(err); }
});

// Get file (read — allowed for system projects)
router.get('/:fileId', async (req: AuthRequest, res, next) => {
  try {
    const { allowed } = await assertProjectAccess(req.params.projectId, req.userId!);
    if (!allowed) { res.status(404).json({ error: 'Not Found', message: 'Project not found' }); return; }
    const file = await prisma.sysMLFile.findFirst({
      where: { id: req.params.fileId, projectId: req.params.projectId },
    });
    if (!file) { res.status(404).json({ error: 'Not Found', message: 'File not found' }); return; }
    res.json({ data: file });
  } catch (err) { next(err); }
});

// Update file content (blocked for system projects unless admin)
router.put('/:fileId', async (req: AuthRequest, res, next) => {
  try {
    const { allowed, isSystem, isAdmin } = await assertProjectAccess(req.params.projectId, req.userId!, req.userRole);
    if (!allowed) { res.status(404).json({ error: 'Not Found', message: 'Project not found' }); return; }
    if (isSystem && !isAdmin) { res.status(403).json({ error: 'Forbidden', message: 'Cannot modify system project' }); return; }
    const { content } = fileUpdateSchema.parse(req.body);
    const contentSize = Buffer.byteLength(content, 'utf8');
    if (contentSize > MAX_CONTENT_BYTES) {
      res.status(413).json({ error: 'Payload Too Large', message: `Content exceeds ${MAX_CONTENT_BYTES} byte limit` }); return;
    }
    const file = await prisma.sysMLFile.findFirst({
      where: { id: req.params.fileId, projectId: req.params.projectId },
    });
    if (!file) { res.status(404).json({ error: 'Not Found', message: 'File not found' }); return; }
    const updated = await prisma.sysMLFile.update({
      where: { id: req.params.fileId },
      data: { content, size: contentSize },
    });
    mcpEvents.emitFileChange({ fileId: req.params.fileId, userId: req.userId!, action: 'updated' });
    res.json({ data: updated });
  } catch (err) { next(err); }
});

// Rename file (blocked for system projects unless admin)
router.patch('/:fileId', async (req: AuthRequest, res, next) => {
  try {
    const { allowed, isSystem, isAdmin } = await assertProjectAccess(req.params.projectId, req.userId!, req.userRole);
    if (!allowed) { res.status(404).json({ error: 'Not Found', message: 'Project not found' }); return; }
    if (isSystem && !isAdmin) { res.status(403).json({ error: 'Forbidden', message: 'Cannot modify system project' }); return; }
    const { name } = fileRenameSchema.parse(req.body);
    const safeName = name.replace(/[\\/\0]/g, '').slice(0, 255);
    if (!safeName) { res.status(400).json({ error: 'Bad Request', message: 'Invalid file name' }); return; }
    const file = await prisma.sysMLFile.findFirst({
      where: { id: req.params.fileId, projectId: req.params.projectId },
    });
    if (!file) { res.status(404).json({ error: 'Not Found', message: 'File not found' }); return; }
    const updated = await prisma.sysMLFile.update({
      where: { id: req.params.fileId },
      data: { name: safeName },
    });
    res.json({ data: updated });
  } catch (err) { next(err); }
});

// Download file (allowed for system projects)
router.get('/:fileId/download', async (req: AuthRequest, res, next) => {
  try {
    const { allowed } = await assertProjectAccess(req.params.projectId, req.userId!);
    if (!allowed) { res.status(404).json({ error: 'Not Found', message: 'Project not found' }); return; }
    const file = await prisma.sysMLFile.findFirst({
      where: { id: req.params.fileId, projectId: req.params.projectId },
    });
    if (!file) { res.status(404).json({ error: 'Not Found', message: 'File not found' }); return; }
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`);
    res.send(file.content);
  } catch (err) { next(err); }
});

// Delete file (blocked for system projects unless admin)
router.delete('/:fileId', async (req: AuthRequest, res, next) => {
  try {
    const { allowed, isSystem, isAdmin } = await assertProjectAccess(req.params.projectId, req.userId!, req.userRole);
    if (!allowed) { res.status(404).json({ error: 'Not Found', message: 'Project not found' }); return; }
    if (isSystem && !isAdmin) { res.status(403).json({ error: 'Forbidden', message: 'Cannot delete system project files' }); return; }
    const file = await prisma.sysMLFile.findFirst({
      where: { id: req.params.fileId, projectId: req.params.projectId },
    });
    if (!file) { res.status(404).json({ error: 'Not Found', message: 'File not found' }); return; }
    await prisma.sysMLFile.delete({ where: { id: req.params.fileId } });
    mcpEvents.emitFileChange({ fileId: req.params.fileId, userId: req.userId!, action: 'deleted' });
    res.status(204).send();
  } catch (err) { next(err); }
});

// Move file to another project (admin can move between system projects)
router.post('/:fileId/move', async (req: AuthRequest, res, next) => {
  try {
    const { targetProjectId } = z.object({ targetProjectId: z.string().min(1) }).parse(req.body);
    // Check access on source project
    const { allowed: srcAllowed, isSystem: srcSystem, isAdmin } = await assertProjectAccess(req.params.projectId, req.userId!, req.userRole);
    if (!srcAllowed) { res.status(404).json({ error: 'Not Found', message: 'Source project not found' }); return; }
    if (srcSystem && !isAdmin) { res.status(403).json({ error: 'Forbidden', message: 'Cannot modify system project' }); return; }
    // Check access on target project
    const { allowed: tgtAllowed, isSystem: tgtSystem, isAdmin: tgtAdmin } = await assertProjectAccess(targetProjectId, req.userId!, req.userRole);
    if (!tgtAllowed) { res.status(404).json({ error: 'Not Found', message: 'Target project not found' }); return; }
    if (tgtSystem && !tgtAdmin) { res.status(403).json({ error: 'Forbidden', message: 'Cannot modify target system project' }); return; }
    // Find file
    const file = await prisma.sysMLFile.findFirst({
      where: { id: req.params.fileId, projectId: req.params.projectId },
    });
    if (!file) { res.status(404).json({ error: 'Not Found', message: 'File not found' }); return; }
    // Move
    const updated = await prisma.sysMLFile.update({
      where: { id: req.params.fileId },
      data: { projectId: targetProjectId },
    });
    mcpEvents.emitFileChange({ fileId: req.params.fileId, userId: req.userId!, action: 'updated' });
    res.json({ data: updated });
  } catch (err) { next(err); }
});

export default router;
