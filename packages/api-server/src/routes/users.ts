import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';
import { asyncHandler, NotFound } from '../lib/errors.js';
import { FeatureFlagsService } from '../services/feature-flags-service.js';

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

// Renderer feature flags — self-mutation, no admin check by design (any
// dogfooder can toggle their own view-renderer flags). See Phase 0 brief §S3
// for the null-as-delete semantic.
const featureFlagsService = new FeatureFlagsService(prisma);

router.get(
  '/me/feature-flags',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const flags = await featureFlagsService.get(req.userId!);
    res.json({ data: flags });
  }),
);

router.patch(
  '/me/feature-flags',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    // FeatureFlagsService.set throws ZodError on unknown keys; the global
    // error middleware turns ZodError into 400 with field-level detail.
    const merged = await featureFlagsService.set(req.userId!, req.body ?? {});
    res.json({ data: merged });
  }),
);

export default router;
