import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, requireAdmin, type AuthRequest } from '../middleware/auth.js';
import { asyncHandler, BadRequest } from '../lib/errors.js';
import { MAX_BUG_SCREENSHOT_BYTES, MAX_BUG_REPORTS_PER_HOUR } from '../config/constants.js';

const router: Router = Router();
router.use(requireAuth);

const createSchema = z.object({
  description: z.string().min(1).max(5000),
  screenshot: z.string().optional(),
  pageUrl: z.string().max(2000),
});

const statusSchema = z.object({
  status: z.enum(['OPEN', 'RESOLVED', 'CLOSED']),
});

// POST /api/bug-reports — submit a bug report (any authenticated user)
router.post('/', asyncHandler(async (req: AuthRequest, res) => {
  const { description, screenshot, pageUrl } = createSchema.parse(req.body);

  // Validate screenshot size
  if (screenshot && Buffer.byteLength(screenshot, 'utf-8') > MAX_BUG_SCREENSHOT_BYTES) {
    throw BadRequest(`Screenshot exceeds ${MAX_BUG_SCREENSHOT_BYTES / 1024 / 1024}MB limit`);
  }

  // Per-user rate limit
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = await prisma.bugReport.count({
    where: { userId: req.userId!, createdAt: { gte: oneHourAgo } },
  });
  if (recentCount >= MAX_BUG_REPORTS_PER_HOUR) {
    throw BadRequest(`Maximum ${MAX_BUG_REPORTS_PER_HOUR} bug reports per hour`);
  }

  const report = await prisma.bugReport.create({
    data: { userId: req.userId!, description, screenshot: screenshot ?? null, pageUrl },
  });

  res.status(201).json({ data: report });
}));

// GET /api/bug-reports — list all reports (admin only)
router.get('/', requireAdmin, asyncHandler(async (req: AuthRequest, res) => {
  const status = req.query.status as string | undefined;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
  const skip = (page - 1) * limit;

  const where = status && ['OPEN', 'RESOLVED', 'CLOSED'].includes(status)
    ? { status: status as 'OPEN' | 'RESOLVED' | 'CLOSED' }
    : {};

  const [reports, total] = await Promise.all([
    prisma.bugReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true, email: true } } },
      take: limit,
      skip,
    }),
    prisma.bugReport.count({ where }),
  ]);

  res.json({ data: { reports, total, page, limit } });
}));

// PATCH /api/bug-reports/:id — update status (admin only)
router.patch('/:id', requireAdmin, asyncHandler(async (req: AuthRequest, res) => {
  const { status } = statusSchema.parse(req.body);
  const report = await prisma.bugReport.update({
    where: { id: req.params.id },
    data: { status },
  });
  res.json({ data: report });
}));

// DELETE /api/bug-reports/:id — delete a report (admin only)
router.delete('/:id', requireAdmin, asyncHandler(async (_req: AuthRequest, res) => {
  await prisma.bugReport.delete({ where: { id: _req.params.id } });
  res.status(204).send();
}));

export default router;
