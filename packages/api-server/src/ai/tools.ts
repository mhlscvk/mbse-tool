import * as fileOps from '../services/file-ops.js';
import { prisma } from '../db.js';

/** Canonical tool definitions — provider-agnostic JSON Schema format */
export const AI_TOOLS = [
  {
    name: 'list_projects',
    description: 'List all SysML projects owned by the user',
    parameters: { type: 'object' as const, properties: {}, required: [] as string[] },
  },
  {
    name: 'list_files',
    description: 'List all SysML files in a project',
    parameters: {
      type: 'object' as const,
      properties: { projectId: { type: 'string', description: 'The project ID' } },
      required: ['projectId'],
    },
  },
  {
    name: 'read_file',
    description: 'Read the content of a SysML file with line numbers',
    parameters: {
      type: 'object' as const,
      properties: { fileId: { type: 'string', description: 'The file ID' } },
      required: ['fileId'],
    },
  },
  {
    name: 'create_file',
    description: 'Create a new SysML file in a project',
    parameters: {
      type: 'object' as const,
      properties: {
        projectId: { type: 'string', description: 'The project ID' },
        name: { type: 'string', description: 'File name (e.g. "Vehicle.sysml")' },
        content: { type: 'string', description: 'Initial SysML content' },
      },
      required: ['projectId', 'name', 'content'],
    },
  },
  {
    name: 'update_file',
    description: 'Replace the entire content of a SysML file',
    parameters: {
      type: 'object' as const,
      properties: {
        fileId: { type: 'string', description: 'The file ID' },
        content: { type: 'string', description: 'New SysML content (replaces entire file)' },
      },
      required: ['fileId', 'content'],
    },
  },
  {
    name: 'apply_edit',
    description: 'Apply a precise text edit using 1-based line/column positions',
    parameters: {
      type: 'object' as const,
      properties: {
        fileId: { type: 'string', description: 'The file ID' },
        startLine: { type: 'number', description: '1-based start line' },
        startColumn: { type: 'number', description: '1-based start column' },
        endLine: { type: 'number', description: '1-based end line (inclusive)' },
        endColumn: { type: 'number', description: '1-based end column (exclusive)' },
        newText: { type: 'string', description: 'Replacement text (empty to delete)' },
      },
      required: ['fileId', 'startLine', 'startColumn', 'endLine', 'endColumn', 'newText'],
    },
  },
  {
    name: 'delete_file',
    description: 'Delete a SysML file from a project',
    parameters: {
      type: 'object' as const,
      properties: { fileId: { type: 'string', description: 'The file ID' } },
      required: ['fileId'],
    },
  },
  {
    name: 'search_files',
    description: 'Search for text across all SysML files in a project',
    parameters: {
      type: 'object' as const,
      properties: {
        projectId: { type: 'string', description: 'The project ID' },
        query: { type: 'string', description: 'Text to search for (case-insensitive)' },
      },
      required: ['projectId', 'query'],
    },
  },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function executeToolCall(userId: string, toolName: string, args: Record<string, any>): Promise<{ result: string; isError: boolean }> {
  try {
    switch (toolName) {
      case 'list_projects': {
        const projects = await prisma.project.findMany({
          where: { ownerId: userId },
          orderBy: { updatedAt: 'desc' },
          include: { _count: { select: { files: true } } },
        });
        return { result: JSON.stringify(projects.map((p: { id: string; name: string; description: string | null; _count: { files: number } }) => ({ id: p.id, name: p.name, description: p.description, fileCount: p._count.files }))), isError: false };
      }

      case 'list_files': {
        const project = await prisma.project.findFirst({ where: { id: args.projectId, ownerId: userId } });
        if (!project) return { result: 'Error: Project not found or access denied', isError: true };
        const files = await fileOps.listFiles(args.projectId);
        return { result: JSON.stringify(files), isError: false };
      }

      case 'read_file': {
        const file = await fileOps.readFileWithOwnerCheck(args.fileId, userId);
        const lines = file.content.split('\n');
        const numbered = lines.map((l: string, i: number) => `${String(i + 1).padStart(4, ' ')} | ${l}`).join('\n');
        return { result: `File: ${file.name} (${lines.length} lines)\n\n${numbered}`, isError: false };
      }

      case 'create_file': {
        const proj = await prisma.project.findFirst({ where: { id: args.projectId, ownerId: userId } });
        if (!proj) return { result: 'Error: Project not found or access denied', isError: true };
        const file = await fileOps.createFile(args.projectId, args.name as string, args.content as string, userId);
        return { result: JSON.stringify({ id: file.id, name: file.name, size: file.size }), isError: false };
      }

      case 'update_file': {
        await fileOps.readFileWithOwnerCheck(args.fileId, userId);
        const updated = await fileOps.updateFileContent(args.fileId, args.content as string, userId);
        return { result: `File "${updated.name}" updated (${updated.size} bytes)`, isError: false };
      }

      case 'apply_edit': {
        const { error } = await fileOps.applyEdit(
          args.fileId, args.startLine, args.startColumn,
          args.endLine, args.endColumn, args.newText, userId,
        );
        if (error) return { result: error, isError: true };
        return { result: 'Edit applied successfully', isError: false };
      }

      case 'delete_file': {
        const df = await fileOps.readFileWithOwnerCheck(args.fileId, userId);
        await fileOps.deleteFile(args.fileId, userId);
        return { result: `File "${df.name}" deleted`, isError: false };
      }

      case 'search_files': {
        const sp = await prisma.project.findFirst({ where: { id: args.projectId, ownerId: userId } });
        if (!sp) return { result: 'Error: Project not found or access denied', isError: true };
        const matches = await fileOps.searchFiles(args.projectId, args.query as string);
        if (!matches.length) return { result: `No matches for "${args.query}"`, isError: false };
        return { result: matches.map(m => `${m.fileName}:${m.line} — ${m.text}`).join('\n'), isError: false };
      }

      default:
        return { result: `Unknown tool: ${toolName}`, isError: true };
    }
  } catch (err) {
    return { result: `Tool error: ${err instanceof Error ? err.message : String(err)}`, isError: true };
  }
}
