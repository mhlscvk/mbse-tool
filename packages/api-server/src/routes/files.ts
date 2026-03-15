import { Router, type IRouter } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';

const router: IRouter = Router({ mergeParams: true });
const prisma = new PrismaClient();

router.use(requireAuth);

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
    const { name, content } = req.body as { name: string; content: string };
    if (!name || !content) {
      res.status(400).json({ error: 'Bad Request', message: 'name and content are required' }); return;
    }
    const file = await prisma.sysMLFile.create({
      data: { name, content, size: Buffer.byteLength(content, 'utf8'), projectId: req.params.projectId },
    });
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
    const { content } = req.body as { content: string };
    if (!content) { res.status(400).json({ error: 'Bad Request', message: 'content is required' }); return; }
    const file = await prisma.sysMLFile.findFirst({
      where: { id: req.params.fileId, projectId: req.params.projectId },
    });
    if (!file) { res.status(404).json({ error: 'Not Found', message: 'File not found' }); return; }
    const updated = await prisma.sysMLFile.update({
      where: { id: req.params.fileId },
      data: { content, size: Buffer.byteLength(content, 'utf8') },
    });
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
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
