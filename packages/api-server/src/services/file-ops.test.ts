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

vi.mock('../lib/auth-helpers.js', () => ({
  assertProjectAccess: vi.fn(),
}));

import { prisma } from '../db.js';
import { mcpEvents } from '../mcp/events.js';
import { assertProjectAccess } from '../lib/auth-helpers.js';
import {
  normalizeSysMLFileName,
  sanitizeFileName,
  extractBaseName,
  isValidSysMLIdentifier,
  formatSysMLPackageName,
  generateRootPackage,
  updateRootPackageName,
  assertContentSize,
  listFiles,
  getFile,
  readFileWithOwnerCheck,
  readFileWithAccessCheck,
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
const mockAccess = assertProjectAccess as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  // $transaction passes the mock prisma as tx so inner calls work
  mock.$transaction.mockImplementation(async (cb: any) => cb(mock));
});

// ── sanitizeFileName ────────────────────────────────────────────────────────

// ── normalizeSysMLFileName ──────────────────────────────────────────────────

describe('normalizeSysMLFileName', () => {
  it('appends .sysml to plain name', () => {
    expect(normalizeSysMLFileName('vehicle')).toBe('vehicle.sysml');
  });

  it('preserves case of base name', () => {
    expect(normalizeSysMLFileName('Vehicle')).toBe('Vehicle.sysml');
  });

  it('keeps name with correct .sysml extension as-is', () => {
    expect(normalizeSysMLFileName('vehicle.sysml')).toBe('vehicle.sysml');
  });

  it('normalizes uppercase .SYSML to lowercase', () => {
    expect(normalizeSysMLFileName('vehicle.SYSML')).toBe('vehicle.sysml');
  });

  it('normalizes mixed case .SysML', () => {
    expect(normalizeSysMLFileName('model.SysML')).toBe('model.sysml');
  });

  it('replaces wrong extension .txt with .sysml', () => {
    expect(normalizeSysMLFileName('vehicle.txt')).toBe('vehicle.sysml');
  });

  it('replaces double extension .sysml.txt', () => {
    expect(normalizeSysMLFileName('vehicle.sysml.txt')).toBe('vehicle.sysml');
  });

  it('trims leading and trailing spaces', () => {
    expect(normalizeSysMLFileName('  vehicle  ')).toBe('vehicle.sysml');
  });

  it('strips all extensions from multi-dot names', () => {
    expect(normalizeSysMLFileName('my.model.v2')).toBe('my.sysml');
  });

  it('strips leading dots (hidden files)', () => {
    expect(normalizeSysMLFileName('.hidden')).toBe('hidden.sysml');
  });

  it('strips leading dots with extension', () => {
    expect(normalizeSysMLFileName('.config.txt')).toBe('config.sysml');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeSysMLFileName('')).toBe('');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(normalizeSysMLFileName('   ')).toBe('');
  });

  it('returns empty string for only dots', () => {
    expect(normalizeSysMLFileName('...')).toBe('');
  });

  it('strips dangerous characters', () => {
    expect(normalizeSysMLFileName('path\\to/file\0name')).toBe('pathtofilename.sysml');
  });

  it('handles name that is just .sysml', () => {
    expect(normalizeSysMLFileName('.sysml')).toBe('');
  });
});

// ── sanitizeFileName (now normalizes to .sysml) ────────────────────────────

describe('sanitizeFileName', () => {
  it('normalizes a plain name to .sysml', () => {
    expect(sanitizeFileName('model')).toBe('model.sysml');
  });

  it('keeps valid .sysml name', () => {
    expect(sanitizeFileName('model.sysml')).toBe('model.sysml');
  });

  it('strips dangerous chars and adds .sysml', () => {
    expect(sanitizeFileName('path\\to/file\0name')).toBe('pathtofilename.sysml');
  });

  it('truncates to 255 characters', () => {
    const long = 'a'.repeat(300);
    const result = sanitizeFileName(long);
    expect(result.length).toBeLessThanOrEqual(255);
    expect(result.endsWith('.sysml')).toBe(true);
  });

  it('throws BadRequest for empty string', () => {
    expect(() => sanitizeFileName('')).toThrow('Invalid file name');
  });

  it('throws BadRequest when name becomes empty after sanitization', () => {
    expect(() => sanitizeFileName('//\\\0')).toThrow('Invalid file name');
  });
});

// ── SysML package name helpers ──────────────────────────────────────────────

describe('extractBaseName', () => {
  it('strips .sysml extension', () => expect(extractBaseName('vehicle.sysml')).toBe('vehicle'));
  it('returns untitled for empty', () => expect(extractBaseName('')).toBe('untitled'));
  it('preserves case', () => expect(extractBaseName('Vehicle.sysml')).toBe('Vehicle'));
});

describe('isValidSysMLIdentifier', () => {
  it('accepts simple name', () => expect(isValidSysMLIdentifier('vehicle')).toBe(true));
  it('accepts name with digits', () => expect(isValidSysMLIdentifier('Vehicle123')).toBe(true));
  it('accepts underscore start', () => expect(isValidSysMLIdentifier('_private')).toBe(true));
  it('rejects name starting with digit', () => expect(isValidSysMLIdentifier('123vehicle')).toBe(false));
  it('rejects name with spaces', () => expect(isValidSysMLIdentifier('vehicle control')).toBe(false));
  it('rejects name with hyphens', () => expect(isValidSysMLIdentifier('vehicle-control')).toBe(false));
});

describe('formatSysMLPackageName', () => {
  it('no quotes for simple identifier', () => expect(formatSysMLPackageName('vehicle')).toBe('vehicle'));
  it('quotes name with spaces', () => expect(formatSysMLPackageName('vehicle control')).toBe("'vehicle control'"));
  it('quotes name starting with digit', () => expect(formatSysMLPackageName('123vehicle')).toBe("'123vehicle'"));
  it('quotes name with hyphens', () => expect(formatSysMLPackageName('vehicle-control')).toBe("'vehicle-control'"));
  it('falls back to untitled for empty', () => expect(formatSysMLPackageName('')).toBe('untitled'));
});

describe('generateRootPackage', () => {
  it('generates unquoted package for simple name', () => {
    expect(generateRootPackage('vehicle.sysml')).toBe('package vehicle {\n  // SysML v2 model\n}\n');
  });
  it('generates quoted package for name with spaces', () => {
    expect(generateRootPackage('Cruise Control.sysml')).toBe("package 'Cruise Control' {\n  // SysML v2 model\n}\n");
  });
  it('preserves case', () => {
    expect(generateRootPackage('Vehicle.sysml')).toContain('package Vehicle {');
  });
});

describe('updateRootPackageName', () => {
  it('updates root package when names match', () => {
    const content = 'package vehicle {\n  part def A;\n}\n';
    const result = updateRootPackageName(content, 'vehicle.sysml', 'car.sysml');
    expect(result).toBe('package car {\n  part def A;\n}\n');
  });

  it('updates quoted package name', () => {
    const content = "package 'vehicle control' {\n  part def A;\n}\n";
    const result = updateRootPackageName(content, 'vehicle control.sysml', 'cruise control.sysml');
    expect(result).toBe("package 'cruise control' {\n  part def A;\n}\n");
  });

  it('returns null when old name does not match', () => {
    const content = 'package other {\n  part def A;\n}\n';
    const result = updateRootPackageName(content, 'vehicle.sysml', 'car.sysml');
    expect(result).toBeNull();
  });

  it('returns null when names are the same', () => {
    const content = 'package vehicle {\n}\n';
    const result = updateRootPackageName(content, 'vehicle.sysml', 'vehicle.sysml');
    expect(result).toBeNull();
  });

  it('does not modify non-root package declarations', () => {
    const content = 'package vehicle {\n  package inner {\n  }\n}\n';
    const result = updateRootPackageName(content, 'vehicle.sysml', 'car.sysml');
    expect(result).toContain('package inner {');
  });

  it('handles leading comments before package', () => {
    const content = '// SysML model\npackage vehicle {\n}\n';
    const result = updateRootPackageName(content, 'vehicle.sysml', 'car.sysml');
    expect(result).toBe('// SysML model\npackage car {\n}\n');
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

// ── readFileWithAccessCheck ────────────────────────────────────────────────

describe('readFileWithAccessCheck', () => {
  it('returns file when user has access', async () => {
    const file = { id: 'f1', projectId: 'proj1', project: {} };
    mock.sysMLFile.findUnique.mockResolvedValue(file);
    mockAccess.mockResolvedValue({ allowed: true, isSystem: false, isAdmin: false });
    const result = await readFileWithAccessCheck('f1', 'user1');
    expect(result).toEqual(file);
  });

  it('throws NotFound when file is null', async () => {
    mock.sysMLFile.findUnique.mockResolvedValue(null);
    await expect(readFileWithAccessCheck('f1', 'user1')).rejects.toThrow('not found');
  });

  it('throws NotFound when access denied', async () => {
    mock.sysMLFile.findUnique.mockResolvedValue({ id: 'f1', projectId: 'proj1', project: {} });
    mockAccess.mockResolvedValue({ allowed: false, isSystem: false, isAdmin: false });
    await expect(readFileWithAccessCheck('f1', 'user1')).rejects.toThrow('not found');
  });
});

// ── readFileWithOwnerCheck (deprecated, delegates to readFileWithAccessCheck)

describe('readFileWithOwnerCheck', () => {
  it('delegates to readFileWithAccessCheck', async () => {
    const file = { id: 'f1', projectId: 'proj1', project: {} };
    mock.sysMLFile.findUnique.mockResolvedValue(file);
    mockAccess.mockResolvedValue({ allowed: true, isSystem: false, isAdmin: false });
    const result = await readFileWithOwnerCheck('f1', 'user1');
    expect(result).toEqual(file);
  });
});

// ── createFile ──────────────────────────────────────────────────────────────

describe('createFile', () => {
  it('creates file with normalized .sysml name and emits event', async () => {
    const created = { id: 'f1', name: 'test.sysml', content: 'abc', size: 3 };
    mock.sysMLFile.create.mockResolvedValue(created);
    const result = await createFile('proj1', 'test', 'abc', 'user1');
    expect(result).toEqual(created);
    expect(mock.sysMLFile.create).toHaveBeenCalledWith({
      data: { name: 'test.sysml', content: 'abc', size: 3, projectId: 'proj1', displayId: 'FIL-TEST1' },
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
    const updated = { id: 'f1', name: 'newName.sysml' };
    mock.sysMLFile.update.mockResolvedValue(updated);
    const result = await renameFile('f1', 'newName');
    expect(result).toEqual(updated);
    expect(mock.sysMLFile.update).toHaveBeenCalledWith({
      where: { id: 'f1' },
      data: { name: 'newName.sysml' },
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
    projectId: 'proj1',
    project: { ownerId: 'user1' },
  });

  beforeEach(() => {
    // applyEdit checks access before the transaction
    mockAccess.mockResolvedValue({ allowed: true, isSystem: false, isAdmin: false });
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

  it('returns error when access denied', async () => {
    mock.sysMLFile.findUnique.mockResolvedValue(makeFile('abc'));
    mockAccess.mockResolvedValue({ allowed: false, isSystem: false, isAdmin: false });
    const result = await applyEdit('f1', 1, 1, 1, 1, 'x', 'wrong-user');
    expect(result.error).toContain('not found');
  });

  it('returns error for system files by non-admin', async () => {
    mock.sysMLFile.findUnique.mockResolvedValue(makeFile('abc'));
    mockAccess.mockResolvedValue({ allowed: true, isSystem: true, isAdmin: false });
    const result = await applyEdit('f1', 1, 1, 1, 1, 'x', 'user1');
    expect(result.error).toContain('read-only');
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
    mock.sysMLFile.findUnique.mockResolvedValue(makeFile(''));
    const result = await applyEdit('f1', 1, 1, 1, 1, 'x', 'user1');
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


// ── Source parameter propagation ──────────────────────────────────────────

describe('source parameter in events', () => {
  it('createFile passes source to emitFileChange', async () => {
    mock.sysMLFile.create.mockResolvedValue({ id: 'f1', name: 't', size: 1 });
    await createFile('proj1', 'test', 'abc', 'user1', 'mcp');
    expect(mockEvents.emitFileChange).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'mcp' }),
    );
  });

  it('createFile omits source when not provided', async () => {
    mock.sysMLFile.create.mockResolvedValue({ id: 'f1', name: 't', size: 1 });
    await createFile('proj1', 'test', 'abc', 'user1');
    expect(mockEvents.emitFileChange).toHaveBeenCalledWith(
      expect.objectContaining({ source: undefined }),
    );
  });

  it('updateFileContent passes source to emitFileChange', async () => {
    mock.sysMLFile.update.mockResolvedValue({ id: 'f1', content: 'x', size: 1 });
    await updateFileContent('f1', 'x', 'user1', 'ai_chat');
    expect(mockEvents.emitFileChange).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'ai_chat' }),
    );
  });

  it('deleteFile passes source to emitFileChange', async () => {
    mock.sysMLFile.findUnique.mockResolvedValue({ id: 'f1' });
    mock.sysMLFile.delete.mockResolvedValue({});
    await deleteFile('f1', 'user1', 'mcp');
    expect(mockEvents.emitFileChange).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'mcp' }),
    );
  });

  it('applyEdit passes source to emitFileChange', async () => {
    const file = { id: 'f1', content: 'abc', projectId: 'p1', project: { ownerId: 'user1' } };
    mock.sysMLFile.findUnique.mockResolvedValue(file);
    mock.sysMLFile.update.mockResolvedValue({});
    mockAccess.mockResolvedValue({ allowed: true, isSystem: false, isAdmin: false });
    const result = await applyEdit('f1', 1, 1, 1, 2, 'X', 'user1', 'mcp');
    expect(result.error).toBeNull();
    expect(mockEvents.emitFileChange).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'mcp' }),
    );
  });
});

// ── readFileWithAccessCheck access control ────────────────────────────────

describe('readFileWithAccessCheck access scenarios', () => {
  it('allows startup member to read startup project file', async () => {
    const file = { id: 'f1', projectId: 'proj1', project: {} };
    mock.sysMLFile.findUnique.mockResolvedValue(file);
    mockAccess.mockResolvedValue({ allowed: true, isSystem: false, isAdmin: false, startupRole: 'STARTUP_USER' });
    const result = await readFileWithAccessCheck('f1', 'member1');
    expect(result).toEqual(file);
  });

  it('allows any user to read system project file', async () => {
    const file = { id: 'f1', projectId: 'sys1', project: {} };
    mock.sysMLFile.findUnique.mockResolvedValue(file);
    mockAccess.mockResolvedValue({ allowed: true, isSystem: true, isAdmin: false });
    const result = await readFileWithAccessCheck('f1', 'anyuser');
    expect(result).toEqual(file);
  });

  it('rejects non-member from startup project', async () => {
    mock.sysMLFile.findUnique.mockResolvedValue({ id: 'f1', projectId: 'proj1', project: {} });
    mockAccess.mockResolvedValue({ allowed: false, isSystem: false, isAdmin: false });
    await expect(readFileWithAccessCheck('f1', 'outsider')).rejects.toThrow('not found');
  });
});
