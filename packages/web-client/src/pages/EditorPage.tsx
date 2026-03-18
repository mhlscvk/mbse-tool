import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../services/api-client.js';
import { diagramClient } from '../services/diagram-client.js';
import MonacoEditor from '../components/Editor/MonacoEditor.js';
import type { EditorMarker, EditorMarkerFix, MonacoEditorHandle } from '../components/Editor/MonacoEditor.js';
import DiagramViewer from '../components/Diagram/DiagramViewer.js';
import ElementPanel from '../components/Diagram/ElementPanel.js';
import AiAssistant from '../components/AI/AiAssistant.js';
import Header from '../components/Layout/Header.js';
import { useLocalStorage } from '../hooks/useLocalStorage.js';
import type { SysMLFile, SModelRoot, SNode, SEdge, DiagramDiagnostic } from '@systemodel/shared-types';

const AUTOSAVE_DEBOUNCE_MS = 1500;
const MIN_PANE_PCT = 15; // minimum pane width as % of container

export default function EditorPage() {
  const { projectId, fileId } = useParams<{ projectId: string; fileId: string }>();
  const lsPrefix = `systemodel:${projectId ?? ''}:${fileId ?? ''}`;

  const [file, setFile] = useState<SysMLFile | null>(null);
  const [content, setContent] = useState('');
  const [diagram, setDiagram] = useState<SModelRoot | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [readOnly, setReadOnly] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const monacoRef = useRef<MonacoEditorHandle>(null);

  // Diagnostics / debug
  const [diagnostics, setDiagnostics] = useState<DiagramDiagnostic[]>([]);
  const [debugOpen, setDebugOpen] = useLocalStorage(`${lsPrefix}:debugOpen`, false);

  // Element visibility
  const [hiddenNodeIds, setHiddenNodeIds] = useLocalStorage<Set<string>>(`${lsPrefix}:hiddenNodes`, new Set<string>());
  const [hiddenEdgeIds, setHiddenEdgeIds] = useLocalStorage<Set<string>>(`${lsPrefix}:hiddenEdges`, new Set<string>());

  // Cross-selection between diagram and element panel
  const [diagramSelectedNodeId, setDiagramSelectedNodeId] = useState<string | null>(null);
  const [diagramSelectedEdgeId, setDiagramSelectedEdgeId] = useState<string | null>(null);

  const diagramNodes = (diagram?.children.filter((c): c is SNode => c.type === 'node') ?? []);
  const diagramEdges = (diagram?.children.filter((c): c is SEdge => c.type === 'edge') ?? []);

  const toggleNode = useCallback((id: string) => {
    setHiddenNodeIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleGroup = useCallback((ids: string[], visible: boolean) => {
    setHiddenNodeIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => visible ? next.delete(id) : next.add(id));
      return next;
    });
  }, []);

  const diagramRef = useRef(diagram);
  useEffect(() => { diagramRef.current = diagram; }, [diagram]);

  const toggleAll = useCallback((visible: boolean) => {
    if (visible) {
      setHiddenNodeIds(new Set());
    } else {
      const nodes = diagramRef.current?.children.filter((c): c is SNode => c.type === 'node') ?? [];
      setHiddenNodeIds(new Set(nodes.map((n) => n.id)));
    }
  }, []);

  const toggleEdge = useCallback((id: string) => {
    setHiddenEdgeIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleEdgeGroup = useCallback((ids: string[], visible: boolean) => {
    setHiddenEdgeIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => visible ? next.delete(id) : next.add(id));
      return next;
    });
  }, []);

  // View mode: nested (compound layout) or tree (flat BDD-style)
  const [viewMode, setViewMode] = useLocalStorage<'nested' | 'tree'>(`${lsPrefix}:viewMode`, 'nested');

  // AI assistant open/close
  const [aiOpen, setAiOpen] = useLocalStorage(`${lsPrefix}:aiOpen`, false);

  // Editor open/close
  const [editorOpen, setEditorOpen] = useLocalStorage(`${lsPrefix}:editorOpen`, true);
  const lastSplitPct = useRef(50); // remember split before closing

  // Resizable split pane state
  const [splitPct, setSplitPct] = useLocalStorage(`${lsPrefix}:splitPct`, 50); // editor % width
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const dividerCleanupRef = useRef<(() => void) | null>(null);

  const onDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    // Clean up any previous drag listeners first
    dividerCleanupRef.current?.();

    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setSplitPct(Math.min(100 - MIN_PANE_PCT, Math.max(MIN_PANE_PCT, pct)));
    };

    const cleanup = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', cleanup);
      dividerCleanupRef.current = null;
    };

    dividerCleanupRef.current = cleanup;
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', cleanup);
  }, []);

  useEffect(() => {
    diagramClient.connect();
    const unsub = diagramClient.onModel((model, diags) => { setDiagram(model); setDiagnostics(diags); });
    const unsubErr = diagramClient.onError((msg) => {
      console.error('[Diagram]', msg);
      setDiagnostics([{ severity: 'error', message: msg, line: 1, column: 1 }]);
    });
    const unsubClear = diagramClient.onClear(() => setDiagram(null));
    return () => { unsub(); unsubErr(); unsubClear(); diagramClient.disconnect(); clearTimeout(saveTimer.current); dividerCleanupRef.current?.(); };
  }, []);

  useEffect(() => {
    if (!projectId || !fileId) return;
    // Check if project is read-only (system project)
    api.projects.get(projectId)
      .then((p) => { if (p.isSystem) setReadOnly(true); })
      .catch(() => {});
    api.files.get(projectId, fileId)
      .then((f) => {
        setFile(f);
        setContent(f.content);
        // Generate initial diagram from loaded content
        diagramClient.sendText(`file://${fileId}`, f.content);
      })
      .catch((e) => setError(e.message));
  }, [projectId, fileId]);

  const handleChange = useCallback((value: string) => {
    if (readOnly) return;
    setContent(value);
    // Send text to diagram-service for server-side parsing → BDD generation
    diagramClient.sendText(`file://${fileId}`, value);

    // Debounced autosave
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (!projectId || !fileId) return;
      setSaving(true);
      try {
        await api.files.update(projectId, fileId, value);
      } catch (e) {
        console.error('Autosave failed:', e);
      } finally {
        setSaving(false);
      }
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [projectId, fileId, readOnly]);

  const handleSave = async () => {
    if (!projectId || !fileId || readOnly) return;
    clearTimeout(saveTimer.current);
    setSaving(true);
    try {
      await api.files.update(projectId, fileId, content);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (error) return <div style={{ padding: 32, color: '#f48771' }}>{error}</div>;
  if (!file) return <div style={{ padding: 32, color: '#666' }}>Loading...</div>;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#1e1e1e' }}>
      <Header title={`${file.name}${readOnly ? ' (Read Only)' : ''}`} showSave={!readOnly} onSave={handleSave} saving={saving} />
      <div ref={containerRef} style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Editor pane */}
        <div style={{
          width: editorOpen ? `${splitPct}%` : 0,
          flexShrink: 0,
          overflow: 'hidden',
          transition: 'width 0.2s ease',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <MonacoEditor
              ref={monacoRef}
              value={content}
              onChange={handleChange}
              readOnly={readOnly}
              markers={diagnostics.map((d): EditorMarker => ({
                severity: d.severity,
                message: d.message,
                line: d.line,
                column: d.column,
                endLine: d.endLine,
                endColumn: d.endColumn,
                fixes: d.fixes as EditorMarkerFix[] | undefined,
              }))}
            />
          </div>
          {/* Debug / Problems panel */}
          {debugOpen && (
            <div style={{
              height: 160, flexShrink: 0, background: '#1a1a1a',
              borderTop: '1px solid #3c3c3c', overflow: 'auto', fontSize: 12,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '3px 10px', background: '#252526',
                borderBottom: '1px solid #3c3c3c', position: 'sticky', top: 0,
              }}>
                <span style={{ color: '#ccc', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Problems</span>
                <span style={{ color: '#888', fontSize: 11 }}>
                  {diagnostics.filter(d => d.severity === 'error').length} errors,&nbsp;
                  {diagnostics.filter(d => d.severity === 'warning').length} warnings
                </span>
              </div>
              {diagnostics.length === 0 ? (
                <div style={{ padding: '8px 12px', color: '#555', fontStyle: 'italic' }}>No problems detected.</div>
              ) : (
                diagnostics.map((d, i) => (
                  <div key={i} style={{
                    padding: '4px 12px 6px', borderBottom: '1px solid #222',
                    background: d.severity === 'error' ? '#2a1a1a' : d.severity === 'warning' ? '#2a2210' : 'transparent',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{ color: d.severity === 'error' ? '#f48771' : d.severity === 'warning' ? '#cca700' : '#75beff', flexShrink: 0, fontSize: 14 }}>
                        {d.severity === 'error' ? '✕' : d.severity === 'warning' ? '⚠' : 'ℹ'}
                      </span>
                      <span
                        style={{ color: '#d4d4d4', flex: 1, cursor: 'pointer' }}
                        onClick={() => monacoRef.current?.revealRange(d.line, d.column, d.endLine ?? d.line, d.endColumn ?? d.column + 1)}
                      >{d.message}</span>
                      <span style={{ color: '#555', whiteSpace: 'nowrap' }}>Ln {d.line}, Col {d.column}</span>
                    </div>
                    {d.fixes && d.fixes.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingLeft: 22, marginTop: 4 }}>
                        {d.fixes.map((fix, fi) => (
                          <button
                            key={fi}
                            onClick={() => monacoRef.current?.applyFix(
                              d.line, d.column, d.endLine ?? d.line, d.endColumn ?? d.column + 1, fix.newText,
                            )}
                            title={`Apply: ${fix.title}`}
                            style={{
                              background: '#0e4c8a', border: '1px solid #1a6fc4', borderRadius: 3,
                              color: '#9cdcfe', fontSize: 10, padding: '1px 6px', cursor: 'pointer',
                            }}
                          >
                            ⚡ {fix.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Divider with toggle button */}
        <div style={{
          width: 22,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          background: '#2d2d2d',
          borderLeft: '1px solid #3c3c3c',
          borderRight: '1px solid #3c3c3c',
          position: 'relative',
          zIndex: 1,
        }}>
          {/* Drag handle — only active when editor is open */}
          {editorOpen && (
            <div
              onMouseDown={onDividerMouseDown}
              style={{
                position: 'absolute', inset: 0,
                cursor: 'col-resize',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#007acc22')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            />
          )}
          {/* Toggle button centered on divider */}
          <button
            onClick={() => {
              if (editorOpen) {
                lastSplitPct.current = splitPct;
                setEditorOpen(false);
              } else {
                setSplitPct(lastSplitPct.current);
                setEditorOpen(true);
              }
            }}
            title={editorOpen ? 'Close editor' : 'Open editor'}
            style={{
              position: 'relative', zIndex: 2,
              marginTop: 'auto', marginBottom: 'auto',
              background: '#3c3c3c', border: 'none',
              color: '#ccc', cursor: 'pointer',
              width: 18, height: 32, borderRadius: 3,
              fontSize: 12, display: 'flex', alignItems: 'center',
              justifyContent: 'center', padding: 0,
              lineHeight: 1,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#007acc')}
            onMouseLeave={e => (e.currentTarget.style.background = '#3c3c3c')}
          >
            {editorOpen ? '‹' : '›'}
          </button>
        </div>

        {/* Diagram pane: element panel + viewer + AI panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Diagram toolbar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '3px 10px',
            background: '#2d2d2d', borderBottom: '1px solid #3c3c3c', flexShrink: 0,
          }}>
            <span style={{ fontSize: 11, color: '#ccc', fontWeight: 600, marginRight: 4 }}>General View</span>
            <span style={{ fontSize: 10, color: '#666' }}>SysML v2</span>
            <span style={{ flex: 1 }} />
            <button
              onClick={() => setAiOpen((v) => !v)}
              style={{
                background: aiOpen ? '#007acc' : '#3c3c3c',
                border: '1px solid', borderColor: aiOpen ? '#007acc' : '#555',
                borderRadius: 3, color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '2px 10px', fontSize: 11, fontWeight: aiOpen ? 600 : 400,
              }}
              onMouseEnter={e => { if (!aiOpen) e.currentTarget.style.background = '#4a4a4a'; }}
              onMouseLeave={e => { if (!aiOpen) e.currentTarget.style.background = '#3c3c3c'; }}
              title={aiOpen ? 'Close AI chat' : 'Open AI chat'}
            >
              &#10022; AI
            </button>
          </div>
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <ElementPanel
              nodes={diagramNodes}
              edges={diagramEdges}
              hiddenNodeIds={hiddenNodeIds}
              hiddenEdgeIds={hiddenEdgeIds}
              onToggleNode={toggleNode}
              onToggleGroup={toggleGroup}
              onToggleAll={toggleAll}
              onToggleEdge={toggleEdge}
              onToggleEdgeGroup={toggleEdgeGroup}
              viewStorageKey={lsPrefix}
              onRestoreView={(nodes, edges) => { setHiddenNodeIds(nodes); setHiddenEdgeIds(edges); }}
              diagramSelectedNodeId={diagramSelectedNodeId}
              diagramSelectedEdgeId={diagramSelectedEdgeId}
            />
            <DiagramViewer
              model={diagram}
              hiddenNodeIds={hiddenNodeIds}
              hiddenEdgeIds={hiddenEdgeIds}
              storageKey={lsPrefix}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              onNodeSelect={(range) => {
                monacoRef.current?.revealRange(
                  range.start.line + 1, range.start.character + 1,
                  range.end.line + 1,   range.end.character + 1,
                );
                if (!editorOpen) {
                  setSplitPct(lastSplitPct.current);
                  setEditorOpen(true);
                }
              }}
              onEdgeSelect={(range) => {
                monacoRef.current?.revealRange(
                  range.start.line + 1, range.start.character + 1,
                  range.end.line + 1,   range.end.character + 1,
                );
                if (!editorOpen) {
                  setSplitPct(lastSplitPct.current);
                  setEditorOpen(true);
                }
              }}
              onHideNode={(id) => setHiddenNodeIds((prev) => { const n = new Set(prev); n.add(id); return n; })}
              onHideEdge={(id) => setHiddenEdgeIds((prev) => { const n = new Set(prev); n.add(id); return n; })}
              onHideNodes={(ids) => setHiddenNodeIds((prev) => { const n = new Set(prev); ids.forEach(id => n.add(id)); return n; })}
              onHideEdges={(ids) => setHiddenEdgeIds((prev) => { const n = new Set(prev); ids.forEach(id => n.add(id)); return n; })}
              selectedNodeId={diagramSelectedNodeId}
              selectedEdgeId={diagramSelectedEdgeId}
              onSelectedNodeChange={setDiagramSelectedNodeId}
              onSelectedEdgeChange={setDiagramSelectedEdgeId}
            />
            {aiOpen && (
              <AiAssistant
                onClose={() => setAiOpen(false)}
                projectId={projectId}
                fileId={fileId}
                fileContent={content}
                fileName={file?.name}
              />
            )}
          </div>
        </div>
      </div>
      <div style={{
        height: 24, background: '#007acc', display: 'flex', alignItems: 'center',
        padding: '0 12px', gap: 12, fontSize: 12, color: '#fff', flexShrink: 0,
      }}>
        <span>SysML v2</span>
        <span style={{ opacity: 0.5 }}>|</span>
        <span>{saving ? 'Saving...' : 'Saved'}</span>
        <span style={{ opacity: 0.5 }}>|</span>
        {/* Error / warning badge — click to toggle debug panel */}
        <button
          onClick={() => setDebugOpen(v => !v)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', color: '#fff',
            display: 'flex', alignItems: 'center', gap: 6, padding: 0, fontSize: 12,
          }}
          title="Toggle Problems panel"
        >
          {diagnostics.filter(d => d.severity === 'error').length > 0 && (
            <span style={{ color: '#f88070' }}>
              ✕ {diagnostics.filter(d => d.severity === 'error').length}
            </span>
          )}
          {diagnostics.filter(d => d.severity === 'warning').length > 0 && (
            <span style={{ color: '#cca700' }}>
              ⚠ {diagnostics.filter(d => d.severity === 'warning').length}
            </span>
          )}
          {diagnostics.length === 0 && <span style={{ opacity: 0.7 }}>✓ No problems</span>}
        </button>
        <span style={{ flex: 1 }} />
        <span>{content.split('\n').length} lines</span>
      </div>
    </div>
  );
}
