import { useAuthStore } from '../store/auth.js';
import type { AiProvider } from '../store/ai-settings.js';

export interface ToolCallDisplay {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
  isError?: boolean;
}

export interface TokenUsageInfo {
  inputTokens: number;
  outputTokens: number;
}

export type ChatStreamEvent =
  | { type: 'text'; chunk: string }
  | { type: 'tool_call'; id: string; name: string; args: Record<string, unknown> }
  | { type: 'tool_result'; id: string; name: string; result: string; isError: boolean }
  | { type: 'usage'; inputTokens: number; outputTokens: number }
  | { type: 'done'; usage?: TokenUsageInfo }
  | { type: 'error'; message: string };

export interface FreeTierStatus {
  freeTierAvailable: boolean;
  freeModel: string | null;
  used: number;
  limit: number;
  remaining: number;
  periodEnd: string;
}

export async function fetchFreeTierStatus(): Promise<FreeTierStatus | null> {
  const token = useAuthStore.getState().token;
  try {
    const res = await fetch('/api/ai/status', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export interface SavedChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  edits?: { name: string; args: Record<string, unknown>; result: string; isError: boolean }[];
  createdAt: string;
}

export async function fetchChatHistory(fileId: string): Promise<SavedChatMessage[]> {
  const token = useAuthStore.getState().token;
  try {
    const res = await fetch(`/api/ai/history/${encodeURIComponent(fileId)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data ?? [];
  } catch {
    return [];
  }
}

export async function clearChatHistory(fileId: string): Promise<void> {
  const token = useAuthStore.getState().token;
  try {
    await fetch(`/api/ai/history/${encodeURIComponent(fileId)}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch { /* ignore */ }
}

export async function* streamChat(params: {
  provider: AiProvider;
  model?: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  context?: { projectId?: string; fileId?: string; fileContent?: string; fileName?: string };
}): AsyncGenerator<ChatStreamEvent> {
  const token = useAuthStore.getState().token;

  let response: Response;
  try {
    response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        provider: params.provider,
        model: params.model,
        messages: params.messages,
        context: params.context,
      }),
    });
  } catch (err) {
    yield { type: 'error', message: err instanceof Error ? err.message : 'Network error' };
    return;
  }

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => `HTTP ${response.status}`);
    let msg = text;
    try { const p = JSON.parse(text); msg = p.message ?? p.error ?? text; } catch { /* */ }
    yield { type: 'error', message: msg };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    let currentEvent = '';
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          if (currentEvent === 'text') yield { type: 'text', chunk: data.chunk };
          else if (currentEvent === 'tool_call') yield { type: 'tool_call', id: data.id, name: data.name, args: data.args };
          else if (currentEvent === 'tool_result') yield { type: 'tool_result', id: data.id, name: data.name, result: data.result, isError: data.isError };
          else if (currentEvent === 'usage') yield { type: 'usage', inputTokens: data.inputTokens, outputTokens: data.outputTokens };
          else if (currentEvent === 'done') { yield { type: 'done', usage: data.usage }; return; }
          else if (currentEvent === 'error') yield { type: 'error', message: data.message };
        } catch { /* skip malformed */ }
      }
    }
  }
}
