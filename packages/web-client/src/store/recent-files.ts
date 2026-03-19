import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface RecentFileEntry {
  projectId: string;
  projectName: string;
  fileId: string;
  fileName: string;
  accessedAt: number;
}

const MAX_ENTRIES = 10;

interface RecentFilesState {
  entries: RecentFileEntry[];
  addEntry: (entry: Omit<RecentFileEntry, 'accessedAt'>) => void;
  removeEntry: (fileId: string) => void;
  clear: () => void;
}

const isValidId = (s: unknown): s is string => typeof s === 'string' && /^[a-z0-9_-]+$/i.test(s);

export const useRecentFilesStore = create<RecentFilesState>()(
  persist(
    (set) => ({
      entries: [],
      addEntry: (entry) => set((s) => {
        if (!isValidId(entry.projectId) || !isValidId(entry.fileId)) return s;
        const filtered = s.entries.filter((e) => e.fileId !== entry.fileId);
        const updated = [{ ...entry, accessedAt: Date.now() }, ...filtered];
        return { entries: updated.slice(0, MAX_ENTRIES) };
      }),
      removeEntry: (fileId) => set((s) => ({
        entries: s.entries.filter((e) => e.fileId !== fileId),
      })),
      clear: () => set({ entries: [] }),
    }),
    {
      name: 'systemodel-recent-files',
      merge: (persisted, current) => {
        const p = persisted as Partial<RecentFilesState> | undefined;
        const entries = Array.isArray(p?.entries)
          ? p.entries.filter((e): e is RecentFileEntry =>
              e != null && isValidId(e.projectId) && isValidId(e.fileId) &&
              typeof e.fileName === 'string' && typeof e.projectName === 'string',
            ).slice(0, MAX_ENTRIES)
          : [];
        return { ...current, entries };
      },
    },
  ),
);
