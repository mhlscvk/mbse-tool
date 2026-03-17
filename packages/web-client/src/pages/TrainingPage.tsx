import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { diagramClient } from '../services/diagram-client.js';
import MonacoEditor from '../components/Editor/MonacoEditor.js';
import DiagramViewer from '../components/Diagram/DiagramViewer.js';
import LegendPanel from '../components/Training/LegendPanel.js';
import TaskCard from '../components/Training/TaskCard.js';
import { TRAINING_TASKS, TOTAL_LEVELS, COMPLETED_CODE } from '../training/tasks.js';
import type { SModelRoot } from '@systemodel/shared-types';
import type { ValidationResult } from '../training/tasks.js';

const TRAINING_URI = 'training://vehicle';

// ─── Completion screen ────────────────────────────────────────────────────────

function CompletionScreen({ onRestart }: { onRestart: () => void }) {
  const navigate = useNavigate();
  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#1e1e1e', gap: 20,
    }}>
      <div style={{ fontSize: 52 }}>🎉</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#4ec9b0' }}>
        Training Complete!
      </div>
      <div style={{
        fontSize: 14, color: '#888', maxWidth: 480,
        textAlign: 'center', lineHeight: 1.7,
      }}>
        You built a complete SysML v2 General View from scratch — part definitions,
        attributes, specialization, composition, subsetting, redefinition, ports,
        and items. These are the foundations of every SysML v2 model.
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <button
          onClick={onRestart}
          style={{
            background: '#3c3c3c', border: '1px solid #555',
            borderRadius: 4, color: '#ccc',
            padding: '10px 20px', cursor: 'pointer', fontSize: 13,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#4a4a4a'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#3c3c3c'; }}
        >
          Start Over
        </button>
        <button
          onClick={() => navigate('/projects')}
          style={{
            background: '#0e639c', border: 'none', borderRadius: 4,
            color: '#fff', padding: '10px 22px',
            cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#1177bb'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#0e639c'; }}
        >
          Go to Projects →
        </button>
      </div>
    </div>
  );
}

// ─── Main training page ───────────────────────────────────────────────────────

export default function TrainingPage() {
  const navigate = useNavigate();
  const [taskIndex, setTaskIndex] = useState(0);
  const [code, setCode] = useState(TRAINING_TASKS[0].starterCode);
  const [diagram, setDiagram] = useState<SModelRoot | null>(null);
  const [lastResult, setLastResult] = useState<ValidationResult | null>(null);
  const [completed, setCompleted] = useState(false);
  const [viewMode, setViewMode] = useState<'nested' | 'tree'>('nested');

  const task = TRAINING_TASKS[Math.min(taskIndex, TRAINING_TASKS.length - 1)];
  const currentLevel = task.level;

  // ── Diagram service connection ──────────────────────────────────────────────
  useEffect(() => {
    diagramClient.connect();
    const unsub = diagramClient.onModel((model) => setDiagram(model));
    const unsubClear = diagramClient.onClear(() => setDiagram(null));
    diagramClient.sendText(TRAINING_URI, TRAINING_TASKS[0].starterCode);
    return () => {
      unsub();
      unsubClear();
      diagramClient.disconnect();
    };
  }, []);

  // ── Load new task ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (taskIndex === 0) return; // initial code already set above
    const newCode = TRAINING_TASKS[taskIndex].starterCode;
    setCode(newCode);
    setLastResult(null);
    diagramClient.sendText(TRAINING_URI, newCode);
  }, [taskIndex]);

  // ── Editor change ───────────────────────────────────────────────────────────
  const handleCodeChange = useCallback((value: string) => {
    setCode(value);
    diagramClient.sendText(TRAINING_URI, value);
    setLastResult(null);
  }, []);

  // ── Validate ────────────────────────────────────────────────────────────────
  const handleValidate = useCallback(() => {
    const result = task.validate(code);
    setLastResult(result);
  }, [task, code]);

  // ── Next task ───────────────────────────────────────────────────────────────
  const handleNext = useCallback(() => {
    if (taskIndex + 1 >= TRAINING_TASKS.length) {
      // Show completed code in diagram one last time
      diagramClient.sendText(TRAINING_URI, COMPLETED_CODE);
      setCompleted(true);
    } else {
      setTaskIndex((i) => i + 1);
    }
  }, [taskIndex]);

  // ── Restart ─────────────────────────────────────────────────────────────────
  const handleRestart = useCallback(() => {
    setTaskIndex(0);
    setCompleted(false);
    const starter = TRAINING_TASKS[0].starterCode;
    setCode(starter);
    setLastResult(null);
    diagramClient.sendText(TRAINING_URI, starter);
  }, []);

  if (completed) {
    return <CompletionScreen onRestart={handleRestart} />;
  }

  // ── Level progress dots ─────────────────────────────────────────────────────
  const levelDots = Array.from({ length: TOTAL_LEVELS }, (_, i) => {
    const lvl = i + 1;
    return {
      lvl,
      state: lvl < currentLevel ? 'done' : lvl === currentLevel ? 'active' : 'future',
    };
  });

  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      background: '#1e1e1e', overflow: 'hidden',
    }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header style={{
        height: 48, flexShrink: 0,
        background: '#2d2d30', borderBottom: '1px solid #3c3c3c',
        display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12,
      }}>
        <span
          style={{ fontWeight: 700, color: '#569cd6', cursor: 'pointer', fontSize: 16 }}
          onClick={() => navigate('/projects')}
        >
          Systemodel
        </span>
        <span style={{ color: '#444' }}>/</span>
        <span style={{ color: '#d4d4d4', fontSize: 14 }}>Training Mode</span>
        <span style={{ color: '#444' }}>—</span>
        <span style={{ color: '#888', fontSize: 12 }}>{task.levelName}</span>

        {/* Level progress dots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 4 }}>
          {levelDots.map(({ lvl, state }) => (
            <div
              key={lvl}
              title={`Level ${lvl}`}
              style={{
                width: state === 'active' ? 11 : 7,
                height: state === 'active' ? 11 : 7,
                borderRadius: '50%',
                background:
                  state === 'done' ? '#4ec9b0'
                  : state === 'active' ? '#569cd6'
                  : '#3c3c3c',
                border: state === 'active' ? '2px solid #9cdcfe' : '1px solid #444',
                transition: 'all 0.2s',
              }}
            />
          ))}
        </div>
        <span style={{ fontSize: 11, color: '#555' }}>
          {currentLevel} / {TOTAL_LEVELS}
        </span>

        <div style={{ flex: 1 }} />

        <button
          onClick={() => navigate('/projects')}
          style={{
            background: 'transparent', color: '#777',
            border: '1px solid #444', borderRadius: 4,
            padding: '3px 10px', cursor: 'pointer', fontSize: 12,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#ccc'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#777'; }}
        >
          Exit Training
        </button>
      </header>

      {/* ── Body: 3 columns ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

        {/* Left sidebar: Legend (top) + Task Card (bottom) */}
        <div style={{
          width: 244, flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          borderRight: '1px solid #2e2e2e', overflow: 'hidden',
        }}>
          <div style={{
            flex: '0 0 40%', minHeight: 0,
            borderBottom: '1px solid #2e2e2e', overflow: 'hidden',
          }}>
            <LegendPanel currentLevel={currentLevel} />
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <TaskCard
              task={task}
              taskIndex={taskIndex}
              totalTasks={TRAINING_TASKS.length}
              onValidate={handleValidate}
              onNext={handleNext}
              lastResult={lastResult}
            />
          </div>
        </div>

        {/* Center: Diagram (top) + Editor (bottom) */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0,
        }}>
          {/* Diagram panel label */}
          <div style={{
            height: 26, flexShrink: 0, background: '#252526',
            borderBottom: '1px solid #2e2e2e',
            display: 'flex', alignItems: 'center', padding: '0 12px', gap: 6,
          }}>
            <span style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              General View
            </span>
            <span style={{ fontSize: 10, color: '#3c3c3c' }}>— live</span>
          </div>

          {/* Diagram viewer */}
          <div style={{ flex: 1, minHeight: 0 }}>
            <DiagramViewer
              model={diagram}
              hiddenNodeIds={new Set()}
              hiddenEdgeIds={new Set()}
              storageKey="training"
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
          </div>

          {/* Editor panel */}
          <div style={{
            height: 210, flexShrink: 0,
            display: 'flex', flexDirection: 'column',
            borderTop: '1px solid #2e2e2e',
          }}>
            <div style={{
              height: 26, flexShrink: 0, background: '#252526',
              borderBottom: '1px solid #2e2e2e',
              display: 'flex', alignItems: 'center', padding: '0 12px', gap: 6,
            }}>
              <span style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                SysML Editor
              </span>
              <span style={{ fontSize: 10, color: '#3c3c3c' }}>— type your model here</span>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <MonacoEditor value={code} onChange={handleCodeChange} />
            </div>
          </div>
        </div>

        {/* Right: Notation mirror (read-only reference) */}
        <div style={{
          width: 272, flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          borderLeft: '1px solid #2e2e2e',
        }}>
          <div style={{
            height: 26, flexShrink: 0, background: '#252526',
            borderBottom: '1px solid #2e2e2e',
            display: 'flex', alignItems: 'center', padding: '0 12px', gap: 6,
          }}>
            <span style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Target Notation
            </span>
            <span style={{ fontSize: 10, color: '#3c3c3c' }}>— reference</span>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <MonacoEditor
              value={task.targetCode}
              onChange={() => {/* read-only */}}
              readOnly
            />
          </div>
        </div>
      </div>

      {/* ── Feedback bar ───────────────────────────────────────────────────── */}
      <div style={{
        height: 36, flexShrink: 0,
        display: 'flex', alignItems: 'center', padding: '0 16px', gap: 8,
        borderTop: '1px solid',
        background: lastResult
          ? lastResult.severity === 'success' ? '#0a2e18'
          : lastResult.severity === 'hint'    ? '#252200'
          : '#2a0e0e'
          : '#1a1a1a',
        borderColor: lastResult
          ? lastResult.severity === 'success' ? '#0a6e37'
          : lastResult.severity === 'hint'    ? '#6a6a00'
          : '#6a1010'
          : '#2e2e2e',
        transition: 'background 0.25s, border-color 0.25s',
      }}>
        {lastResult ? (
          <>
            <span style={{ fontSize: 13, flexShrink: 0 }}>
              {lastResult.severity === 'success' ? '✓'
               : lastResult.severity === 'hint'   ? '💡'
               : '✕'}
            </span>
            <span style={{
              fontSize: 12,
              color: lastResult.severity === 'success' ? '#4ec9b0'
                   : lastResult.severity === 'hint'    ? '#c8b800'
                   : '#f08070',
            }}>
              {lastResult.message}
            </span>
          </>
        ) : (
          <span style={{ fontSize: 12, color: '#444' }}>
            Edit the model in the editor, then click "Check Answer"
          </span>
        )}
      </div>
    </div>
  );
}
