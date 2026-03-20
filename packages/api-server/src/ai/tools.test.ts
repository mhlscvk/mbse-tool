import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AI_TOOLS, executeToolCall } from './tools.js';

// Mock Prisma
vi.mock('../db.js', () => ({
  prisma: {
    project: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    sysMLFile: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../mcp/events.js', () => ({
  mcpEvents: {
    emitFileChange: vi.fn(),
  },
}));

import { prisma } from '../db.js';

const mockPrisma = prisma as unknown as {
  project: { findMany: ReturnType<typeof vi.fn>; findFirst: ReturnType<typeof vi.fn> };
  sysMLFile: { findMany: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

describe('AI_TOOLS definitions', () => {
  it('all tools have unique names', () => {
    const names = AI_TOOLS.map(t => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('all tools have valid JSON Schema parameters', () => {
    for (const tool of AI_TOOLS) {
      expect(tool.parameters.type).toBe('object');
      expect(Array.isArray(tool.parameters.required)).toBe(true);
      // Every required field must appear in properties
      for (const req of tool.parameters.required) {
        expect(tool.parameters.properties).toHaveProperty(req);
      }
    }
  });
});

describe('executeToolCall', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns error for unknown tool names', async () => {
    const result = await executeToolCall('user1', 'evil_tool', {});
    expect(result.isError).toBe(true);
    expect(result.result).toContain('Unknown tool');
  });

  it('returns error for list_files with non-owned project', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(null);
    const result = await executeToolCall('user1', 'list_files', { projectId: 'proj1' });
    expect(result.isError).toBe(true);
    expect(result.result).toContain('access denied');
  });

  it('returns error for read_file on non-owned file', async () => {
    mockPrisma.sysMLFile.findUnique.mockResolvedValue({
      id: 'f1', name: 'test.sysml', content: 'part def A;',
      project: { ownerId: 'other-user' },
    });
    const result = await executeToolCall('user1', 'read_file', { fileId: 'f1' });
    expect(result.isError).toBe(true);
    expect(result.result).toContain('access denied');
  });

  it('list_projects returns only user-owned projects', async () => {
    mockPrisma.project.findMany.mockResolvedValue([
      { id: 'p1', name: 'My Project', description: null, _count: { files: 3 } },
    ]);
    const result = await executeToolCall('user1', 'list_projects', {});
    expect(result.isError).toBe(false);
    const data = JSON.parse(result.result);
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe('My Project');
    // Verify query was scoped to user
    expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: 'user1' } }),
    );
  });

  it('create_file rejects content over 10MB', async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: 'p1', ownerId: 'user1' });
    const hugeContent = 'x'.repeat(11 * 1024 * 1024);
    const result = await executeToolCall('user1', 'create_file', {
      projectId: 'p1', name: 'huge.sysml', content: hugeContent,
    });
    expect(result.isError).toBe(true);
    expect(result.result).toContain('10MB');
  });

  it('create_file sanitizes dangerous file names', async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: 'p1', ownerId: 'user1' });
    mockPrisma.sysMLFile.create.mockResolvedValue({ id: 'f1', name: 'testfile.sysml', size: 10 });

    await executeToolCall('user1', 'create_file', {
      projectId: 'p1', name: '../../../etc/passwd', content: 'part def A;',
    });

    // Verify dangerous characters stripped
    const createCall = mockPrisma.sysMLFile.create.mock.calls[0][0];
    expect(createCall.data.name).not.toContain('/');
    expect(createCall.data.name).not.toContain('\\');
  });

  it('update_file rejects content over 10MB', async () => {
    mockPrisma.sysMLFile.findUnique.mockResolvedValue({
      id: 'f1', name: 'test.sysml', project: { ownerId: 'user1' },
    });
    const hugeContent = 'x'.repeat(11 * 1024 * 1024);
    const result = await executeToolCall('user1', 'update_file', {
      fileId: 'f1', content: hugeContent,
    });
    expect(result.isError).toBe(true);
    expect(result.result).toContain('10MB');
  });

  it('search_files truncates query to 500 chars', async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: 'p1', ownerId: 'user1' });
    mockPrisma.sysMLFile.findMany.mockResolvedValue([
      { id: 'f1', name: 'test.sysml', content: 'part def Vehicle;' },
    ]);

    const longQuery = 'a'.repeat(1000);
    const result = await executeToolCall('user1', 'search_files', {
      projectId: 'p1', query: longQuery,
    });
    // Should not crash, and the truncated query won't match
    expect(result.isError).toBe(false);
  });

  it('search_files limits results to 50', async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: 'p1', ownerId: 'user1' });
    // Create a file with 100 matching lines
    const lines = Array.from({ length: 100 }, (_, i) => `part def Part${i};`).join('\n');
    mockPrisma.sysMLFile.findMany.mockResolvedValue([
      { id: 'f1', name: 'test.sysml', content: lines },
    ]);

    const result = await executeToolCall('user1', 'search_files', {
      projectId: 'p1', query: 'part def',
    });
    expect(result.isError).toBe(false);
    expect(result.result.split('\n').length).toBe(50);
  });

  it('search_files requests at most 100 files', async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: 'p1', ownerId: 'user1' });
    mockPrisma.sysMLFile.findMany.mockResolvedValue([]);

    await executeToolCall('user1', 'search_files', {
      projectId: 'p1', query: 'test',
    });

    expect(mockPrisma.sysMLFile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });
});
