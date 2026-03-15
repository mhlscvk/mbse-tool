import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { DiagramDiagnostic } from '@systemodel/shared-types';
import { streamAssist, type AiEditEvent } from '../../services/ai-client.js';

interface AiAssistantProps {
  content: string;
  diagnostics: DiagramDiagnostic[];
  onApplyEdit: (startLine: number, startCol: number, endLine: number, endCol: number, newText: string) => void;
  onClose: () => void;
}

interface MsgEdit extends AiEditEvent { applied: boolean }

interface Message {
  role: 'user' | 'assistant';
  text: string;
  edits?: MsgEdit[];
  error?: string;
}

const SUGGESTIONS = [
  'Fix all errors shown in the problems panel',
  'Add a mass attribute to the selected block',
  'Generate a complete SysML v2 template for a vehicle system',
  'Explain what this file models',
  'Add ports and flow connections between blocks',
];

export default function AiAssistant({ content, diagnostics, onApplyEdit, onClose }: AiAssistantProps) {
  const [messages, setMessages]     = useState<Message[]>([]);
  const [input, setInput]           = useState('');
  const [streaming, setStreaming]   = useState(false);
  const bottomRef                   = useRef<HTMLDivElement>(null);
  const textareaRef                 = useRef<HTMLTextAreaElement>(null);
  const abortRef                    = useRef(false);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = useCallback(async (instruction: string) => {
    if (!instruction.trim() || streaming) return;

    const userMsg: Message = { role: 'user', text: instruction };
    const assistantMsg: Message = { role: 'assistant', text: '', edits: [] };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput('');
    setStreaming(true);
    abortRef.current = false;

    try {
      for await (const event of streamAssist(content, instruction, diagnostics)) {
        if (abortRef.current) break;
        if (event.type === 'text') {
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { ...next[next.length - 1], text: next[next.length - 1].text + event.chunk };
            return next;
          });
        } else if (event.type === 'edit') {
          const edit: MsgEdit = { ...event, applied: false };
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            next[next.length - 1] = { ...last, edits: [...(last.edits ?? []), edit] };
            return next;
          });
        } else if (event.type === 'error') {
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { ...next[next.length - 1], error: event.message };
            return next;
          });
          break;
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { ...next[next.length - 1], error: err instanceof Error ? err.message : 'Stream failed' };
        return next;
      });
    } finally {
      setStreaming(false);
    }
  }, [content, diagnostics, streaming]);

  const handleApplyEdit = useCallback((msgIdx: number, editIdx: number, edit: MsgEdit) => {
    onApplyEdit(edit.startLine, edit.startColumn, edit.endLine, edit.endColumn, edit.newText);
    setMessages((prev) => {
      const next = [...prev];
      const edits = [...(next[msgIdx].edits ?? [])];
      edits[editIdx] = { ...edits[editIdx], applied: true };
      next[msgIdx] = { ...next[msgIdx], edits };
      return next;
    });
  }, [onApplyEdit]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <div style={{
      width: 320, flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      background: '#1e1e1e', borderLeft: '1px solid #3c3c3c',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 10px', background: '#252526', borderBottom: '1px solid #3c3c3c',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14 }}>✦</span>
          <span style={{ color: '#ccc', fontWeight: 600, fontSize: 12 }}>AI Assistant</span>
          <span style={{
            fontSize: 9, background: '#007acc', color: '#fff',
            borderRadius: 3, padding: '1px 5px', fontWeight: 600,
          }}>Claude</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              title="Clear conversation"
              style={iconBtn}
            >⟳</button>
          )}
          <button onClick={onClose} title="Close" style={iconBtn}>✕</button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {messages.length === 0 ? (
          <div style={{ padding: '16px 12px' }}>
            <div style={{ color: '#888', fontSize: 12, marginBottom: 12 }}>
              Ask Claude to edit your SysML v2 model, fix errors, or explain anything.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  style={{
                    background: '#2d2d2d', border: '1px solid #3c3c3c',
                    borderRadius: 4, color: '#9cdcfe', fontSize: 11,
                    textAlign: 'left', padding: '6px 10px', cursor: 'pointer',
                    lineHeight: 1.4,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#2a3a4a')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#2d2d2d')}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, mi) => (
            <div key={mi} style={{ marginBottom: 4 }}>
              {msg.role === 'user' ? (
                <div style={{
                  margin: '4px 10px', padding: '8px 10px',
                  background: '#094771', borderRadius: 6,
                  color: '#e0e8f0', fontSize: 12, lineHeight: 1.5,
                }}>
                  {msg.text}
                </div>
              ) : (
                <div style={{ padding: '4px 0' }}>
                  {/* Assistant text */}
                  {msg.text && (
                    <div style={{
                      padding: '0 12px', color: '#d4d4d4', fontSize: 12,
                      lineHeight: 1.6, whiteSpace: 'pre-wrap',
                    }}>
                      <SimpleMarkdown text={msg.text} />
                    </div>
                  )}
                  {/* Streaming indicator */}
                  {streaming && mi === messages.length - 1 && !msg.text && (
                    <div style={{ padding: '4px 12px', color: '#555', fontSize: 12 }}>
                      <span style={{ animation: 'pulse 1s infinite' }}>▋</span>
                    </div>
                  )}
                  {/* Error */}
                  {msg.error && (
                    <div style={{
                      margin: '4px 12px', padding: '6px 10px',
                      background: '#2a1010', border: '1px solid #5a2020',
                      borderRadius: 4, color: '#f48771', fontSize: 11,
                    }}>
                      ✕ {msg.error}
                    </div>
                  )}
                  {/* Edit proposals */}
                  {msg.edits && msg.edits.length > 0 && (
                    <div style={{ margin: '6px 10px 2px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {msg.edits.map((edit, ei) => (
                        <EditCard
                          key={ei}
                          edit={edit}
                          onApply={() => handleApplyEdit(mi, ei, edit)}
                        />
                      ))}
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
      <div style={{
        padding: '8px', borderTop: '1px solid #3c3c3c',
        background: '#252526', flexShrink: 0,
      }}>
        <div style={{ position: 'relative' }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Claude… (Enter to send, Shift+Enter for newline)"
            disabled={streaming}
            rows={3}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: '#3c3c3c', border: '1px solid #555',
              borderRadius: 4, color: '#d4d4d4', fontSize: 12,
              padding: '7px 36px 7px 10px', resize: 'none',
              fontFamily: 'inherit', lineHeight: 1.4,
              outline: 'none',
            }}
            onFocus={(e) => (e.target.style.borderColor = '#007acc')}
            onBlur={(e) => (e.target.style.borderColor = '#555')}
          />
          <button
            onClick={() => streaming ? (abortRef.current = true) : send(input)}
            title={streaming ? 'Stop' : 'Send (Enter)'}
            style={{
              position: 'absolute', right: 6, bottom: 6,
              background: streaming ? '#5a1a1a' : (input.trim() ? '#007acc' : '#3c3c3c'),
              border: 'none', borderRadius: 4, color: '#fff',
              width: 26, height: 26, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, transition: 'background 0.1s',
            }}
          >
            {streaming ? '■' : '▶'}
          </button>
        </div>
        <div style={{ color: '#555', fontSize: 10, marginTop: 4, textAlign: 'right' }}>
          {content.split('\n').length} lines · {diagnostics.length} diagnostic{diagnostics.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}

// ── Edit proposal card ────────────────────────────────────────────────────────

function EditCard({ edit, onApply }: { edit: MsgEdit; onApply: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{
      border: `1px solid ${edit.applied ? '#2a5a2a' : '#2a4a6a'}`,
      borderRadius: 4, overflow: 'hidden',
      background: edit.applied ? '#0a1a0a' : '#0a1a2a',
      opacity: edit.applied ? 0.7 : 1,
    }}>
      {/* Card header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 8px', cursor: 'pointer',
      }} onClick={() => setExpanded((v) => !v)}>
        <span style={{ color: edit.applied ? '#4ec9b0' : '#9cdcfe', fontSize: 13 }}>
          {edit.applied ? '✓' : '✎'}
        </span>
        <span style={{ flex: 1, color: '#c8d8e8', fontSize: 11 }}>{edit.description}</span>
        <span style={{ color: '#555', fontSize: 10 }}>
          L{edit.startLine}–{edit.endLine}
        </span>
        <span style={{ color: '#888', fontSize: 10 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Expanded: diff preview */}
      {expanded && (
        <div style={{
          borderTop: '1px solid #2a3a4a',
          background: '#111', padding: '6px 8px',
          fontFamily: "'Consolas','Courier New',monospace",
          fontSize: 11, overflowX: 'auto', maxHeight: 160, overflowY: 'auto',
        }}>
          {edit.newText.split('\n').map((line, i) => (
            <div key={i} style={{ color: '#4ec9b0', whiteSpace: 'pre' }}>+ {line}</div>
          ))}
        </div>
      )}

      {/* Apply button */}
      {!edit.applied && (
        <div style={{ padding: '4px 8px', borderTop: expanded ? '1px solid #1a2a3a' : 'none' }}>
          <button
            onClick={(e) => { e.stopPropagation(); onApply(); }}
            style={{
              background: '#007acc', border: 'none', borderRadius: 3,
              color: '#fff', fontSize: 11, padding: '3px 10px',
              cursor: 'pointer', width: '100%',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#005a9e')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#007acc')}
          >
            Apply Edit
          </button>
        </div>
      )}
    </div>
  );
}

// ── Minimal markdown renderer (bold, inline code, headings) ──────────────────

function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, i) => {
        if (line.startsWith('### ')) return <div key={i} style={{ fontWeight: 700, color: '#9cdcfe', marginTop: 6 }}>{line.slice(4)}</div>;
        if (line.startsWith('## '))  return <div key={i} style={{ fontWeight: 700, color: '#9cdcfe', marginTop: 6 }}>{line.slice(3)}</div>;
        if (line.startsWith('# '))   return <div key={i} style={{ fontWeight: 700, color: '#9cdcfe', marginTop: 6 }}>{line.slice(2)}</div>;
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return <div key={i} style={{ paddingLeft: 12, color: '#d4d4d4' }}>• {renderInline(line.slice(2))}</div>;
        }
        return <div key={i}>{renderInline(line) || <br />}</div>;
      })}
    </>
  );
}

function renderInline(text: string): React.ReactNode {
  // Split on **bold** and `code`
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} style={{ color: '#e8eef6' }}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`'))
      return <code key={i} style={{ background: '#2d2d2d', color: '#ce9178', borderRadius: 2, padding: '0 3px', fontFamily: 'monospace' }}>{part.slice(1, -1)}</code>;
    return part;
  });
}

const iconBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: '#888',
  cursor: 'pointer', fontSize: 13, padding: '2px 4px',
  borderRadius: 3, lineHeight: 1,
};
