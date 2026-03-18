import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { prisma } from '../db.js';
import { mcpEvents } from './events.js';

/**
 * Register all MCP tools on the given server.
 * `userId` is captured via closure so every tool operates in the user's scope.
 */
export function registerTools(server: McpServer, userId: string): void {

  // ─── list_projects ──────────────────────────────────────────────────────────
  server.tool(
    'list_projects',
    'List all SysML projects owned by the authenticated user',
    {},
    async () => {
      const projects = await prisma.project.findMany({
        where: { ownerId: userId },
        orderBy: { updatedAt: 'desc' },
        include: { _count: { select: { files: true } } },
      });
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(projects.map(p => ({
            id: p.id,
            name: p.name,
            description: p.description,
            fileCount: p._count.files,
            updatedAt: p.updatedAt.toISOString(),
          })), null, 2),
        }],
      };
    },
  );

  // ─── list_files ─────────────────────────────────────────────────────────────
  server.tool(
    'list_files',
    'List all SysML files in a project',
    { projectId: z.string().describe('The project ID') },
    async ({ projectId }) => {
      const project = await prisma.project.findFirst({
        where: { id: projectId, ownerId: userId },
      });
      if (!project) {
        return { content: [{ type: 'text' as const, text: 'Error: Project not found or access denied' }], isError: true };
      }
      const files = await prisma.sysMLFile.findMany({
        where: { projectId },
        select: { id: true, name: true, size: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      });
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(files.map(f => ({
            id: f.id,
            name: f.name,
            size: f.size,
            updatedAt: f.updatedAt.toISOString(),
          })), null, 2),
        }],
      };
    },
  );

  // ─── read_file ──────────────────────────────────────────────────────────────
  server.tool(
    'read_file',
    'Read the content of a SysML file with line numbers',
    { fileId: z.string().describe('The file ID') },
    async ({ fileId }) => {
      const file = await prisma.sysMLFile.findUnique({
        where: { id: fileId },
        include: { project: { select: { ownerId: true } } },
      });
      if (!file || file.project.ownerId !== userId) {
        return { content: [{ type: 'text' as const, text: 'Error: File not found or access denied' }], isError: true };
      }
      const numbered = file.content.split('\n')
        .map((line, i) => `${String(i + 1).padStart(4, ' ')} | ${line}`)
        .join('\n');
      return {
        content: [{
          type: 'text' as const,
          text: `File: ${file.name} (${file.content.split('\n').length} lines)\n\n${numbered}`,
        }],
      };
    },
  );

  // ─── create_file ────────────────────────────────────────────────────────────
  server.tool(
    'create_file',
    'Create a new SysML file in a project',
    {
      projectId: z.string().describe('The project ID'),
      name: z.string().min(1).max(255).describe('File name (e.g. "Vehicle.sysml")'),
      content: z.string().describe('Initial SysML content'),
    },
    async ({ projectId, name, content }) => {
      const project = await prisma.project.findFirst({
        where: { id: projectId, ownerId: userId },
      });
      if (!project) {
        return { content: [{ type: 'text' as const, text: 'Error: Project not found or access denied' }], isError: true };
      }
      const safeName = name.replace(/[\\/\0]/g, '').slice(0, 255);
      if (!safeName) {
        return { content: [{ type: 'text' as const, text: 'Error: Invalid file name' }], isError: true };
      }
      const size = Buffer.byteLength(content, 'utf8');
      if (size > 10 * 1024 * 1024) {
        return { content: [{ type: 'text' as const, text: 'Error: Content exceeds 10 MB limit' }], isError: true };
      }
      const file = await prisma.sysMLFile.create({
        data: { name: safeName, content, size, projectId },
      });
      mcpEvents.emitFileChange({ fileId: file.id, userId, action: 'created' });
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ id: file.id, name: file.name, size: file.size }, null, 2),
        }],
      };
    },
  );

  // ─── update_file ────────────────────────────────────────────────────────────
  server.tool(
    'update_file',
    'Replace the entire content of a SysML file',
    {
      fileId: z.string().describe('The file ID'),
      content: z.string().describe('New SysML content (replaces entire file)'),
    },
    async ({ fileId, content }) => {
      const file = await prisma.sysMLFile.findUnique({
        where: { id: fileId },
        include: { project: { select: { ownerId: true } } },
      });
      if (!file || file.project.ownerId !== userId) {
        return { content: [{ type: 'text' as const, text: 'Error: File not found or access denied' }], isError: true };
      }
      const size = Buffer.byteLength(content, 'utf8');
      if (size > 10 * 1024 * 1024) {
        return { content: [{ type: 'text' as const, text: 'Error: Content exceeds 10 MB limit' }], isError: true };
      }
      const updated = await prisma.sysMLFile.update({
        where: { id: fileId },
        data: { content, size },
      });
      mcpEvents.emitFileChange({ fileId, userId, action: 'updated' });
      return {
        content: [{
          type: 'text' as const,
          text: `File "${updated.name}" updated (${updated.size} bytes)`,
        }],
      };
    },
  );

  // ─── apply_edit ─────────────────────────────────────────────────────────────
  server.tool(
    'apply_edit',
    'Apply a precise text edit to a SysML file using 1-based line/column positions',
    {
      fileId: z.string().describe('The file ID'),
      startLine: z.number().int().positive().describe('1-based start line'),
      startColumn: z.number().int().positive().describe('1-based start column'),
      endLine: z.number().int().positive().describe('1-based end line (inclusive)'),
      endColumn: z.number().int().positive().describe('1-based end column (exclusive)'),
      newText: z.string().describe('Replacement text (empty string to delete)'),
    },
    async ({ fileId, startLine, startColumn, endLine, endColumn, newText }) => {
      const file = await prisma.sysMLFile.findUnique({
        where: { id: fileId },
        include: { project: { select: { ownerId: true } } },
      });
      if (!file || file.project.ownerId !== userId) {
        return { content: [{ type: 'text' as const, text: 'Error: File not found or access denied' }], isError: true };
      }

      const lines = file.content.split('\n');
      if (startLine < 1 || endLine > lines.length || startLine > endLine) {
        return { content: [{ type: 'text' as const, text: `Error: Invalid line range (file has ${lines.length} lines)` }], isError: true };
      }

      // Convert 1-based to 0-based for array indexing
      const sl = startLine - 1;
      const el = endLine - 1;
      const sc = startColumn - 1;
      const ec = endColumn - 1;

      // Validate column bounds
      if (sc < 0 || sc > lines[sl].length) {
        return { content: [{ type: 'text' as const, text: `Error: startColumn ${startColumn} is out of range (line ${startLine} has ${lines[sl].length} characters)` }], isError: true };
      }
      if (ec < 0 || ec > lines[el].length) {
        return { content: [{ type: 'text' as const, text: `Error: endColumn ${endColumn} is out of range (line ${endLine} has ${lines[el].length} characters)` }], isError: true };
      }
      // Same-line range: startColumn must not exceed endColumn
      if (sl === el && sc > ec) {
        return { content: [{ type: 'text' as const, text: `Error: startColumn (${startColumn}) must not exceed endColumn (${endColumn}) on the same line` }], isError: true };
      }

      // Build the edited content
      const before = lines.slice(0, sl).join('\n')
        + (sl > 0 ? '\n' : '')
        + lines[sl].substring(0, sc);
      const after = lines[el].substring(ec)
        + (el < lines.length - 1 ? '\n' : '')
        + lines.slice(el + 1).join('\n');

      const newContent = before + newText + after;
      const size = Buffer.byteLength(newContent, 'utf8');

      await prisma.sysMLFile.update({
        where: { id: fileId },
        data: { content: newContent, size },
      });
      mcpEvents.emitFileChange({ fileId, userId, action: 'updated' });

      // Show a few lines around the edit for context
      const resultLines = newContent.split('\n');
      const previewStart = Math.max(0, sl - 2);
      const previewEnd = Math.min(resultLines.length, sl + newText.split('\n').length + 2);
      const preview = resultLines.slice(previewStart, previewEnd)
        .map((l, i) => `${String(previewStart + i + 1).padStart(4, ' ')} | ${l}`)
        .join('\n');

      return {
        content: [{
          type: 'text' as const,
          text: `Edit applied successfully. Preview around edit:\n\n${preview}`,
        }],
      };
    },
  );

  // ─── delete_file ────────────────────────────────────────────────────────────
  server.tool(
    'delete_file',
    'Delete a SysML file from a project',
    { fileId: z.string().describe('The file ID') },
    async ({ fileId }) => {
      const file = await prisma.sysMLFile.findUnique({
        where: { id: fileId },
        include: { project: { select: { ownerId: true } } },
      });
      if (!file || file.project.ownerId !== userId) {
        return { content: [{ type: 'text' as const, text: 'Error: File not found or access denied' }], isError: true };
      }
      await prisma.sysMLFile.delete({ where: { id: fileId } });
      mcpEvents.emitFileChange({ fileId, userId, action: 'deleted' });
      return {
        content: [{
          type: 'text' as const,
          text: `File "${file.name}" deleted`,
        }],
      };
    },
  );

  // ─── search_files ───────────────────────────────────────────────────────────
  server.tool(
    'search_files',
    'Search for text across all SysML files in a project',
    {
      projectId: z.string().describe('The project ID'),
      query: z.string().min(1).max(500).describe('Text to search for (case-insensitive)'),
    },
    async ({ projectId, query }) => {
      const project = await prisma.project.findFirst({
        where: { id: projectId, ownerId: userId },
      });
      if (!project) {
        return { content: [{ type: 'text' as const, text: 'Error: Project not found or access denied' }], isError: true };
      }
      const files = await prisma.sysMLFile.findMany({
        where: { projectId },
        select: { id: true, name: true, content: true },
      });

      const lowerQuery = query.toLowerCase();
      const results: { fileId: string; fileName: string; line: number; text: string }[] = [];

      for (const file of files) {
        const lines = file.content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(lowerQuery)) {
            results.push({ fileId: file.id, fileName: file.name, line: i + 1, text: lines[i].trim() });
          }
        }
      }

      if (results.length === 0) {
        return { content: [{ type: 'text' as const, text: `No matches found for "${query}"` }] };
      }

      // Limit to 50 results
      const limited = results.slice(0, 50);
      return {
        content: [{
          type: 'text' as const,
          text: `Found ${results.length} match(es)${results.length > 50 ? ' (showing first 50)' : ''}:\n\n` +
            limited.map(r => `${r.fileName}:${r.line} — ${r.text}`).join('\n'),
        }],
      };
    },
  );
}
