import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { SNode, SEdge, ElementLock, ViewType } from '@systemodel/shared-types';
import { useTheme } from '../../store/theme.js';

// ─── Saved Views types & helpers ──────────────────────────────────────────────

interface SavedView {
  name: string;
  hiddenNodeIds: string[];
  hiddenEdgeIds: string[];
  createdAt: number;
  viewType?: ViewType;
  viewMode?: 'nested' | 'tree';
  showInherited?: boolean;
  showLegend?: boolean;
}

function loadSavedViews(storageKey: string): SavedView[] {
  if (!storageKey) return [];
  try {
    const raw = localStorage.getItem(`${storageKey}:savedViews`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function persistSavedViews(storageKey: string, views: SavedView[]) {
  if (!storageKey) return;
  localStorage.setItem(`${storageKey}:savedViews`, JSON.stringify(views));
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ElementPanelProps {
  nodes: SNode[];
  edges: SEdge[];
  hiddenNodeIds: Set<string>;
  hiddenEdgeIds: Set<string>;
  onToggleNode: (id: string) => void;
  onToggleGroup: (ids: string[], visible: boolean) => void;
  onToggleAll: (visible: boolean) => void;
  onToggleEdge: (id: string) => void;
  onToggleEdgeGroup: (ids: string[], visible: boolean) => void;
  /** When true, fills parent width instead of using fixed 220px */
  fillWidth?: boolean;
  /** Called when user clicks an element name — passes the node for navigation */
  onNodeClick?: (node: SNode) => void;
  /** Called when user clicks a relation label — passes the edge for navigation */
  onEdgeClick?: (edge: SEdge) => void;
  /** Storage key for persisting saved views (e.g. "systemodel:proj:file") */
  viewStorageKey?: string;
  /** Called to restore a saved view — sets both hidden node and edge ids */
  onRestoreView?: (hiddenNodes: Set<string>, hiddenEdges: Set<string>) => void;
  /** Currently selected node id from the diagram (for cross-highlighting) */
  diagramSelectedNodeId?: string | null;
  /** Currently selected edge id from the diagram (for cross-highlighting) */
  diagramSelectedEdgeId?: string | null;
  /** Legend visibility state */
  showLegend?: boolean;
  /** Called when user toggles legend visibility */
  onToggleLegend?: () => void;
  /** Element locks for this file */
  locks?: ElementLock[];
  /** Current user ID for lock ownership */
  currentUserId?: string;
  /** Called to check out an element */
  onCheckOut?: (elementName: string) => void;
  /** Called to check in an element */
  onCheckIn?: (elementName: string) => void;
  /** Called to request a locked element */
  onRequestLock?: (elementName: string) => void;
  /** Current diagram view settings (for saving with views) */
  currentViewType?: ViewType;
  currentViewMode?: 'nested' | 'tree';
  currentShowInherited?: boolean;
  currentShowLegend?: boolean;
  /** Called to restore view settings when loading a saved view */
  onRestoreSettings?: (settings: { viewType?: ViewType; viewMode?: 'nested' | 'tree'; showInherited?: boolean; showLegend?: boolean }) => void;
  /** Called to navigate to an element's code by name */
  onGoToCode?: (elementName: string) => void;
}

const KIND_LABELS: Record<string, string> = {
  package:              'Package',
  partdefinition:       'Part Def',
  attributedefinition:  'Attribute Def',
  connectiondefinition: 'Connection Def',
  portdefinition:       'Port Def',
  actiondefinition:     'Action Def',
  statedefinition:      'State Def',
  itemdefinition:       'Item Def',
  partusage:            'Part Usage',
  attributeusage:       'Attribute Usage',
  connectionusage:      'Connection Usage',
  portusage:            'Port Usage',
  actionusage:          'Action Usage',
  stateusage:           'State Usage',
  itemusage:            'Item Usage',
  actionin:             'In Parameter',
  actionout:            'Out Parameter',
  actioninout:          'InOut Parameter',
  casedefinition:       'Case Def',
  caseusage:            'Case Usage',
  metadatausage:        'Metadata Usage',
  flowusage:            'Flow Usage',
  successionflowusage:  'Succession Flow',
  connectorasusage:     'Connector',
  bindingconnectorasusage:'Binding Connector',
  successionasusage:    'Succession',
  conjugatedportdefinition:'Conjugated Port Def',
  performactionusage:   'Perform Action',
  sendactionusage:      'Send Action',
  acceptactionusage:    'Accept Action',
  ifactionusage:        'If Action',
  assignmentactionusage:'Assignment',
  forloopactionusage:   'For Loop',
  whileloopactionusage: 'While Loop',
  includeusecaseusage:  'Include Use Case',
  assertconstraintusage:'Assert Constraint',
  satisfyrequirementusage:'Satisfy Requirement',
  eventoccurrenceusage: 'Event Occurrence',
  exhibitstateusage:    'Exhibit State',
  transitionusage:      'Transition',
  forknode:             'Fork Node',
  joinnode:             'Join Node',
  mergenode:            'Merge Node',
  decisionnode:         'Decision Node',
  startnode:            'Start Node',
  donenode:             'Done Node',
  terminatenode:        'Terminate Node',
  objectivemembership:  'Objective',
  subjectmembership:    'Subject',
  actormembership:      'Actor',
  stakeholdermembership:'Stakeholder',
  viewrenderingmembership:'Rendering',
  membershipexpose:     'Expose',
  namespaceexpose:      'Expose',
  referenceusage:       'Reference',
  alias:                'Alias',
  comment:              'Comment',
  stdlib:               'Standard Library',
  default:              'Other',
};

const KIND_COLORS: Record<string, string> = {
  package:              '#2a2a3a',
  partdefinition:       '#1c3f6e',
  attributedefinition:  '#1e4d1e',
  connectiondefinition: '#4a2810',
  portdefinition:       '#3a1a5a',
  actiondefinition:     '#0f4a4a',
  statedefinition:      '#3a3a10',
  itemdefinition:       '#4a2e08',
  partusage:            '#0a2040',
  attributeusage:       '#102810',
  connectionusage:      '#2a1408',
  portusage:            '#1e0a30',
  actionusage:          '#082828',
  stateusage:           '#202008',
  itemusage:            '#201408',
  actionin:             '#082828',
  actionout:            '#1a1008',
  actioninout:          '#1a2828',
  casedefinition:       '#1a2a4a',
  caseusage:            '#0e1a2a',
  metadatausage:        '#2a1a2a',
  flowusage:            '#0a3a2a',
  successionflowusage:  '#0a3a2a',
  connectorasusage:     '#2a1408',
  bindingconnectorasusage:'#2a1408',
  successionasusage:    '#082828',
  conjugatedportdefinition:'#3a1a5a',
  performactionusage:   '#082828',
  sendactionusage:      '#0a2838',
  acceptactionusage:    '#0a2838',
  ifactionusage:        '#082830',
  assignmentactionusage:'#082830',
  forloopactionusage:   '#0a3030',
  whileloopactionusage: '#0a3030',
  includeusecaseusage:  '#0e1a3a',
  assertconstraintusage:'#3a1a0e',
  satisfyrequirementusage:'#3a0e0e',
  eventoccurrenceusage: '#1a2a1a',
  exhibitstateusage:    '#202008',
  transitionusage:      '#2a2a2a',
  forknode:             '#4a4a4a',
  joinnode:             '#4a4a4a',
  mergenode:            '#3a3a2a',
  decisionnode:         '#3a3a2a',
  startnode:            '#222222',
  terminatenode:        '#3a3a3a',
  objectivemembership:  '#1a2a4a',
  subjectmembership:    '#1a2a4a',
  actormembership:      '#1a2a4a',
  stakeholdermembership:'#1a2a4a',
  viewrenderingmembership:'#0e2020',
  membershipexpose:     '#0e2020',
  namespaceexpose:      '#0e2020',
  referenceusage:       '#252530',
  alias:                '#2a2040',
  comment:              '#2a3a2a',
  stdlib:               '#0a2018',
  default:              '#252525',
};

const EDGE_KIND_LABELS: Record<string, string> = {
  dependency:          'Specialization',
  composition:         'Composition',
  association:         'Association',
  flow:                'Flow',
  succession:          'Succession',
  transition:          'Transition',
  typereference:       'Type Reference',
  subsetting:          'Subsetting',
  redefinition:        'Redefinition',
  referencesubsetting: 'Reference Subsetting',
  satisfy:             'Satisfy',
  verify:              'Verify',
  allocate:            'Allocate',
  bind:                'Binding',
  annotate:            'Annotate',
  conjugation:         'Conjugation',
};

const EDGE_KIND_COLORS: Record<string, string> = {
  dependency:          '#9e9e9e',
  composition:         '#9cdcfe',
  association:         '#777777',
  flow:                '#4ec9b0',
  succession:          '#4ec9b0',
  transition:          '#4ec9b0',
  typereference:       '#6a7a8a',
  subsetting:          '#9e9e9e',
  redefinition:        '#9e9e9e',
  referencesubsetting: '#9e9e9e',
  satisfy:             '#e06060',
  verify:              '#60b060',
  allocate:            '#c0a060',
  bind:                '#9090c0',
  annotate:            '#a0a060',
  conjugation:         '#9a7aba',
};

function getNodeName(node: SNode): string {
  const label = node.children.find((c) => c.id.endsWith('__label'));
  return label?.text ?? node.id;
}

function getNodeKind(node: SNode): string {
  return node.cssClasses?.[0] ?? 'default';
}

function getEdgeKind(edge: SEdge): string {
  return edge.cssClasses?.[0] ?? 'association';
}

function getEdgeLabel(edge: SEdge, nodeIndex: Map<string, string>): string {
  const edgeLabel = edge.children[0]?.text;
  if (edgeLabel && edgeLabel !== '' && edgeLabel !== '\u00ABflow\u00BB' && !edgeLabel.includes('\u2192')) {
    return edgeLabel;
  }
  const src = nodeIndex.get(edge.sourceId) ?? edge.sourceId.split('__').pop() ?? '?';
  const tgt = nodeIndex.get(edge.targetId) ?? edge.targetId.split('__').pop() ?? '?';
  return `${src} → ${tgt}`;
}

type Tab = 'elements' | 'relationships' | 'views' | 'locks';
type ViewMode = 'nested' | 'tree';

export default function ElementPanel({
  nodes, edges, hiddenNodeIds, hiddenEdgeIds,
  onToggleNode, onToggleGroup, onToggleAll, onToggleEdge, onToggleEdgeGroup,
  fillWidth, onNodeClick, onEdgeClick, viewStorageKey, onRestoreView,
  diagramSelectedNodeId, diagramSelectedEdgeId,
  showLegend = true, onToggleLegend,
  locks, currentUserId, onCheckOut, onCheckIn, onRequestLock,
  currentViewType, currentViewMode, currentShowInherited, currentShowLegend, onRestoreSettings,
  onGoToCode,
}: ElementPanelProps) {
  const t = useTheme();

  // Theme-aware button styles
  const btnStyleT: React.CSSProperties = {
    background: 'none', border: `1px solid ${t.btnBorder}`, color: t.textSecondary,
    cursor: 'pointer', borderRadius: 3, padding: '1px 5px', fontSize: 10, lineHeight: '14px',
  };
  const viewBtnStyleT: React.CSSProperties = {
    background: 'none', border: `1px solid ${t.btnBorder}`, color: t.textMuted,
    cursor: 'pointer', borderRadius: 3, padding: '2px 6px', fontSize: 9,
  };

  const [collapsed, setCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [collapsedEdgeGroups, setCollapsedEdgeGroups] = useState<Set<string>>(new Set());
  const [collapsedTreeGroups, setCollapsedTreeGroups] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<Tab>('elements');
  const [viewMode, setViewMode] = useState<ViewMode>('nested');

  // Lock lookup by element name
  const lockMap = useMemo(() => {
    const map = new Map<string, ElementLock>();
    if (locks) locks.forEach(l => map.set(l.elementName, l));
    return map;
  }, [locks]);

  // ── Saved views state ───────────────────────────────────────────────────────
  const [savedViews, setSavedViews] = useState<SavedView[]>(() => loadSavedViews(viewStorageKey ?? ''));
  const [activeViewName, setActiveViewName] = useState<string | null>(null);
  const [newViewName, setNewViewName] = useState('');
  const [renamingIdx, setRenamingIdx] = useState<number | null>(null);
  const [renameText, setRenameText] = useState('');
  const [updatedViewName, setUpdatedViewName] = useState<string | null>(null);
  const updatedTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Reload views when storage key changes
  useEffect(() => {
    setSavedViews(loadSavedViews(viewStorageKey ?? ''));
    setActiveViewName(null);
  }, [viewStorageKey]);

  // Cleanup timer on unmount
  useEffect(() => () => { clearTimeout(updatedTimerRef.current); }, []);

  const saveCurrentView = useCallback(() => {
    const name = newViewName.trim();
    if (!name || !viewStorageKey) return;
    const view: SavedView = {
      name,
      hiddenNodeIds: [...hiddenNodeIds],
      hiddenEdgeIds: [...hiddenEdgeIds],
      createdAt: Date.now(),
      viewType: currentViewType,
      viewMode: currentViewMode,
      showInherited: currentShowInherited,
      showLegend: currentShowLegend,
    };
    const updated = [...savedViews.filter(v => v.name !== name), view];
    setSavedViews(updated);
    persistSavedViews(viewStorageKey, updated);
    setActiveViewName(name);
    setNewViewName('');
  }, [newViewName, viewStorageKey, hiddenNodeIds, hiddenEdgeIds, savedViews, currentViewType, currentViewMode, currentShowInherited, currentShowLegend]);

  const loadView = useCallback((view: SavedView) => {
    if (onRestoreView) {
      onRestoreView(new Set(view.hiddenNodeIds), new Set(view.hiddenEdgeIds));
      setActiveViewName(view.name);
    }
    if (onRestoreSettings) {
      onRestoreSettings({
        viewType: view.viewType,
        viewMode: view.viewMode,
        showInherited: view.showInherited,
        showLegend: view.showLegend,
      });
    }
  }, [onRestoreView, onRestoreSettings]);

  const deleteView = useCallback((name: string) => {
    if (!viewStorageKey) return;
    const updated = savedViews.filter(v => v.name !== name);
    setSavedViews(updated);
    persistSavedViews(viewStorageKey, updated);
    if (activeViewName === name) setActiveViewName(null);
  }, [viewStorageKey, savedViews, activeViewName]);

  const renameView = useCallback((oldName: string, newName: string) => {
    if (!viewStorageKey || !newName.trim()) return;
    const updated = savedViews.map(v => v.name === oldName ? { ...v, name: newName.trim() } : v);
    setSavedViews(updated);
    persistSavedViews(viewStorageKey, updated);
    if (activeViewName === oldName) setActiveViewName(newName.trim());
    setRenamingIdx(null);
  }, [viewStorageKey, savedViews, activeViewName]);

  const updateView = useCallback((name: string) => {
    if (!viewStorageKey) return;
    const updated = savedViews.map(v => v.name === name
      ? { ...v, hiddenNodeIds: [...hiddenNodeIds], hiddenEdgeIds: [...hiddenEdgeIds], createdAt: Date.now(),
          viewType: currentViewType, viewMode: currentViewMode, showInherited: currentShowInherited, showLegend: currentShowLegend }
      : v,
    );
    setSavedViews(updated);
    persistSavedViews(viewStorageKey, updated);
    setUpdatedViewName(name);
    clearTimeout(updatedTimerRef.current);
    updatedTimerRef.current = setTimeout(() => setUpdatedViewName(null), 1500);
  }, [viewStorageKey, savedViews, hiddenNodeIds, hiddenEdgeIds, currentViewType, currentViewMode, currentShowInherited, currentShowLegend]);

  const nodeIndex = useMemo(() => new Map<string, string>(nodes.map((n) => [n.id, getNodeName(n)])), [nodes]);

  // Build full composition tree from ALL composition edges, with pre-sorted children
  const { childrenOf, sortedChildren, rootNodes, parentOf } = useMemo(() => {
    const parentOf = new Map<string, string>();
    const childMap = new Map<string, string[]>();
    const byId = new Map(nodes.map(n => [n.id, n]));

    for (const edge of edges) {
      if (getEdgeKind(edge) === 'composition') {
        parentOf.set(edge.targetId, edge.sourceId);
        const arr = childMap.get(edge.sourceId) ?? [];
        arr.push(edge.targetId);
        childMap.set(edge.sourceId, arr);
      }
    }

    // Pre-resolve and sort children for each parent
    const sorted = new Map<string, SNode[]>();
    for (const [parentId, childIds] of childMap) {
      const children = childIds
        .map(id => byId.get(id))
        .filter((n): n is SNode => n != null)
        .sort((a, b) => getNodeName(a).localeCompare(getNodeName(b)));
      sorted.set(parentId, children);
    }

    const roots = nodes
      .filter(n => !parentOf.has(n.id))
      .sort((a, b) => getNodeName(a).localeCompare(getNodeName(b)));

    return { childrenOf: childMap, sortedChildren: sorted, rootNodes: roots, parentOf };
  }, [nodes, edges]);

  // Group edges by kind
  const edgeGroups = useMemo(() => edges.reduce<Record<string, SEdge[]>>((acc, edge) => {
    const kind = getEdgeKind(edge);
    (acc[kind] ??= []).push(edge);
    return acc;
  }, {}), [edges]);

  // Build containment path breadcrumbs for tree view
  const containmentPaths = useMemo(() => {
    const paths = new Map<string, string>();
    const byId = new Map(nodes.map(n => [n.id, n]));
    for (const node of nodes) {
      const parts: string[] = [];
      let cur = parentOf.get(node.id);
      while (cur) {
        const p = byId.get(cur);
        if (p) parts.unshift(getNodeName(p));
        cur = parentOf.get(cur);
      }
      paths.set(node.id, parts.join(' > '));
    }
    return paths;
  }, [nodes, parentOf]);

  // Group all nodes by kind for tree view
  const kindGroups = useMemo(() => {
    const groups = new Map<string, SNode[]>();
    for (const node of nodes) {
      const kind = getNodeKind(node);
      const arr = groups.get(kind) ?? [];
      arr.push(node);
      groups.set(kind, arr);
    }
    // Sort nodes within each group
    for (const [, arr] of groups) {
      arr.sort((a, b) => getNodeName(a).localeCompare(getNodeName(b)));
    }
    return groups;
  }, [nodes]);

  const toggleGroupCollapse = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleEdgeGroupCollapse = (kind: string) => {
    setCollapsedEdgeGroups(prev => {
      const next = new Set(prev);
      next.has(kind) ? next.delete(kind) : next.add(kind);
      return next;
    });
  };

  const toggleTreeGroupCollapse = (kind: string) => {
    setCollapsedTreeGroups(prev => {
      const next = new Set(prev);
      next.has(kind) ? next.delete(kind) : next.add(kind);
      return next;
    });
  };

  // Pre-compute all descendant IDs for each node (including self)
  const allDescendantIds = useMemo(() => {
    const cache = new Map<string, string[]>();
    const collect = (nodeId: string): string[] => {
      if (cache.has(nodeId)) return cache.get(nodeId)!;
      const ids = [nodeId];
      for (const childId of childrenOf.get(nodeId) ?? []) {
        ids.push(...collect(childId));
      }
      cache.set(nodeId, ids);
      return ids;
    };
    for (const node of nodes) collect(node.id);
    return cache;
  }, [nodes, childrenOf]);

  const collectAllIds = (nodeId: string): string[] => allDescendantIds.get(nodeId) ?? [nodeId];

  // Compute depth of each node in the composition tree
  const nodeDepths = useMemo(() => {
    const depths = new Map<string, number>();
    const walk = (nodeId: string, d: number) => {
      depths.set(nodeId, d);
      for (const childId of childrenOf.get(nodeId) ?? []) walk(childId, d + 1);
    };
    for (const root of rootNodes) walk(root.id, 0);
    return depths;
  }, [rootNodes, childrenOf]);

  // All node IDs that have children (collapsible)
  const collapsibleIds = useMemo(() => {
    const ids: string[] = [];
    for (const node of nodes) {
      if ((childrenOf.get(node.id) ?? []).length > 0) ids.push(node.id);
    }
    return ids;
  }, [nodes, childrenOf]);

  // Max depth of any collapsible node
  const maxDepth = useMemo(() => {
    let max = 0;
    for (const id of collapsibleIds) max = Math.max(max, nodeDepths.get(id) ?? 0);
    return max;
  }, [collapsibleIds, nodeDepths]);

  const allRootKeys = rootNodes.map(n => n.id);
  const allKindKeys = Array.from(kindGroups.keys());

  const allGroupsCollapsed = viewMode === 'nested'
    ? collapsibleIds.length > 0 && collapsibleIds.every(k => collapsedGroups.has(k))
    : allKindKeys.length > 0 && allKindKeys.every(k => collapsedTreeGroups.has(k));

  const allGroupsExpanded = viewMode === 'nested'
    ? collapsibleIds.length > 0 && collapsibleIds.every(k => !collapsedGroups.has(k))
    : allKindKeys.length > 0 && allKindKeys.every(k => !collapsedTreeGroups.has(k));

  // Step-by-step collapse: collapse one level at a time, deepest expanded first
  const stepCollapse = () => {
    if (viewMode === 'nested') {
      // Find the deepest level that has expanded (non-collapsed) nodes
      for (let d = maxDepth; d >= 0; d--) {
        const atDepth = collapsibleIds.filter(id => (nodeDepths.get(id) ?? 0) === d && !collapsedGroups.has(id));
        if (atDepth.length > 0) {
          setCollapsedGroups(prev => {
            const next = new Set(prev);
            for (const id of atDepth) next.add(id);
            return next;
          });
          return;
        }
      }
    } else {
      setCollapsedTreeGroups(new Set(allKindKeys));
    }
  };

  // Step-by-step expand: expand one level at a time, shallowest collapsed first
  const stepExpand = () => {
    if (viewMode === 'nested') {
      // Find the shallowest level that has collapsed nodes
      for (let d = 0; d <= maxDepth; d++) {
        const atDepth = collapsibleIds.filter(id => (nodeDepths.get(id) ?? 0) === d && collapsedGroups.has(id));
        if (atDepth.length > 0) {
          setCollapsedGroups(prev => {
            const next = new Set(prev);
            for (const id of atDepth) next.delete(id);
            return next;
          });
          return;
        }
      }
    } else {
      setCollapsedTreeGroups(new Set());
    }
  };

  const toggleAllEdges = (visible: boolean) => {
    onToggleEdgeGroup(edges.map(e => e.id), visible);
  };

  // Recursive node renderer — mirrors the composition tree from the diagram
  const renderNode = (node: SNode, depth: number): React.ReactNode => {
    const kind = getNodeKind(node);
    const name = getNodeName(node);
    const color = KIND_COLORS[kind] ?? KIND_COLORS.default;
    const kindLabel = KIND_LABELS[kind] ?? kind;
    const visible = !hiddenNodeIds.has(node.id);
    const isPkg = kind === 'package';
    const children = sortedChildren.get(node.id) ?? [];
    const hasChildren = children.length > 0;
    const isCollapsed = collapsedGroups.has(node.id);
    const padLeft = 8 + depth * 14;
    const allIds = collectAllIds(node.id);
    const allVisible = allIds.every(id => !hiddenNodeIds.has(id));
    const allHidden = allIds.every(id => hiddenNodeIds.has(id));
    const isDiagramSelected = diagramSelectedNodeId === node.id;
    const defaultBg = isPkg ? (t.mode === 'dark' ? (depth === 0 ? '#28283a' : '#24243a') : (depth === 0 ? '#e8e8f0' : '#eeeef4')) : 'transparent';
    const rowBg = isDiagramSelected ? (t.mode === 'dark' ? '#2a2a10' : '#fffde0') : defaultBg;

    return (
      <div key={node.id}>
        {/* Node header row */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: `4px 8px 4px ${padLeft}px`,
            borderBottom: `1px solid ${t.borderLight}`,
            background: rowBg,
            cursor: 'pointer', userSelect: 'none',
            opacity: visible ? 1 : 0.45,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = t.bgHover; }}
          onMouseLeave={e => { e.currentTarget.style.background = rowBg; }}
        >
          {/* Collapse toggle — only for nodes with children */}
          {hasChildren ? (
            <span
              onClick={(e) => { e.stopPropagation(); toggleGroupCollapse(node.id); }}
              style={{ color: t.textMuted, fontSize: 10, width: 10, display: 'inline-block', flexShrink: 0 }}
            >{isCollapsed ? '▶' : '▼'}</span>
          ) : (
            <span style={{ width: 10, flexShrink: 0 }} />
          )}

          {/* Visibility checkbox */}
          <input
            type="checkbox"
            checked={hasChildren ? allVisible : visible}
            ref={hasChildren ? (el => { if (el) el.indeterminate = !allHidden && !allVisible; }) : undefined}
            onChange={e => {
              if (hasChildren) {
                onToggleGroup(allIds, e.target.checked);
              } else {
                onToggleNode(node.id);
              }
            }}
            onClick={e => e.stopPropagation()}
            style={{ cursor: 'pointer', accentColor: isPkg ? '#6a6a8a' : color, flexShrink: 0 }}
          />

          {/* Icon */}
          {isPkg ? (
            <svg width={12} height={10} style={{ flexShrink: 0 }}>
              <rect x={0} y={0} width={7} height={3} fill={color} stroke="#6a6a8a" strokeWidth={0.8} />
              <rect x={0} y={3} width={12} height={7} fill={color} stroke="#6a6a8a" strokeWidth={0.8} />
            </svg>
          ) : (
            <span style={{
              width: 8, height: 8, flexShrink: 0,
              borderRadius: kind.includes('usage') || kind === 'actionin' || kind === 'actionout' || kind === 'actioninout'
                || kind === 'startnode' || kind === 'terminatenode' ? 4 : kind === 'forknode' || kind === 'joinnode' ? 1 : kind === 'mergenode' || kind === 'decisionnode' ? 0 : 1,
              background: color,
              ...(kind === 'mergenode' || kind === 'decisionnode' ? { transform: 'rotate(45deg)', width: 7, height: 7 } : {}),
            }} />
          )}

          {/* Name + kind label */}
          <span
            onClick={(e) => {
              e.stopPropagation();
              if (onNodeClick) {
                onNodeClick(node);
              } else if (hasChildren) {
                toggleGroupCollapse(node.id);
              } else {
                onToggleNode(node.id);
              }
            }}
            style={{
              flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              fontFamily: 'monospace', fontSize: 11,
              color: isDiagramSelected ? '#f0c040' : visible ? (isPkg ? t.text : t.text) : t.textDim,
              fontWeight: hasChildren || isDiagramSelected ? 600 : 400,
            }}
          >
            {name}
          </span>

          {/* Kind badge */}
          <span style={{
            fontSize: 9, color: isDiagramSelected ? '#f0c040' : t.textMuted, flexShrink: 0,
            background: t.bg, borderRadius: 3, padding: '0 4px',
          }}>
            {kindLabel}
          </span>
        </div>

        {/* Children */}
        {hasChildren && !isCollapsed && children.map(child => renderNode(child, depth + 1))}
      </div>
    );
  };

  // Tree view renderer — flat list grouped by kind
  const renderTreeView = () => {
    const sortedKinds = Array.from(kindGroups.entries())
      .sort(([a], [b]) => (KIND_LABELS[a] ?? a).localeCompare(KIND_LABELS[b] ?? b));

    return sortedKinds.map(([kind, groupNodes]) => {
      const color = KIND_COLORS[kind] ?? KIND_COLORS.default;
      const label = KIND_LABELS[kind] ?? kind;
      const isGroupCollapsed = collapsedTreeGroups.has(kind);
      const groupIds = groupNodes.map(n => n.id);
      const groupAllVisible = groupIds.every(id => !hiddenNodeIds.has(id));
      const groupAllHidden = groupIds.every(id => hiddenNodeIds.has(id));

      return (
        <div key={kind}>
          {/* Group header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 8px', borderBottom: `1px solid ${t.borderLight}`,
            background: t.bgSelected, cursor: 'pointer', userSelect: 'none',
          }}>
            <span
              onClick={() => toggleTreeGroupCollapse(kind)}
              style={{ color: t.textMuted, fontSize: 10, width: 10, display: 'inline-block', flexShrink: 0 }}
            >{isGroupCollapsed ? '▶' : '▼'}</span>
            <span style={{
              width: 8, height: 8, flexShrink: 0,
              borderRadius: kind.includes('usage') || kind === 'actionin' || kind === 'actionout' || kind === 'actioninout'
                || kind === 'startnode' || kind === 'terminatenode' ? 4 : 1,
              background: color, display: 'inline-block',
              ...(kind === 'mergenode' || kind === 'decisionnode' ? { transform: 'rotate(45deg)', width: 7, height: 7 } : {}),
            }} />
            <span
              onClick={() => toggleTreeGroupCollapse(kind)}
              style={{ flex: 1, color: t.text, fontWeight: 600, fontSize: 11 }}
            >{label} ({groupNodes.length})</span>
            <input
              type="checkbox"
              checked={groupAllVisible}
              ref={el => { if (el) el.indeterminate = !groupAllHidden && !groupAllVisible; }}
              onChange={e => onToggleGroup(groupIds, e.target.checked)}
              onClick={e => e.stopPropagation()}
              style={{ cursor: 'pointer', accentColor: color, flexShrink: 0 }}
            />
          </div>

          {/* Group items */}
          {!isGroupCollapsed && groupNodes.map(node => {
            const name = getNodeName(node);
            const visible = !hiddenNodeIds.has(node.id);
            const path = containmentPaths.get(node.id) ?? '';
            const isDiagSel = diagramSelectedNodeId === node.id;
            const treeBg = isDiagSel ? (t.mode === 'dark' ? '#2a2a10' : '#fffde0') : 'transparent';

            return (
              <div
                key={node.id}
                onClick={() => onNodeClick ? onNodeClick(node) : onToggleNode(node.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '4px 8px 4px 24px', cursor: 'pointer',
                  borderBottom: `1px solid ${t.borderLight}`,
                  background: treeBg,
                  opacity: visible ? 1 : 0.45,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = t.bgHover)}
                onMouseLeave={e => (e.currentTarget.style.background = treeBg)}
              >
                <input
                  type="checkbox" checked={visible}
                  onChange={() => onToggleNode(node.id)}
                  onClick={e => e.stopPropagation()}
                  style={{ cursor: 'pointer', accentColor: color, flexShrink: 0 }}
                />
                <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
                  <div style={{
                    fontFamily: 'monospace', fontSize: 11,
                    color: isDiagSel ? '#f0c040' : visible ? t.text : t.textDim,
                    fontWeight: isDiagSel ? 600 : 400,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{name}</div>
                  {path && (
                    <div style={{
                      fontSize: 9, color: t.textMuted, marginTop: 1,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{path}</div>
                  )}
                </div>
                {/* Lock indicator + action */}
                {(() => {
                  const lock = lockMap.get(name);
                  if (!lock && onCheckOut) {
                    return (
                      <button
                        onClick={e => { e.stopPropagation(); onCheckOut(name); }}
                        title="Check out this element"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: t.textDim, padding: '0 2px', flexShrink: 0 }}
                      >&#128275;</button>
                    );
                  }
                  if (lock) {
                    const isMine = lock.lockedBy === currentUserId;
                    return (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          if (isMine && onCheckIn) onCheckIn(name);
                          else if (!isMine && onRequestLock) onRequestLock(name);
                        }}
                        title={isMine ? 'Check in (you hold this lock)' : `Locked by ${lock.user?.name ?? 'another user'} — click to request`}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer', fontSize: 10,
                          color: isMine ? t.info : t.warning, padding: '0 2px', flexShrink: 0,
                        }}
                      >&#128274;</button>
                    );
                  }
                  return null;
                })()}
              </div>
            );
          })}
        </div>
      );
    });
  };

  if (collapsed) {
    return (
      <div style={{
        width: 28, background: t.bgTertiary, borderRight: `1px solid ${t.border}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 8, flexShrink: 0,
      }}>
        <button
          onClick={() => setCollapsed(false)}
          title="Show elements panel"
          style={{ background: 'none', border: 'none', color: t.textSecondary, cursor: 'pointer', fontSize: 16, padding: 4, lineHeight: 1 }}
        >&#9776;</button>
      </div>
    );
  }

  return (
    <div style={{
      ...(fillWidth
        ? { flex: 1, minWidth: 0 }
        : { width: 220, flexShrink: 0, borderRight: `1px solid ${t.border}` }),
      background: t.bgTertiary,
      display: 'flex', flexDirection: 'column', overflow: 'hidden', fontSize: 12,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 8px', borderBottom: `1px solid ${t.border}`, background: t.bgSecondary, flexShrink: 0,
      }}>
        <span style={{ color: t.text, fontWeight: 600, fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {tab === 'elements' ? 'Elements' : tab === 'relationships' ? 'Relations' : tab === 'locks' ? 'Checked Out' : 'Views'}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {tab === 'elements' && (
            <>
              <button onClick={() => onToggleAll(true)} title="Show all" style={btnStyleT}>All</button>
              <button onClick={() => onToggleAll(false)} title="Hide all" style={btnStyleT}>None</button>
              <button
                onClick={stepExpand}
                disabled={allGroupsExpanded}
                title="Expand one level"
                style={{ ...btnStyleT, opacity: allGroupsExpanded ? 0.3 : 1 }}
              >&#9660;</button>
              <button
                onClick={stepCollapse}
                disabled={allGroupsCollapsed}
                title="Collapse one level"
                style={{ ...btnStyleT, opacity: allGroupsCollapsed ? 0.3 : 1 }}
              >&#9650;</button>
            </>
          )}
          {tab === 'relationships' && (
            <>
              <button onClick={() => toggleAllEdges(true)} title="Show all" style={btnStyleT}>All</button>
              <button onClick={() => toggleAllEdges(false)} title="Hide all" style={btnStyleT}>None</button>
              <button
                onClick={() => {
                  const allKinds = Object.keys(edgeGroups);
                  const allCol = allKinds.every(k => collapsedEdgeGroups.has(k));
                  setCollapsedEdgeGroups(allCol ? new Set() : new Set(allKinds));
                }}
                title="Collapse / expand all"
                style={btnStyleT}
              >{Object.keys(edgeGroups).every(k => collapsedEdgeGroups.has(k)) ? '▶▶' : '▼▼'}</button>
            </>
          )}
          <button onClick={() => setCollapsed(true)} title="Collapse panel" style={{ ...btnStyleT, fontSize: 14 }}>&#8249;</button>
        </div>
      </div>


      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
        {([
          { key: 'elements' as Tab, label: `Elements (${nodes.length})` },
          { key: 'relationships' as Tab, label: `Relations (${edges.length})` },
          ...(viewStorageKey ? [{ key: 'views' as Tab, label: `Views (${savedViews.length})` }] : []),
          ...(locks && locks.some(l => l.lockedBy === currentUserId) ? [{ key: 'locks' as Tab, label: `Locks (${locks.filter(l => l.lockedBy === currentUserId).length})` }] : []),
        ]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              flex: 1, background: tab === key ? t.bg : t.bgSecondary,
              border: 'none', borderBottom: tab === key ? `2px solid ${t.statusBar}` : '2px solid transparent',
              color: tab === key ? t.text : t.textSecondary, cursor: 'pointer',
              fontSize: 11, padding: '5px 4px', fontWeight: tab === key ? 600 : 400,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* View mode toggle — only when Elements tab active */}
      {tab === 'elements' && nodes.length > 0 && (
        <div style={{
          display: 'flex', gap: 2, padding: '4px 8px', borderBottom: `1px solid ${t.border}`,
          background: t.bgSecondary, flexShrink: 0,
        }}>
          {(['nested', 'tree'] as ViewMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                flex: 1, border: `1px solid ${t.btnBorder}`, cursor: 'pointer',
                borderRadius: 3, padding: '2px 6px', fontSize: 10,
                background: viewMode === mode ? t.statusBar : 'transparent',
                color: viewMode === mode ? (t.mode === 'dark' ? '#fff' : '#fff') : t.textSecondary,
                fontWeight: viewMode === mode ? 600 : 400,
              }}
            >{mode === 'nested' ? 'Nested' : 'By Kind'}</button>
          ))}
        </div>
      )}

      {/* Elements tab */}
      {tab === 'elements' && (
        nodes.length === 0 ? (
          <div style={{ padding: 12, color: t.textDim, fontStyle: 'italic' }}>
            No elements detected.<br />Start typing SysML.
          </div>
        ) : (
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {viewMode === 'nested'
              ? rootNodes.map(node => renderNode(node, 0))
              : renderTreeView()
            }
          </div>
        )
      )}

      {/* Relationships tab */}
      {tab === 'relationships' && onToggleLegend && (
        <div style={{ padding: '6px 8px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11, color: t.textSecondary }}>
            <input
              type="checkbox"
              checked={showLegend}
              onChange={onToggleLegend}
              style={{ accentColor: t.info, cursor: 'pointer' }}
            />
            Show Legend
          </label>
        </div>
      )}
      {tab === 'relationships' && (
        edges.length === 0 ? (
          <div style={{ padding: 12, color: t.textDim, fontStyle: 'italic' }}>
            No relationships detected.
          </div>
        ) : (
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {Object.entries(edgeGroups)
              .sort(([a], [b]) => (EDGE_KIND_LABELS[a] ?? a).localeCompare(EDGE_KIND_LABELS[b] ?? b))
              .map(([kind, kindEdges]) => {
                const color = EDGE_KIND_COLORS[kind] ?? '#777';
                const label = EDGE_KIND_LABELS[kind] ?? kind;
                const groupAllVisible = kindEdges.every(e => !hiddenEdgeIds.has(e.id));
                const groupAllHidden = kindEdges.every(e => hiddenEdgeIds.has(e.id));
                const isGroupCollapsed = collapsedEdgeGroups.has(kind);

                return (
                  <div key={kind}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '5px 8px', borderBottom: `1px solid ${t.borderLight}`,
                      background: t.bgSelected, cursor: 'pointer', userSelect: 'none',
                    }}>
                      <span
                        onClick={() => toggleEdgeGroupCollapse(kind)}
                        style={{ color: t.textMuted, fontSize: 10, width: 10, display: 'inline-block' }}
                      >{isGroupCollapsed ? '▶' : '▼'}</span>
                      <svg width={18} height={10} style={{ flexShrink: 0 }}>
                        <line x1={0} y1={5} x2={18} y2={5} stroke={color} strokeWidth={1.5}
                          strokeDasharray={kind === 'flow' ? '4,2' : kind === 'typereference' ? '2,2' : undefined} />
                      </svg>
                      <span
                        onClick={() => toggleEdgeGroupCollapse(kind)}
                        style={{ flex: 1, color: t.text, fontWeight: 600 }}
                      >{label} ({kindEdges.length})</span>
                      <input
                        type="checkbox"
                        checked={groupAllVisible}
                        ref={el => { if (el) el.indeterminate = !groupAllHidden && !groupAllVisible; }}
                        onChange={e => onToggleEdgeGroup(kindEdges.map(e => e.id), e.target.checked)}
                        style={{ cursor: 'pointer', accentColor: color }}
                      />
                    </div>
                    {!isGroupCollapsed && [...kindEdges].sort((a, b) =>
                      getEdgeLabel(a, nodeIndex).localeCompare(getEdgeLabel(b, nodeIndex))
                    ).map(edge => {
                      const visible = !hiddenEdgeIds.has(edge.id);
                      const edgeDiagSel = diagramSelectedEdgeId === edge.id;
                      const edgeBg = edgeDiagSel ? (t.mode === 'dark' ? '#2a2a10' : '#fffde0') : visible ? 'transparent' : t.bg;
                      return (
                        <div
                          key={edge.id}
                          onClick={() => onEdgeClick ? onEdgeClick(edge) : onToggleEdge(edge.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '4px 8px 4px 24px', cursor: 'pointer',
                            borderBottom: `1px solid ${t.borderLight}`,
                            background: edgeBg,
                            opacity: visible ? 1 : 0.45,
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = t.bgHover)}
                          onMouseLeave={e => (e.currentTarget.style.background = edgeBg)}
                        >
                          <input
                            type="checkbox" checked={visible}
                            onChange={() => onToggleEdge(edge.id)}
                            onClick={e => e.stopPropagation()}
                            style={{ cursor: 'pointer', accentColor: color, flexShrink: 0 }}
                          />
                          <span style={{
                            color: edgeDiagSel ? '#f0c040' : visible ? t.text : t.textDim,
                            fontWeight: edgeDiagSel ? 600 : 400,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            fontFamily: 'monospace', fontSize: 11,
                          }}>
                            {getEdgeLabel(edge, nodeIndex)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
          </div>
        )
      )}

      {/* Views tab */}
      {tab === 'views' && viewStorageKey && (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {/* Save new view */}
          <div style={{
            padding: '8px', borderBottom: `1px solid ${t.border}`,
            display: 'flex', gap: 4, flexShrink: 0,
          }}>
            <input
              type="text"
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveCurrentView(); }}
              placeholder="View name..."
              style={{
                flex: 1, background: t.bgInput, border: `1px solid ${t.btnBorder}`,
                borderRadius: 3, color: t.text, fontSize: 11, padding: '4px 8px',
                outline: 'none', minWidth: 0,
              }}
            />
            <button
              onClick={saveCurrentView}
              disabled={!newViewName.trim()}
              title="Save current visibility as a named view"
              style={{
                ...btnStyleT,
                opacity: newViewName.trim() ? 1 : 0.4,
                padding: '3px 8px',
              }}
            >
              Save
            </button>
          </div>

          {/* Saved views list */}
          {savedViews.length === 0 ? (
            <div style={{ padding: 12, color: t.textDim, fontStyle: 'italic', fontSize: 11 }}>
              No saved views yet. Configure element/relation visibility, then save it as a view above.
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {savedViews
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((view, idx) => {
                  const isActive = activeViewName === view.name;
                  const isRenaming = renamingIdx === idx;
                  const hiddenCount = view.hiddenNodeIds.length + view.hiddenEdgeIds.length;

                  return (
                    <div
                      key={view.name}
                      style={{
                        padding: '6px 8px',
                        borderBottom: `1px solid ${t.borderLight}`,
                        background: isActive ? (t.mode === 'dark' ? '#1a3050' : '#e0f0ff') : 'transparent',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = t.bgHover; }}
                      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                    >
                      {isRenaming ? (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <input
                            autoFocus
                            type="text"
                            value={renameText}
                            onChange={(e) => setRenameText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') renameView(view.name, renameText);
                              if (e.key === 'Escape') setRenamingIdx(null);
                            }}
                            onBlur={() => setRenamingIdx(null)}
                            style={{
                              flex: 1, background: t.bgInput, border: `1px solid ${t.borderFocus}`,
                              borderRadius: 3, color: t.text, fontSize: 11, padding: '2px 6px',
                              outline: 'none', minWidth: 0,
                            }}
                          />
                        </div>
                      ) : (
                        <>
                          <div
                            onClick={() => loadView(view)}
                            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                          >
                            {/* Active indicator */}
                            <span style={{
                              width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                              background: isActive ? t.accent : t.btnBg,
                            }} />
                            <span style={{
                              flex: 1, color: isActive ? t.info : t.text,
                              fontSize: 12, fontWeight: isActive ? 600 : 400,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {view.name}
                            </span>
                            <span style={{ fontSize: 9, color: t.textDim, flexShrink: 0 }}>
                              {hiddenCount > 0 ? `${hiddenCount} hidden` : 'all visible'}
                              {view.viewType ? ` · ${
                                ({ general: 'GV', interconnection: 'IV', 'action-flow': 'AFV', 'state-transition': 'STV', sequence: 'SEQ', grid: 'GRD', browser: 'BRW', geometry: 'GEO' } as Record<string, string>)[view.viewType]
                              }` : ''}
                              {view.viewMode === 'tree' ? ' · Tree' : ''}
                              {view.showInherited ? ' · Inh' : ''}
                            </span>
                          </div>
                          {/* Action buttons */}
                          <div style={{ display: 'flex', gap: 2, marginTop: 4, paddingLeft: 12 }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); loadView(view); }}
                              style={{ ...viewBtnStyleT, color: t.info, borderColor: t.btnBorder }}
                              title="Load this view"
                            >Load</button>
                            <button
                              onClick={(e) => { e.stopPropagation(); updateView(view.name); }}
                              style={{
                                ...viewBtnStyleT,
                                ...(updatedViewName === view.name
                                  ? { color: t.success, borderColor: t.success }
                                  : {}),
                              }}
                              title="Update with current visibility"
                            >{updatedViewName === view.name ? 'Updated' : 'Update'}</button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setRenamingIdx(idx);
                                setRenameText(view.name);
                              }}
                              style={viewBtnStyleT}
                              title="Rename view"
                            >Rename</button>
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteView(view.name); }}
                              style={{ ...viewBtnStyleT, color: t.error, borderColor: t.btnBorder }}
                              title="Delete view"
                            >Delete</button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
            </div>
          )}

          {/* Show All button at bottom */}
          <div style={{ padding: '8px', borderTop: `1px solid ${t.border}`, flexShrink: 0 }}>
            <button
              onClick={() => {
                if (onRestoreView) onRestoreView(new Set(), new Set());
                setActiveViewName(null);
              }}
              style={{
                width: '100%', padding: '5px 8px',
                background: t.bgSecondary, border: `1px solid ${t.btnBorder}`, borderRadius: 3,
                color: t.textSecondary, fontSize: 11, cursor: 'pointer',
              }}
            >
              Show All (reset)
            </button>
          </div>
        </div>
      )}

      {/* Locks tab content */}
      {tab === 'locks' && locks && (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {(() => {
            const myLocks = locks.filter(l => l.lockedBy === currentUserId);
            if (myLocks.length === 0) {
              return (
                <div style={{ padding: 16, color: t.textMuted, fontSize: 12, textAlign: 'center' }}>
                  No elements checked out.
                </div>
              );
            }
            return myLocks.map(lock => (
              <div key={lock.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 8px', borderBottom: `1px solid ${t.borderLight}`,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = t.bgHover; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div
                  style={{ flex: 1, minWidth: 0, cursor: onGoToCode ? 'pointer' : 'default' }}
                  onClick={() => onGoToCode?.(lock.elementName)}
                  title="Go to code"
                >
                  <div style={{ color: t.info, fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    &#128274; {lock.elementName}
                  </div>
                  <div style={{ color: t.textDim, fontSize: 9 }}>
                    {new Date(lock.lockedAt).toLocaleTimeString()} — click to go to code
                  </div>
                </div>
                <button
                  onClick={() => onCheckIn?.(lock.elementName)}
                  style={{
                    background: t.info, color: '#fff', border: 'none', borderRadius: 3,
                    padding: '3px 8px', fontSize: 10, cursor: 'pointer', fontWeight: 600, flexShrink: 0,
                  }}
                >
                  Check In
                </button>
              </div>
            ));
          })()}
        </div>
      )}
    </div>
  );
}

// These are overridden at runtime with theme values via btnStyleT / viewBtnStyleT
const btnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid #444',
  color: '#aaa',
  cursor: 'pointer',
  borderRadius: 3,
  padding: '1px 5px',
  fontSize: 10,
  lineHeight: '14px',
};

const viewBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid #333',
  color: '#888',
  cursor: 'pointer',
  borderRadius: 3,
  padding: '2px 6px',
  fontSize: 9,
};

