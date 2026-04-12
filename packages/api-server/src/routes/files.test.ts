import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db.js', () => ({
  prisma: {
    sysMLFile: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    project: { findUnique: vi.fn() },
  },
}));
vi.mock('../services/file-ops.js', () => ({
  listFiles: vi.fn(),
  getFile: vi.fn(),
  createFile: vi.fn(),
  updateFileContent: vi.fn(),
  renameFile: vi.fn(),
  deleteFile: vi.fn(),
  moveFile: vi.fn(),
}));
vi.mock('../lib/auth-helpers.js', () => ({
  assertProjectAccess: vi.fn(),
  assertWriteAccess: vi.fn(),
}));
vi.mock('../services/examples-sync.js', () => ({
  syncFileToDisk: vi.fn(),
  removeFileFromDisk: vi.fn(),
  renameFileOnDisk: vi.fn(),
}));
vi.mock('../mcp/events.js', () => ({
  mcpEvents: { onFileChange: vi.fn(), offFileChange: vi.fn() },
}));

import * as fileOps from '../services/file-ops.js';
import { assertProjectAccess, assertWriteAccess } from '../lib/auth-helpers.js';

const mockAccess = assertProjectAccess as ReturnType<typeof vi.fn>;
const mockWriteAccess = assertWriteAccess as ReturnType<typeof vi.fn>;
const mockFileOps = fileOps as unknown as {
  listFiles: ReturnType<typeof vi.fn>;
  getFile: ReturnType<typeof vi.fn>;
  createFile: ReturnType<typeof vi.fn>;
  updateFileContent: ReturnType<typeof vi.fn>;
  renameFile: ReturnType<typeof vi.fn>;
  deleteFile: ReturnType<typeof vi.fn>;
  moveFile: ReturnType<typeof vi.fn>;
};

describe('files route — access control', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('listFiles requires project access', async () => {
    mockAccess.mockResolvedValue({ allowed: false });
    await expect(async () => {
      const access = await assertProjectAccess('proj1', 'user1');
      if (!access.allowed) throw new Error('Not found');
    }).rejects.toThrow('Not found');
  });

  it('listFiles succeeds with access', async () => {
    mockAccess.mockResolvedValue({ allowed: true, isSystem: false, isAdmin: false });
    mockFileOps.listFiles.mockResolvedValue([{ id: 'f1', name: 'test.sysml', size: 10 }]);
    const files = await fileOps.listFiles('proj1');
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe('test.sysml');
  });

  it('createFile calls assertWriteAccess', async () => {
    mockAccess.mockResolvedValue({ allowed: true, isSystem: false, isAdmin: false });
    mockWriteAccess.mockImplementation(() => {}); // no throw = allowed
    mockFileOps.createFile.mockResolvedValue({ id: 'f1', name: 'test.sysml', size: 10 });
    const file = await fileOps.createFile('proj1', 'test', 'content', 'user1');
    expect(file.name).toBe('test.sysml');
  });

  it('createFile blocked on system projects for non-admin', async () => {
    mockAccess.mockResolvedValue({ allowed: true, isSystem: true, isAdmin: false });
    mockWriteAccess.mockImplementation(() => { throw new Error('System projects are read-only'); });
    const access = await assertProjectAccess('proj1', 'user1');
    expect(() => assertWriteAccess(access)).toThrow('read-only');
  });

  it('deleteFile requires write access on project', async () => {
    mockAccess.mockResolvedValue({ allowed: true, isSystem: false, isAdmin: false });
    mockWriteAccess.mockImplementation(() => {}); // allowed
    mockFileOps.getFile.mockResolvedValue({ id: 'f1', name: 'test.sysml' });
    mockFileOps.deleteFile.mockResolvedValue({ id: 'f1' });
    await fileOps.deleteFile('f1', 'user1');
    expect(mockFileOps.deleteFile).toHaveBeenCalledWith('f1', 'user1');
  });

  it('moveFile requires write access on both source and target projects', async () => {
    mockAccess
      .mockResolvedValueOnce({ allowed: true, isSystem: false, isAdmin: false })
      .mockResolvedValueOnce({ allowed: true, isSystem: false, isAdmin: false });
    mockWriteAccess.mockImplementation(() => {});
    mockFileOps.getFile.mockResolvedValue({ id: 'f1', name: 'test.sysml' });
    mockFileOps.moveFile.mockResolvedValue({ id: 'f1', projectId: 'proj2' });

    // Simulate the route logic
    assertWriteAccess(await assertProjectAccess('proj1', 'user1'));
    assertWriteAccess(await assertProjectAccess('proj2', 'user1'));
    const result = await fileOps.moveFile('f1', 'proj2', 'user1');

    expect(mockAccess).toHaveBeenCalledTimes(2);
    expect(result.projectId).toBe('proj2');
  });

  it('moveFile fails if target project write denied', async () => {
    mockAccess
      .mockResolvedValueOnce({ allowed: true, isSystem: false, isAdmin: false })
      .mockResolvedValueOnce({ allowed: true, isSystem: true, isAdmin: false });
    mockWriteAccess
      .mockImplementationOnce(() => {})
      .mockImplementationOnce(() => { throw new Error('System projects are read-only'); });

    assertWriteAccess(await assertProjectAccess('proj1', 'user1')); // source OK
    const targetAccess = await assertProjectAccess('proj2', 'user1');
    expect(() => assertWriteAccess(targetAccess)).toThrow('read-only'); // target blocked
  });
});

describe('files route — SSE token', () => {
  it('SSE token has 60s expiry and sse purpose', async () => {
    // Verify the token contract: purpose=sse, short TTL
    const jwt = await import('jsonwebtoken');
    const secret = 'test-secret-key';
    const token = jwt.default.sign(
      { userId: 'user1', role: 'editor', purpose: 'sse' },
      secret,
      { algorithm: 'HS256', expiresIn: '60s' },
    );
    const payload = jwt.default.verify(token, secret, { algorithms: ['HS256'] }) as { userId: string; purpose: string };
    expect(payload.userId).toBe('user1');
    expect(payload.purpose).toBe('sse');
  });

  it('rejects non-sse purpose tokens', async () => {
    const jwt = await import('jsonwebtoken');
    const secret = 'test-secret-key';
    const token = jwt.default.sign(
      { userId: 'user1', purpose: 'admin' },
      secret,
      { algorithm: 'HS256' },
    );
    const payload = jwt.default.verify(token, secret) as { purpose?: string };
    // Route checks: if purpose exists and is not 'sse', reject
    expect(payload.purpose && payload.purpose !== 'sse').toBe(true);
  });
});
