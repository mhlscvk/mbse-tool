import React, { useState, useMemo } from 'react';
import type { SNode, SEdge } from '@systemodel/shared-types';

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
  stdlib:               '#0a2018',
  default:              '#252525',
};

const EDGE_KIND_LABELS: Record<string, string> = {
  dependency:    'Generalization',
  composition:   'Composition',
  association:   'Association',
  flow:          'Flow',
  typereference: 'Type Reference',
};

const EDGE_KIND_COLORS: Record<string, string> = {
  dependency:    '#9e9e9e',
  composition:   '#9cdcfe',
  association:   '#777777',
  flow:          '#4ec9b0',
  typereference: '#6a7a8a',
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
  if (edgeLabel && edgeLabel !== '' && edgeLabel !== '«flow»' && !edgeLabel.includes('→')) {
    return edgeLabel;
  }
  const src = nodeIndex.get(edge.sourceId) ?? edge.sourceId.split('__').pop() ?? '?';
  const tgt = nodeIndex.get(edge.targetId) ?? edge.targetId.split('__').pop() ?? '?';
  return `${src} → ${tgt}`;
}

type Tab = 'elements' | 'relationships';
type ViewMode = 'nested' | 'tree';

export default function ElementPanel({
  nodes, edges, hiddenNodeIds, hiddenEdgeIds,
  onToggleNode, onToggleGroup, onToggleAll, onToggleEdge, onToggleEdgeGroup,
}: ElementPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [collapsedEdgeGroups, setCollapsedEdgeGroups] = useState<Set<string>>(new Set());
  const [collapsedTreeGroups, setCollapsedTreeGroups] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<Tab>('elements');
  const [viewMode, setViewMode] = useState<ViewMode>('nested');

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

  const allRootKeys = rootNodes.map(n => n.id);
  const allKindKeys = Array.from(kindGroups.keys());
  const allGroupsCollapsed = viewMode === 'nested'
    ? allRootKeys.length > 0 && allRootKeys.every(k => collapsedGroups.has(k))
    : allKindKeys.length > 0 && allKindKeys.every(k => collapsedTreeGroups.has(k));
  const collapseAll = () => {
    if (viewMode === 'nested') setCollapsedGroups(new Set(allRootKeys));
    else setCollapsedTreeGroups(new Set(allKindKeys));
  };
  const expandAll = () => {
    if (viewMode === 'nested') setCollapsedGroups(new Set());
    else setCollapsedTreeGroups(new Set());
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

    return (
      <div key={node.id}>
        {/* Node header row */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: `4px 8px 4px ${padLeft}px`,
            borderBottom: '1px solid #222',
            background: isPkg ? (depth === 0 ? '#28283a' : '#24243a') : 'transparent',
            cursor: 'pointer', userSelect: 'none',
            opacity: visible ? 1 : 0.45,
          }}
          onMouseEnter={e => { if (!isPkg) e.currentTarget.style.background = '#2a3a4a'; }}
          onMouseLeave={e => { if (!isPkg) e.currentTarget.style.background = 'transparent'; }}
        >
          {/* Collapse toggle — only for nodes with children */}
          {hasChildren ? (
            <span
              onClick={() => toggleGroupCollapse(node.id)}
              style={{ color: isPkg ? '#9a9ac0' : '#888', fontSize: 10, width: 10, display: 'inline-block', flexShrink: 0 }}
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
              borderRadius: kind.includes('usage') || kind === 'actionin' || kind === 'actionout' || kind === 'actioninout' ? 4 : 1,
              background: color,
            }} />
          )}

          {/* Name + kind label */}
          <span
            onClick={() => hasChildren ? toggleGroupCollapse(node.id) : onToggleNode(node.id)}
            style={{
              flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              fontFamily: 'monospace', fontSize: 11,
              color: visible ? (isPkg ? '#c0c0e0' : '#ddd') : '#555',
              fontWeight: hasChildren ? 600 : 400,
            }}
          >
            {name}
          </span>

          {/* Kind badge */}
          <span style={{
            fontSize: 9, color: '#666', flexShrink: 0,
            background: '#1a1a1a', borderRadius: 3, padding: '0 4px',
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
            padding: '5px 8px', borderBottom: '1px solid #2a2a2a',
            background: '#2a2a2a', cursor: 'pointer', userSelect: 'none',
          }}>
            <span
              onClick={() => toggleTreeGroupCollapse(kind)}
              style={{ color: '#888', fontSize: 10, width: 10, display: 'inline-block', flexShrink: 0 }}
            >{isGroupCollapsed ? '▶' : '▼'}</span>
            <span style={{
              width: 8, height: 8, flexShrink: 0,
              borderRadius: kind.includes('usage') || kind === 'actionin' || kind === 'actionout' || kind === 'actioninout' ? 4 : 1,
              background: color, display: 'inline-block',
            }} />
            <span
              onClick={() => toggleTreeGroupCollapse(kind)}
              style={{ flex: 1, color: '#bbb', fontWeight: 600, fontSize: 11 }}
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

            return (
              <div
                key={node.id}
                onClick={() => onToggleNode(node.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '4px 8px 4px 24px', cursor: 'pointer',
                  borderBottom: '1px solid #222',
                  opacity: visible ? 1 : 0.45,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#2a3a4a')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
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
                    color: visible ? '#ddd' : '#555',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{name}</div>
                  {path && (
                    <div style={{
                      fontSize: 9, color: '#666', marginTop: 1,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{path}</div>
                  )}
                </div>
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
        width: 28, background: '#252526', borderRight: '1px solid #3c3c3c',
        display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 8, flexShrink: 0,
      }}>
        <button
          onClick={() => setCollapsed(false)}
          title="Show elements panel"
          style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 16, padding: 4, lineHeight: 1 }}
        >&#9776;</button>
      </div>
    );
  }

  return (
    <div style={{
      width: 220, flexShrink: 0, background: '#252526', borderRight: '1px solid #3c3c3c',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', fontSize: 12,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 8px', borderBottom: '1px solid #3c3c3c', background: '#2d2d2d', flexShrink: 0,
      }}>
        <span style={{ color: '#ccc', fontWeight: 600, fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {tab === 'elements' ? 'Elements' : 'Relations'}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {tab === 'elements' ? (
            <>
              <button onClick={() => onToggleAll(true)} title="Show all" style={btnStyle}>All</button>
              <button onClick={() => onToggleAll(false)} title="Hide all" style={btnStyle}>None</button>
              <button
                onClick={allGroupsCollapsed ? expandAll : collapseAll}
                title={allGroupsCollapsed ? 'Expand all' : 'Collapse all'}
                style={btnStyle}
              >{allGroupsCollapsed ? '▶▶' : '▼▼'}</button>
            </>
          ) : (
            <>
              <button onClick={() => toggleAllEdges(true)} title="Show all" style={btnStyle}>All</button>
              <button onClick={() => toggleAllEdges(false)} title="Hide all" style={btnStyle}>None</button>
              <button
                onClick={() => {
                  const allKinds = Object.keys(edgeGroups);
                  const allCol = allKinds.every(k => collapsedEdgeGroups.has(k));
                  setCollapsedEdgeGroups(allCol ? new Set() : new Set(allKinds));
                }}
                title="Collapse / expand all"
                style={btnStyle}
              >{Object.keys(edgeGroups).every(k => collapsedEdgeGroups.has(k)) ? '▶▶' : '▼▼'}</button>
            </>
          )}
          <button onClick={() => setCollapsed(true)} title="Collapse panel" style={{ ...btnStyle, fontSize: 14 }}>&#8249;</button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid #3c3c3c', flexShrink: 0 }}>
        {(['elements', 'relationships'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, background: tab === t ? '#1e1e1e' : '#2d2d2d',
              border: 'none', borderBottom: tab === t ? '2px solid #007acc' : '2px solid transparent',
              color: tab === t ? '#fff' : '#888', cursor: 'pointer',
              fontSize: 11, padding: '5px 4px', fontWeight: tab === t ? 600 : 400,
            }}
          >
            {t === 'elements' ? `Elements (${nodes.length})` : `Relations (${edges.length})`}
          </button>
        ))}
      </div>

      {/* View mode toggle — only when Elements tab active */}
      {tab === 'elements' && nodes.length > 0 && (
        <div style={{
          display: 'flex', gap: 2, padding: '4px 8px', borderBottom: '1px solid #3c3c3c',
          background: '#2d2d2d', flexShrink: 0,
        }}>
          {(['nested', 'tree'] as ViewMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                flex: 1, border: '1px solid #444', cursor: 'pointer',
                borderRadius: 3, padding: '2px 6px', fontSize: 10,
                background: viewMode === mode ? '#007acc' : 'transparent',
                color: viewMode === mode ? '#fff' : '#aaa',
                fontWeight: viewMode === mode ? 600 : 400,
              }}
            >{mode === 'nested' ? 'Nested' : 'By Kind'}</button>
          ))}
        </div>
      )}

      {/* Elements tab */}
      {tab === 'elements' && (
        nodes.length === 0 ? (
          <div style={{ padding: 12, color: '#555', fontStyle: 'italic' }}>
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
      {tab === 'relationships' && (
        edges.length === 0 ? (
          <div style={{ padding: 12, color: '#555', fontStyle: 'italic' }}>
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
                      padding: '5px 8px', borderBottom: '1px solid #2a2a2a',
                      background: '#2a2a2a', cursor: 'pointer', userSelect: 'none',
                    }}>
                      <span
                        onClick={() => toggleEdgeGroupCollapse(kind)}
                        style={{ color: '#888', fontSize: 10, width: 10, display: 'inline-block' }}
                      >{isGroupCollapsed ? '▶' : '▼'}</span>
                      <svg width={18} height={10} style={{ flexShrink: 0 }}>
                        <line x1={0} y1={5} x2={18} y2={5} stroke={color} strokeWidth={1.5}
                          strokeDasharray={kind === 'flow' ? '4,2' : kind === 'typereference' ? '2,2' : undefined} />
                      </svg>
                      <span
                        onClick={() => toggleEdgeGroupCollapse(kind)}
                        style={{ flex: 1, color: '#bbb', fontWeight: 600 }}
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
                      return (
                        <div
                          key={edge.id}
                          onClick={() => onToggleEdge(edge.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '4px 8px 4px 24px', cursor: 'pointer',
                            borderBottom: '1px solid #222',
                            background: visible ? 'transparent' : '#1a1a1a',
                            opacity: visible ? 1 : 0.45,
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#2a3a4a')}
                          onMouseLeave={e => (e.currentTarget.style.background = visible ? 'transparent' : '#1a1a1a')}
                        >
                          <input
                            type="checkbox" checked={visible}
                            onChange={() => onToggleEdge(edge.id)}
                            onClick={e => e.stopPropagation()}
                            style={{ cursor: 'pointer', accentColor: color, flexShrink: 0 }}
                          />
                          <span style={{
                            color: visible ? '#ccc' : '#555',
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
    </div>
  );
}

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
