import { prisma } from '../db.js';
import { mcpEvents } from '../mcp/events.js';
import {
  MAX_FILE_BYTES,
  MAX_FILE_NAME_LENGTH,
  MAX_SEARCH_QUERY_LENGTH,
  MAX_SEARCH_RESULTS,
  MAX_SEARCH_FILES,
  MAX_LINE_PREVIEW_LENGTH,
} from '../config/constants.js';
import { NotFound, BadRequest, PayloadTooLarge } from '../lib/errors.js';
import { generateFileDisplayId } from '../lib/id-generator.js';

// ── Pure business logic — no Express, no MCP SDK ─────────────────────────────

/**
 * Normalize a file name to always end with exactly one `.sysml` extension.
 * - Trims whitespace
 * - Strips any existing extension(s)
 * - Appends `.sysml` (lowercase)
 * - Handles edge cases: multiple dots, uppercase variants, double extensions
 */
export function normalizeSysMLFileName(name: string): string {
  let base = name.trim();
  // Strip dangerous chars first
  base = base.replace(/[\\/\0]/g, '');
  if (!base) return '';

  // Repeatedly strip extensions until only the base name remains
  // This handles: "file.sysml.txt" → "file.sysml" → "file"
  //               "file.SYSML" → "file"
  //               "file.txt" → "file"
  let prev = '';
  while (prev !== base) {
    prev = base;
    base = base.replace(/\.sysml$/i, '');
    // Strip any other extension (last .xxx)
    const dotIdx = base.lastIndexOf('.');
    if (dotIdx > 0 && dotIdx < base.length - 1) {
      base = base.slice(0, dotIdx);
    }
  }
  // Remove leading dots (hidden file names like ".file")
  base = base.replace(/^\.+/, '');

  if (!base) return '';
  return base + '.sysml';
}

export function sanitizeFileName(name: string): string {
  const normalized = normalizeSysMLFileName(name);
  if (!normalized) throw BadRequest('Invalid file name');
  // Ensure truncation preserves .sysml extension
  if (normalized.length <= MAX_FILE_NAME_LENGTH) return normalized;
  const base = normalized.slice(0, MAX_FILE_NAME_LENGTH - 6); // leave room for .sysml
  return base + '.sysml';
}

/** Extract the base name from a .sysml filename (strip extension) */
export function extractBaseName(fileName: string): string {
  return fileName.replace(/\.sysml$/i, '').trim() || 'untitled';
}

/** Check if a name is a valid SysML v2 identifier (no quoting needed) */
export function isValidSysMLIdentifier(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

/** Format a name for use in a SysML package declaration (quote if needed) */
export function formatSysMLPackageName(name: string): string {
  const base = name.trim() || 'untitled';
  return isValidSysMLIdentifier(base) ? base : `'${base}'`;
}

/** Generate a root package block for initial file content */
export function generateRootPackage(fileName: string): string {
  const base = extractBaseName(fileName);
  const pkgName = formatSysMLPackageName(base);
  return `package ${pkgName} {\n  // SysML v2 model\n}\n`;
}

/**
 * Update the root package name in file content when a file is renamed.
 * Only updates if the content starts with `package <oldName>` pattern.
 * Returns null if no safe update can be made.
 */
export function updateRootPackageName(content: string, oldFileName: string, newFileName: string): string | null {
  const oldBase = extractBaseName(oldFileName);
  const newBase = extractBaseName(newFileName);
  if (oldBase === newBase) return null; // no change needed

  const oldPkg = formatSysMLPackageName(oldBase);
  const newPkg = formatSysMLPackageName(newBase);

  // Match root package declaration at the start of the file (with optional leading whitespace/comments)
  const rootPkgPattern = new RegExp(
    `^(\\s*(?:\\/\\/[^\\n]*\\n\\s*)*)package\\s+${escapeRegExp(oldPkg)}\\s*\\{`,
    'm',
  );

  if (!rootPkgPattern.test(content)) return null; // can't safely update

  return content.replace(rootPkgPattern, `$1package ${newPkg} {`);
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function assertContentSize(content: string): number {
  const size = Buffer.byteLength(content, 'utf8');
  if (size > MAX_FILE_BYTES) {
    throw PayloadTooLarge(`Content exceeds ${MAX_FILE_BYTES} byte limit`);
  }
  return size;
}

export async function listFiles(projectId: string) {
  return prisma.sysMLFile.findMany({
    where: { projectId },
    select: { id: true, name: true, size: true, createdAt: true, updatedAt: true },
  });
}

export async function getFile(fileId: string, projectId: string) {
  const file = await prisma.sysMLFile.findFirst({
    where: { id: fileId, projectId },
  });
  if (!file) throw NotFound('File');
  return file;
}

/**
 * Read a file after verifying the user has access to its project.
 * Supports all project types: USER (owner), STARTUP (member), SYSTEM (all).
 * Pass userRole when available for admin access.
 */
export async function readFileWithAccessCheck(fileId: string, userId: string, userRole?: string) {
  const file = await prisma.sysMLFile.findUnique({
    where: { id: fileId },
    include: { project: true },
  });
  if (!file) throw NotFound('File');

  const { assertProjectAccess } = await import('../lib/auth-helpers.js');
  const access = await assertProjectAccess(file.projectId, userId, userRole);
  if (!access.allowed) throw NotFound('File');
  return file;
}

/** @deprecated Use readFileWithAccessCheck — this only checks project ownership, not startup membership */
export async function readFileWithOwnerCheck(fileId: string, userId: string) {
  return readFileWithAccessCheck(fileId, userId);
}

export async function createFile(
  projectId: string,
  name: string,
  content: string,
  userId: string,
  source?: 'mcp' | 'ai_chat' | 'rest',
) {
  const safeName = sanitizeFileName(name);
  const size = assertContentSize(content);
  const displayId = generateFileDisplayId();
  const file = await prisma.sysMLFile.create({
    data: { name: safeName, content, size, projectId, displayId },
  });
  mcpEvents.emitFileChange({ fileId: file.id, userId, action: 'created', source });
  return file;
}

export async function updateFileContent(
  fileId: string,
  content: string,
  userId: string,
  source?: 'mcp' | 'ai_chat' | 'rest',
) {
  const size = assertContentSize(content);
  const updated = await prisma.sysMLFile.update({
    where: { id: fileId },
    data: { content, size },
  });
  mcpEvents.emitFileChange({ fileId, userId, action: 'updated', source });
  return updated;
}

export async function renameFile(fileId: string, name: string) {
  const safeName = sanitizeFileName(name);

  // Try to update root package name in file content to match new name
  const existing = await prisma.sysMLFile.findUnique({ where: { id: fileId }, select: { name: true, content: true } });
  const data: { name: string; content?: string; size?: number } = { name: safeName };
  if (existing?.content) {
    const updated = updateRootPackageName(existing.content, existing.name, safeName);
    if (updated !== null) {
      data.content = updated;
      data.size = Buffer.byteLength(updated, 'utf8');
    }
  }

  return prisma.sysMLFile.update({ where: { id: fileId }, data });
}

export async function deleteFile(fileId: string, userId: string, source?: 'mcp' | 'ai_chat' | 'rest') {
  const file = await prisma.sysMLFile.findUnique({ where: { id: fileId } });
  if (!file) throw NotFound('File');
  await prisma.sysMLFile.delete({ where: { id: fileId } });
  mcpEvents.emitFileChange({ fileId, userId, action: 'deleted', source });
  return file;
}

export async function moveFile(
  fileId: string,
  targetProjectId: string,
  userId: string,
) {
  const updated = await prisma.sysMLFile.update({
    where: { id: fileId },
    data: { projectId: targetProjectId },
  });
  mcpEvents.emitFileChange({ fileId, userId, action: 'updated' });
  return updated;
}

export async function applyEdit(
  fileId: string,
  startLine: number,
  startColumn: number,
  endLine: number,
  endColumn: number,
  newText: string,
  userId: string,
  source?: 'mcp' | 'ai_chat' | 'rest',
  userRole?: string,
) {
  // Verify access before the transaction (assertProjectAccess can't run inside $transaction)
  const { assertProjectAccess } = await import('../lib/auth-helpers.js');
  const check = await prisma.sysMLFile.findUnique({ where: { id: fileId }, include: { project: true } });
  if (!check) return { error: 'Error: File not found or access denied' };
  const access = await assertProjectAccess(check.projectId, userId, userRole);
  if (!access.allowed) return { error: 'Error: File not found or access denied' };
  if (access.isSystem && !access.isAdmin) return { error: 'Error: System files are read-only' };

  const result = await prisma.$transaction(async (tx) => {
    const file = await tx.sysMLFile.findUnique({
      where: { id: fileId },
      include: { project: { select: { ownerId: true } } },
    });
    if (!file) return 'Error: File not found';

    const lines = file.content.split('\n');
    if (startLine < 1 || endLine > lines.length || startLine > endLine) {
      return `Error: Invalid line range (file has ${lines.length} lines)`;
    }

    const sl = startLine - 1, el = endLine - 1;
    const sc = startColumn - 1, ec = endColumn - 1;

    if (sc < 0 || sc > lines[sl].length) return 'Error: startColumn out of range';
    if (ec < 0 || ec > lines[el].length) return 'Error: endColumn out of range';
    if (sl === el && sc > ec) return 'Error: startColumn exceeds endColumn on same line';
    if (lines.length === 1 && lines[0] === '' && (sc > 0 || ec > 0)) return 'Error: File is empty';

    const before = lines.slice(0, sl).join('\n') + (sl > 0 ? '\n' : '') + lines[sl].substring(0, sc);
    const after = lines[el].substring(ec) + (el < lines.length - 1 ? '\n' : '') + lines.slice(el + 1).join('\n');
    const newContent = before + newText + after;
    const newSize = Buffer.byteLength(newContent, 'utf8');

    await tx.sysMLFile.update({ where: { id: fileId }, data: { content: newContent, size: newSize } });
    return null; // success
  });

  if (result) return { error: result };

  mcpEvents.emitFileChange({ fileId, userId, action: 'updated', source });
  return { error: null };
}

export async function searchFiles(projectId: string, query: string) {
  const q = query.slice(0, MAX_SEARCH_QUERY_LENGTH).toLowerCase();
  const files = await prisma.sysMLFile.findMany({
    where: { projectId },
    select: { id: true, name: true, content: true },
    take: MAX_SEARCH_FILES,
  });

  const matches: { fileName: string; line: number; text: string }[] = [];
  outer: for (const file of files) {
    const lines = file.content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(q)) {
        matches.push({
          fileName: file.name,
          line: i + 1,
          text: lines[i].trim().slice(0, MAX_LINE_PREVIEW_LENGTH),
        });
        if (matches.length >= MAX_SEARCH_RESULTS) break outer;
      }
    }
  }

  return matches;
}
