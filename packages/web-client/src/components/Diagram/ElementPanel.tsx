import React, { useState } from 'react';
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
  stdlib:               'Standard Library',
  default:              'Other',
};

const KIND_COLORS: Record<string, string> = {
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

// Active tab: 'elements' | 'relationships'
type Tab = 'elements' | 'relationships';

export default function ElementPanel({
  nodes,
  edges,
  hiddenNodeIds,
  hiddenEdgeIds,
  onToggleNode,
  onToggleGroup,
  onToggleAll,
  onToggleEdge,
  onToggleEdgeGroup,
}: ElementPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [collapsedEdgeGroups, setCollapsedEdgeGroups] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<Tab>('elements');

  // Build a nodeId → display name index for edge label resolution
  const nodeIndex = new Map<string, string>(nodes.map((n) => [n.id, getNodeName(n)]));

  // Group nodes by kind
  const groups = nodes.reduce<Record<string, SNode[]>>((acc, node) => {
    const kind = getNodeKind(node);
    (acc[kind] ??= []).push(node);
    return acc;
  }, {});
  for (const kind of Object.keys(groups)) {
    groups[kind].sort((a, b) => getNodeName(a).localeCompare(getNodeName(b)));
  }

  // Group edges by kind
  const edgeGroups = edges.reduce<Record<string, SEdge[]>>((acc, edge) => {
    const kind = getEdgeKind(edge);
    (acc[kind] ??= []).push(edge);
    return acc;
  }, {});

  const allVisible = nodes.every((n) => !hiddenNodeIds.has(n.id));

  const toggleGroupCollapse = (kind: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(kind) ? next.delete(kind) : next.add(kind);
      return next;
    });
  };

  const toggleEdgeGroupCollapse = (kind: string) => {
    setCollapsedEdgeGroups((prev) => {
      const next = new Set(prev);
      next.has(kind) ? next.delete(kind) : next.add(kind);
      return next;
    });
  };

  const allGroupsCollapsed = Object.keys(groups).length > 0 &&
    Object.keys(groups).every((k) => collapsedGroups.has(k));

  const collapseAll = () => setCollapsedGroups(new Set(Object.keys(groups)));
  const expandAll   = () => setCollapsedGroups(new Set());

  const allEdgesVisible = edges.every((e) => !hiddenEdgeIds.has(e.id));
  const toggleAllEdges = (visible: boolean) => {
    onToggleEdgeGroup(edges.map((e) => e.id), visible);
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
      width: 210, flexShrink: 0, background: '#252526', borderRight: '1px solid #3c3c3c',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', fontSize: 12,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 8px', borderBottom: '1px solid #3c3c3c', background: '#2d2d2d', flexShrink: 0,
      }}>
        <span style={{ color: '#ccc', fontWeight: 600, fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {tab === 'elements' ? 'Elements' : 'Relationships'}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {tab === 'elements' ? (
            <>
              <button onClick={() => onToggleAll(true)}  title="Show all elements"  style={btnStyle}>All</button>
              <button onClick={() => onToggleAll(false)} title="Hide all elements"  style={btnStyle}>None</button>
              <button
                onClick={allGroupsCollapsed ? expandAll : collapseAll}
                title={allGroupsCollapsed ? 'Expand all groups' : 'Collapse all groups'}
                style={btnStyle}
              >{allGroupsCollapsed ? '▶▶' : '▼▼'}</button>
            </>
          ) : (
            <>
              <button onClick={() => toggleAllEdges(true)}  title="Show all relationships" style={btnStyle}>All</button>
              <button onClick={() => toggleAllEdges(false)} title="Hide all relationships" style={btnStyle}>None</button>
              <button
                onClick={() => {
                  const allKinds = Object.keys(edgeGroups);
                  const allCollapsed = allKinds.every((k) => collapsedEdgeGroups.has(k));
                  setCollapsedEdgeGroups(allCollapsed ? new Set() : new Set(allKinds));
                }}
                title="Collapse / expand all groups"
                style={btnStyle}
              >{Object.keys(edgeGroups).every((k) => collapsedEdgeGroups.has(k)) ? '▶▶' : '▼▼'}</button>
            </>
          )}
          <button
            onClick={() => setCollapsed(true)}
            title="Collapse panel"
            style={{ ...btnStyle, fontSize: 14 }}
          >&#8249;</button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid #3c3c3c', flexShrink: 0 }}>
        {(['elements', 'relationships'] as Tab[]).map((t) => (
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

      {/* Elements tab */}
      {tab === 'elements' && (
        nodes.length === 0 ? (
          <div style={{ padding: 12, color: '#555', fontStyle: 'italic' }}>
            No elements detected.<br />Start typing SysML.
          </div>
        ) : (
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {Object.entries(groups).sort(([a], [b]) => (KIND_LABELS[a] ?? a).localeCompare(KIND_LABELS[b] ?? b)).map(([kind, groupNodes]) => {
              const color = KIND_COLORS[kind] ?? KIND_COLORS.default;
              const label = KIND_LABELS[kind] ?? kind;
              const groupHidden = groupNodes.every((n) => hiddenNodeIds.has(n.id));
              const groupAllVisible = groupNodes.every((n) => !hiddenNodeIds.has(n.id));
              const isGroupCollapsed = collapsedGroups.has(kind);

              return (
                <div key={kind}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 8px', borderBottom: '1px solid #2a2a2a',
                    background: '#2a2a2a', cursor: 'pointer', userSelect: 'none',
                  }}>
                    <span
                      onClick={() => toggleGroupCollapse(kind)}
                      style={{ color: '#888', fontSize: 10, width: 10, display: 'inline-block' }}
                    >{isGroupCollapsed ? '▶' : '▼'}</span>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
                    <span
                      onClick={() => toggleGroupCollapse(kind)}
                      style={{ flex: 1, color: '#bbb', fontWeight: 600 }}
                    >{label} ({groupNodes.length})</span>
                    <input
                      type="checkbox"
                      checked={groupAllVisible}
                      ref={(el) => { if (el) el.indeterminate = !groupHidden && !groupAllVisible; }}
                      onChange={(e) => onToggleGroup(groupNodes.map((n) => n.id), e.target.checked)}
                      style={{ cursor: 'pointer', accentColor: color }}
                      title={groupAllVisible ? 'Hide group' : 'Show group'}
                    />
                  </div>
                  {!isGroupCollapsed && groupNodes.map((node) => {
                    const name = getNodeName(node);
                    const visible = !hiddenNodeIds.has(node.id);
                    return (
                      <div
                        key={node.id}
                        onClick={() => onToggleNode(node.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '4px 8px 4px 24px', cursor: 'pointer',
                          borderBottom: '1px solid #222',
                          background: visible ? 'transparent' : '#1a1a1a',
                          opacity: visible ? 1 : 0.45,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#2a3a4a')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = visible ? 'transparent' : '#1a1a1a')}
                      >
                        <input
                          type="checkbox"
                          checked={visible}
                          onChange={() => onToggleNode(node.id)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ cursor: 'pointer', accentColor: color, flexShrink: 0 }}
                        />
                        <span style={{
                          color: visible ? '#ddd' : '#555',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          fontFamily: 'monospace',
                        }}>
                          {name}
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
                const groupAllVisible = kindEdges.every((e) => !hiddenEdgeIds.has(e.id));
                const groupAllHidden  = kindEdges.every((e) =>  hiddenEdgeIds.has(e.id));
                const isGroupCollapsed = collapsedEdgeGroups.has(kind);

                return (
                  <div key={kind}>
                    {/* Edge group header */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '5px 8px', borderBottom: '1px solid #2a2a2a',
                      background: '#2a2a2a', cursor: 'pointer', userSelect: 'none',
                    }}>
                      <span
                        onClick={() => toggleEdgeGroupCollapse(kind)}
                        style={{ color: '#888', fontSize: 10, width: 10, display: 'inline-block' }}
                      >{isGroupCollapsed ? '▶' : '▼'}</span>
                      {/* Edge kind indicator: a short line segment */}
                      <svg width={18} height={10} style={{ flexShrink: 0 }}>
                        <line
                          x1={0} y1={5} x2={18} y2={5}
                          stroke={color} strokeWidth={1.5}
                          strokeDasharray={kind === 'flow' ? '4,2' : kind === 'typereference' ? '2,2' : undefined}
                        />
                      </svg>
                      <span
                        onClick={() => toggleEdgeGroupCollapse(kind)}
                        style={{ flex: 1, color: '#bbb', fontWeight: 600 }}
                      >{label} ({kindEdges.length})</span>
                      <input
                        type="checkbox"
                        checked={groupAllVisible}
                        ref={(el) => { if (el) el.indeterminate = !groupAllHidden && !groupAllVisible; }}
                        onChange={(e) => onToggleEdgeGroup(kindEdges.map((e) => e.id), e.target.checked)}
                        style={{ cursor: 'pointer', accentColor: color }}
                        title={groupAllVisible ? 'Hide all' : 'Show all'}
                      />
                    </div>

                    {/* Individual edges — sorted alphabetically by display label */}
                    {!isGroupCollapsed && [...kindEdges].sort((a, b) =>
                      getEdgeLabel(a, nodeIndex).localeCompare(getEdgeLabel(b, nodeIndex))
                    ).map((edge) => {
                      const visible = !hiddenEdgeIds.has(edge.id);
                      const displayLabel = getEdgeLabel(edge, nodeIndex);
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
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#2a3a4a')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = visible ? 'transparent' : '#1a1a1a')}
                        >
                          <input
                            type="checkbox"
                            checked={visible}
                            onChange={() => onToggleEdge(edge.id)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ cursor: 'pointer', accentColor: color, flexShrink: 0 }}
                          />
                          <span style={{
                            color: visible ? '#ccc' : '#555',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            fontFamily: 'monospace', fontSize: 11,
                          }}>
                            {displayLabel}
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
