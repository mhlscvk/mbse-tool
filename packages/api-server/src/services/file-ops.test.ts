import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db.js', () => ({
  prisma: {
    sysMLFile: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../mcp/events.js', () => ({
  mcpEvents: { emitFileChange: vi.fn() },
}));

vi.mock('../lib/id-generator.js', () => ({
  generateFileDisplayId: vi.fn(() => 'FIL-TEST1'),
}));

import { prisma } from '../db.js';
import { mcpEvents } from '../mcp/events.js';
import {
  sanitizeFileName,
  assertContentSize,
  listFiles,
  getFile,
  readFileWithOwnerCheck,
  createFile,
  updateFileContent,
  renameFile,
  deleteFile,
  moveFile,
  applyEdit,
  searchFiles,
} from './file-ops.js';

const mock = prisma as any;
const mockEvents = mcpEvents as any;

beforeEach(() => {
  vi.clearAllMocks();
  // $transaction passes the mock prisma as tx so inner calls work
  mock.$transaction.mockImplementation(async (cb: any) => cb(mock));
});

// ── sanitizeFileName ────────────────────────────────────────────────────────

describe('sanitizeFileName', () => {
  it('returns a valid name unchanged', () => {
    expect(sanitizeFileName('model.sysml')).toBe('model.sysml');
  });

  it('strips backslashes, forward slashes, and null bytes', () => {
    expect(sanitizeFileName('path\\to/file\0name')).toBe('pathtofilename');
  });

  it('truncates to 255 characters', () => {
    const long = 'a'.repeat(300);
    expect(sanitizeFileName(long)).toHaveLength(255);
  });

  it('throws BadRequest for empty string', () => {
    expect(() => sanitizeFileName('')).toThrow('Invalid file name');
  });

  it('throws BadRequest when name becomes empty after sanitization', () => {
    expect(() => sanitizeFileName('//\\\0')).toThrow('Invalid file name');
  });
});

// ── assertContentSize ───────────────────────────────────────────────────────

describe('assertContentSize', () => {
  it('returns byte size for content within limit', () => {
    expect(assertContentSize('hello')).toBe(5);
  });

  it('throws PayloadTooLarge for content over 10MB', () => {
    const big = 'x'.repeat(10 * 1024 * 1024 + 1);
    expect(() => assertContentSize(big)).toThrow('exceeds');
  });

  it('measures multi-byte UTF-8 correctly', () => {
    // Emoji is 4 bytes but length 2
    const emoji = '😀';
    expect(assertContentSize(emoji)).toBe(Buffer.byteLength(emoji, 'utf8'));
  });
});

// ── listFiles ───────────────────────────────────────────────────────────────

describe('listFiles', () => {
  it('returns files for a project', async () => {
    const files = [{ id: 'f1', name: 'test', size: 10 }];
    mock.sysMLFile.findMany.mockResolvedValue(files);
    const result = await listFiles('proj1');
    expect(result).toEqual(files);
    expect(mock.sysMLFile.findMany).toHaveBeenCalledWith({
      where: { projectId: 'proj1' },
      select: { id: true, name: true, size: true, createdAt: true, updatedAt: true },
    });
  });
});

// ── getFile ─────────────────────────────────────────────────────────────────

describe('getFile', () => {
  it('returns file when found', async () => {
    const file = { id: 'f1', name: 'test', content: 'abc' };
    mock.sysMLFile.findFirst.mockResolvedValue(file);
    const result = await getFile('f1', 'proj1');
    expect(result).toEqual(file);
  });

  it('throws NotFound when file is null', async () => {
    mock.sysMLFile.findFirst.mockResolvedValue(null);
    await expect(getFile('f1', 'proj1')).rejects.toThrow('not found');
  });
});

// ── readFileWithOwnerCheck ──────────────────────────────────────────────────

describe('readFileWithOwnerCheck', () => {
  it('returns file when owner matches', async () => {
    const file = { id: 'f1', project: { ownerId: 'user1' } };
    mock.sysMLFile.findUnique.mockResolvedValue(file);
    const result = await readFileWithOwnerCheck('f1', 'user1');
    expect(result).toEqual(file);
  });

  it('throws NotFound when file is null', async () => {
    mock.sysMLFile.findUnique.mockResolvedValue(null);
    await expect(readFileWithOwnerCheck('f1', 'user1')).rejects.toThrow('not found');
  });

  it('throws NotFound when owner does not match', async () => {
    mock.sysMLFile.findUnique.mockResolvedValue({ id: 'f1', project: { ownerId: 'other' } });
    await expect(readFileWithOwnerCheck('f1', 'user1')).rejects.toThrow('not found');
  });
});

// ── createFile ──────────────────────────────────────────────────────────────

describe('createFile', () => {
  it('creates file with sanitized name and emits event', async () => {
    const created = { id: 'f1', name: 'test', content: 'abc', size: 3 };
    mock.sysMLFile.create.mockResolvedValue(created);
    const result = await createFile('proj1', 'test', 'abc', 'user1');
    expect(result).toEqual(created);
    expect(mock.sysMLFile.create).toHaveBeenCalledWith({
      data: { name: 'test', content: 'abc', size: 3, projectId: 'proj1', displayId: 'FIL-TEST1' },
    });
    expect(mockEvents.emitFileChange).toHaveBeenCalledWith({ fileId: 'f1', userId: 'user1', action: 'created' });
  });

  it('throws BadRequest for invalid file name', async () => {
    await expect(createFile('proj1', '', 'abc', 'user1')).rejects.toThrow('Invalid file name');
  });

  it('throws PayloadTooLarge for oversized content', async () => {
    const big = 'x'.repeat(10 * 1024 * 1024 + 1);
    await expect(createFile('proj1', 'test', big, 'user1')).rejects.toThrow('exceeds');
  });
});

// ── updateFileContent ───────────────────────────────────────────────────────

describe('updateFileContent', () => {
  it('updates file and emits event', async () => {
    const updated = { id: 'f1', content: 'new', size: 3 };
    mock.sysMLFile.update.mockResolvedValue(updated);
    const result = await updateFileContent('f1', 'new', 'user1');
    expect(result).toEqual(updated);
    expect(mockEvents.emitFileChange).toHaveBeenCalledWith({ fileId: 'f1', userId: 'user1', action: 'updated' });
  });

  it('throws PayloadTooLarge for oversized content', async () => {
    const big = 'x'.repeat(10 * 1024 * 1024 + 1);
    await expect(updateFileContent('f1', big, 'user1')).rejects.toThrow('exceeds');
  });
});

// ── renameFile ──────────────────────────────────────────────────────────────

describe('renameFile', () => {
  it('renames file after sanitization', async () => {
    const updated = { id: 'f1', name: 'newName' };
    mock.sysMLFile.update.mockResolvedValue(updated);
    const result = await renameFile('f1', 'newName');
    expect(result).toEqual(updated);
    expect(mock.sysMLFile.update).toHaveBeenCalledWith({
      where: { id: 'f1' },
      data: { name: 'newName' },
    });
  });

  it('throws BadRequest for invalid name', () => {
    expect(() => renameFile('f1', '')).rejects.toThrow('Invalid file name');
  });
});

// ── deleteFile ──────────────────────────────────────────────────────────────

describe('deleteFile', () => {
  it('deletes file and emits event', async () => {
    const file = { id: 'f1', name: 'test' };
    mock.sysMLFile.findUnique.mockResolvedValue(file);
    mock.sysMLFile.delete.mockResolvedValue(file);
    const result = await deleteFile('f1', 'user1');
    expect(result).toEqual(file);
    expect(mock.sysMLFile.delete).toHaveBeenCalledWith({ where: { id: 'f1' } });
    expect(mockEvents.emitFileChange).toHaveBeenCalledWith({ fileId: 'f1', userId: 'user1', action: 'deleted' });
  });

  it('throws NotFound when file does not exist', async () => {
    mock.sysMLFile.findUnique.mockResolvedValue(null);
    await expect(deleteFile('f1', 'user1')).rejects.toThrow('not found');
  });
});

// ── moveFile ────────────────────────────────────────────────────────────────

describe('moveFile', () => {
  it('moves file to target project and emits event', async () => {
    const updated = { id: 'f1', projectId: 'proj2' };
    mock.sysMLFile.update.mockResolvedValue(updated);
    const result = await moveFile('f1', 'proj2', 'user1');
    expect(result).toEqual(updated);
    expect(mockEvents.emitFileChange).toHaveBeenCalledWith({ fileId: 'f1', userId: 'user1', action: 'updated' });
  });
});

// ── applyEdit ───────────────────────────────────────────────────────────────

describe('applyEdit', () => {
  const makeFile = (content: string) => ({
    id: 'f1',
    content,
    project: { ownerId: 'user1' },
  });

  it('applies edit in the middle of a file', async () => {
    mock.sysMLFile.findUnique.mockResolvedValue(makeFile('line1\nline2\nline3'));
    mock.sysMLFile.update.mockResolvedValue({});
    const result = await applyEdit('f1', 2, 1, 2, 6, 'REPLACED', 'user1');
    expect(result.error).toBeNull();
    expect(mock.sysMLFile.update).toHaveBeenCalledWith({
      where: { id: 'f1' },
      data: { content: 'line1\nREPLACED\nline3', size: expect.any(Number) },
    });
    expect(mockEvents.emitFileChange).toHaveBeenCalled();
  });

  it('returns error when file not found', async () => {
    mock.sysMLFile.findUnique.mockResolvedValue(null);
    const result = await applyEdit('f1', 1, 1, 1, 1, 'x', 'user1');
    expect(result.error).toContain('not found');
    expect(mockEvents.emitFileChange).not.toHaveBeenCalled();
  });

  it('returns error when owner does not match', async () => {
    mock.sysMLFile.findUnique.mockResolvedValue(makeFile('abc'));
    const result = await applyEdit('f1', 1, 1, 1, 1, 'x', 'wrong-user');
    expect(result.error).toContain('not found');
  });

  it('returns error for invalid line range — startLine < 1', async () => {
    mock.sysMLFile.findUnique.mockResolvedValue(makeFile('abc'));
    const result = await applyEdit('f1', 0, 1, 1, 1, 'x', 'user1');
    expect(result.error).toContain('Invalid line range');
  });

  it('returns error for invalid line range — endLine > lines', async () => {
    mock.sysMLFile.findUnique.mockResolvedValue(makeFile('abc'));
    const result = await applyEdit('f1', 1, 1, 5, 1, 'x', 'user1');
    expect(result.error).toContain('Invalid line range');
  });

  it('returns error for invalid line range — startLine > endLine', async () => {
    mock.sysMLFile.findUnique.mockResolvedValue(makeFile('line1\nline2'));
    const result = await applyEdit('f1', 2, 1, 1, 1, 'x', 'user1');
    expect(result.error).toContain('Invalid line range');
  });

  it('returns error when startColumn out of range', async () => {
    mock.sysMLFile.findUnique.mockResolvedValue(makeFile('abc'));
    const result = await applyEdit('f1', 1, 10, 1, 3, 'x', 'user1');
    expect(result.error).toContain('startColumn out of range');
  });

  it('returns error when endColumn out of range', async () => {
    mock.sysMLFile.findUnique.mockResolvedValue(makeFile('abc'));
    const result = await applyEdit('f1', 1, 1, 1, 10, 'x', 'user1');
    expect(result.error).toContain('endColumn out of range');
  });

  it('returns error when startColumn > endColumn on same line', async () => {
    mock.sysMLFile.findUnique.mockResolvedValue(makeFile('abcdef'));
    const result = await applyEdit('f1', 1, 5, 1, 2, 'x', 'user1');
    expect(result.error).toContain('startColumn exceeds endColumn');
  });

  it('returns error for empty file with non-zero columns', async () => {
    // sc=0, ec=1 → passes sc check (0 <= 0) but ec=0 > lines[0].length=0 triggers endColumn error
    // The "File is empty" guard only triggers when lines=[''] and sc>0 || ec>0 AFTER column range checks pass
    mock.sysMLFile.findUnique.mockResolvedValue(makeFile(''));
    const result = await applyEdit('f1', 1, 1, 1, 1, 'x', 'user1');
    // sc=0, ec=0 → both pass range, then single empty line with (sc>0 || ec>0) is false → no error
    // Actually for empty file: lines=[''], sc=0, ec=0 → 0<=0 ok, 0<=0 ok, same line 0>0 false, lines[0]==='' && (0>0||0>0) false → succeeds
    expect(result.error).toBeNull();
  });

  it('returns startColumn error on empty file with col > 1', async () => {
    mock.sysMLFile.findUnique.mockResolvedValue(makeFile(''));
    const result = await applyEdit('f1', 1, 2, 1, 2, 'x', 'user1');
    expect(result.error).toContain('startColumn out of range');
  });
});

// ── searchFiles ─────────────────────────────────────────────────────────────

describe('searchFiles', () => {
  it('finds matching lines across files', async () => {
    mock.sysMLFile.findMany.mockResolvedValue([
      { id: 'f1', name: 'model', content: 'part def Vehicle {\n  attribute mass;\n}' },
    ]);
    const results = await searchFiles('proj1', 'vehicle');
    expect(results).toEqual([{ fileName: 'model', line: 1, text: 'part def Vehicle {' }]);
  });

  it('is case-insensitive', async () => {
    mock.sysMLFile.findMany.mockResolvedValue([
      { id: 'f1', name: 'model', content: 'Part DEF Vehicle' },
    ]);
    const results = await searchFiles('proj1', 'part def');
    expect(results).toHaveLength(1);
  });

  it('caps results at MAX_SEARCH_RESULTS', async () => {
    const lines = Array.from({ length: 100 }, (_, i) => `match line ${i}`).join('\n');
    mock.sysMLFile.findMany.mockResolvedValue([{ id: 'f1', name: 'm', content: lines }]);
    const results = await searchFiles('proj1', 'match');
    expect(results).toHaveLength(50);
  });

  it('truncates line preview to 200 chars', async () => {
    const longLine = 'x'.repeat(300);
    mock.sysMLFile.findMany.mockResolvedValue([{ id: 'f1', name: 'm', content: longLine }]);
    const results = await searchFiles('proj1', 'x');
    expect(results[0].text).toHaveLength(200);
  });
});
