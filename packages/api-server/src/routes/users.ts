import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';
import { asyncHandler, NotFound } from '../lib/errors.js';

const router: IRouter = Router();

const SUPPORTED_LANGUAGES = ['tr', 'en'] as const;

const preferencesSchema = z.object({
  preferredLanguage: z.enum(SUPPORTED_LANGUAGES),
});

router.patch(
  '/me/preferences',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const { preferredLanguage } = preferencesSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { preferredLanguage },
      select: { id: true, preferredLanguage: true },
    }).catch(() => null);

    if (!user) throw NotFound('User');

    res.json({ data: user });
  }),
);

export default router;
