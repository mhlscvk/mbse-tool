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

async function assertProjectOwner(projectId: string, userId: string): Promise<boolean> {
  const project = await prisma.project.findFirst({ where: { id: projectId, ownerId: userId } });
  return project !== null;
}

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    if (!(await assertProjectOwner(req.params.projectId, req.userId!))) {
      res.status(404).json({ error: 'Not Found', message: 'Project not found' }); return;
    }
    const files = await prisma.sysMLFile.findMany({
      where: { projectId: req.params.projectId },
      select: { id: true, name: true, size: true, createdAt: true, updatedAt: true },
    });
    res.json({ data: files });
  } catch (err) { next(err); }
});

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    if (!(await assertProjectOwner(req.params.projectId, req.userId!))) {
      res.status(404).json({ error: 'Not Found', message: 'Project not found' }); return;
    }
    const { name, content } = fileCreateSchema.parse(req.body);
    const contentSize = Buffer.byteLength(content, 'utf8');
    if (contentSize > MAX_CONTENT_BYTES) {
      res.status(413).json({ error: 'Payload Too Large', message: `Content exceeds ${MAX_CONTENT_BYTES} byte limit` }); return;
    }
    // Sanitize filename: strip path separators, null bytes, limit length
    const safeName = name.replace(/[\\/\0]/g, '').slice(0, 255);
    if (!safeName) {
      res.status(400).json({ error: 'Bad Request', message: 'Invalid file name' }); return;
    }
    const file = await prisma.sysMLFile.create({
      data: { name: safeName, content, size: contentSize, projectId: req.params.projectId },
    });
    mcpEvents.emitFileChange({ fileId: file.id, userId: req.userId!, action: 'created' });
    res.status(201).json({ data: file });
  } catch (err) { next(err); }
});

router.get('/:fileId', async (req: AuthRequest, res, next) => {
  try {
    if (!(await assertProjectOwner(req.params.projectId, req.userId!))) {
      res.status(404).json({ error: 'Not Found', message: 'Project not found' }); return;
    }
    const file = await prisma.sysMLFile.findFirst({
      where: { id: req.params.fileId, projectId: req.params.projectId },
    });
    if (!file) { res.status(404).json({ error: 'Not Found', message: 'File not found' }); return; }
    res.json({ data: file });
  } catch (err) { next(err); }
});

router.put('/:fileId', async (req: AuthRequest, res, next) => {
  try {
    if (!(await assertProjectOwner(req.params.projectId, req.userId!))) {
      res.status(404).json({ error: 'Not Found', message: 'Project not found' }); return;
    }
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

router.delete('/:fileId', async (req: AuthRequest, res, next) => {
  try {
    if (!(await assertProjectOwner(req.params.projectId, req.userId!))) {
      res.status(404).json({ error: 'Not Found', message: 'Project not found' }); return;
    }
    const file = await prisma.sysMLFile.findFirst({
      where: { id: req.params.fileId, projectId: req.params.projectId },
    });
    if (!file) { res.status(404).json({ error: 'Not Found', message: 'File not found' }); return; }
    await prisma.sysMLFile.delete({ where: { id: req.params.fileId } });
    mcpEvents.emitFileChange({ fileId: req.params.fileId, userId: req.userId!, action: 'deleted' });
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
