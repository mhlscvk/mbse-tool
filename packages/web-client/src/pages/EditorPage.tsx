import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { findNodeByName, getNodeSourceRange } from '../utils/sysml-helpers.js';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api-client.js';
import { diagramClient } from '../services/diagram-client.js';
import MonacoEditor from '../components/Editor/MonacoEditor.js';
import type { EditorMarker, EditorMarkerFix, MonacoEditorHandle } from '../components/Editor/MonacoEditor.js';
import DiagramViewer from '../components/Diagram/DiagramViewer.js';
import ElementPanel from '../components/Diagram/ElementPanel.js';
import AiAssistant from '../components/AI/AiAssistant.js';
import Header from '../components/Layout/Header.js';
import { useLocalStorage } from '../hooks/useLocalStorage.js';
import { useAuthStore } from '../store/auth.js';
import { useTheme } from '../store/theme.js';
import { useRecentFilesStore } from '../store/recent-files.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import type { SysMLFile, SModelRoot, SNode, SEdge, DiagramDiagnostic, ViewType, ElementLock } from '@systemodel/shared-types';

const AUTOSAVE_DEBOUNCE_MS = 1500;
const MIN_PANE_PCT = 15; // minimum pane width as % of container

export default function EditorPage() {
  const { projectId, fileId } = useParams<{ projectId: string; fileId: string }>();
  const navigate = useNavigate();
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

  // Legend visibility
  const [showLegend, setShowLegend] = useLocalStorage(`${lsPrefix}:showLegend`, true);

  // Cross-selection between diagram and element panel
  const [diagramSelectedNodeId, setDiagramSelectedNodeId] = useState<string | null>(null);
  const [diagramSelectedEdgeId, setDiagramSelectedEdgeId] = useState<string | null>(null);

  const diagramNodes = (diagram?.children.filter((c): c is SNode => c.type === 'node') ?? []);
  const diagramEdges = (diagram?.children.filter((c): c is SEdge => c.type === 'edge') ?? []);

  // Prune stale hidden IDs when diagram model changes
  useEffect(() => {
    if (!diagram) return;
    const validNodeIds = new Set(diagramNodes.map(n => n.id));
    const validEdgeIds = new Set(diagramEdges.map(e => e.id));
    setHiddenNodeIds(prev => {
      const pruned = new Set([...prev].filter(id => validNodeIds.has(id)));
      return pruned.size === prev.size ? prev : pruned;
    });
    setHiddenEdgeIds(prev => {
      const pruned = new Set([...prev].filter(id => validEdgeIds.has(id)));
      return pruned.size === prev.size ? prev : pruned;
    });
  }, [diagram]);

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

  // Reset view: show all elements and edges, restore default layout
  const handleResetView = useCallback(() => {
    setHiddenNodeIds(new Set());
    setHiddenEdgeIds(new Set());
    setEditorOpen(true);
    setSplitPct(25);
    setViewMode('nested');
    setViewType('general');
    setShowInherited(false);
    setShowLegend(true);
    if (fileId) diagramClient.sendText(`file://${fileId}`, content, 'general', false);
  }, [fileId, content]);

  // Show only a specific node and its descendants (hide everything else)
  const handleShowOnly = useCallback((nodeId: string) => {
    const model = diagramRef.current;
    if (!model) return;
    const allNodes = model.children.filter((c): c is SNode => c.type === 'node');
    const allEdges = model.children.filter((c): c is SEdge => c.type === 'edge');
    // Build parent→children map from composition edges
    const childrenOf = new Map<string, string[]>();
    for (const e of allEdges) {
      if (e.cssClasses?.[0] === 'composition' || e.cssClasses?.[0] === 'noncomposite') {
        const siblings = childrenOf.get(e.sourceId) ?? [];
        siblings.push(e.targetId);
        childrenOf.set(e.sourceId, siblings);
      }
    }
    // Collect target + all descendants
    const keep = new Set<string>();
    const stack = [nodeId];
    while (stack.length > 0) {
      const id = stack.pop()!;
      keep.add(id);
      for (const child of childrenOf.get(id) ?? []) stack.push(child);
    }
    // Hide everything not in keep set
    setHiddenNodeIds(new Set(allNodes.filter(n => !keep.has(n.id)).map(n => n.id)));
  }, []);

  // Show only by element name (for editor context menu)
  const handleShowOnlyByName = useCallback((elementName: string) => {
    const allNodes = diagramRef.current?.children.filter((c): c is SNode => c.type === 'node') ?? [];
    const target = findNodeByName(allNodes, elementName);
    if (target) handleShowOnly(target.id);
  }, [handleShowOnly]);

  // Navigate to an element's code by name
  const handleGoToCode = useCallback((elementName: string) => {
    const allNodes = diagramRef.current?.children.filter((c): c is SNode => c.type === 'node') ?? [];
    const target = findNodeByName(allNodes, elementName);
    if (target) {
      const range = getNodeSourceRange(target);
      if (range) {
        monacoRef.current?.revealRange(
          range.start.line + 1, range.start.character + 1,
          range.end.line + 1, range.end.character + 1,
        );
        return;
      }
    }
    // Fallback: search the editor content for the element name
    const lines = content.split('\n');
    const defPattern = new RegExp(`\\b(?:part|attribute|port|action|state|item|connection|interface|package)\\s+(?:def\\s+)?${elementName}\\b`);
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(defPattern);
      if (match) {
        const col = (match.index ?? 0) + 1;
        monacoRef.current?.revealRange(i + 1, col, i + 1, col + match[0].length);
        return;
      }
    }
  }, [content]);

  // Navigate to a relation's code by searching for the relationship keyword
  const handleEdgeGoToCode = useCallback((edgeKind: string, sourceName?: string, targetName?: string) => {
    const lines = content.split('\n');
    // Map diagram edge kinds to SysML v2 keywords
    const kindToKeyword: Record<string, string[]> = {
      specialization: ['specializes'],
      subsetting: ['subsets'],
      redefinition: ['redefines'],
      typereference: [':'],
      dependency: ['dependency'],
      flow: ['flow'],
      succession: ['then', 'first'],
      transition: ['transition'],
      connection: ['connect'],
      satisfy: ['satisfy'],
      verify: ['verify'],
      allocate: ['allocate'],
      bind: ['bind'],
      annotate: ['annotate', 'comment', 'doc'],
    };
    const keywords = kindToKeyword[edgeKind] ?? [edgeKind];

    // Strategy 1: Find the keyword near the target name within the source element's block
    if (targetName) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes(targetName) && keywords.some(kw => line.includes(kw))) {
          const col = line.indexOf(targetName) + 1;
          monacoRef.current?.revealRange(i + 1, col, i + 1, col + targetName.length);
          return;
        }
      }
    }

    // Strategy 2: Find the keyword near the source name
    if (sourceName) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes(sourceName) && keywords.some(kw => line.includes(kw))) {
          const idx = keywords.reduce((best, kw) => {
            const pos = line.indexOf(kw);
            return pos >= 0 && (best < 0 || pos < best) ? pos : best;
          }, -1);
          if (idx >= 0) {
            monacoRef.current?.revealRange(i + 1, idx + 1, i + 1, idx + 1 + (keywords.find(kw => line.indexOf(kw) === idx)?.length ?? 0));
            return;
          }
        }
      }
    }

    // Strategy 3: Just find any line with the keyword
    for (const kw of keywords) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(kw)) {
          const col = lines[i].indexOf(kw) + 1;
          monacoRef.current?.revealRange(i + 1, col, i + 1, col + kw.length);
          return;
        }
      }
    }
  }, [content]);

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

  // SysML v2 standard view type
  const [viewType, setViewType] = useLocalStorage<ViewType>(`${lsPrefix}:viewType`, 'general');

  // Show inherited features toggle
  const [showInherited, setShowInherited] = useLocalStorage(`${lsPrefix}:showInherited`, false);

  // AI assistant open/close
  const [aiOpen, setAiOpen] = useLocalStorage(`${lsPrefix}:aiOpen`, false);
  const t = useTheme();
  const [projectName, setProjectName] = useState('');
  const [siblingFiles, setSiblingFiles] = useState<SysMLFile[]>([]);
  const [fileSwitcherOpen, setFileSwitcherOpen] = useState(false);

  // Element locks
  const [locks, setLocks] = useState<ElementLock[]>([]);
  const [lockBarOpen, setLockBarOpen] = useState(false);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [isStartupProject, setIsStartupProject] = useState(false);
  const [checkoutWarning, setCheckoutWarning] = useState(false);
  const checkoutWarningTimer = useRef<ReturnType<typeof setTimeout>>();

  const showCheckoutWarning = useCallback(() => {
    if (!isStartupProject || !readOnly) return;
    setCheckoutWarning(true);
    clearTimeout(checkoutWarningTimer.current);
    checkoutWarningTimer.current = setTimeout(() => setCheckoutWarning(false), 3000);
  }, [isStartupProject, readOnly]);
  const fileSwitcherRef = useRef<HTMLDivElement>(null);
  const addRecentEntry = useRecentFilesStore((s) => s.addEntry);

  const isMobile = useIsMobile();
  // Mobile tab: which pane is shown
  const [mobileTab, setMobileTab] = useState<'editor' | 'diagram' | 'ai'>('diagram');

  // Editor open/close
  const [editorOpen, setEditorOpen] = useLocalStorage(`${lsPrefix}:editorOpen`, true);
  const lastSplitPct = useRef(50); // remember split before closing

  // Resizable split pane state
  const [splitPct, setSplitPct] = useLocalStorage(`${lsPrefix}:splitPct`, 25); // editor % width
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const dividerCleanupRef = useRef<(() => void) | null>(null);

  const startDrag = useCallback((startX: number) => {
    dividerCleanupRef.current?.();
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (clientX: number) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((clientX - rect.left) / rect.width) * 100;
      setSplitPct(Math.min(100 - MIN_PANE_PCT, Math.max(MIN_PANE_PCT, pct)));
    };

    const onMouseMove = (ev: MouseEvent) => onMove(ev.clientX);
    const onTouchMove = (ev: TouchEvent) => { ev.preventDefault(); onMove(ev.touches[0].clientX); };

    const cleanup = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', cleanup);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', cleanup);
      dividerCleanupRef.current = null;
    };

    dividerCleanupRef.current = cleanup;
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', cleanup);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', cleanup);
  }, []);

  const onDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startDrag(e.clientX);
  }, [startDrag]);

  const onDividerTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    startDrag(e.touches[0].clientX);
  }, [startDrag]);

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
    // System projects are read-only for non-admin users
    const isAdmin = useAuthStore.getState().user?.role === 'admin';
    api.projects.get(projectId)
      .then((p) => {
        setProjectName(p.name);
        if (p.isSystem && !isAdmin) setReadOnly(true);
        if (p.projectType === 'STARTUP') {
          setIsStartupProject(true);
          setReadOnly(true); // read-only until user checks out elements
        }
      })
      .catch(() => {});
    api.files.get(projectId, fileId)
      .then((f) => {
        setFile(f);
        setContent(f.content);
        diagramClient.sendText(`file://${fileId}`, f.content, viewType, showInherited);
      })
      .catch((e) => setError(e.message));
    // Fetch sibling files for file switcher
    api.files.list(projectId)
      .then((list) => setSiblingFiles(list.sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => {});
  }, [projectId, fileId]);

  // Set of element names locked by the current user
  const myLockedElements = useMemo(() => {
    const set = new Set<string>();
    for (const l of locks) {
      if (l.lockedBy === currentUserId) set.add(l.elementName);
    }
    return set;
  }, [locks, currentUserId]);

  // For startup projects: editable only when user has checked-out elements
  useEffect(() => {
    if (!isStartupProject) return;
    const hasMyLocks = locks.some(l => l.lockedBy === currentUserId);
    setReadOnly(!hasMyLocks);
  }, [locks, isStartupProject, currentUserId]);

  // Fetch and poll element locks
  const fetchLocks = useCallback(async () => {
    if (!projectId || !fileId) return;
    try {
      const list = await api.elementLocks.list(projectId, fileId);
      setLocks(list);
    } catch { /* ignore */ }
  }, [projectId, fileId]);

  useEffect(() => {
    fetchLocks();
    const interval = setInterval(fetchLocks, 15_000);
    return () => clearInterval(interval);
  }, [fetchLocks]);

  const handleCheckOut = async (elementName: string) => {
    if (!projectId || !fileId) return;
    try {
      const lock = await api.elementLocks.checkOut(projectId, fileId, elementName);
      setLocks(prev => [...prev, lock]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to check out element');
    }
  };

  const handleCheckIn = async (elementName: string) => {
    if (!projectId || !fileId) return;
    const save = confirm(`Save changes and check in "${elementName}"?\n\nClick OK to save & check in, or Cancel to keep editing.`);
    if (!save) return;
    try {
      clearTimeout(saveTimer.current);
      setSaving(true);
      await api.files.update(projectId, fileId, content);
      setSaving(false);
      await api.elementLocks.checkIn(projectId, fileId, elementName);
      setLocks(prev => prev.filter(l => l.elementName !== elementName));
    } catch (e) {
      setSaving(false);
      setError(e instanceof Error ? e.message : 'Failed to check in element');
    }
  };

  const handleRequestLock = async (elementName: string) => {
    if (!fileId) return;
    try {
      await api.notifications.create(elementName, fileId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send lock request');
    }
  };

  // Poll for file changes by other users (check updatedAt timestamp)
  const lastUpdatedAt = useRef<string | null>(null);
  useEffect(() => {
    if (!projectId || !fileId || !isStartupProject) return;
    // Set initial timestamp
    if (file) lastUpdatedAt.current = file.updatedAt;

    const poll = setInterval(async () => {
      // Don't reload while user is actively editing (has locks)
      const hasMyLocks = locks.some(l => l.lockedBy === currentUserId);
      if (hasMyLocks) return;

      try {
        const latest = await api.files.get(projectId, fileId);
        if (lastUpdatedAt.current && latest.updatedAt !== lastUpdatedAt.current) {
          // File was updated by another user — reload content
          lastUpdatedAt.current = latest.updatedAt;
          setFile(latest);
          setContent(latest.content);
          diagramClient.sendText(`file://${fileId}`, latest.content, viewType, showInherited);
        }
      } catch { /* ignore */ }
    }, 10_000); // poll every 10 seconds

    return () => clearInterval(poll);
  }, [projectId, fileId, isStartupProject, locks, currentUserId, viewType, showInherited]);

  // Record recent file visit once both file and project name are loaded
  useEffect(() => {
    if (file && projectName && projectId && fileId) {
      addRecentEntry({ projectId, projectName, fileId, fileName: file.name });
    }
  }, [file, projectName]);

  // Click-outside to close file switcher
  useEffect(() => {
    if (!fileSwitcherOpen) return;
    const handle = (e: MouseEvent) => {
      if (fileSwitcherRef.current && !fileSwitcherRef.current.contains(e.target as Node)) setFileSwitcherOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [fileSwitcherOpen]);

  const handleChange = useCallback((value: string) => {
    // Allow edits when user has checked-out elements (MonacoEditor handles per-element restriction)
    const hasLocks = myLockedElements.size > 0;
    if (readOnly && !hasLocks) return;
    setContent(value);
    // Send text to diagram-service for server-side parsing → BDD generation
    diagramClient.sendText(`file://${fileId}`, value, viewType, showInherited);

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
  }, [projectId, fileId, readOnly, viewType, myLockedElements]);

  const handleSave = async () => {
    const hasLocks = myLockedElements.size > 0;
    if (!projectId || !fileId || (readOnly && !hasLocks)) return;
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
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: t.bg }}>
      <Header
        title={`${file.name}${readOnly ? (isStartupProject ? ' (Check out to edit)' : ' (Read Only)') : ''}`}
        titleExtra={siblingFiles.length > 1 ? (
          <div ref={fileSwitcherRef} style={{ position: 'relative', display: 'inline-flex' }}>
            <button
              onClick={() => setFileSwitcherOpen((v) => !v)}
              style={{
                background: 'transparent', border: 'none', color: t.textSecondary,
                cursor: 'pointer', fontSize: 10, padding: '2px 4px', borderRadius: 3,
                display: 'flex', alignItems: 'center',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = t.info; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = t.textSecondary; }}
              title="Switch to another file in this project"
            >{fileSwitcherOpen ? '\u25B2' : '\u25BC'}</button>
            {fileSwitcherOpen && (
              <div style={{
                position: 'absolute', top: 28, left: -8, zIndex: 9999,
                background: t.bgSecondary, border: `1px solid ${t.border}`, borderRadius: 6,
                boxShadow: t.shadow, minWidth: 220, maxWidth: 340, padding: '4px 0',
              }}>
                <div style={{ padding: '6px 12px', color: t.textMuted, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {projectName} — Files
                </div>
                {siblingFiles.map((sf) => (
                  <div
                    key={sf.id}
                    onClick={() => {
                      if (sf.id !== fileId) navigate(`/projects/${projectId}/files/${sf.id}`);
                      setFileSwitcherOpen(false);
                    }}
                    style={{
                      padding: '7px 12px', cursor: sf.id === fileId ? 'default' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: sf.id === fileId ? t.accentBg : 'transparent',
                      fontWeight: sf.id === fileId ? 600 : 400,
                    }}
                    onMouseEnter={(e) => { if (sf.id !== fileId) e.currentTarget.style.background = t.bgHover; }}
                    onMouseLeave={(e) => { if (sf.id !== fileId) e.currentTarget.style.background = sf.id === fileId ? t.accentBg : 'transparent'; }}
                  >
                    <span style={{ color: sf.id === fileId ? t.info : t.success, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {sf.name}
                    </span>
                    <span style={{ color: t.textDim, fontSize: 10, flexShrink: 0, marginLeft: 8 }}>
                      {(sf.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : undefined}
        showSave={!readOnly}
        onSave={handleSave}
        saving={saving}
      />
      {/* ── Checkout warning toast ───────────────────────────────── */}
      {checkoutWarning && (
        <div style={{
          position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10000, background: t.warning, color: '#fff',
          padding: '10px 20px', borderRadius: 6, fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', gap: 8,
          animation: 'fadeIn 0.2s ease',
        }}>
          &#128274; Cannot edit without check-out. Right-click an element in the diagram to check out.
        </div>
      )}
      {/* ── Other users' locks bar (minimal) ─────────────────────── */}
      {(() => {
        const otherLocks = locks.filter(l => l.lockedBy !== currentUserId);
        if (otherLocks.length === 0) return null;
        return (
          <div style={{ background: t.bgTertiary, borderBottom: `1px solid ${t.border}`, padding: '0 12px', flexShrink: 0 }}>
            <div
              onClick={() => setLockBarOpen(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', cursor: 'pointer', fontSize: 10, color: t.textMuted }}
            >
              <span style={{ color: t.warning }}>&#128274;</span>
              <span>{otherLocks.length} locked by others</span>
              <span style={{ fontSize: 8 }}>{lockBarOpen ? '\u25B2' : '\u25BC'}</span>
            </div>
            {lockBarOpen && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingBottom: 4 }}>
                {otherLocks.map(lock => (
                  <span key={lock.id} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    background: 'rgba(245,158,11,0.12)', border: `1px solid ${t.warning}`,
                    borderRadius: 4, padding: '2px 8px', fontSize: 11, color: t.warning,
                  }}>
                    <strong>{lock.elementName}</strong>
                    <span style={{ color: t.textMuted, fontSize: 10 }}>{lock.user?.name ?? 'other'}</span>
                    <button
                      onClick={() => handleRequestLock(lock.elementName)}
                      style={{ background: 'none', border: 'none', color: t.warning, cursor: 'pointer', fontSize: 10, padding: '0 2px', textDecoration: 'underline' }}
                      title="Request this element from the holder"
                    >
                      Request
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })()}
      {/* ── Mobile tab bar ────────────────────────────────────────── */}
      {isMobile && (
        <div style={{
          display: 'flex', flexShrink: 0,
          borderBottom: `1px solid ${t.border}`, background: t.bgSecondary,
        }}>
          {(['diagram', 'editor', 'ai'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setMobileTab(tab)}
              style={{
                flex: 1, padding: '8px 0', border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: mobileTab === tab ? 600 : 400,
                background: mobileTab === tab ? t.bg : t.bgSecondary,
                color: mobileTab === tab ? t.text : t.textSecondary,
                borderBottom: mobileTab === tab ? `2px solid ${t.accent}` : '2px solid transparent',
              }}
            >
              {tab === 'diagram' ? 'Diagram' : tab === 'editor' ? 'Editor' : 'AI'}
            </button>
          ))}
        </div>
      )}

      {/* ── Mobile layout ──────────────────────────────────────────── */}
      {isMobile ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Editor tab */}
          {mobileTab === 'editor' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <MonacoEditor
                ref={monacoRef}
                value={content}
                onChange={handleChange}
                readOnly={readOnly}
                onReadOnlyEdit={isStartupProject ? showCheckoutWarning : undefined}
                onCheckOut={handleCheckOut}
                onCheckIn={handleCheckIn}
                myLockedElements={myLockedElements}
                onShowOnly={handleShowOnlyByName}
                markers={diagnostics.map((d): EditorMarker => ({
                  severity: d.severity, message: d.message,
                  line: d.line, column: d.column,
                  endLine: d.endLine, endColumn: d.endColumn,
                  fixes: d.fixes as EditorMarkerFix[] | undefined,
                }))}
              />
            </div>
          )}
          {/* Diagram tab */}
          {mobileTab === 'diagram' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <DiagramViewer
                model={diagram}
                hiddenNodeIds={hiddenNodeIds}
                hiddenEdgeIds={hiddenEdgeIds}
                storageKey={lsPrefix}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                onShowOnly={handleShowOnly}
                onResetView={handleResetView}
                onNodeSelect={(range) => {
                  monacoRef.current?.revealRange(
                    range.start.line + 1, range.start.character + 1,
                    range.end.line + 1,   range.end.character + 1,
                  );
                  setMobileTab('editor');
                }}
                onEdgeSelect={(range) => {
                  monacoRef.current?.revealRange(
                    range.start.line + 1, range.start.character + 1,
                    range.end.line + 1,   range.end.character + 1,
                  );
                  setMobileTab('editor');
                }}
                onEdgeGoToCode={handleEdgeGoToCode}
                onHideNode={(id) => setHiddenNodeIds((prev) => { const n = new Set(prev); n.add(id); return n; })}
                onHideEdge={(id) => setHiddenEdgeIds((prev) => { const n = new Set(prev); n.add(id); return n; })}
                onHideNodes={(ids) => setHiddenNodeIds((prev) => { const n = new Set(prev); ids.forEach(id => n.add(id)); return n; })}
                onHideEdges={(ids) => setHiddenEdgeIds((prev) => { const n = new Set(prev); ids.forEach(id => n.add(id)); return n; })}
                selectedNodeId={diagramSelectedNodeId}
                selectedEdgeId={diagramSelectedEdgeId}
                onSelectedNodeChange={setDiagramSelectedNodeId}
                onSelectedEdgeChange={setDiagramSelectedEdgeId}
                showLegend={showLegend}
                viewType={viewType}
                onViewTypeChange={(vt) => {
                  setViewType(vt);
                  if (fileId) diagramClient.sendText(`file://${fileId}`, content, vt, showInherited);
                }}
                showInherited={showInherited}
                onShowInheritedChange={(v) => {
                  setShowInherited(v);
                  if (fileId) diagramClient.sendText(`file://${fileId}`, content, viewType, v);
                }}
                locks={locks}
                currentUserId={currentUserId}
                onCheckOut={handleCheckOut}
                onCheckIn={handleCheckIn}
                onRequestLock={handleRequestLock}
              />
            </div>
          )}
          {/* AI tab */}
          {mobileTab === 'ai' && (
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              <AiAssistant
                onClose={() => setMobileTab('diagram')}
                projectId={projectId}
                fileId={fileId}
                fileContent={content}
                fileName={file?.name}
              />
            </div>
          )}
        </div>
      ) : (
        /* ── Desktop layout (unchanged) ──────────────────────────── */
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
                onReadOnlyEdit={isStartupProject ? showCheckoutWarning : undefined}
                onCheckOut={handleCheckOut}
                onCheckIn={handleCheckIn}
                myLockedElements={myLockedElements}
                onShowOnly={handleShowOnlyByName}
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
                height: 160, flexShrink: 0, background: t.bg,
                borderTop: `1px solid ${t.border}`, overflow: 'auto', fontSize: 12,
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '3px 10px', background: t.bgTertiary,
                  borderBottom: `1px solid ${t.border}`, position: 'sticky', top: 0,
                }}>
                  <span style={{ color: t.text, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Problems</span>
                  <span style={{ color: t.textSecondary, fontSize: 11 }}>
                    {diagnostics.filter(d => d.severity === 'error').length} errors,&nbsp;
                    {diagnostics.filter(d => d.severity === 'warning').length} warnings
                  </span>
                </div>
                {diagnostics.length === 0 ? (
                  <div style={{ padding: '8px 12px', color: t.textDim, fontStyle: 'italic' }}>No problems detected.</div>
                ) : (
                  diagnostics.map((d, i) => (
                    <div key={i} style={{
                      padding: '4px 12px 6px', borderBottom: `1px solid ${t.borderLight}`,
                      background: d.severity === 'error' ? t.errorBg : d.severity === 'warning' ? (t.mode === 'dark' ? '#2a2210' : '#fff8e1') : 'transparent',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <span style={{ color: d.severity === 'error' ? t.error : d.severity === 'warning' ? t.warning : t.info, flexShrink: 0, fontSize: 14 }}>
                          {d.severity === 'error' ? '✕' : d.severity === 'warning' ? '⚠' : 'ℹ'}
                        </span>
                        <span
                          style={{ color: t.text, flex: 1, cursor: 'pointer' }}
                          onClick={() => monacoRef.current?.revealRange(d.line, d.column, d.endLine ?? d.line, d.endColumn ?? d.column + 1)}
                        >{d.message}</span>
                        <span style={{ color: t.textDim, whiteSpace: 'nowrap' }}>Ln {d.line}, Col {d.column}</span>
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
                                background: t.accent, border: `1px solid ${t.accentHover}`, borderRadius: 3,
                                color: '#fff', fontSize: 10, padding: '1px 6px', cursor: 'pointer',
                              }}
                            >
                              {'\u26A1'} {fix.title}
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
            background: t.bgSecondary,
            borderLeft: `1px solid ${t.border}`,
            borderRight: `1px solid ${t.border}`,
            position: 'relative',
            zIndex: 1,
          }}>
            {/* Drag handle — only active when editor is open */}
            {editorOpen && (
              <div
                onMouseDown={onDividerMouseDown}
                onTouchStart={onDividerTouchStart}
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
                background: t.btnBg, border: 'none',
                color: t.text, cursor: 'pointer',
                width: 18, height: 32, borderRadius: 3,
                fontSize: 12, display: 'flex', alignItems: 'center',
                justifyContent: 'center', padding: 0,
                lineHeight: 1,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = t.statusBar)}
              onMouseLeave={e => (e.currentTarget.style.background = t.btnBg)}
            >
              {editorOpen ? '\u2039' : '\u203A'}
            </button>
          </div>

          {/* Diagram pane: element panel + viewer + AI panel */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Diagram toolbar */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '3px 10px',
              background: t.bgSecondary, borderBottom: `1px solid ${t.border}`, flexShrink: 0,
            }}>
              <span style={{ fontSize: 11, color: t.text, fontWeight: 600, marginRight: 4 }}>
                {{ 'general': 'General View', 'interconnection': 'Interconnection View', 'action-flow': 'Action Flow View', 'state-transition': 'State Transition View' }[viewType]}
              </span>
              <span style={{ fontSize: 10, color: t.textMuted }}>SysML v2</span>
              <span style={{ flex: 1 }} />
              <button
                onClick={() => setAiOpen((v) => !v)}
                style={{
                  background: aiOpen ? t.statusBar : t.btnBg,
                  border: '1px solid', borderColor: aiOpen ? t.statusBar : t.btnBorder,
                  borderRadius: 3, color: aiOpen ? '#fff' : t.text, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '2px 10px', fontSize: 11, fontWeight: aiOpen ? 600 : 400,
                }}
                onMouseEnter={e => { if (!aiOpen) e.currentTarget.style.background = t.btnBgHover; }}
                onMouseLeave={e => { if (!aiOpen) e.currentTarget.style.background = t.btnBg; }}
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
                showLegend={showLegend}
                onToggleLegend={() => setShowLegend(!showLegend)}
                locks={locks}
                currentUserId={currentUserId}
                onCheckOut={handleCheckOut}
                onCheckIn={handleCheckIn}
                onRequestLock={handleRequestLock}
                currentViewType={viewType}
                currentViewMode={viewMode}
                currentShowInherited={showInherited}
                currentShowLegend={showLegend}
                onRestoreSettings={(s) => {
                  if (s.viewType !== undefined) { setViewType(s.viewType); if (fileId) diagramClient.sendText(`file://${fileId}`, content, s.viewType, s.showInherited ?? showInherited); }
                  if (s.viewMode !== undefined) setViewMode(s.viewMode);
                  if (s.showInherited !== undefined) { setShowInherited(s.showInherited); if (!s.viewType && fileId) diagramClient.sendText(`file://${fileId}`, content, viewType, s.showInherited); }
                  if (s.showLegend !== undefined) setShowLegend(s.showLegend);
                }}
                onGoToCode={handleGoToCode}
              />
              <DiagramViewer
                model={diagram}
                hiddenNodeIds={hiddenNodeIds}
                hiddenEdgeIds={hiddenEdgeIds}
                storageKey={lsPrefix}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                onShowOnly={handleShowOnly}
                onResetView={handleResetView}
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
                onEdgeGoToCode={handleEdgeGoToCode}
                onHideNode={(id) => setHiddenNodeIds((prev) => { const n = new Set(prev); n.add(id); return n; })}
                onHideEdge={(id) => setHiddenEdgeIds((prev) => { const n = new Set(prev); n.add(id); return n; })}
                onHideNodes={(ids) => setHiddenNodeIds((prev) => { const n = new Set(prev); ids.forEach(id => n.add(id)); return n; })}
                onHideEdges={(ids) => setHiddenEdgeIds((prev) => { const n = new Set(prev); ids.forEach(id => n.add(id)); return n; })}
                selectedNodeId={diagramSelectedNodeId}
                selectedEdgeId={diagramSelectedEdgeId}
                onSelectedNodeChange={setDiagramSelectedNodeId}
                onSelectedEdgeChange={setDiagramSelectedEdgeId}
                showLegend={showLegend}
                viewType={viewType}
                onViewTypeChange={(vt) => {
                  setViewType(vt);
                  if (fileId) diagramClient.sendText(`file://${fileId}`, content, vt, showInherited);
                }}
                showInherited={showInherited}
                onShowInheritedChange={(v) => {
                  setShowInherited(v);
                  if (fileId) diagramClient.sendText(`file://${fileId}`, content, viewType, v);
                }}
                locks={locks}
                currentUserId={currentUserId}
                onCheckOut={handleCheckOut}
                onCheckIn={handleCheckIn}
                onRequestLock={handleRequestLock}
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
      )}

      {/* ── Status bar ───────────────────────────────────────────── */}
      <div style={{
        height: 24, background: t.statusBar, display: 'flex', alignItems: 'center',
        padding: '0 12px', gap: isMobile ? 6 : 12, fontSize: isMobile ? 10 : 12, color: '#fff', flexShrink: 0,
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
            display: 'flex', alignItems: 'center', gap: 6, padding: 0, fontSize: isMobile ? 10 : 12,
          }}
          title="Toggle Problems panel"
        >
          {diagnostics.filter(d => d.severity === 'error').length > 0 && (
            <span style={{ color: '#ffc0b0' }}>
              {'\u2715'} {diagnostics.filter(d => d.severity === 'error').length}
            </span>
          )}
          {diagnostics.filter(d => d.severity === 'warning').length > 0 && (
            <span style={{ color: '#ffe080' }}>
              {'\u26A0'} {diagnostics.filter(d => d.severity === 'warning').length}
            </span>
          )}
          {diagnostics.length === 0 && <span style={{ opacity: 0.7 }}>{'\u2713'} No problems</span>}
        </button>
        <span style={{ flex: 1 }} />
        <span>{(content.match(/\n/g) ?? []).length + 1} lines</span>
      </div>
    </div>
  );
}
