import React, { useState, useEffect } from 'react';
import type { TrainingTask, ValidationResult } from '../../training/tasks.js';

// ─── Mini markdown renderer: **bold** and `code` ─────────────────────────────

function renderText(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const lines = text.split('\n');

  lines.forEach((line, lineIdx) => {
    const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/);
    parts.forEach((part, partIdx) => {
      const key = `${lineIdx}-${partIdx}`;
      if (part.startsWith('**') && part.endsWith('**')) {
        nodes.push(
          <strong key={key} style={{ color: '#dcdcaa', fontWeight: 600 }}>
            {part.slice(2, -2)}
          </strong>,
        );
      } else if (part.startsWith('`') && part.endsWith('`')) {
        nodes.push(
          <code key={key} style={{
            background: '#1e1e1e', color: '#9cdcfe',
            padding: '1px 5px', borderRadius: 3,
            fontFamily: 'monospace', fontSize: '0.95em',
            border: '1px solid #333',
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

// ─── Nav button style helper ─────────────────────────────────────────────────

const navBtnBase: React.CSSProperties = {
  background: '#2d2d30',
  border: '1px solid #444',
  borderRadius: 4,
  color: '#999',
  fontSize: 12,
  padding: '5px 10px',
  cursor: 'pointer',
  flex: 1,
  textAlign: 'center',
};

const navBtnDisabled: React.CSSProperties = {
  ...navBtnBase,
  opacity: 0.35,
  cursor: 'default',
};

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
  const [showHint, setShowHint] = useState(false);

  // Reset hint when task changes
  useEffect(() => {
    setShowHint(false);
  }, [task.id]);

  const isLast = taskIndex + 1 >= totalTasks;

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
          <div style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Task {taskIndex + 1} / {totalTasks}
          </div>
          {isCompleted && (
            <div style={{
              fontSize: 9, color: '#4ec9b0', background: '#0a2e18',
              border: '1px solid #0a6e37', borderRadius: 3,
              padding: '1px 6px', textTransform: 'uppercase', letterSpacing: 0.5,
            }}>
              Completed
            </div>
          )}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#e8e8e8', lineHeight: 1.3 }}>
          {task.title}
        </div>
      </div>

      {/* Prev / Next navigation */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={canGoPrev ? onPrev : undefined}
          style={canGoPrev ? navBtnBase : navBtnDisabled}
          onMouseEnter={(e) => {
            if (canGoPrev) (e.currentTarget as HTMLButtonElement).style.background = '#3c3c3c';
          }}
          onMouseLeave={(e) => {
            if (canGoPrev) (e.currentTarget as HTMLButtonElement).style.background = '#2d2d30';
          }}
        >
          ← Prev
        </button>
        <button
          onClick={canGoNext ? onNext : undefined}
          style={canGoNext ? navBtnBase : navBtnDisabled}
          onMouseEnter={(e) => {
            if (canGoNext) (e.currentTarget as HTMLButtonElement).style.background = '#3c3c3c';
          }}
          onMouseLeave={(e) => {
            if (canGoNext) (e.currentTarget as HTMLButtonElement).style.background = '#2d2d30';
          }}
        >
          Next →
        </button>
      </div>

      {/* Instruction */}
      <div style={{
        fontSize: 12, color: '#ccc', lineHeight: 1.65,
        borderLeft: '2px solid #3c3c3c', paddingLeft: 10,
      }}>
        {renderText(task.instruction)}
      </div>

      {/* Concept box */}
      <div style={{
        fontSize: 11, background: '#1e2430',
        border: '1px solid #2a3a4a', borderRadius: 4,
        padding: '8px 10px',
      }}>
        <div style={{ color: '#569cd6', fontWeight: 600, marginBottom: 3 }}>
          {task.concept}
        </div>
        <div style={{ color: '#8aaccc', lineHeight: 1.5 }}>
          {task.conceptExplanation}
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {/* Hint */}
      {!showHint ? (
        <button
          onClick={() => setShowHint(true)}
          style={{
            background: 'none', border: '1px solid #3c3c3c',
            borderRadius: 3, color: '#666', fontSize: 11,
            padding: '4px 8px', cursor: 'pointer', textAlign: 'left',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#555'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#3c3c3c'; }}
        >
          Show hint
        </button>
      ) : (
        <div style={{
          background: '#1a2b1a', border: '1px solid #2e4a2e',
          borderRadius: 4, padding: '7px 10px',
          fontSize: 11, color: '#8ec98e', lineHeight: 1.5,
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
            background: '#0e639c', border: 'none', borderRadius: 4,
            color: '#fff', fontSize: 13, fontWeight: 600,
            padding: '9px 16px', cursor: 'pointer', width: '100%',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#1177bb'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#0e639c'; }}
        >
          Check Answer
        </button>
      )}
    </div>
  );
}
