import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAiSettings } from '../../store/ai-settings.js';
import { streamChat, fetchFreeTierStatus, fetchChatHistory, clearChatHistory, type ToolCallDisplay, type FreeTierStatus, type TokenUsageInfo } from '../../services/ai-client.js';
import { api, type AiKeyInfo } from '../../services/api-client.js';
import { useTheme } from '../../store/theme.js';

interface AiAssistantProps {
  onClose: () => void;
  projectId?: string;
  fileId?: string;
  fileContent?: string;
  fileName?: string;
  /** Called after the AI successfully edits the current file */
  onFileEdited?: () => void;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCallDisplay[];
}

const PROVIDER_LABELS = { anthropic: 'Claude', openai: 'GPT', gemini: 'Gemini' } as const;
const PROVIDER_COLORS = { anthropic: '#d4a27a', openai: '#74aa9c', gemini: '#4285f4' } as const;

const FILE_EDIT_TOOLS = new Set(['apply_edit', 'update_file', 'create_file', 'delete_file']);

export default function AiAssistant({ onClose, projectId, fileId, fileContent, fileName, onFileEdited }: AiAssistantProps) {
  const navigate = useNavigate();
  const { provider, setProvider } = useAiSettings();
  const t = useTheme();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [freeStatus, setFreeStatus] = useState<FreeTierStatus | null>(null);
  const [storedKeys, setStoredKeys] = useState<AiKeyInfo[]>([]);

  // Global token usage per provider, persisted in localStorage
  // Key ties usage to the active provider (API key), not individual files
  const tokenKeyForProvider = useCallback((prov: string) => `systemodel:tokens:${prov}`, []);

  const loadTokenUsage = useCallback((prov: string): TokenUsageInfo => {
    try {
      const saved = localStorage.getItem(tokenKeyForProvider(prov));
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return { inputTokens: 0, outputTokens: 0 };
  }, [tokenKeyForProvider]);

  const [tokenUsage, setTokenUsage] = useState<TokenUsageInfo>(() => loadTokenUsage(provider));
  const providerRef = useRef(provider);
  providerRef.current = provider;

  const addTokenUsage = useCallback((delta: TokenUsageInfo) => {
    setTokenUsage(prev => {
      const next = {
        inputTokens: prev.inputTokens + delta.inputTokens,
        outputTokens: prev.outputTokens + delta.outputTokens,
      };
      try { localStorage.setItem(tokenKeyForProvider(providerRef.current), JSON.stringify(next)); } catch { /* full */ }
      return next;
    });
  }, [tokenKeyForProvider]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const activeKey = storedKeys.find(k => k.provider === provider);
  const hasOwnKey = !!activeKey;
  const isFreeTier = !hasOwnKey;
  const freeTierAvailable = freeStatus?.freeTierAvailable ?? false;
  const canChat = hasOwnKey || freeTierAvailable;
  const quotaExhausted = isFreeTier && freeStatus ? freeStatus.remaining <= 0 : false;

  // Fetch API keys and free tier status on mount AND when fileId changes
  // (re-fetch ensures keys are always recognized after navigation)
  useEffect(() => {
    let cancelled = false;
    fetchFreeTierStatus().then(s => { if (!cancelled) setFreeStatus(s); }).catch(() => {});
    api.aiKeys.list().then(keys => {
      if (cancelled) return;
      setStoredKeys(keys);
      // Auto-select a connected provider if the current one has no key
      if (keys.length > 0 && !keys.find(k => k.provider === provider)) {
        setProvider(keys[0].provider as 'anthropic' | 'openai' | 'gemini');
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId]);

  // Reload persisted token usage when provider changes
  useEffect(() => {
    setTokenUsage(loadTokenUsage(provider));
  }, [provider, loadTokenUsage]);

  // Load chat history on mount / fileId change
  useEffect(() => {
    if (!fileId) return;
    fetchChatHistory(fileId).then(history => {
      if (history.length === 0) return;
      setMessages(history.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.text,
        toolCalls: m.edits?.map((e, i) => ({
          id: `saved_${i}`,
          name: e.name,
          args: e.args,
          result: e.result,
          isError: e.isError,
        })),
      })));
    });
  }, [fileId]);

  // Abort in-flight request on unmount
  useEffect(() => {
    return () => { abortControllerRef.current?.abort(); };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = useCallback(async (instruction: string) => {
    if (!instruction.trim() || streaming || !canChat || quotaExhausted) return;

    const userMsg: ChatMessage = { role: 'user', content: instruction };
    const assistantMsg: ChatMessage = { role: 'assistant', content: '', toolCalls: [] };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setInput('');
    setStreaming(true);
    // Abort any in-flight request before starting a new one
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));

    try {
      const gen = streamChat({
        provider: hasOwnKey ? provider : 'anthropic',
        model: activeKey?.model,
        messages: history,
        context: { projectId, fileId, fileContent, fileName },
      });

      for await (const event of gen) {
        if (abortControllerRef.current?.signal.aborted) break;

        if (event.type === 'text') {
          setMessages(prev => {
            const next = [...prev];
            const last = next[next.length - 1];
            next[next.length - 1] = { ...last, content: last.content + event.chunk };
            return next;
          });
        } else if (event.type === 'tool_call') {
          setMessages(prev => {
            const next = [...prev];
            const last = next[next.length - 1];
            next[next.length - 1] = {
              ...last,
              toolCalls: [...(last.toolCalls ?? []), { id: event.id, name: event.name, args: event.args }],
            };
            return next;
          });
        } else if (event.type === 'tool_result') {
          setMessages(prev => {
            const next = [...prev];
            const last = next[next.length - 1];
            const calls = (last.toolCalls ?? []).map(tc =>
              tc.id === event.id ? { ...tc, result: event.result, isError: event.isError } : tc
            );
            next[next.length - 1] = { ...last, toolCalls: calls };
            return next;
          });
          // Refresh editor content after a successful file-editing tool call
          if (!event.isError && FILE_EDIT_TOOLS.has(event.name)) {
            onFileEdited?.();
          }
        } else if (event.type === 'usage') {
          // Live update during multi-round tool use (shows running total for this request)
          // Don't persist — wait for done event with final total
        } else if (event.type === 'done') {
          // Add this request's total to the cumulative per-file usage
          if (event.usage && (event.usage.inputTokens > 0 || event.usage.outputTokens > 0)) {
            addTokenUsage(event.usage);
          }
          if (isFreeTier) fetchFreeTierStatus().then(setFreeStatus);
        } else if (event.type === 'error') {
          setMessages(prev => {
            const next = [...prev];
            const last = next[next.length - 1];
            next[next.length - 1] = { ...last, content: last.content + `\n\n**Error:** ${event.message}` };
            return next;
          });
          if (isFreeTier) fetchFreeTierStatus().then(setFreeStatus);
          break;
        }
      }
    } catch (err) {
      setMessages(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        next[next.length - 1] = { ...last, content: last.content + `\n\n**Error:** ${err instanceof Error ? err.message : 'Failed'}` };
        return next;
      });
    } finally {
      setStreaming(false);
    }
  }, [provider, setProvider, activeKey, messages, streaming, canChat, quotaExhausted, hasOwnKey, isFreeTier, projectId, fileId, fileContent, fileName, onFileEdited, addTokenUsage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const tierLabel = hasOwnKey ? PROVIDER_LABELS[provider] : 'Free';
  const tierColor = hasOwnKey ? PROVIDER_COLORS[provider] : t.textMuted;

  return (
    <div style={{
      width: 320, flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      background: t.bg, borderLeft: `1px solid ${t.border}`,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 10px', background: t.bgTertiary, borderBottom: `1px solid ${t.border}`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14 }}>&#10022;</span>
          <span style={{ color: t.text, fontWeight: 600, fontSize: 12 }}>AI Chat</span>
          <span style={{
            fontSize: 9, background: tierColor + '30', color: tierColor,
            borderRadius: 3, padding: '1px 5px', fontWeight: 600,
          }}>{tierLabel}</span>
        </div>
        <div style={{ display: 'flex', gap: 4, color: t.textMuted }}>
          <button onClick={() => navigate('/settings?tab=ai-provider')} title="AI Settings" style={iconBtn}>&#9881;</button>
          {messages.length > 0 && (
            <button onClick={() => {
              if (fileId) clearChatHistory(fileId);
              setMessages([]);
            }} title="Clear chat" style={iconBtn}>&#10227;</button>
          )}
          <button onClick={onClose} title="Close" style={iconBtn}>&#10005;</button>
        </div>
      </div>

      {/* Free tier quota bar */}
      {isFreeTier && freeStatus && freeStatus.freeTierAvailable && (
        <div style={{ padding: '4px 10px', background: t.bgSecondary, borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ fontSize: 10, color: t.textMuted }}>
              {freeStatus.used} / {freeStatus.limit} free messages
            </span>
            <span style={{ fontSize: 10, color: quotaExhausted ? t.error : t.info, cursor: 'pointer' }}
              onClick={() => navigate('/settings?tab=ai-provider')}
            >
              {quotaExhausted ? 'Upgrade' : 'Add your key for unlimited'}
            </span>
          </div>
          <div style={{ width: '100%', height: 3, background: t.bgTertiary, borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(100, (freeStatus.used / freeStatus.limit) * 100)}%`,
              height: '100%', borderRadius: 2,
              background: quotaExhausted ? t.error : t.accent,
            }} />
          </div>
        </div>
      )}

      {/* Token usage bar */}
      {canChat && <TokenUsageBar usage={tokenUsage} t={t} streaming={streaming} />}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {!canChat ? (
          <div style={{ padding: '24px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>&#10022;</div>
            <div style={{ color: t.text, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Connect AI Provider</div>
            <div style={{ color: t.textMuted, fontSize: 12, lineHeight: 1.6, marginBottom: 16 }}>
              Add your AI provider API key in Settings to start chatting.
            </div>
            <button onClick={() => navigate('/settings?tab=ai-provider')} style={{
              background: t.accent, color: '#fff', border: 'none',
              borderRadius: 4, padding: '8px 20px', fontSize: 13, cursor: 'pointer',
            }}>Configure AI Provider</button>
          </div>
        ) : messages.length === 0 ? (
          <div style={{ padding: '16px 12px', color: t.textMuted, fontSize: 12, lineHeight: 1.6 }}>
            Ask the AI to edit your SysML model, fix errors, explain code, or generate new elements.
            {isFreeTier && <span style={{ color: t.info }}> You&apos;re on the free tier ({freeStatus?.remaining ?? '...'} messages left).</span>}
          </div>
        ) : (
          messages.map((msg, mi) => (
            <div key={mi} style={{ marginBottom: 4 }}>
              {msg.role === 'user' ? (
                <div style={{
                  margin: '4px 10px', padding: '8px 10px',
                  background: '#e1ecf4', borderRadius: 6,
                  color: '#1a3050', fontSize: 12, lineHeight: 1.5,
                }}>{msg.content}</div>
              ) : (
                <div style={{ padding: '4px 0' }}>
                  {msg.content && (
                    <div style={{
                      padding: '0 12px', color: t.text, fontSize: 12,
                      lineHeight: 1.6, whiteSpace: 'pre-wrap',
                    }}><SimpleMarkdown text={msg.content} /></div>
                  )}
                  {streaming && mi === messages.length - 1 && !msg.content && !msg.toolCalls?.length && (
                    <div style={{ padding: '4px 12px', color: t.textDim, fontSize: 12 }}>
                      <span style={{ animation: 'pulse 1s infinite' }}>&#9613;</span>
                    </div>
                  )}
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div style={{ margin: '6px 10px 2px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {msg.toolCalls.map(tc => <ToolCallCard key={tc.id} call={tc} />)}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {canChat && (
        <div style={{
          padding: '8px', borderTop: `1px solid ${t.border}`,
          background: t.bgTertiary, flexShrink: 0,
        }}>
          <div style={{ position: 'relative' }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={quotaExhausted ? 'Free tier limit reached — add your key in Settings' : 'Ask about your SysML model...'}
              disabled={streaming || quotaExhausted}
              rows={3}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: quotaExhausted ? t.bgTertiary : t.bgInput,
                border: `1px solid ${t.border}`, borderRadius: 4,
                color: quotaExhausted ? t.textDim : t.text, fontSize: 12,
                caretColor: '#000', padding: '7px 36px 7px 10px', resize: 'none',
                fontFamily: 'inherit', lineHeight: 1.4, outline: 'none',
              }}
              onFocus={e => { if (!quotaExhausted) e.target.style.borderColor = t.accent; }}
              onBlur={e => (e.target.style.borderColor = t.border)}
            />
            <button
              onClick={() => streaming ? abortControllerRef.current?.abort() : send(input)}
              disabled={quotaExhausted && !streaming}
              title={quotaExhausted ? 'Limit reached' : streaming ? 'Stop' : 'Send (Enter)'}
              style={{
                position: 'absolute', right: 6, bottom: 6,
                background: streaming ? t.error : quotaExhausted ? t.btnDisabled : (input.trim() ? t.accent : t.bgTertiary),
                border: 'none', borderRadius: 4, color: '#fff',
                width: 26, height: 26,
                cursor: quotaExhausted && !streaming ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
              }}
            >{streaming ? '\u25A0' : '\u25B6'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Token Usage Bar ────────────────────────────────────────────────────────

function formatTokenCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function TokenUsageBar({ usage, t, streaming }: { usage: TokenUsageInfo; t: ReturnType<typeof useTheme>; streaming: boolean }) {
  const total = usage.inputTokens + usage.outputTokens;
  const hasUsage = total > 0;
  // Context window estimate based on common model limits
  const contextLimit = 200_000;
  const pct = hasUsage ? Math.min(100, (total / contextLimit) * 100) : 0;
  const barColor = pct > 80 ? t.error : pct > 50 ? '#ff9800' : t.accent;

  return (
    <div style={{
      padding: '4px 10px', background: t.bgSecondary,
      borderBottom: `1px solid ${t.border}`, flexShrink: 0,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ fontSize: 10, color: t.textMuted }}>
          {hasUsage
            ? `Tokens: ${formatTokenCount(usage.inputTokens)} in + ${formatTokenCount(usage.outputTokens)} out`
            : streaming ? 'Calculating tokens...' : 'Token usage'
          }
        </span>
        <span style={{ fontSize: 10, color: t.textMuted }}>
          {hasUsage ? `${formatTokenCount(total)} total` : '0'}
        </span>
      </div>
      <div style={{
        width: '100%', height: 3, background: t.bgTertiary,
        borderRadius: 2, overflow: 'hidden',
      }}>
        <div style={{
          width: hasUsage ? `${Math.max(1, pct)}%` : '0%',
          height: '100%', borderRadius: 2, background: barColor,
          transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  );
}

// ─── Tool Call Card ──────────────────────────────────────────────────────────

function ToolCallCard({ call }: { call: ToolCallDisplay }) {
  const t = useTheme();
  const [expanded, setExpanded] = useState(false);
  const isDone = call.result !== undefined;
  const isError = call.isError;

  const borderColor = isError ? '#e8c0c0' : isDone ? '#c0e0c0' : '#c0d0e0';
  const bgColor = isError ? '#fff0f0' : isDone ? '#f0fff0' : '#f0f0ff';

  return (
    <div style={{
      border: `1px solid ${borderColor}`,
      borderRadius: 4, overflow: 'hidden', fontSize: 11,
      background: bgColor,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 8px', cursor: 'pointer',
      }} onClick={() => setExpanded(v => !v)}>
        <span style={{ color: isError ? t.error : isDone ? t.success : t.info, fontSize: 12 }}>
          {isError ? '\u2717' : isDone ? '\u2713' : '\u25CB'}
        </span>
        <code style={{ color: t.info, fontFamily: 'monospace' }}>{call.name}</code>
        <span style={{ flex: 1 }} />
        <span style={{ color: t.textDim, fontSize: 9 }}>{expanded ? '\u25B2' : '\u25BC'}</span>
      </div>
      {expanded && (
        <div style={{ borderTop: `1px solid ${t.border}`, padding: '4px 8px', background: t.bgSecondary }}>
          <div style={{ color: t.textMuted, fontSize: 10, marginBottom: 2 }}>Args:</div>
          <pre style={{ color: t.textMuted, margin: 0, fontSize: 10, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
            {JSON.stringify(call.args, null, 2)}
          </pre>
          {call.result && (
            <>
              <div style={{ color: t.textMuted, fontSize: 10, marginTop: 4, marginBottom: 2 }}>Result:</div>
              <pre style={{
                color: isError ? t.error : t.success, margin: 0, fontSize: 10,
                whiteSpace: 'pre-wrap', fontFamily: 'monospace', maxHeight: 120, overflow: 'auto',
              }}>{call.result}</pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Markdown ────────────────────────────────────────────────────────────────

function SimpleMarkdown({ text }: { text: string }) {
  const t = useTheme();
  const lines = text.split('\n');
  const headingColor = t.info;
  return (
    <>
      {lines.map((line, i) => {
        if (line.startsWith('### ')) return <div key={i} style={{ fontWeight: 700, color: headingColor, marginTop: 6 }}>{line.slice(4)}</div>;
        if (line.startsWith('## '))  return <div key={i} style={{ fontWeight: 700, color: headingColor, marginTop: 6 }}>{line.slice(3)}</div>;
        if (line.startsWith('# '))   return <div key={i} style={{ fontWeight: 700, color: headingColor, marginTop: 6 }}>{line.slice(2)}</div>;
        if (line.startsWith('- ') || line.startsWith('* '))
          return <div key={i} style={{ paddingLeft: 12, color: t.text }}>&bull; {renderInline(line.slice(2), t)}</div>;
        return <div key={i}>{renderInline(line, t) || <br />}</div>;
      })}
    </>
  );
}

function renderInline(text: string, t: ReturnType<typeof useTheme>): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} style={{ color: t.text }}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`'))
      return <code key={i} style={{ background: t.bgTertiary, color: '#a31515', borderRadius: 2, padding: '0 3px', fontFamily: 'monospace' }}>{part.slice(1, -1)}</code>;
    return part;
  });
}

const iconBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: 'inherit',
  cursor: 'pointer', fontSize: 13, padding: '2px 4px',
  borderRadius: 3, lineHeight: 1,
};
