import React, { useMemo, useState, useCallback } from 'react';
import type { SModelRoot, SNode, SEdge } from '@systemodel/shared-types';
import { useTheme } from '../../store/theme.js';

interface BrowserRendererProps {
  model: SModelRoot | null;
  onNodeSelect?: (nodeId: string) => void;
  selectedNodeId?: string | null;
}

interface TreeNode {
  id: string;
  name: string;
  kind: string;
  cssClass: string;
  children: TreeNode[];
}

const KIND_ICONS: Record<string, string> = {
  package: 'P',
  partdefinition: 'PD', partusage: 'p',
  attributedefinition: 'AD', attributeusage: 'a',
  connectiondefinition: 'CD', connectionusage: 'c',
  portdefinition: 'PtD', portusage: 'pt',
  actiondefinition: 'AcD', actionusage: 'ac',
  statedefinition: 'SD', stateusage: 's',
  itemdefinition: 'ID', itemusage: 'i',
  requirementdefinition: 'RD', requirementusage: 'r',
  constraintdefinition: 'CnD', constraintusage: 'cn',
  interfacedefinition: 'IfD', interfaceusage: 'if',
  enumdefinition: 'ED', enumusage: 'e',
  calcdefinition: 'CaD', calcusage: 'ca',
  allocationdefinition: 'AlD', allocationusage: 'al',
  usecasedefinition: 'UCD', usecaseusage: 'uc',
  casedefinition: 'CsD', caseusage: 'cs',
  viewdefinition: 'VD', viewusage: 'v',
  flowdefinition: 'FD', flowusage: 'f',
  comment: '//.',
  alias: '→',
};

const KIND_COLORS: Record<string, string> = {
  package: '#6a6aaa',
  partdefinition: '#4a8ab0', partusage: '#4a8ab0',
  attributedefinition: '#4a8a4a', attributeusage: '#4a8a4a',
  actiondefinition: '#3a9a9a', actionusage: '#3a9a9a',
  statedefinition: '#8a8a3a', stateusage: '#8a8a3a',
  portdefinition: '#8a5aaa', portusage: '#8a5aaa',
  requirementdefinition: '#aa4a4a', requirementusage: '#aa4a4a',
  constraintdefinition: '#aa6a3a', constraintusage: '#aa6a3a',
};

export default function BrowserRenderer({ model, onNodeSelect, selectedNodeId }: BrowserRendererProps) {
  const t = useTheme();
  const isDark = t.mode === 'dark';
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');

  const tree = useMemo(() => {
    if (!model) return [] as TreeNode[];

    const nodes = model.children.filter((c): c is SNode => c.type === 'node');
    const edges = model.children.filter((c): c is SEdge => c.type === 'edge');

    // Build parent→children map from composition edges
    const childrenOf = new Map<string, string[]>();
    const hasParent = new Set<string>();
    for (const e of edges) {
      const kind = e.cssClasses?.[0] ?? '';
      if (kind === 'composition' || kind === 'noncomposite') {
        const kids = childrenOf.get(e.sourceId) ?? [];
        kids.push(e.targetId);
        childrenOf.set(e.sourceId, kids);
        hasParent.add(e.targetId);
      }
    }

    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    function buildTree(nodeId: string): TreeNode | null {
      const node = nodeMap.get(nodeId);
      if (!node) return null;
      const name = node.children.find(c => c.id.endsWith('__label'))?.text ?? node.id.split('__').pop() ?? '';
      const kind = node.children.find(c => c.id.endsWith('__kind'))?.text ?? '';
      const cssClass = node.cssClasses?.[0] ?? 'default';
      const childIds = childrenOf.get(nodeId) ?? [];
      const children = childIds.map(buildTree).filter(Boolean) as TreeNode[];
      return { id: nodeId, name, kind, cssClass, children };
    }

    // Root nodes = nodes without a parent
    const roots = nodes.filter(n => !hasParent.has(n.id));
    return roots.map(r => buildTree(r.id)).filter(Boolean) as TreeNode[];
  }, [model]);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const filterLower = filter.toLowerCase();

  function matchesFilter(node: TreeNode): boolean {
    if (!filterLower) return true;
    if (node.name.toLowerCase().includes(filterLower)) return true;
    if (node.kind.toLowerCase().includes(filterLower)) return true;
    return node.children.some(matchesFilter);
  }

  function renderNode(node: TreeNode, depth: number): React.ReactNode {
    if (!matchesFilter(node)) return null;
    const hasChildren = node.children.length > 0;
    const isCollapsed = collapsed.has(node.id);
    const isSelected = selectedNodeId === node.id;
    const icon = KIND_ICONS[node.cssClass] ?? '•';
    const color = KIND_COLORS[node.cssClass] ?? (isDark ? '#888' : '#666');

    return (
      <div key={node.id}>
        <div
          onClick={() => onNodeSelect?.(node.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '2px 6px', paddingLeft: 6 + depth * 16,
            cursor: 'pointer',
            background: isSelected ? (isDark ? '#2a3a5a' : '#d0d8f0') : 'transparent',
            borderRadius: 2,
          }}
          onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = isDark ? '#252540' : '#f0f0f8'; }}
          onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
        >
          {/* Expand/collapse toggle */}
          <span
            onClick={e => { e.stopPropagation(); if (hasChildren) toggleCollapse(node.id); }}
            style={{ width: 14, textAlign: 'center', fontSize: 10, color: isDark ? '#888' : '#999', userSelect: 'none' }}
          >
            {hasChildren ? (isCollapsed ? '▶' : '▼') : ' '}
          </span>
          {/* Kind icon */}
          <span style={{
            fontSize: 9, fontWeight: 700, color: '#fff', background: color,
            borderRadius: 2, padding: '0 3px', minWidth: 18, textAlign: 'center',
            lineHeight: '16px',
          }}>
            {icon}
          </span>
          {/* Name */}
          <span style={{ fontSize: 12, color: t.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {node.name}
          </span>
          {/* Kind label */}
          <span style={{ fontSize: 9, color: isDark ? '#666' : '#aaa', flexShrink: 0 }}>
            {node.kind}
          </span>
        </div>
        {hasChildren && !isCollapsed && node.children.map(child => renderNode(child, depth + 1))}
      </div>
    );
  }

  if (!model) {
    return <div style={{ padding: 40, color: t.textSecondary, textAlign: 'center' }}>No model data for Browser View</div>;
  }

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: isDark ? '#1a1a2e' : '#fff' }}>
      {/* Search */}
      <div style={{ padding: '6px 8px', borderBottom: `1px solid ${isDark ? '#333' : '#ddd'}` }}>
        <input
          type="text"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filter elements..."
          style={{
            width: '100%', padding: '4px 8px', fontSize: 11,
            background: isDark ? '#252540' : '#f8f8ff',
            color: t.text, border: `1px solid ${isDark ? '#444' : '#ccc'}`,
            borderRadius: 3, outline: 'none',
          }}
        />
      </div>
      {/* Tree */}
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
        {tree.length === 0 ? (
          <div style={{ padding: 40, color: t.textSecondary, textAlign: 'center', fontSize: 13 }}>
            No model elements to display.
          </div>
        ) : (
          tree.map(node => renderNode(node, 0))
        )}
      </div>
    </div>
  );
}
