import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { assertProjectAccess } from '../lib/auth-helpers.js';
import { isAdmin } from '../lib/auth-helpers.js';
import { asyncHandler, NotFound, Forbidden } from '../lib/errors.js';
import * as lockOps from '../services/element-lock-ops.js';
import * as notificationOps from '../services/notification-ops.js';
import * as auditOps from '../services/audit-ops.js';

const router: IRouter = Router({ mergeParams: true });

const checkOutSchema = z.object({
  elementName: z.string().min(1).max(500),
});

const notifySchema = z.object({
  elementName: z.string().min(1).max(500),
  fileId: z.string().min(1),
});

router.use(requireAuth);

// ── Element Locks (scoped to project) ───────────────────────────────────────

// List all locks for a file in this project
router.get('/files/:fileId/locks', asyncHandler(async (req: AuthRequest, res) => {
  const access = await assertProjectAccess(req.params.projectId, req.userId!, req.userRole);
  if (!access.allowed) throw NotFound('Project');
  const locks = await lockOps.listFileLocks(req.params.fileId);
  res.json({ data: locks });
}));

// Get lock status for a specific element
router.get('/files/:fileId/locks/:elementName', asyncHandler(async (req: AuthRequest, res) => {
  const access = await assertProjectAccess(req.params.projectId, req.userId!, req.userRole);
  if (!access.allowed) throw NotFound('Project');
  const status = await lockOps.getElementLockStatus(req.params.fileId, decodeURIComponent(req.params.elementName));
  res.json({ data: status });
}));

// Check out an element
router.post('/files/:fileId/locks', asyncHandler(async (req: AuthRequest, res) => {
  const access = await assertProjectAccess(req.params.projectId, req.userId!, req.userRole);
  if (!access.allowed) throw NotFound('Project');
  const { elementName } = checkOutSchema.parse(req.body);
  const lock = await lockOps.checkOutElement(req.params.fileId, elementName, req.userId!);
  res.status(201).json({ data: lock });
}));

// Check in an element
router.delete('/files/:fileId/locks/:elementName', asyncHandler(async (req: AuthRequest, res) => {
  const access = await assertProjectAccess(req.params.projectId, req.userId!, req.userRole);
  if (!access.allowed) throw NotFound('Project');
  const elementName = decodeURIComponent(req.params.elementName);
  const result = await lockOps.checkInElement(req.params.fileId, elementName, req.userId!);
  res.json({ data: result });
}));

// Force check-in (admin / startup admin only)
router.delete('/files/:fileId/locks/:elementName/force', asyncHandler(async (req: AuthRequest, res) => {
  const access = await assertProjectAccess(req.params.projectId, req.userId!, req.userRole);
  if (!access.allowed) throw NotFound('Project');
  if (!isAdmin(req.userRole) && access.startupRole !== 'STARTUP_ADMIN') {
    throw Forbidden('Only admins can force check-in');
  }
  const elementName = decodeURIComponent(req.params.elementName);
  const result = await lockOps.forceCheckIn(req.params.fileId, elementName, req.userId!);
  res.json({ data: result });
}));

// ── Audit Log ───────────────────────────────────────────────────────────────

// Get audit log for a project
router.get('/audit-log', asyncHandler(async (req: AuthRequest, res) => {
  const access = await assertProjectAccess(req.params.projectId, req.userId!, req.userRole);
  if (!access.allowed) throw NotFound('Project');

  const fileId = typeof req.query.fileId === 'string' ? req.query.fileId : undefined;
  const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
  const limit = parseInt(typeof req.query.limit === 'string' ? req.query.limit : '100', 10);
  const offset = parseInt(typeof req.query.offset === 'string' ? req.query.offset : '0', 10);

  const logs = await auditOps.getAuditLog(req.params.projectId, { fileId, userId, limit, offset });
  res.json({ data: logs });
}));

export default router;
