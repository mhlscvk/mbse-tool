import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { assertProjectAccess, assertWriteAccess } from '../lib/auth-helpers.js';
import { asyncHandler, NotFound } from '../lib/errors.js';
import * as fileOps from '../services/file-ops.js';
import { fileName, fileContent } from '../config/schemas.js';

const router: IRouter = Router({ mergeParams: true });

router.use(requireAuth);

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
  assertWriteAccess(await assertProjectAccess(req.params.projectId, req.userId!, req.userRole));
  const { name, content } = fileCreateSchema.parse(req.body);
  const file = await fileOps.createFile(req.params.projectId, name, content, req.userId!);
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
  assertWriteAccess(await assertProjectAccess(req.params.projectId, req.userId!, req.userRole));
  const { content } = fileUpdateSchema.parse(req.body);
  // Verify file exists in this project first
  await fileOps.getFile(req.params.fileId, req.params.projectId);
  const updated = await fileOps.updateFileContent(req.params.fileId, content, req.userId!);
  res.json({ data: updated });
}));

// Rename file (blocked for system projects unless admin)
router.patch('/:fileId', asyncHandler(async (req: AuthRequest, res) => {
  assertWriteAccess(await assertProjectAccess(req.params.projectId, req.userId!, req.userRole));
  const { name } = fileRenameSchema.parse(req.body);
  await fileOps.getFile(req.params.fileId, req.params.projectId);
  const updated = await fileOps.renameFile(req.params.fileId, name);
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
  assertWriteAccess(await assertProjectAccess(req.params.projectId, req.userId!, req.userRole));
  await fileOps.getFile(req.params.fileId, req.params.projectId);
  await fileOps.deleteFile(req.params.fileId, req.userId!);
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
