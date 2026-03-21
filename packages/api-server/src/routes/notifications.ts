import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { asyncHandler } from '../lib/errors.js';
import * as notificationOps from '../services/notification-ops.js';

const router: IRouter = Router();

const createSchema = z.object({
  elementName: z.string().min(1).max(500),
  fileId: z.string().min(1),
});

router.use(requireAuth);

// List notifications for current user
router.get('/', asyncHandler(async (req: AuthRequest, res) => {
  const unreadOnly = req.query.unread === 'true';
  const notifications = await notificationOps.listNotifications(req.userId!, unreadOnly);
  res.json({ data: notifications });
}));

// Get unread count
router.get('/unread-count', asyncHandler(async (req: AuthRequest, res) => {
  const count = await notificationOps.getUnreadCount(req.userId!);
  res.json({ data: { count } });
}));

// Send a lock request notification to the element holder
router.post('/', asyncHandler(async (req: AuthRequest, res) => {
  const body = createSchema.parse(req.body);
  const notification = await notificationOps.createLockNotification(
    body.elementName,
    body.fileId,
    req.userId!,
  );
  res.status(201).json({ data: notification });
}));

// Mark a notification as read
router.patch('/:id/read', asyncHandler(async (req: AuthRequest, res) => {
  const notification = await notificationOps.markNotificationRead(req.params.id, req.userId!);
  res.json({ data: notification });
}));

// Mark all notifications as read
router.post('/mark-all-read', asyncHandler(async (req: AuthRequest, res) => {
  await notificationOps.markAllNotificationsRead(req.userId!);
  res.json({ data: { success: true } });
}));

export default router;
