import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AiProvider = 'anthropic' | 'openai' | 'gemini';

interface AiSettingsState {
  provider: AiProvider;
  setProvider: (p: AiProvider) => void;
}

export const useAiSettings = create<AiSettingsState>()(
  persist(
    (set) => ({
      provider: 'anthropic',
      setProvider: (provider) => set({ provider }),
    }),
    {
      // localStorage — persists across refresh and tab close
      name: 'systemodel-ai-settings',
    },
  ),
);

export const DEFAULT_MODELS: Record<AiProvider, string> = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o',
  gemini: 'gemini-2.0-flash',
};
