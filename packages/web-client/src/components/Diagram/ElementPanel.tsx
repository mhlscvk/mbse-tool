import React, { useState } from 'react';
import type { SNode } from '@systemodel/shared-types';

interface ElementPanelProps {
  nodes: SNode[];
  hiddenNodeIds: Set<string>;
  onToggleNode: (id: string) => void;
  onToggleGroup: (ids: string[], visible: boolean) => void;
  onToggleAll: (visible: boolean) => void;
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

function getNodeName(node: SNode): string {
  const label = node.children.find((c) => c.id.endsWith('__label'));
  return label?.text ?? node.id;
}

function getNodeKind(node: SNode): string {
  return node.cssClasses?.[0] ?? 'default';
}

export default function ElementPanel({
  nodes,
  hiddenNodeIds,
  onToggleNode,
  onToggleGroup,
  onToggleAll,
}: ElementPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Group nodes by kind, sorted by name within each group
  const groups = nodes.reduce<Record<string, SNode[]>>((acc, node) => {
    const kind = getNodeKind(node);
    (acc[kind] ??= []).push(node);
    return acc;
  }, {});
  for (const kind of Object.keys(groups)) {
    groups[kind].sort((a, b) => getNodeName(a).localeCompare(getNodeName(b)));
  }

  const allVisible = nodes.every((n) => !hiddenNodeIds.has(n.id));
  const anyVisible = nodes.some((n) => !hiddenNodeIds.has(n.id));

  const toggleGroupCollapse = (kind: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(kind) ? next.delete(kind) : next.add(kind);
      return next;
    });
  };

  const allGroupsCollapsed = Object.keys(groups).length > 0 &&
    Object.keys(groups).every((k) => collapsedGroups.has(k));

  const collapseAll  = () => setCollapsedGroups(new Set(Object.keys(groups)));
  const expandAll    = () => setCollapsedGroups(new Set());

  if (collapsed) {
    return (
      <div style={{
        width: 28, background: '#252526', borderRight: '1px solid #3c3c3c',
        display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 8, flexShrink: 0,
      }}>
        <button
          onClick={() => setCollapsed(false)}
          title="Show elements panel"
          style={{
            background: 'none', border: 'none', color: '#ccc', cursor: 'pointer',
            fontSize: 16, padding: 4, lineHeight: 1,
          }}
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
          Elements
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => onToggleAll(true)}  title="Show all elements"  style={btnStyle}>All</button>
          <button onClick={() => onToggleAll(false)} title="Hide all elements"  style={btnStyle}>None</button>
          <button
            onClick={allGroupsCollapsed ? expandAll : collapseAll}
            title={allGroupsCollapsed ? 'Expand all groups' : 'Collapse all groups'}
            style={btnStyle}
          >{allGroupsCollapsed ? '▶▶' : '▼▼'}</button>
          <button
            onClick={() => setCollapsed(true)}
            title="Collapse panel"
            style={{ ...btnStyle, fontSize: 14 }}
          >&#8249;</button>
        </div>
      </div>

      {nodes.length === 0 ? (
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
                {/* Group header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 8px', borderBottom: '1px solid #2a2a2a',
                  background: '#2a2a2a', cursor: 'pointer', userSelect: 'none',
                }}>
                  <span
                    onClick={() => toggleGroupCollapse(kind)}
                    style={{ color: '#888', fontSize: 10, width: 10, display: 'inline-block' }}
                  >{isGroupCollapsed ? '▶' : '▼'}</span>
                  <span
                    style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }}
                  />
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

                {/* Group items */}
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
