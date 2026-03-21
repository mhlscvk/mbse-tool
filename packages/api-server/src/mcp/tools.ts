import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { prisma } from '../db.js';
import * as fileOps from '../services/file-ops.js';

/** Helper to build MCP text content response */
function mcpText(text: string, isError = false) {
  return { content: [{ type: 'text' as const, text }], ...(isError ? { isError: true } : {}) };
}

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
      return mcpText(JSON.stringify(projects.map((p: { id: string; name: string; description: string | null; _count: { files: number }; updatedAt: Date }) => ({
        id: p.id, name: p.name, description: p.description,
        fileCount: p._count.files, updatedAt: p.updatedAt.toISOString(),
      })), null, 2));
    },
  );

  // ─── list_files ─────────────────────────────────────────────────────────────
  server.tool(
    'list_files',
    'List all SysML files in a project',
    { projectId: z.string().describe('The project ID') },
    async ({ projectId }) => {
      const project = await prisma.project.findFirst({ where: { id: projectId, ownerId: userId } });
      if (!project) return mcpText('Error: Project not found or access denied', true);
      const files = await fileOps.listFiles(projectId);
      return mcpText(JSON.stringify(files.map((f: { id: string; name: string; size: number; updatedAt: Date }) => ({
        id: f.id, name: f.name, size: f.size, updatedAt: f.updatedAt.toISOString(),
      })), null, 2));
    },
  );

  // ─── read_file ──────────────────────────────────────────────────────────────
  server.tool(
    'read_file',
    'Read the content of a SysML file with line numbers',
    { fileId: z.string().describe('The file ID') },
    async ({ fileId }) => {
      try {
        const file = await fileOps.readFileWithOwnerCheck(fileId, userId);
        const lines = file.content.split('\n');
        const numbered = lines
          .map((line: string, i: number) => `${String(i + 1).padStart(4, ' ')} | ${line}`)
          .join('\n');
        return mcpText(`File: ${file.name} (${lines.length} lines)\n\n${numbered}`);
      } catch {
        return mcpText('Error: File not found or access denied', true);
      }
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
      const project = await prisma.project.findFirst({ where: { id: projectId, ownerId: userId } });
      if (!project) return mcpText('Error: Project not found or access denied', true);
      try {
        const file = await fileOps.createFile(projectId, name, content, userId);
        return mcpText(JSON.stringify({ id: file.id, name: file.name, size: file.size }, null, 2));
      } catch (err) {
        return mcpText(`Error: ${err instanceof Error ? err.message : String(err)}`, true);
      }
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
      try {
        await fileOps.readFileWithOwnerCheck(fileId, userId);
        const updated = await fileOps.updateFileContent(fileId, content, userId);
        return mcpText(`File "${updated.name}" updated (${updated.size} bytes)`);
      } catch (err) {
        return mcpText(`Error: ${err instanceof Error ? err.message : String(err)}`, true);
      }
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
      const { error } = await fileOps.applyEdit(fileId, startLine, startColumn, endLine, endColumn, newText, userId);
      if (error) return mcpText(error, true);

      // Show a few lines around the edit for context
      try {
        const file = await fileOps.readFileWithOwnerCheck(fileId, userId);
        const resultLines = file.content.split('\n');
        const previewStart = Math.max(0, startLine - 3);
        const previewEnd = Math.min(resultLines.length, startLine + newText.split('\n').length + 2);
        const preview = resultLines.slice(previewStart, previewEnd)
          .map((l: string, i: number) => `${String(previewStart + i + 1).padStart(4, ' ')} | ${l}`)
          .join('\n');
        return mcpText(`Edit applied successfully. Preview around edit:\n\n${preview}`);
      } catch {
        return mcpText('Edit applied successfully.');
      }
    },
  );

  // ─── delete_file ────────────────────────────────────────────────────────────
  server.tool(
    'delete_file',
    'Delete a SysML file from a project',
    { fileId: z.string().describe('The file ID') },
    async ({ fileId }) => {
      try {
        const file = await fileOps.readFileWithOwnerCheck(fileId, userId);
        await fileOps.deleteFile(fileId, userId);
        return mcpText(`File "${file.name}" deleted`);
      } catch {
        return mcpText('Error: File not found or access denied', true);
      }
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
      const project = await prisma.project.findFirst({ where: { id: projectId, ownerId: userId } });
      if (!project) return mcpText('Error: Project not found or access denied', true);

      const matches = await fileOps.searchFiles(projectId, query);
      if (!matches.length) return mcpText(`No matches found for "${query}"`);

      return mcpText(
        `Found ${matches.length} match(es):\n\n` +
        matches.map(r => `${r.fileName}:${r.line} — ${r.text}`).join('\n'),
      );
    },
  );
}
