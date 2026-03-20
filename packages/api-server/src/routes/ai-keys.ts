import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';
import { encryptApiKey, maskApiKey } from '../ai/encryption.js';

const router: IRouter = Router();
router.use(requireAuth);

// ─── GET / — list connected providers (masked keys only) ─────────────────────

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const keys = await prisma.aiProviderKey.findMany({
      where: { userId: req.userId! },
      select: { id: true, provider: true, maskedKey: true, model: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ data: keys });
  } catch (err) { next(err); }
});

// ─── POST / — save or update an API key for a provider ───────────────────────

const saveSchema = z.object({
  provider: z.enum(['anthropic', 'openai', 'gemini']),
  apiKey: z.string().min(10).max(500),
  model: z.string().min(1).max(100),
});

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const { provider, apiKey, model } = saveSchema.parse(req.body);

    const { encrypted, iv, authTag } = encryptApiKey(apiKey);
    const masked = maskApiKey(apiKey);

    await prisma.aiProviderKey.upsert({
      where: { userId_provider: { userId: req.userId!, provider } },
      create: {
        userId: req.userId!,
        provider,
        encryptedKey: encrypted,
        iv,
        authTag,
        maskedKey: masked,
        model,
      },
      update: {
        encryptedKey: encrypted,
        iv,
        authTag,
        maskedKey: masked,
        model,
      },
    });

    // Return masked key confirmation (full key never sent back — user already has it)
    res.json({
      data: {
        provider,
        maskedKey: masked,
        model,
      },
    });
  } catch (err) { next(err); }
});

// ─── PATCH /:provider — update model only (no key change) ────────────────────

const updateModelSchema = z.object({
  model: z.string().min(1).max(100),
});

const validProviders = ['anthropic', 'openai', 'gemini'] as const;

router.patch('/:provider', async (req: AuthRequest, res, next) => {
  try {
    const provider = req.params.provider;
    if (!validProviders.includes(provider as typeof validProviders[number])) {
      res.status(400).json({ error: 'Bad Request', message: 'Invalid provider' }); return;
    }
    const { model } = updateModelSchema.parse(req.body);

    const key = await prisma.aiProviderKey.findUnique({
      where: { userId_provider: { userId: req.userId!, provider } },
    });
    if (!key) {
      res.status(404).json({ error: 'No key configured for this provider' });
      return;
    }

    await prisma.aiProviderKey.update({
      where: { userId_provider: { userId: req.userId!, provider } },
      data: { model },
    });

    res.json({ data: { provider, model } });
  } catch (err) { next(err); }
});

// ─── DELETE /:provider — remove a provider's key ─────────────────────────────

router.delete('/:provider', async (req: AuthRequest, res, next) => {
  try {
    const provider = req.params.provider;
    if (!validProviders.includes(provider as typeof validProviders[number])) {
      res.status(400).json({ error: 'Bad Request', message: 'Invalid provider' }); return;
    }
    const key = await prisma.aiProviderKey.findUnique({
      where: { userId_provider: { userId: req.userId!, provider } },
    });
    if (!key) {
      res.status(404).json({ error: 'No key configured for this provider' });
      return;
    }
    await prisma.aiProviderKey.delete({
      where: { userId_provider: { userId: req.userId!, provider } },
    });
    res.json({ data: { success: true } });
  } catch (err) { next(err); }
});

export default router;
