import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { requireAuth, requireAdmin, type AuthRequest } from '../middleware/auth.js';
import { asyncHandler, NotFound, Forbidden } from '../lib/errors.js';
import * as startupOps from '../services/startup-ops.js';

const router: IRouter = Router();

const createSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes'),
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/).optional(),
});

const addMemberSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['STARTUP_ADMIN', 'STARTUP_USER']),
});

const updateRoleSchema = z.object({
  role: z.enum(['STARTUP_ADMIN', 'STARTUP_USER']),
});

router.use(requireAuth);

// List startups visible to the current user (site admins see all)
router.get('/', asyncHandler(async (req: AuthRequest, res) => {
  if (req.userRole?.toUpperCase() === 'ADMIN') {
    const startups = await startupOps.listStartups();
    res.json({ data: startups });
  } else {
    const startups = await startupOps.listUserStartups(req.userId!);
    res.json({ data: startups });
  }
}));

// Create startup (site admin only)
router.post('/', requireAdmin, asyncHandler(async (req: AuthRequest, res) => {
  const body = createSchema.parse(req.body);
  const startup = await startupOps.createStartup(body.name, body.slug, req.userId!);
  res.status(201).json({ data: startup });
}));

// Get single startup
router.get('/:startupId', asyncHandler(async (req: AuthRequest, res) => {
  const access = await startupOps.assertStartupAccess(req.params.startupId, req.userId!, req.userRole);
  if (!access.allowed) throw NotFound('Startup');
  const startup = await startupOps.getStartup(req.params.startupId);
  res.json({ data: startup });
}));

// Update startup (startup admin or site admin)
router.patch('/:startupId', asyncHandler(async (req: AuthRequest, res) => {
  const access = await startupOps.assertStartupAccess(req.params.startupId, req.userId!, req.userRole);
  startupOps.assertStartupWriteAccess(access);
  const body = updateSchema.parse(req.body);
  const updated = await startupOps.updateStartup(req.params.startupId, body);
  res.json({ data: updated });
}));

// Delete startup (site admin only)
router.delete('/:startupId', requireAdmin, asyncHandler(async (req: AuthRequest, res) => {
  await startupOps.deleteStartup(req.params.startupId);
  res.status(204).send();
}));

// ── Member Management ───────────────────────────────────────────────────────

// List members of a startup
router.get('/:startupId/members', asyncHandler(async (req: AuthRequest, res) => {
  const access = await startupOps.assertStartupAccess(req.params.startupId, req.userId!, req.userRole);
  if (!access.allowed) throw NotFound('Startup');
  const members = await startupOps.listMembers(req.params.startupId);
  res.json({ data: members });
}));

// Add member (startup admin or site admin)
router.post('/:startupId/members', asyncHandler(async (req: AuthRequest, res) => {
  const access = await startupOps.assertStartupAccess(req.params.startupId, req.userId!, req.userRole);
  startupOps.assertStartupWriteAccess(access);
  const body = addMemberSchema.parse(req.body);
  const member = await startupOps.addMember(req.params.startupId, body.userId, body.role);
  res.status(201).json({ data: member });
}));

// Update member role (startup admin or site admin)
router.patch('/:startupId/members/:userId', asyncHandler(async (req: AuthRequest, res) => {
  const access = await startupOps.assertStartupAccess(req.params.startupId, req.userId!, req.userRole);
  startupOps.assertStartupWriteAccess(access);
  const body = updateRoleSchema.parse(req.body);
  const updated = await startupOps.updateMemberRole(req.params.startupId, req.params.userId, body.role);
  res.json({ data: updated });
}));

// Remove member (startup admin or site admin)
router.delete('/:startupId/members/:userId', asyncHandler(async (req: AuthRequest, res) => {
  const access = await startupOps.assertStartupAccess(req.params.startupId, req.userId!, req.userRole);
  startupOps.assertStartupWriteAccess(access);
  await startupOps.removeMember(req.params.startupId, req.params.userId);
  res.status(204).send();
}));

export default router;
