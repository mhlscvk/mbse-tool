import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { diagramClient } from '../services/diagram-client.js';
import MonacoEditor from '../components/Editor/MonacoEditor.js';
import type { MonacoEditorHandle } from '../components/Editor/MonacoEditor.js';
import DiagramViewer from '../components/Diagram/DiagramViewer.js';
import ElementPanel from '../components/Diagram/ElementPanel.js';
import LegendPanel from '../components/Training/LegendPanel.js';
import TaskCard from '../components/Training/TaskCard.js';
import { TRAINING_TASKS, TOTAL_LEVELS, COMPLETED_CODE } from '../training/tasks.js';
import type { SModelRoot, SNode, SEdge } from '@systemodel/shared-types';
import type { ValidationResult } from '../training/tasks.js';
import { useTheme } from '../store/theme.js';

const TRAINING_URI = 'training://vehicle';
const STORAGE_KEY_INDEX = 'training:taskIndex';
const STORAGE_KEY_COMPLETED = 'training:completedTasks';
const STORAGE_KEY_CODES = 'training:taskCodes';

type SourceRange = { start: { line: number; character: number }; end: { line: number; character: number } };

// ─── Persistence helpers ──────────────────────────────────────────────────────

function loadProgress(): {
  taskIndex: number;
  completedTasks: Set<number>;
  taskCodes: Record<number, string>;
} {
  try {
    const idx = parseInt(localStorage.getItem(STORAGE_KEY_INDEX) || '0', 10);
    const taskIndex = Number.isNaN(idx) ? 0 : Math.min(idx, TRAINING_TASKS.length - 1);

    const completedRaw = localStorage.getItem(STORAGE_KEY_COMPLETED);
    const completedArr: number[] = completedRaw ? JSON.parse(completedRaw) : [];
    const completedTasks = new Set(completedArr);

    const codesRaw = localStorage.getItem(STORAGE_KEY_CODES);
    const taskCodes: Record<number, string> = codesRaw ? JSON.parse(codesRaw) : {};

    return { taskIndex, completedTasks, taskCodes };
  } catch {
    return { taskIndex: 0, completedTasks: new Set(), taskCodes: {} };
  }
}

function saveTaskIndex(index: number) {
  localStorage.setItem(STORAGE_KEY_INDEX, String(index));
}

function saveCompletedTasks(completed: Set<number>) {
  localStorage.setItem(STORAGE_KEY_COMPLETED, JSON.stringify([...completed]));
}

function saveTaskCodes(codes: Record<number, string>) {
  localStorage.setItem(STORAGE_KEY_CODES, JSON.stringify(codes));
}

// ─── Completion screen ────────────────────────────────────────────────────────

function CompletionScreen({ onRestart, onReview }: { onRestart: () => void; onReview: () => void }) {
  const navigate = useNavigate();
  const t = useTheme();
  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: t.bg, gap: 20,
    }}>
      <div style={{ fontSize: 52 }}>🎉</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: t.success }}>
        Training Complete!
      </div>
      <div style={{
        fontSize: 14, color: t.textSecondary, maxWidth: 480,
        textAlign: 'center', lineHeight: 1.7,
      }}>
        You completed 100 training tasks covering the full SysML v2 language — part definitions,
        attributes, specialization, composition, subsetting, redefinition, ports, items,
        enumerations, actions, states, requirements, constraints, calculations, packages,
        use cases, allocation, views, and viewpoints. You are ready to model any system.
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <button
          onClick={onReview}
          style={{
            background: t.btnBg, border: `1px solid ${t.btnBorder}`,
            borderRadius: 4, color: t.text,
            padding: '10px 20px', cursor: 'pointer', fontSize: 13,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = t.btnBgHover; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = t.btnBg; }}
        >
          Review Tasks
        </button>
        <button
          onClick={onRestart}
          style={{
            background: t.btnBg, border: `1px solid ${t.btnBorder}`,
            borderRadius: 4, color: t.text,
            padding: '10px 20px', cursor: 'pointer', fontSize: 13,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = t.btnBgHover; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = t.btnBg; }}
        >
          Start Over
        </button>
        <button
          onClick={() => navigate('/projects')}
          style={{
            background: t.accent, border: 'none', borderRadius: 4,
            color: '#fff', padding: '10px 22px',
            cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = t.accentHover; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = t.accent; }}
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
  const monacoRef = useRef<MonacoEditorHandle>(null);
  const t = useTheme();

  // Load saved progress on mount
  const saved = useRef(loadProgress());

  const [taskIndex, setTaskIndex] = useState(saved.current.taskIndex);
  const [completedTasks, setCompletedTasks] = useState<Set<number>>(saved.current.completedTasks);
  const [taskCodes, setTaskCodes] = useState<Record<number, string>>(saved.current.taskCodes);

  const initialTask = TRAINING_TASKS[saved.current.taskIndex];
  const initialCode = saved.current.taskCodes[saved.current.taskIndex] ?? initialTask.starterCode;

  const [code, setCode] = useState(initialCode);
  const [diagram, setDiagram] = useState<SModelRoot | null>(null);
  const [lastResult, setLastResult] = useState<ValidationResult | null>(null);
  const [completed, setCompleted] = useState(false);
  const [viewMode, setViewMode] = useState<'nested' | 'tree'>('nested');

  // Visibility toggles for ElementPanel
  const [hiddenNodeIds, setHiddenNodeIds] = useState<Set<string>>(new Set());
  const [hiddenEdgeIds, setHiddenEdgeIds] = useState<Set<string>>(new Set());

  // Cross-selection between diagram and element panel
  const [diagramSelectedNodeId, setDiagramSelectedNodeId] = useState<string | null>(null);
  const [diagramSelectedEdgeId, setDiagramSelectedEdgeId] = useState<string | null>(null);

  // Left sidebar tab: legend vs elements
  const [leftTab, setLeftTab] = useState<'task' | 'elements'>('task');

  const task = TRAINING_TASKS[Math.min(taskIndex, TRAINING_TASKS.length - 1)];
  const currentLevel = task.level;

  // Extract nodes and edges from diagram model
  const allNodes = useMemo(
    () => diagram?.children.filter((c): c is SNode => c.type === 'node') ?? [],
    [diagram],
  );
  const allEdges = useMemo(
    () => diagram?.children.filter((c): c is SEdge => c.type === 'edge') ?? [],
    [diagram],
  );

  // ── Persist progress ────────────────────────────────────────────────────────
  useEffect(() => {
    saveTaskIndex(taskIndex);
  }, [taskIndex]);

  useEffect(() => {
    saveCompletedTasks(completedTasks);
  }, [completedTasks]);

  useEffect(() => {
    saveTaskCodes(taskCodes);
  }, [taskCodes]);

  // ── Diagram service connection ──────────────────────────────────────────────
  useEffect(() => {
    diagramClient.connect();
    const unsub = diagramClient.onModel((model) => setDiagram(model));
    const unsubClear = diagramClient.onClear(() => setDiagram(null));
    diagramClient.sendText(TRAINING_URI, initialCode);
    return () => {
      unsub();
      unsubClear();
      diagramClient.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Navigate to source range in editor ──────────────────────────────────────
  const revealRange = useCallback((range: SourceRange) => {
    monacoRef.current?.revealRange(
      range.start.line + 1, range.start.character + 1,
      range.end.line + 1, range.end.character + 1,
    );
  }, []);

  // ── Element/edge visibility toggles ─────────────────────────────────────────
  const handleToggleNode = useCallback((id: string) => {
    setHiddenNodeIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleToggleGroup = useCallback((ids: string[], visible: boolean) => {
    setHiddenNodeIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        visible ? next.delete(id) : next.add(id);
      }
      return next;
    });
  }, []);

  const handleToggleAll = useCallback((visible: boolean) => {
    if (visible) {
      setHiddenNodeIds(new Set());
    } else {
      setHiddenNodeIds(new Set(allNodes.map((n) => n.id)));
    }
  }, [allNodes]);

  const handleToggleEdge = useCallback((id: string) => {
    setHiddenEdgeIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleToggleEdgeGroup = useCallback((ids: string[], visible: boolean) => {
    setHiddenEdgeIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        visible ? next.delete(id) : next.add(id);
      }
      return next;
    });
  }, []);

  // Hide-only handlers for context menu (always hide, never toggle back)
  const handleHideNode = useCallback((id: string) => {
    setHiddenNodeIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const handleHideEdge = useCallback((id: string) => {
    setHiddenEdgeIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  // ── Navigate to a task (shared logic) ─────────────────────────────────────
  const goToTask = useCallback((newIndex: number) => {
    // Save current code before leaving
    setTaskCodes((prev) => {
      const next = { ...prev, [taskIndex]: code };
      saveTaskCodes(next);
      return next;
    });

    setTaskIndex(newIndex);

    // Restore saved code or use starter code
    setTaskCodes((prev) => {
      const restored = prev[newIndex] ?? TRAINING_TASKS[newIndex].starterCode;
      setCode(restored);
      diagramClient.sendText(TRAINING_URI, restored);
      return prev;
    });

    setLastResult(null);
  }, [taskIndex, code]);

  // ── Editor change ───────────────────────────────────────────────────────────
  const handleCodeChange = useCallback((value: string) => {
    setCode(value);
    diagramClient.sendText(TRAINING_URI, value);
    setLastResult(null);
    setTaskCodes((prev) => {
      const next = { ...prev, [taskIndex]: value };
      return next;
    });
  }, [taskIndex]);

  // ── Validate ────────────────────────────────────────────────────────────────
  const handleValidate = useCallback(() => {
    const result = task.validate(code);
    setLastResult(result);
    if (result.passed) {
      setCompletedTasks((prev) => {
        const next = new Set(prev);
        next.add(taskIndex);
        return next;
      });
    }
  }, [task, code, taskIndex]);

  // ── Next task ───────────────────────────────────────────────────────────────
  const handleNext = useCallback(() => {
    if (taskIndex + 1 >= TRAINING_TASKS.length) {
      diagramClient.sendText(TRAINING_URI, COMPLETED_CODE);
      setCompleted(true);
    } else {
      goToTask(taskIndex + 1);
    }
  }, [taskIndex, goToTask]);

  // ── Previous task ─────────────────────────────────────────────────────────
  const handlePrev = useCallback(() => {
    if (taskIndex > 0) {
      goToTask(taskIndex - 1);
    }
  }, [taskIndex, goToTask]);

  // ── Restart ─────────────────────────────────────────────────────────────────
  const handleRestart = useCallback(() => {
    setTaskIndex(0);
    setCompleted(false);
    setCompletedTasks(new Set());
    setTaskCodes({});
    const starter = TRAINING_TASKS[0].starterCode;
    setCode(starter);
    setLastResult(null);
    diagramClient.sendText(TRAINING_URI, starter);
    localStorage.removeItem(STORAGE_KEY_INDEX);
    localStorage.removeItem(STORAGE_KEY_COMPLETED);
    localStorage.removeItem(STORAGE_KEY_CODES);
  }, []);

  // ── Review (go back to last task from completion screen) ──────────────────
  const handleReview = useCallback(() => {
    setCompleted(false);
    goToTask(TRAINING_TASKS.length - 1);
  }, [goToTask]);

  if (completed) {
    return <CompletionScreen onRestart={handleRestart} onReview={handleReview} />;
  }

  // ── Level progress dots ─────────────────────────────────────────────────────
  const levelDots = Array.from({ length: TOTAL_LEVELS }, (_, i) => {
    const lvl = i + 1;
    return {
      lvl,
      state: lvl < currentLevel ? 'done' : lvl === currentLevel ? 'active' : 'future',
    };
  });

  const highestUnlocked = Math.max(
    taskIndex,
    ...Array.from(completedTasks).map((i) => i + 1),
  );

  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      background: t.bg, overflow: 'hidden',
    }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header style={{
        height: 48, flexShrink: 0,
        background: t.bgSecondary, borderBottom: `1px solid ${t.border}`,
        display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12,
      }}>
        <span
          style={{ fontWeight: 700, color: '#A0522D', cursor: 'pointer', fontSize: 18, fontFamily: 'Georgia, "Times New Roman", serif', fontStyle: 'italic' }}
          onClick={() => navigate('/projects')}
        >
          SysteModel
        </span>
        <span style={{ color: t.textDim }}>/</span>
        <span style={{ color: t.text, fontSize: 14 }}>Training Mode</span>
        <span style={{ color: t.textDim }}>—</span>
        <span style={{ color: t.textSecondary, fontSize: 12 }}>{task.levelName}</span>

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
                  state === 'done' ? t.success
                  : state === 'active' ? t.info
                  : t.btnBg,
                border: state === 'active' ? `2px solid ${t.accent}` : `1px solid ${t.border}`,
                transition: 'all 0.2s',
              }}
            />
          ))}
        </div>
        <span style={{ fontSize: 11, color: t.textDim }}>
          {currentLevel} / {TOTAL_LEVELS}
        </span>

        <span style={{ fontSize: 11, color: t.success }}>
          {completedTasks.size} / {TRAINING_TASKS.length} done
        </span>

        <div style={{ flex: 1 }} />

        <button
          onClick={() => navigate('/projects')}
          style={{
            background: 'transparent', color: t.textSecondary,
            border: '1px solid #444', borderRadius: 4,
            padding: '3px 10px', cursor: 'pointer', fontSize: 12,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = t.text; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = t.textSecondary; }}
        >
          Exit Training
        </button>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

        {/* ── Left sidebar: Task/Legend + Elements/Relations ────────────────── */}
        <div style={{
          width: 260, flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          borderRight: `1px solid ${t.border}`, overflow: 'hidden',
        }}>
          {/* Sidebar tab bar */}
          <div style={{ display: 'flex', borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
            {([
              { key: 'task' as const, label: 'Task' },
              { key: 'elements' as const, label: `Elements (${allNodes.length})` },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setLeftTab(key)}
                style={{
                  flex: 1, background: leftTab === key ? t.bg : t.bgSecondary,
                  border: 'none',
                  borderBottom: leftTab === key ? `2px solid ${t.statusBar}` : '2px solid transparent',
                  color: leftTab === key ? t.text : t.textSecondary, cursor: 'pointer',
                  fontSize: 11, padding: '5px 4px', fontWeight: leftTab === key ? 600 : 400,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Task tab: Legend (top) + TaskCard (bottom) */}
          {leftTab === 'task' && (
            <>
              <div style={{
                flex: '0 0 35%', minHeight: 0,
                borderBottom: `1px solid ${t.border}`, overflow: 'hidden',
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
                  onPrev={handlePrev}
                  lastResult={lastResult}
                  isCompleted={completedTasks.has(taskIndex)}
                  canGoNext={taskIndex + 1 <= highestUnlocked || completedTasks.has(taskIndex)}
                  canGoPrev={taskIndex > 0}
                />
              </div>
            </>
          )}

          {/* Elements tab: ElementPanel with Elements + Relations */}
          {leftTab === 'elements' && (
            <div style={{
              flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex',
            }}>
              {/* Override ElementPanel's fixed width to fill sidebar */}
              <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}
                className="training-element-panel"
              >
                <ElementPanel
                  nodes={allNodes}
                  edges={allEdges}
                  hiddenNodeIds={hiddenNodeIds}
                  hiddenEdgeIds={hiddenEdgeIds}
                  onToggleNode={handleToggleNode}
                  onToggleGroup={handleToggleGroup}
                  onToggleAll={handleToggleAll}
                  onToggleEdge={handleToggleEdge}
                  onToggleEdgeGroup={handleToggleEdgeGroup}
                  fillWidth
                  onNodeClick={(node) => {
                    const range = node.data?.range as SourceRange | undefined;
                    if (range) revealRange(range);
                  }}
                  onEdgeClick={(edge) => {
                    const range = edge.data?.range as SourceRange | undefined;
                    if (range) {
                      revealRange(range);
                      return;
                    }
                    // Fallback: navigate to source node
                    const src = allNodes.find((n) => n.id === edge.sourceId);
                    const srcRange = src?.data?.range as SourceRange | undefined;
                    if (srcRange) revealRange(srcRange);
                  }}
                  viewStorageKey="training"
                  onRestoreView={(nodes, edges) => { setHiddenNodeIds(nodes); setHiddenEdgeIds(edges); }}
                  diagramSelectedNodeId={diagramSelectedNodeId}
                  diagramSelectedEdgeId={diagramSelectedEdgeId}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Center: Diagram (top) + Editor (bottom) ──────────────────────── */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0,
        }}>
          {/* Diagram panel label */}
          <div style={{
            height: 26, flexShrink: 0, background: t.bgTertiary,
            borderBottom: `1px solid ${t.borderLight}`,
            display: 'flex', alignItems: 'center', padding: '0 12px', gap: 6,
          }}>
            <span style={{ fontSize: 10, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              General View
            </span>
            <span style={{ fontSize: 10, color: t.border }}>— live</span>
          </div>

          {/* Diagram viewer */}
          <div style={{ flex: 1, minHeight: 0 }}>
            <DiagramViewer
              model={diagram}
              hiddenNodeIds={hiddenNodeIds}
              hiddenEdgeIds={hiddenEdgeIds}
              storageKey="training"
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              onNodeSelect={revealRange}
              onEdgeSelect={revealRange}
              onHideNode={handleHideNode}
              onHideEdge={handleHideEdge}
              onHideNodes={(ids) => setHiddenNodeIds((prev) => { const n = new Set(prev); ids.forEach(id => n.add(id)); return n; })}
              onHideEdges={(ids) => setHiddenEdgeIds((prev) => { const n = new Set(prev); ids.forEach(id => n.add(id)); return n; })}
              selectedNodeId={diagramSelectedNodeId}
              selectedEdgeId={diagramSelectedEdgeId}
              onSelectedNodeChange={setDiagramSelectedNodeId}
              onSelectedEdgeChange={setDiagramSelectedEdgeId}
            />
          </div>

          {/* Editor panel */}
          <div style={{
            height: 210, flexShrink: 0,
            display: 'flex', flexDirection: 'column',
            borderTop: `1px solid ${t.border}`,
          }}>
            <div style={{
              height: 26, flexShrink: 0, background: t.bgTertiary,
              borderBottom: `1px solid ${t.borderLight}`,
              display: 'flex', alignItems: 'center', padding: '0 12px', gap: 6,
            }}>
              <span style={{ fontSize: 10, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                SysML Editor
              </span>
              <span style={{ fontSize: 10, color: t.border }}>— type your model here</span>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <MonacoEditor ref={monacoRef} value={code} onChange={handleCodeChange} />
            </div>
          </div>
        </div>

        {/* ── Right: Notation mirror (read-only reference) ─────────────────── */}
        <div style={{
          width: 272, flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          borderLeft: `1px solid ${t.border}`,
        }}>
          <div style={{
            height: 26, flexShrink: 0, background: t.bgTertiary,
            borderBottom: `1px solid ${t.borderLight}`,
            display: 'flex', alignItems: 'center', padding: '0 12px', gap: 6,
          }}>
            <span style={{ fontSize: 10, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Target Notation
            </span>
            <span style={{ fontSize: 10, color: t.border }}>— reference</span>
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
          ? lastResult.severity === 'success' ? '#e8f8f0'
          : lastResult.severity === 'hint'    ? '#f8f5e0'
          : '#f8e8e8'
          : t.bgSecondary,
        borderColor: lastResult
          ? lastResult.severity === 'success' ? '#60b060'
          : lastResult.severity === 'hint'    ? '#b0a040'
          : '#e07070'
          : t.border,
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
              color: lastResult.severity === 'success' ? t.success
                   : lastResult.severity === 'hint'    ? t.warning
                   : t.error,
            }}>
              {lastResult.message}
            </span>
          </>
        ) : (
          <span style={{ fontSize: 12, color: t.textDim }}>
            Edit the model in the editor, then click "Check Answer"
          </span>
        )}
      </div>
    </div>
  );
}
