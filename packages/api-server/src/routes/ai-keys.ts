import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';
import { encryptApiKey, maskApiKey } from '../ai/encryption.js';
import { asyncHandler, NotFound, BadRequest } from '../lib/errors.js';
import { provider as providerSchema } from '../config/schemas.js';

const router: IRouter = Router();
router.use(requireAuth);

const VALID_PROVIDERS = ['anthropic', 'openai', 'gemini'] as const;

function validateProvider(provider: string) {
  if (!VALID_PROVIDERS.includes(provider as typeof VALID_PROVIDERS[number])) {
    throw BadRequest('Invalid provider');
  }
  return provider;
}

// ─── GET / — list connected providers (masked keys only) ─────────────────────

router.get('/', asyncHandler(async (req: AuthRequest, res) => {
  const keys = await prisma.aiProviderKey.findMany({
    where: { userId: req.userId! },
    select: { id: true, provider: true, maskedKey: true, model: true, createdAt: true, updatedAt: true },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ data: keys });
}));

// ─── POST / — save or update an API key for a provider ───────────────────────

const saveSchema = z.object({
  provider: providerSchema,
  apiKey: z.string().min(10).max(500),
  model: z.string().min(1).max(100),
});

router.post('/', asyncHandler(async (req: AuthRequest, res) => {
  const { provider, apiKey, model } = saveSchema.parse(req.body);

  const { encrypted, iv, authTag } = encryptApiKey(apiKey);
  const masked = maskApiKey(apiKey);

  await prisma.aiProviderKey.upsert({
    where: { userId_provider: { userId: req.userId!, provider } },
    create: { userId: req.userId!, provider, encryptedKey: encrypted, iv, authTag, maskedKey: masked, model },
    update: { encryptedKey: encrypted, iv, authTag, maskedKey: masked, model },
  });

  res.json({ data: { provider, maskedKey: masked, model } });
}));

// ─── PATCH /:provider — update model only (no key change) ────────────────────

const updateModelSchema = z.object({
  model: z.string().min(1).max(100),
});

router.patch('/:provider', asyncHandler(async (req: AuthRequest, res) => {
  const provider = validateProvider(req.params.provider);
  const { model } = updateModelSchema.parse(req.body);

  const key = await prisma.aiProviderKey.findUnique({
    where: { userId_provider: { userId: req.userId!, provider } },
  });
  if (!key) throw NotFound('Key for this provider');

  await prisma.aiProviderKey.update({
    where: { userId_provider: { userId: req.userId!, provider } },
    data: { model },
  });

  res.json({ data: { provider, model } });
}));

// ─── DELETE /:provider — remove a provider's key ─────────────────────────────

router.delete('/:provider', asyncHandler(async (req: AuthRequest, res) => {
  const provider = validateProvider(req.params.provider);

  const key = await prisma.aiProviderKey.findUnique({
    where: { userId_provider: { userId: req.userId!, provider } },
  });
  if (!key) throw NotFound('Key for this provider');

  await prisma.aiProviderKey.delete({
    where: { userId_provider: { userId: req.userId!, provider } },
  });
  res.json({ data: { success: true } });
}));

export default router;
