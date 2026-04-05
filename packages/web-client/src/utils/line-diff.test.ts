import { describe, it, expect } from 'vitest';
import { computeDiffHunks, type DiffHunk } from './line-diff.js';

describe('computeDiffHunks', () => {
  it('returns empty array for identical content', () => {
    expect(computeDiffHunks('abc', 'abc')).toEqual([]);
  });

  it('returns empty array for both empty strings', () => {
    expect(computeDiffHunks('', '')).toEqual([]);
  });

  it('detects a single added line', () => {
    const hunks = computeDiffHunks('line1', 'line1\nline2');
    expect(hunks).toHaveLength(1);
    expect(hunks[0].type).toBe('added');
    expect(hunks[0].newLines).toEqual(['line2']);
    expect(hunks[0].oldLines).toEqual([]);
    expect(hunks[0].newStartLine).toBe(2);
    expect(hunks[0].newEndLine).toBe(2);
  });

  it('detects a single deleted line', () => {
    const hunks = computeDiffHunks('line1\nline2', 'line1');
    expect(hunks).toHaveLength(1);
    expect(hunks[0].type).toBe('deleted');
    expect(hunks[0].oldLines).toEqual(['line2']);
    expect(hunks[0].newLines).toEqual([]);
    expect(hunks[0].newEndLine).toBe(0); // pure deletion
  });

  it('detects a modified line', () => {
    const hunks = computeDiffHunks('line1\nold\nline3', 'line1\nnew\nline3');
    expect(hunks).toHaveLength(1);
    expect(hunks[0].type).toBe('modified');
    expect(hunks[0].oldLines).toEqual(['old']);
    expect(hunks[0].newLines).toEqual(['new']);
    expect(hunks[0].newStartLine).toBe(2);
    expect(hunks[0].newEndLine).toBe(2);
  });

  it('detects multiple separated hunks', () => {
    const old = 'a\nb\nc\nd\ne';
    const now = 'a\nB\nc\nD\ne';
    const hunks = computeDiffHunks(old, now);
    expect(hunks).toHaveLength(2);
    expect(hunks[0].newLines).toEqual(['B']);
    expect(hunks[1].newLines).toEqual(['D']);
  });

  it('handles completely different content', () => {
    const hunks = computeDiffHunks('old1\nold2', 'new1\nnew2');
    expect(hunks.length).toBeGreaterThanOrEqual(1);
    // All old lines should appear somewhere in oldLines
    const allOld = hunks.flatMap(h => h.oldLines);
    expect(allOld).toContain('old1');
    expect(allOld).toContain('old2');
  });

  it('handles addition from empty content', () => {
    // '' splits to [''], so old has one empty line → type is 'modified' not 'added'
    const hunks = computeDiffHunks('', 'line1\nline2');
    expect(hunks).toHaveLength(1);
    expect(hunks[0].type).toBe('modified');
    expect(hunks[0].oldLines).toEqual(['']);
    expect(hunks[0].newLines).toEqual(['line1', 'line2']);
  });

  it('handles deletion to empty content', () => {
    // '' splits to [''], so new has one empty line → type is 'modified' not 'deleted'
    const hunks = computeDiffHunks('line1\nline2', '');
    expect(hunks).toHaveLength(1);
    expect(hunks[0].type).toBe('modified');
    expect(hunks[0].oldLines).toEqual(['line1', 'line2']);
    expect(hunks[0].newLines).toEqual(['']);
  });

  it('generates unique hunk IDs', () => {
    const hunks = computeDiffHunks('a\nb\nc', 'A\nb\nC');
    expect(hunks).toHaveLength(2);
    expect(hunks[0].id).not.toBe(hunks[1].id);
    expect(hunks[0].id).toMatch(/^ai_hunk_\d+$/);
    expect(hunks[1].id).toMatch(/^ai_hunk_\d+$/);
  });

  it('preserves old and new lines for revert', () => {
    const old = 'part def Vehicle {\n  attribute mass;\n}';
    const now = 'part def Vehicle {\n  attribute weight;\n  attribute color;\n}';
    const hunks = computeDiffHunks(old, now);
    expect(hunks.length).toBeGreaterThanOrEqual(1);
    // The old line should be recoverable
    const allOld = hunks.flatMap(h => h.oldLines);
    expect(allOld).toContain('  attribute mass;');
  });

  it('handles single-line change', () => {
    const hunks = computeDiffHunks('old', 'new');
    expect(hunks).toHaveLength(1);
    expect(hunks[0].type).toBe('modified');
  });

  it('handles consecutive additions at end', () => {
    const hunks = computeDiffHunks('a\nb', 'a\nb\nc\nd');
    expect(hunks).toHaveLength(1);
    expect(hunks[0].type).toBe('added');
    expect(hunks[0].newLines).toEqual(['c', 'd']);
  });
});
