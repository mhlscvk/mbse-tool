import { create } from 'zustand';
import type { ElementLock } from '@systemodel/shared-types';
import { api } from '../services/api-client.js';
import { useAuthStore } from './auth.js';

function currentUserId(): string | undefined {
  return useAuthStore.getState().user?.id;
}

interface LockState {
  locks: ElementLock[];
  projectId: string | null;
  fileId: string | null;
  isStartupProject: boolean;

  // Derived
  myLockedElements: () => Set<string>;
  otherLocks: () => ElementLock[];
  isLockedByMe: (elementName: string) => boolean;

  // Actions
  init: (projectId: string, fileId: string, isStartup: boolean) => void;
  fetch: () => Promise<void>;
  checkOut: (elementName: string) => Promise<void>;
  checkIn: (elementName: string) => Promise<void>;
  requestLock: (elementName: string) => Promise<void>;
  reset: () => void;
}

export const useLockStore = create<LockState>((set, get) => ({
  locks: [],
  projectId: null,
  fileId: null,
  isStartupProject: false,

  myLockedElements: () => {
    const uid = currentUserId();
    const s = new Set<string>();
    for (const l of get().locks) {
      if (l.lockedBy === uid) s.add(l.elementName);
    }
    return s;
  },

  otherLocks: () => {
    const uid = currentUserId();
    return get().locks.filter(l => l.lockedBy !== uid);
  },

  isLockedByMe: (elementName) => {
    const uid = currentUserId();
    return get().locks.some(l => l.elementName === elementName && l.lockedBy === uid);
  },

  init: (projectId, fileId, isStartup) => {
    set({ projectId, fileId, isStartupProject: isStartup, locks: [] });
  },

  fetch: async () => {
    const { projectId, fileId } = get();
    if (!projectId || !fileId) return;
    try {
      const list = await api.elementLocks.list(projectId, fileId);
      set({ locks: list });
    } catch { /* ignore */ }
  },

  checkOut: async (elementName) => {
    const { projectId, fileId } = get();
    if (!projectId || !fileId) return;
    const lock = await api.elementLocks.checkOut(projectId, fileId, elementName);
    set(s => ({ locks: [...s.locks, lock] }));
  },

  checkIn: async (elementName) => {
    const { projectId, fileId } = get();
    if (!projectId || !fileId) return;
    await api.elementLocks.checkIn(projectId, fileId, elementName);
    set(s => ({ locks: s.locks.filter(l => l.elementName !== elementName) }));
  },

  requestLock: async (elementName) => {
    const { fileId } = get();
    if (!fileId) return;
    await api.notifications.create(elementName, fileId);
  },

  reset: () => set({ locks: [], projectId: null, fileId: null, isStartupProject: false }),
}));
