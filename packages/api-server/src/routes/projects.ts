import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
});

router.use(requireAuth);

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const projects = await prisma.project.findMany({
      where: { ownerId: req.userId },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { files: true } } },
    });
    res.json({ data: projects });
  } catch (err) { next(err); }
});

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const project = await prisma.project.create({
      data: { ...body, ownerId: req.userId! },
    });
    res.status(201).json({ data: project });
  } catch (err) { next(err); }
});

router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, ownerId: req.userId },
      include: { files: { select: { id: true, name: true, size: true, createdAt: true, updatedAt: true } } },
    });
    if (!project) { res.status(404).json({ error: 'Not Found', message: 'Project not found' }); return; }
    res.json({ data: project });
  } catch (err) { next(err); }
});

router.patch('/:id', async (req: AuthRequest, res, next) => {
  try {
    const body = createSchema.partial().parse(req.body);
    const project = await prisma.project.findFirst({ where: { id: req.params.id, ownerId: req.userId } });
    if (!project) { res.status(404).json({ error: 'Not Found', message: 'Project not found' }); return; }
    const updated = await prisma.project.update({ where: { id: req.params.id }, data: body });
    res.json({ data: updated });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const project = await prisma.project.findFirst({ where: { id: req.params.id, ownerId: req.userId } });
    if (!project) { res.status(404).json({ error: 'Not Found', message: 'Project not found' }); return; }
    await prisma.project.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
