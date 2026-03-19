import { describe, it, expect, beforeEach } from 'vitest';
import { useRecentFilesStore } from './recent-files.js';

beforeEach(() => {
  useRecentFilesStore.setState({ entries: [] });
  localStorage.clear();
});

const entry = (n: number) => ({
  projectId: `proj-${n}`,
  projectName: `Project ${n}`,
  fileId: `file-${n}`,
  fileName: `model${n}.sysml`,
});

describe('recent files store', () => {
  it('starts empty', () => {
    expect(useRecentFilesStore.getState().entries).toEqual([]);
  });

  it('adds an entry', () => {
    useRecentFilesStore.getState().addEntry(entry(1));
    const entries = useRecentFilesStore.getState().entries;
    expect(entries).toHaveLength(1);
    expect(entries[0].fileId).toBe('file-1');
    expect(entries[0].accessedAt).toBeGreaterThan(0);
  });

  it('most recent entry is first', () => {
    useRecentFilesStore.getState().addEntry(entry(1));
    useRecentFilesStore.getState().addEntry(entry(2));
    const entries = useRecentFilesStore.getState().entries;
    expect(entries[0].fileId).toBe('file-2');
    expect(entries[1].fileId).toBe('file-1');
  });

  it('re-adding same fileId moves it to top', () => {
    useRecentFilesStore.getState().addEntry(entry(1));
    useRecentFilesStore.getState().addEntry(entry(2));
    useRecentFilesStore.getState().addEntry(entry(1));
    const entries = useRecentFilesStore.getState().entries;
    expect(entries).toHaveLength(2);
    expect(entries[0].fileId).toBe('file-1');
  });

  it('caps at 10 entries', () => {
    for (let i = 0; i < 15; i++) {
      useRecentFilesStore.getState().addEntry(entry(i));
    }
    expect(useRecentFilesStore.getState().entries).toHaveLength(10);
    // Most recent (14) should be first, oldest (5) should be last
    expect(useRecentFilesStore.getState().entries[0].fileId).toBe('file-14');
    expect(useRecentFilesStore.getState().entries[9].fileId).toBe('file-5');
  });

  it('removes entry by fileId', () => {
    useRecentFilesStore.getState().addEntry(entry(1));
    useRecentFilesStore.getState().addEntry(entry(2));
    useRecentFilesStore.getState().removeEntry('file-1');
    const entries = useRecentFilesStore.getState().entries;
    expect(entries).toHaveLength(1);
    expect(entries[0].fileId).toBe('file-2');
  });

  it('clear removes all entries', () => {
    useRecentFilesStore.getState().addEntry(entry(1));
    useRecentFilesStore.getState().addEntry(entry(2));
    useRecentFilesStore.getState().clear();
    expect(useRecentFilesStore.getState().entries).toHaveLength(0);
  });
});

describe('recent files security', () => {
  it('rejects entries with invalid projectId', () => {
    useRecentFilesStore.getState().addEntry({
      projectId: '../../../etc/passwd',
      projectName: 'evil',
      fileId: 'file-1',
      fileName: 'test.sysml',
    });
    expect(useRecentFilesStore.getState().entries).toHaveLength(0);
  });

  it('rejects entries with invalid fileId', () => {
    useRecentFilesStore.getState().addEntry({
      projectId: 'proj-1',
      projectName: 'ok',
      fileId: '<script>alert(1)</script>',
      fileName: 'test.sysml',
    });
    expect(useRecentFilesStore.getState().entries).toHaveLength(0);
  });

  it('rejects entries with empty projectId', () => {
    useRecentFilesStore.getState().addEntry({
      projectId: '',
      projectName: 'test',
      fileId: 'file-1',
      fileName: 'test.sysml',
    });
    expect(useRecentFilesStore.getState().entries).toHaveLength(0);
  });

  it('accepts valid CUID-style IDs', () => {
    useRecentFilesStore.getState().addEntry({
      projectId: 'cmmx68i6c000ukyqanzrs3pzi',
      projectName: 'My Project',
      fileId: 'cmmx68i6v0010kyqa8op0t0wz',
      fileName: 'vehicle.sysml',
    });
    expect(useRecentFilesStore.getState().entries).toHaveLength(1);
  });

  it('accepts IDs with hyphens and underscores', () => {
    useRecentFilesStore.getState().addEntry({
      projectId: 'proj-abc_123',
      projectName: 'Test',
      fileId: 'file-xyz_456',
      fileName: 'test.sysml',
    });
    expect(useRecentFilesStore.getState().entries).toHaveLength(1);
  });

  it('rejects IDs with special characters', () => {
    const bad = ['id/path', 'id?q=1', 'id#hash', 'id space', 'id\nnewline', 'id;drop'];
    for (const id of bad) {
      useRecentFilesStore.setState({ entries: [] });
      useRecentFilesStore.getState().addEntry({
        projectId: id,
        projectName: 'test',
        fileId: 'file-1',
        fileName: 'test.sysml',
      });
      expect(useRecentFilesStore.getState().entries, `should reject projectId "${id}"`).toHaveLength(0);
    }
  });
});
