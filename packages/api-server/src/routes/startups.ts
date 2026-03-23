import { Router, type IRouter } from 'express';
import { z } from 'zod';
import nodemailer from 'nodemailer';
import { requireAuth, requireAdmin, type AuthRequest } from '../middleware/auth.js';
import { asyncHandler, NotFound, Forbidden, BadRequest } from '../lib/errors.js';
import * as startupOps from '../services/startup-ops.js';
import { prisma } from '../db.js';

const router: IRouter = Router();

// ── Email helper for invitations ────────────────────────────────────────────
function getMailTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function sendInvitationEmail(email: string, startupName: string, inviterName: string) {
  const baseUrl = process.env.APP_URL ?? 'https://systemodel.com';
  const registerUrl = `${baseUrl}/login?register=true`;
  const transporter = getMailTransporter();

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? '"Systemodel" <noreply@systemodel.com>',
    to: email,
    subject: `You've been invited to ${startupName} on Systemodel`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #569cd6;">You're Invited!</h2>
        <p><strong>${inviterName}</strong> has invited you to join <strong>${startupName}</strong> on Systemodel — a SysML v2 web modeling platform.</p>
        <p>Create your account to get started:</p>
        <a href="${registerUrl}" style="display: inline-block; background: #0e639c; color: #fff; padding: 12px 24px; border-radius: 4px; text-decoration: none; font-weight: bold;">
          Join ${startupName}
        </a>
        <p style="color: #888; font-size: 13px; margin-top: 24px;">
          Or copy this link: <br/>${registerUrl}
        </p>
        <p style="color: #888; font-size: 12px;">Once you register with this email address (${email}), you'll automatically be added to ${startupName}.</p>
      </div>
    `,
  });
}

async function sendMemberAddedEmail(email: string, startupName: string, inviterName: string) {
  const baseUrl = process.env.APP_URL ?? 'https://systemodel.com';
  const transporter = getMailTransporter();

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? '"Systemodel" <noreply@systemodel.com>',
    to: email,
    subject: `You've been added to ${startupName} on Systemodel`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #569cd6;">Welcome to ${startupName}!</h2>
        <p><strong>${inviterName}</strong> has added you to <strong>${startupName}</strong> on Systemodel.</p>
        <p>You can now access the team's projects and files:</p>
        <a href="${baseUrl}" style="display: inline-block; background: #0e639c; color: #fff; padding: 12px 24px; border-radius: 4px; text-decoration: none; font-weight: bold;">
          Open Systemodel
        </a>
        <p style="color: #888; font-size: 12px; margin-top: 24px;">Log in with your existing account to see ${startupName}'s projects.</p>
      </div>
    `,
  });
}

const createSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes'),
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/).optional(),
});

const addMemberSchema = z.object({
  userId: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(['STARTUP_ADMIN', 'STARTUP_USER']),
}).refine(d => d.userId || d.email, { message: 'Either userId or email is required' });

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

// Add member (startup admin or site admin) — accepts userId or email
// If the email doesn't belong to an existing user, creates a pending invitation
router.post('/:startupId/members', asyncHandler(async (req: AuthRequest, res) => {
  const access = await startupOps.assertStartupAccess(req.params.startupId, req.userId!, req.userRole);
  startupOps.assertStartupWriteAccess(access);
  const body = addMemberSchema.parse(req.body);

  let userId = body.userId;
  if (!userId && body.email) {
    const email = body.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Create a pending invitation instead
      const invitation = await prisma.startupInvitation.upsert({
        where: { startupId_email: { startupId: req.params.startupId, email } },
        update: { role: body.role },
        create: { startupId: req.params.startupId, email, role: body.role, invitedBy: req.userId! },
      });

      // Send invitation email (non-blocking — don't fail the request if email fails)
      const startup = await startupOps.getStartup(req.params.startupId);
      const inviter = await prisma.user.findUnique({ where: { id: req.userId! }, select: { name: true, email: true } });
      const startupName = startup?.name ?? 'an enterprise';
      const inviterName = inviter?.name ?? inviter?.email ?? 'A team member';
      sendInvitationEmail(email, startupName, inviterName).catch((err) => {
        console.error(`[STARTUP] Failed to send invitation email to ${email}:`, err.message);
      });

      res.status(201).json({ data: { invitation, pending: true, message: `Invitation sent to ${email}. They will be added automatically when they register.` } });
      return;
    }
    userId = user.id;
  }

  const member = await startupOps.addMember(req.params.startupId, userId!, body.role);

  // Notify existing user they've been added (non-blocking)
  if (body.email) {
    const startup = await startupOps.getStartup(req.params.startupId);
    const inviter = await prisma.user.findUnique({ where: { id: req.userId! }, select: { name: true, email: true } });
    const startupName = startup?.name ?? 'an enterprise';
    const inviterName = inviter?.name ?? inviter?.email ?? 'A team member';
    sendMemberAddedEmail(body.email.toLowerCase(), startupName, inviterName).catch((err) => {
      console.error(`[STARTUP] Failed to send member-added email to ${body.email}:`, err.message);
    });
  }

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

// ── Pending Invitations ─────────────────────────────────────────────────────

// List pending invitations for a startup
router.get('/:startupId/invitations', asyncHandler(async (req: AuthRequest, res) => {
  const access = await startupOps.assertStartupAccess(req.params.startupId, req.userId!, req.userRole);
  if (!access.allowed) throw NotFound('Startup');
  const invitations = await prisma.startupInvitation.findMany({
    where: { startupId: req.params.startupId },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: invitations });
}));

// Revoke a pending invitation
router.delete('/:startupId/invitations/:invitationId', asyncHandler(async (req: AuthRequest, res) => {
  const access = await startupOps.assertStartupAccess(req.params.startupId, req.userId!, req.userRole);
  startupOps.assertStartupWriteAccess(access);
  await prisma.startupInvitation.delete({ where: { id: req.params.invitationId } });
  res.status(204).send();
}));

export default router;
