import { Router, type IRouter } from 'express';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';

const router: IRouter = Router();
router.use(requireAuth);

// ─── GET / — list all tokens for the authenticated user ─────────────────────

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const tokens = await prisma.mcpToken.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        // Only show last 8 chars of token for security
        token: true,
        lastUsed: true,
        expiresAt: true,
        revoked: true,
        createdAt: true,
      },
    });

    const masked = tokens.map(t => ({
      ...t,
      token: `mcp_...${t.token.slice(-8)}`,
    }));

    res.json({ data: masked });
  } catch (err) { next(err); }
});

// ─── POST / — create a new MCP access token ────────────────────────────────

const createSchema = z.object({
  name: z.string().min(1).max(100),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const body = createSchema.parse(req.body);

    // Limit to 10 active tokens per user
    const activeCount = await prisma.mcpToken.count({
      where: { userId: req.userId!, revoked: false },
    });
    if (activeCount >= 10) {
      res.status(400).json({ error: 'Token limit reached', message: 'Maximum 10 active tokens per user. Revoke unused tokens first.' });
      return;
    }

    // Generate a secure random token with mcp_ prefix
    const rawToken = randomBytes(32).toString('base64url');
    const token = `mcp_${rawToken}`;

    const expiresAt = body.expiresInDays
      ? new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const record = await prisma.mcpToken.create({
      data: {
        userId: req.userId!,
        token,
        name: body.name,
        expiresAt,
      },
    });

    // Return full token ONLY on creation — it won't be shown again
    res.status(201).json({
      data: {
        id: record.id,
        name: record.name,
        token, // full token, shown only once
        expiresAt: record.expiresAt?.toISOString() ?? null,
        createdAt: record.createdAt.toISOString(),
      },
    });
  } catch (err) { next(err); }
});

// ─── DELETE /:id — revoke a token ───────────────────────────────────────────

router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const token = await prisma.mcpToken.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });
    if (!token) {
      res.status(404).json({ error: 'Not Found', message: 'Token not found' });
      return;
    }

    await prisma.mcpToken.update({
      where: { id: req.params.id },
      data: { revoked: true },
    });

    res.json({ data: { success: true } });
  } catch (err) { next(err); }
});

export default router;
