import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AI_TOOLS, executeToolCall } from './tools.js';

// Mock Prisma
vi.mock('../db.js', () => ({
  prisma: {
    project: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    sysMLFile: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    startupMember: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../mcp/events.js', () => ({
  mcpEvents: {
    emitFileChange: vi.fn(),
  },
}));

// Mock assertProjectAccess
vi.mock('../lib/auth-helpers.js', () => ({
  assertProjectAccess: vi.fn(),
}));

import { prisma } from '../db.js';
import { assertProjectAccess } from '../lib/auth-helpers.js';

const mockPrisma = prisma as unknown as {
  project: { findMany: ReturnType<typeof vi.fn>; findFirst: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn> };
  sysMLFile: { findMany: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn>; findFirst: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
  startupMember: { findMany: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

const mockAccess = assertProjectAccess as ReturnType<typeof vi.fn>;

describe('AI_TOOLS definitions', () => {
  it('all tools have unique names', () => {
    const names = AI_TOOLS.map(t => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('all tools have valid JSON Schema parameters', () => {
    for (const tool of AI_TOOLS) {
      expect(tool.parameters.type).toBe('object');
      expect(Array.isArray(tool.parameters.required)).toBe(true);
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

  it('returns error for list_files with no access', async () => {
    mockAccess.mockResolvedValue({ allowed: false, isSystem: false, isAdmin: false });
    const result = await executeToolCall('user1', 'list_files', { projectId: 'proj1' });
    expect(result.isError).toBe(true);
    expect(result.result).toContain('not found');
  });

  it('returns error for read_file on non-accessible file', async () => {
    mockPrisma.sysMLFile.findUnique.mockResolvedValue({
      id: 'f1', name: 'test.sysml', content: 'part def A;',
      projectId: 'proj1', project: { ownerId: 'other-user' },
    });
    mockAccess.mockResolvedValue({ allowed: false, isSystem: false, isAdmin: false });
    const result = await executeToolCall('user1', 'read_file', { fileId: 'f1' });
    expect(result.isError).toBe(true);
  });

  it('list_projects returns user-owned projects', async () => {
    mockPrisma.project.findMany.mockResolvedValue([
      { id: 'p1', name: 'My Project', description: null, _count: { files: 3 } },
    ]);
    mockPrisma.startupMember.findMany.mockResolvedValue([]);
    const result = await executeToolCall('user1', 'list_projects', {});
    expect(result.isError).toBe(false);
    const data = JSON.parse(result.result);
    expect(data.length).toBeGreaterThanOrEqual(1);
    expect(data[0].name).toBe('My Project');
  });

  it('create_file rejects content over 10MB', async () => {
    mockAccess.mockResolvedValue({ allowed: true, isSystem: false, isAdmin: false });
    const hugeContent = 'x'.repeat(11 * 1024 * 1024);
    const result = await executeToolCall('user1', 'create_file', {
      projectId: 'p1', name: 'huge.sysml', content: hugeContent,
    });
    expect(result.isError).toBe(true);
    expect(result.result).toContain('byte limit');
  });

  it('create_file sanitizes dangerous file names', async () => {
    mockAccess.mockResolvedValue({ allowed: true, isSystem: false, isAdmin: false });
    mockPrisma.sysMLFile.create.mockResolvedValue({ id: 'f1', name: 'testfile.sysml', size: 10 });

    await executeToolCall('user1', 'create_file', {
      projectId: 'p1', name: '../../../etc/passwd', content: 'part def A;',
    });

    const createCall = mockPrisma.sysMLFile.create.mock.calls[0][0];
    expect(createCall.data.name).not.toContain('/');
    expect(createCall.data.name).not.toContain('\\');
  });

  it('update_file rejects content over 10MB', async () => {
    mockPrisma.sysMLFile.findUnique.mockResolvedValue({
      id: 'f1', name: 'test.sysml', projectId: 'p1', project: { ownerId: 'user1' },
    });
    mockAccess.mockResolvedValue({ allowed: true, isSystem: false, isAdmin: false });
    const hugeContent = 'x'.repeat(11 * 1024 * 1024);
    const result = await executeToolCall('user1', 'update_file', {
      fileId: 'f1', content: hugeContent,
    });
    expect(result.isError).toBe(true);
    expect(result.result).toContain('byte limit');
  });

  it('search_files truncates query to 500 chars', async () => {
    mockAccess.mockResolvedValue({ allowed: true, isSystem: false, isAdmin: false });
    mockPrisma.sysMLFile.findMany.mockResolvedValue([
      { id: 'f1', name: 'test.sysml', content: 'part def Vehicle;' },
    ]);

    const longQuery = 'a'.repeat(1000);
    const result = await executeToolCall('user1', 'search_files', {
      projectId: 'p1', query: longQuery,
    });
    expect(result.isError).toBe(false);
  });

  it('search_files limits results to 50', async () => {
    mockAccess.mockResolvedValue({ allowed: true, isSystem: false, isAdmin: false });
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
    mockAccess.mockResolvedValue({ allowed: true, isSystem: false, isAdmin: false });
    mockPrisma.sysMLFile.findMany.mockResolvedValue([]);

    await executeToolCall('user1', 'search_files', {
      projectId: 'p1', query: 'test',
    });

    expect(mockPrisma.sysMLFile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });

  it('create_file blocks writes to system projects for non-admin', async () => {
    mockAccess.mockResolvedValue({ allowed: true, isSystem: true, isAdmin: false });
    const result = await executeToolCall('user1', 'create_file', {
      projectId: 'p1', name: 'test.sysml', content: 'part def A;',
    });
    expect(result.isError).toBe(true);
    expect(result.result).toContain('system');
  });
});

describe('executeToolCall — access control and source', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('list_projects includes startup projects for members', async () => {
    mockPrisma.project.findMany
      .mockResolvedValueOnce([{ id: 'p1', name: 'My Project', description: null, _count: { files: 1 } }]) // user-owned
      .mockResolvedValueOnce([{ id: 'p2', name: 'System', description: null, _count: { files: 0 } }]) // system
      .mockResolvedValueOnce([{ id: 'p3', name: 'Enterprise', description: null, _count: { files: 2 } }]); // startup
    mockPrisma.startupMember.findMany.mockResolvedValue([{ startupId: 's1' }]);

    const result = await executeToolCall('user1', 'list_projects', {});
    expect(result.isError).toBe(false);
    const data = JSON.parse(result.result);
    expect(data).toHaveLength(3);
    expect(data.map((p: { name: string }) => p.name)).toContain('Enterprise');
  });

  it('list_projects deduplicates projects across categories', async () => {
    const shared = { id: 'p1', name: 'Shared', description: null, _count: { files: 1 } };
    mockPrisma.project.findMany
      .mockResolvedValueOnce([shared]) // user-owned
      .mockResolvedValueOnce([]) // system
      .mockResolvedValueOnce([shared]); // startup (same project)
    mockPrisma.startupMember.findMany.mockResolvedValue([{ startupId: 's1' }]);

    const result = await executeToolCall('user1', 'list_projects', {});
    const data = JSON.parse(result.result);
    expect(data).toHaveLength(1); // deduplicated
  });

  it('read_file works for startup project members', async () => {
    mockPrisma.sysMLFile.findUnique.mockResolvedValue({
      id: 'f1', name: 'model.sysml', content: 'part def A;',
      projectId: 'proj1', project: {},
    });
    mockAccess.mockResolvedValue({ allowed: true, isSystem: false, isAdmin: false, startupRole: 'STARTUP_USER' });
    const result = await executeToolCall('member1', 'read_file', { fileId: 'f1' });
    expect(result.isError).toBe(false);
    expect(result.result).toContain('part def A');
  });

  it('update_file emits source ai_chat', async () => {
    mockPrisma.sysMLFile.findUnique.mockResolvedValue({
      id: 'f1', name: 'test.sysml', projectId: 'p1', project: {},
    });
    mockAccess.mockResolvedValue({ allowed: true, isSystem: false, isAdmin: false });
    mockPrisma.sysMLFile.update.mockResolvedValue({ id: 'f1', name: 'test.sysml', size: 5 });
    const result = await executeToolCall('user1', 'update_file', { fileId: 'f1', content: 'new' });
    expect(result.isError).toBe(false);
    const { mcpEvents } = await import('../mcp/events.js');
    expect(mcpEvents.emitFileChange).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'ai_chat' }),
    );
  });

  it('delete_file checks access and emits source ai_chat', async () => {
    mockPrisma.sysMLFile.findUnique.mockResolvedValue({
      id: 'f1', name: 'test.sysml', projectId: 'p1', project: {},
    });
    mockAccess.mockResolvedValue({ allowed: true, isSystem: false, isAdmin: false });
    mockPrisma.sysMLFile.delete.mockResolvedValue({});
    const result = await executeToolCall('user1', 'delete_file', { fileId: 'f1' });
    expect(result.isError).toBe(false);
    expect(result.result).toContain('deleted');
  });

  it('list_files allows startup member access', async () => {
    mockAccess.mockResolvedValue({ allowed: true, isSystem: false, isAdmin: false, startupRole: 'STARTUP_USER' });
    mockPrisma.sysMLFile.findMany.mockResolvedValue([
      { id: 'f1', name: 'model.sysml', size: 10, createdAt: new Date(), updatedAt: new Date() },
    ]);
    const result = await executeToolCall('member1', 'list_files', { projectId: 'proj1' });
    expect(result.isError).toBe(false);
  });
});
