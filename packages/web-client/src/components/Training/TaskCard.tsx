import React, { useState, useEffect } from 'react';
import type { TrainingTask, ValidationResult } from '../../training/tasks.js';
import { useTheme } from '../../store/theme.js';

// ─── Mini markdown renderer: **bold** and `code` ─────────────────────────────

function renderText(text: string, t: ReturnType<typeof useTheme>): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const lines = text.split('\n');

  lines.forEach((line, lineIdx) => {
    const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/);
    parts.forEach((part, partIdx) => {
      const key = `${lineIdx}-${partIdx}`;
      if (part.startsWith('**') && part.endsWith('**')) {
        nodes.push(
          <strong key={key} style={{ color: t.accent, fontWeight: 600 }}>
            {part.slice(2, -2)}
          </strong>,
        );
      } else if (part.startsWith('`') && part.endsWith('`')) {
        nodes.push(
          <code key={key} style={{
            background: t.bgTertiary, color: t.info,
            padding: '1px 5px', borderRadius: 3,
            fontFamily: 'monospace', fontSize: '0.95em',
            border: `1px solid ${t.border}`,
          }}>
            {part.slice(1, -1)}
          </code>,
        );
      } else if (part.startsWith('- ')) {
        nodes.push(
          <span key={key} style={{ display: 'block', paddingLeft: 12 }}>
            · {part.slice(2)}
          </span>,
        );
      } else {
        nodes.push(<span key={key}>{part}</span>);
      }
    });
    if (lineIdx < lines.length - 1) {
      nodes.push(<br key={`br-${lineIdx}`} />);
    }
  });

  return nodes;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: TrainingTask;
  taskIndex: number;
  totalTasks: number;
  onValidate: () => void;
  onNext: () => void;
  onPrev: () => void;
  lastResult: ValidationResult | null;
  isCompleted: boolean;
  canGoNext: boolean;
  canGoPrev: boolean;
}

export default function TaskCard({
  task, taskIndex, totalTasks, onValidate, onNext, onPrev, lastResult,
  isCompleted, canGoNext, canGoPrev,
}: TaskCardProps) {
  const t = useTheme();
  const [showHint, setShowHint] = useState(false);

  // Reset hint when task changes
  useEffect(() => {
    setShowHint(false);
  }, [task.id]);

  const isLast = taskIndex + 1 >= totalTasks;

  const navBtnBase: React.CSSProperties = {
    background: t.btnBg, border: `1px solid ${t.border}`,
    borderRadius: 4, color: t.textSecondary,
    fontSize: 12, padding: '5px 10px', cursor: 'pointer',
    flex: 1, textAlign: 'center',
  };

  const navBtnDisabled: React.CSSProperties = {
    ...navBtnBase, opacity: 0.35, cursor: 'default',
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', padding: '12px 12px 14px',
      gap: 10, overflowY: 'auto',
    }}>
      {/* Task header with nav */}
      <div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 3,
        }}>
          <div style={{ fontSize: 10, color: t.textDim, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Task {taskIndex + 1} / {totalTasks}
          </div>
          {isCompleted && (
            <div style={{
              fontSize: 9, color: '#0a6e37', background: '#e0f5e8',
              border: '1px solid #0a6e37', borderRadius: 3,
              padding: '1px 6px', textTransform: 'uppercase', letterSpacing: 0.5,
            }}>
              Completed
            </div>
          )}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: t.text, lineHeight: 1.3 }}>
          {task.title}
        </div>
      </div>

      {/* Prev / Next navigation */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={canGoPrev ? onPrev : undefined}
          style={canGoPrev ? navBtnBase : navBtnDisabled}
          onMouseEnter={(e) => {
            if (canGoPrev) (e.currentTarget as HTMLButtonElement).style.background = t.btnBgHover;
          }}
          onMouseLeave={(e) => {
            if (canGoPrev) (e.currentTarget as HTMLButtonElement).style.background = t.btnBg;
          }}
        >
          ← Prev
        </button>
        <button
          onClick={canGoNext ? onNext : undefined}
          style={canGoNext ? navBtnBase : navBtnDisabled}
          onMouseEnter={(e) => {
            if (canGoNext) (e.currentTarget as HTMLButtonElement).style.background = t.btnBgHover;
          }}
          onMouseLeave={(e) => {
            if (canGoNext) (e.currentTarget as HTMLButtonElement).style.background = t.btnBg;
          }}
        >
          Next →
        </button>
      </div>

      {/* Instruction */}
      <div style={{
        fontSize: 12, color: t.text, lineHeight: 1.65,
        borderLeft: `2px solid ${t.border}`, paddingLeft: 10,
      }}>
        {renderText(task.instruction, t)}
      </div>

      {/* Concept box */}
      <div style={{
        fontSize: 11, background: t.bgTertiary,
        border: `1px solid ${t.border}`, borderRadius: 4,
        padding: '8px 10px',
      }}>
        <div style={{ color: t.accent, fontWeight: 600, marginBottom: 3 }}>
          {task.concept}
        </div>
        <div style={{ color: t.textSecondary, lineHeight: 1.5 }}>
          {task.conceptExplanation}
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {/* Hint */}
      {!showHint ? (
        <button
          onClick={() => setShowHint(true)}
          style={{
            background: 'none', border: `1px solid ${t.border}`,
            borderRadius: 3, color: t.textDim, fontSize: 11,
            padding: '4px 8px', cursor: 'pointer', textAlign: 'left',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = t.textSecondary; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = t.border; }}
        >
          Show hint
        </button>
      ) : (
        <div style={{
          background: '#f0f8f0',
          border: '1px solid #a0d0a0',
          borderRadius: 4, padding: '7px 10px',
          fontSize: 11, color: '#2a6a2a', lineHeight: 1.5,
        }}>
          <span style={{ opacity: 0.7 }}>Hint: </span>{task.hint}
        </div>
      )}

      {/* Action buttons */}
      {lastResult?.passed ? (
        <button
          onClick={onNext}
          style={{
            background: '#0a6e37', border: 'none', borderRadius: 4,
            color: '#fff', fontSize: 13, fontWeight: 600,
            padding: '9px 16px', cursor: 'pointer', width: '100%',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#0d8a45'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#0a6e37'; }}
        >
          {isLast ? 'Complete Training ✓' : 'Next Task →'}
        </button>
      ) : (
        <button
          onClick={onValidate}
          style={{
            background: t.accent, border: 'none', borderRadius: 4,
            color: '#fff', fontSize: 13, fontWeight: 600,
            padding: '9px 16px', cursor: 'pointer', width: '100%',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = t.accentHover; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = t.accent; }}
        >
          Check Answer
        </button>
      )}
    </div>
  );
}
