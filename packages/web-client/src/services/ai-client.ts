import type { DiagramDiagnostic } from '@systemodel/shared-types';
import { useAuthStore } from '../store/auth.js';

export interface AiTextEvent  { type: 'text';  chunk: string }
export interface AiEditEvent  {
  type: 'edit';
  description: string;
  startLine:   number;
  startColumn: number;
  endLine:     number;
  endColumn:   number;
  newText:     string;
}
export interface AiDoneEvent  { type: 'done' }
export interface AiErrorEvent { type: 'error'; message: string }

export type AiEvent = AiTextEvent | AiEditEvent | AiDoneEvent | AiErrorEvent;

export async function* streamAssist(
  content: string,
  instruction: string,
  diagnostics: DiagramDiagnostic[],
): AsyncGenerator<AiEvent> {
  const token = useAuthStore.getState().token;

  let response: Response;
  try {
    response = await fetch('/api/ai/assist', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ content, instruction, diagnostics }),
    });
  } catch (err) {
    yield { type: 'error', message: err instanceof Error ? err.message : 'Network error' };
    return;
  }

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => `HTTP ${response.status}`);
    let msg = text;
    try { msg = JSON.parse(text).error ?? text; } catch { /* ignore */ }
    yield { type: 'error', message: msg };
    return;
  }

  const reader  = response.body.getReader();
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
          if      (currentEvent === 'text')  yield { type: 'text',  chunk: data.chunk };
          else if (currentEvent === 'edit')  yield { type: 'edit',  ...data };
          else if (currentEvent === 'done')  { yield { type: 'done' }; return; }
          else if (currentEvent === 'error') yield { type: 'error', message: data.message };
        } catch { /* skip malformed */ }
      }
    }
  }
}
