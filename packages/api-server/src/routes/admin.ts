import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);
router.use(requireAdmin);

// POST /api/admin/sync-examples — re-import examples from prisma/examples/ directory
router.post('/sync-examples', async (_req: AuthRequest, res, next) => {
  try {
    // Dynamic import to avoid loading Prisma seed logic at startup
    const { importExamples } = await import('../../prisma/seed-examples.js');
    await importExamples();
    res.json({ data: { message: 'Examples synced successfully' } });
  } catch (err) { next(err); }
});

export default router;
