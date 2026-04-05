import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { assertProjectAccess, assertWriteAccess } from '../lib/auth-helpers.js';
import { asyncHandler, NotFound } from '../lib/errors.js';
import { prisma } from '../db.js';
import * as fileOps from '../services/file-ops.js';
import { fileName, fileContent } from '../config/schemas.js';
import { syncFileToDisk, removeFileFromDisk, renameFileOnDisk } from '../services/examples-sync.js';
import { mcpEvents, type FileChangeEvent } from '../mcp/events.js';

const router: IRouter = Router({ mergeParams: true });

// ─── SSE: real-time MCP edit notifications for the web client ────────────────
// Uses a short-lived, purpose-limited SSE token (not the full session JWT)
// to avoid exposing the session token in query strings / logs.

router.get('/:fileId/events', async (req: AuthRequest, res) => {
  const sseToken = req.query.token as string;
  if (!sseToken) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const jwt = await import('jsonwebtoken');
  const secret = process.env.JWT_SECRET;
  if (!secret) { res.status(500).json({ error: 'Server misconfigured' }); return; }
  let userId: string;
  let userRole: string | undefined;
  try {
    const payload = jwt.default.verify(sseToken, secret, { algorithms: ['HS256'] }) as { userId: string; role?: string; purpose?: string };
    // Accept both SSE-specific tokens and regular JWTs (backward compat)
    if (payload.purpose && payload.purpose !== 'sse') { res.status(401).json({ error: 'Invalid token' }); return; }
    userId = payload.userId;
    userRole = payload.role;
  } catch {
    res.status(401).json({ error: 'Invalid token' }); return;
  }

  const { projectId, fileId } = req.params;
  try {
    const access = await assertProjectAccess(projectId, userId, userRole);
    if (!access.allowed) { res.status(404).json({ error: 'File not found' }); return; }
  } catch {
    res.status(404).json({ error: 'File not found' }); return;
  }
  const file = await prisma.sysMLFile.findFirst({ where: { id: fileId, projectId } });
  if (!file) { res.status(404).json({ error: 'File not found' }); return; }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const keepalive = setInterval(() => { res.write(': keepalive\n\n'); }, 30_000);

  const handler = (event: FileChangeEvent) => {
    if (event.fileId !== fileId) return;
    if (event.source !== 'mcp') return;
    res.write(`data: ${JSON.stringify({ fileId: event.fileId, action: event.action })}\n\n`);
  };

  mcpEvents.onFileChange(handler);
  req.on('close', () => {
    clearInterval(keepalive);
    mcpEvents.offFileChange(handler);
  });
});

router.use(requireAuth);

// Mint a short-lived SSE token (60s) — prevents full JWT from leaking in query strings
router.post('/:fileId/sse-token', asyncHandler(async (req: AuthRequest, res) => {
  const access = await assertProjectAccess(req.params.projectId, req.userId!, req.userRole);
  if (!access.allowed) throw NotFound('Project');
  const file = await prisma.sysMLFile.findFirst({ where: { id: req.params.fileId, projectId: req.params.projectId } });
  if (!file) throw NotFound('File');
  const jwt = await import('jsonwebtoken');
  const secret = process.env.JWT_SECRET!;
  const sseToken = jwt.default.sign(
    { userId: req.userId, role: req.userRole, purpose: 'sse' },
    secret,
    { algorithm: 'HS256', expiresIn: '60s' },
  );
  res.json({ token: sseToken });
}));

const fileCreateSchema = z.object({ name: fileName, content: fileContent });
const fileUpdateSchema = z.object({ content: fileContent });
const fileRenameSchema = z.object({ name: fileName });

// List files (read — allowed for system projects)
router.get('/', asyncHandler(async (req: AuthRequest, res) => {
  const access = await assertProjectAccess(req.params.projectId, req.userId!, req.userRole);
  if (!access.allowed) throw NotFound('Project');
  const files = await fileOps.listFiles(req.params.projectId);
  res.json({ data: files });
}));

// Create file (blocked for system projects unless admin)
router.post('/', asyncHandler(async (req: AuthRequest, res) => {
  const access = await assertProjectAccess(req.params.projectId, req.userId!, req.userRole);
  assertWriteAccess(access);
  const { name, content } = fileCreateSchema.parse(req.body);
  const file = await fileOps.createFile(req.params.projectId, name, content, req.userId!);
  if (access.isSystem) syncFileToDisk(file.id);
  res.status(201).json({ data: file });
}));

// Get file (read — allowed for system projects)
router.get('/:fileId', asyncHandler(async (req: AuthRequest, res) => {
  const access = await assertProjectAccess(req.params.projectId, req.userId!, req.userRole);
  if (!access.allowed) throw NotFound('Project');
  const file = await fileOps.getFile(req.params.fileId, req.params.projectId);
  res.json({ data: file });
}));

// Update file content (blocked for system projects unless admin)
router.put('/:fileId', asyncHandler(async (req: AuthRequest, res) => {
  const access = await assertProjectAccess(req.params.projectId, req.userId!, req.userRole);
  assertWriteAccess(access);
  const { content } = fileUpdateSchema.parse(req.body);
  await fileOps.getFile(req.params.fileId, req.params.projectId);
  const updated = await fileOps.updateFileContent(req.params.fileId, content, req.userId!);
  if (access.isSystem) syncFileToDisk(updated.id);
  res.json({ data: updated });
}));

// Rename file (blocked for system projects unless admin)
router.patch('/:fileId', asyncHandler(async (req: AuthRequest, res) => {
  const access = await assertProjectAccess(req.params.projectId, req.userId!, req.userRole);
  assertWriteAccess(access);
  const { name } = fileRenameSchema.parse(req.body);
  const oldFile = await fileOps.getFile(req.params.fileId, req.params.projectId);
  const updated = await fileOps.renameFile(req.params.fileId, name);
  if (access.isSystem) {
    const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
    if (project) renameFileOnDisk(project.name, oldFile.name, updated.name);
  }
  res.json({ data: updated });
}));

// Download file (allowed for system projects)
router.get('/:fileId/download', asyncHandler(async (req: AuthRequest, res) => {
  const access = await assertProjectAccess(req.params.projectId, req.userId!, req.userRole);
  if (!access.allowed) throw NotFound('Project');
  const file = await fileOps.getFile(req.params.fileId, req.params.projectId);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`);
  res.send(file.content);
}));

// Delete file (blocked for system projects unless admin)
router.delete('/:fileId', asyncHandler(async (req: AuthRequest, res) => {
  const access = await assertProjectAccess(req.params.projectId, req.userId!, req.userRole);
  assertWriteAccess(access);
  const file = await fileOps.getFile(req.params.fileId, req.params.projectId);
  await fileOps.deleteFile(req.params.fileId, req.userId!);
  if (access.isSystem) {
    const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
    if (project) removeFileFromDisk(project.name, file.name);
  }
  res.status(204).send();
}));

// Move file to another project (admin can move between system projects)
router.post('/:fileId/move', asyncHandler(async (req: AuthRequest, res) => {
  const { targetProjectId } = z.object({ targetProjectId: z.string().min(1) }).parse(req.body);
  // Check access on source project
  assertWriteAccess(await assertProjectAccess(req.params.projectId, req.userId!, req.userRole));
  // Check access on target project
  assertWriteAccess(await assertProjectAccess(targetProjectId, req.userId!, req.userRole));
  // Verify file exists
  await fileOps.getFile(req.params.fileId, req.params.projectId);
  const updated = await fileOps.moveFile(req.params.fileId, targetProjectId, req.userId!);
  res.json({ data: updated });
}));

export default router;
