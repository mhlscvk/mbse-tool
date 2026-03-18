import { prisma } from '../db.js';
import { mcpEvents } from '../mcp/events.js';

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
        return { result: JSON.stringify(projects.map(p => ({ id: p.id, name: p.name, description: p.description, fileCount: p._count.files }))), isError: false };
      }

      case 'list_files': {
        const project = await prisma.project.findFirst({ where: { id: args.projectId, ownerId: userId } });
        if (!project) return { result: 'Error: Project not found or access denied', isError: true };
        const files = await prisma.sysMLFile.findMany({
          where: { projectId: args.projectId },
          select: { id: true, name: true, size: true, updatedAt: true },
        });
        return { result: JSON.stringify(files), isError: false };
      }

      case 'read_file': {
        const file = await prisma.sysMLFile.findUnique({ where: { id: args.fileId }, include: { project: { select: { ownerId: true } } } });
        if (!file || file.project.ownerId !== userId) return { result: 'Error: File not found or access denied', isError: true };
        const numbered = file.content.split('\n').map((l, i) => `${String(i + 1).padStart(4, ' ')} | ${l}`).join('\n');
        return { result: `File: ${file.name} (${file.content.split('\n').length} lines)\n\n${numbered}`, isError: false };
      }

      case 'create_file': {
        const proj = await prisma.project.findFirst({ where: { id: args.projectId, ownerId: userId } });
        if (!proj) return { result: 'Error: Project not found or access denied', isError: true };
        const safeName = (args.name as string).replace(/[\\/\0]/g, '').slice(0, 255);
        if (!safeName) return { result: 'Error: Invalid file name', isError: true };
        const size = Buffer.byteLength(args.content, 'utf8');
        const created = await prisma.sysMLFile.create({ data: { name: safeName, content: args.content, size, projectId: args.projectId } });
        mcpEvents.emitFileChange({ fileId: created.id, userId, action: 'created' });
        return { result: JSON.stringify({ id: created.id, name: created.name, size: created.size }), isError: false };
      }

      case 'update_file': {
        const f = await prisma.sysMLFile.findUnique({ where: { id: args.fileId }, include: { project: { select: { ownerId: true } } } });
        if (!f || f.project.ownerId !== userId) return { result: 'Error: File not found or access denied', isError: true };
        const sz = Buffer.byteLength(args.content, 'utf8');
        await prisma.sysMLFile.update({ where: { id: args.fileId }, data: { content: args.content, size: sz } });
        mcpEvents.emitFileChange({ fileId: args.fileId, userId, action: 'updated' });
        return { result: `File "${f.name}" updated (${sz} bytes)`, isError: false };
      }

      case 'apply_edit': {
        // Use transaction to prevent TOCTOU — read + validate + update atomically
        const editResult = await prisma.$transaction(async (tx) => {
          const ef = await tx.sysMLFile.findUnique({ where: { id: args.fileId }, include: { project: { select: { ownerId: true } } } });
          if (!ef || ef.project.ownerId !== userId) return 'Error: File not found or access denied';
          const lines = ef.content.split('\n');
          const { startLine, startColumn, endLine, endColumn, newText } = args;
          if (startLine < 1 || endLine > lines.length || startLine > endLine)
            return `Error: Invalid line range (file has ${lines.length} lines)`;
          const sl = startLine - 1, el = endLine - 1, sc = startColumn - 1, ec = endColumn - 1;
          if (sc < 0 || sc > lines[sl].length) return 'Error: startColumn out of range';
          if (ec < 0 || ec > lines[el].length) return 'Error: endColumn out of range';
          if (sl === el && sc > ec) return 'Error: startColumn exceeds endColumn on same line';
          if (lines.length === 1 && lines[0] === '' && (sc > 0 || ec > 0)) return 'Error: File is empty';
          const before = lines.slice(0, sl).join('\n') + (sl > 0 ? '\n' : '') + lines[sl].substring(0, sc);
          const after = lines[el].substring(ec) + (el < lines.length - 1 ? '\n' : '') + lines.slice(el + 1).join('\n');
          const newContent = before + newText + after;
          const newSize = Buffer.byteLength(newContent, 'utf8');
          await tx.sysMLFile.update({ where: { id: args.fileId }, data: { content: newContent, size: newSize } });
          return null; // success
        });
        if (editResult) return { result: editResult, isError: true };
        mcpEvents.emitFileChange({ fileId: args.fileId, userId, action: 'updated' });
        return { result: 'Edit applied successfully', isError: false };
      }

      case 'delete_file': {
        const df = await prisma.sysMLFile.findUnique({ where: { id: args.fileId }, include: { project: { select: { ownerId: true } } } });
        if (!df || df.project.ownerId !== userId) return { result: 'Error: File not found or access denied', isError: true };
        await prisma.sysMLFile.delete({ where: { id: args.fileId } });
        mcpEvents.emitFileChange({ fileId: args.fileId, userId, action: 'deleted' });
        return { result: `File "${df.name}" deleted`, isError: false };
      }

      case 'search_files': {
        const sp = await prisma.project.findFirst({ where: { id: args.projectId, ownerId: userId } });
        if (!sp) return { result: 'Error: Project not found or access denied', isError: true };
        const allFiles = await prisma.sysMLFile.findMany({ where: { projectId: args.projectId }, select: { id: true, name: true, content: true } });
        const q = (args.query as string).toLowerCase();
        const matches: string[] = [];
        for (const file of allFiles) {
          file.content.split('\n').forEach((line, i) => {
            if (line.toLowerCase().includes(q)) matches.push(`${file.name}:${i + 1} — ${line.trim()}`);
          });
        }
        return { result: matches.length ? matches.slice(0, 50).join('\n') : `No matches for "${args.query}"`, isError: false };
      }

      default:
        return { result: `Unknown tool: ${toolName}`, isError: true };
    }
  } catch (err) {
    return { result: `Tool error: ${err instanceof Error ? err.message : String(err)}`, isError: true };
  }
}
