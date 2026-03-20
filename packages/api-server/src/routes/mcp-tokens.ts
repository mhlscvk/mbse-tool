import { Router, type IRouter } from 'express';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';
import { asyncHandler, NotFound, BadRequest } from '../lib/errors.js';

const router: IRouter = Router();
router.use(requireAuth);

// ─── GET / — list all tokens for the authenticated user ─────────────────────

router.get('/', asyncHandler(async (req: AuthRequest, res) => {
  const tokens = await prisma.mcpToken.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, token: true, lastUsed: true, expiresAt: true, revoked: true, createdAt: true },
  });

  const masked = tokens.map((t: typeof tokens[number]) => ({
    ...t,
    token: `mcp_...${t.token.slice(-8)}`,
  }));

  res.json({ data: masked });
}));

// ─── POST / — create a new MCP access token ────────────────────────────────

const createSchema = z.object({
  name: z.string().min(1).max(100),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

router.post('/', asyncHandler(async (req: AuthRequest, res) => {
  const body = createSchema.parse(req.body);

  const activeCount = await prisma.mcpToken.count({
    where: { userId: req.userId!, revoked: false },
  });
  if (activeCount >= 10) {
    throw BadRequest('Maximum 10 active tokens per user. Revoke unused tokens first.');
  }

  const rawToken = randomBytes(32).toString('base64url');
  const token = `mcp_${rawToken}`;

  const expiresAt = body.expiresInDays
    ? new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const record = await prisma.mcpToken.create({
    data: { userId: req.userId!, token, name: body.name, expiresAt },
  });

  res.status(201).json({
    data: {
      id: record.id, name: record.name, token,
      expiresAt: record.expiresAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
    },
  });
}));

// ─── DELETE /:id — revoke a token ───────────────────────────────────────────

router.delete('/:id', asyncHandler(async (req: AuthRequest, res) => {
  const token = await prisma.mcpToken.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!token) throw NotFound('Token');

  await prisma.mcpToken.update({
    where: { id: req.params.id },
    data: { revoked: true },
  });

  res.json({ data: { success: true } });
}));

export default router;
