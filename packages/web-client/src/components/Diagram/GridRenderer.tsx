import React, { useMemo, useState } from 'react';
import type { SModelRoot, SNode, SEdge } from '@systemodel/shared-types';
import { useTheme } from '../../store/theme.js';

interface GridRendererProps {
  model: SModelRoot | null;
  onNodeSelect?: (nodeId: string) => void;
}

type RelKind = 'satisfy' | 'verify' | 'allocate' | 'dependency' | 'flow' | 'composition' | 'typereference';

const REL_TABS: { key: RelKind | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'satisfy', label: 'Satisfy' },
  { key: 'verify', label: 'Verify' },
  { key: 'allocate', label: 'Allocate' },
  { key: 'dependency', label: 'Specialization' },
  { key: 'flow', label: 'Flow' },
];

const REL_SYMBOLS: Record<string, string> = {
  satisfy: '✓',
  verify: 'V',
  allocate: '→',
  dependency: '▷',
  flow: '⇒',
  composition: '◆',
  typereference: ':',
};

const REL_COLORS: Record<string, string> = {
  satisfy: '#e06060',
  verify: '#60b060',
  allocate: '#c0a060',
  dependency: '#9e9e9e',
  flow: '#4ec9b0',
  composition: '#9cdcfe',
  typereference: '#6a7a8a',
};

export default function GridRenderer({ model, onNodeSelect }: GridRendererProps) {
  const t = useTheme();
  const [activeTab, setActiveTab] = useState<RelKind | 'all'>('all');

  const { rowNodes, colNodes, matrix } = useMemo(() => {
    if (!model) return { rowNodes: [] as SNode[], colNodes: [] as SNode[], matrix: new Map<string, Map<string, string[]>>() };

    const nodes = model.children.filter((c): c is SNode => c.type === 'node');
    const edges = model.children.filter((c): c is SEdge => c.type === 'edge');
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // Filter edges by active tab
    const relEdges = edges.filter(e => {
      const kind = e.cssClasses?.[0] ?? '';
      if (kind === 'composition' || kind === 'noncomposite') return false; // skip structural
      if (activeTab === 'all') return true;
      return kind === activeTab;
    });

    // Build matrix
    const mat = new Map<string, Map<string, string[]>>();
    const rowSet = new Set<string>();
    const colSet = new Set<string>();

    for (const e of relEdges) {
      if (!nodeMap.has(e.sourceId) || !nodeMap.has(e.targetId)) continue;
      rowSet.add(e.sourceId);
      colSet.add(e.targetId);
      if (!mat.has(e.sourceId)) mat.set(e.sourceId, new Map());
      const row = mat.get(e.sourceId)!;
      if (!row.has(e.targetId)) row.set(e.targetId, []);
      row.get(e.targetId)!.push(e.cssClasses?.[0] ?? 'association');
    }

    const rNodes = [...rowSet].map(id => nodeMap.get(id)!).filter(Boolean).slice(0, 50);
    const cNodes = [...colSet].map(id => nodeMap.get(id)!).filter(Boolean).slice(0, 50);

    return { rowNodes: rNodes, colNodes: cNodes, matrix: mat };
  }, [model, activeTab]);

  const getName = (n: SNode) => n.children.find(c => c.id.endsWith('__label'))?.text ?? n.id.split('__').pop() ?? '';
  const getKind = (n: SNode) => n.children.find(c => c.id.endsWith('__kind'))?.text ?? '';

  const bg = '#ffffff';
  const headerBg = '#f0f0f8';
  const cellBorder = '#ddd';
  const hoverBg = '#e8e8f0';

  if (!model) {
    return <div style={{ padding: 40, color: t.textSecondary, textAlign: 'center' }}>No model data for Grid View</div>;
  }

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'auto', background: bg, padding: 8 }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 8, flexWrap: 'wrap' }}>
        {REL_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              background: activeTab === tab.key ? t.statusBar : ('#e0e0e8'),
              color: activeTab === tab.key ? '#fff' : t.text,
              border: 'none', borderRadius: 3, padding: '4px 10px', fontSize: 11,
              cursor: 'pointer', fontWeight: activeTab === tab.key ? 700 : 400,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {rowNodes.length === 0 || colNodes.length === 0 ? (
        <div style={{ padding: 40, color: t.textSecondary, textAlign: 'center', fontSize: 13 }}>
          No relationships found{activeTab !== 'all' ? ` for "${activeTab}"` : ''}. Add satisfy, verify, allocate, or flow relationships to see the matrix.
        </div>
      ) : (
        <div style={{ overflow: 'auto', maxHeight: 'calc(100% - 40px)' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, top: 0, zIndex: 2, background: headerBg, border: `1px solid ${cellBorder}`, padding: '4px 8px', minWidth: 120 }}>
                  Source ↓ / Target →
                </th>
                {colNodes.map(cn => (
                  <th
                    key={cn.id}
                    onClick={() => onNodeSelect?.(cn.id)}
                    style={{
                      position: 'sticky', top: 0, zIndex: 1,
                      background: headerBg, border: `1px solid ${cellBorder}`,
                      padding: '4px 6px', cursor: 'pointer', whiteSpace: 'nowrap',
                      maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis',
                      writingMode: 'vertical-rl', textOrientation: 'mixed', height: 100,
                      color: t.text, fontWeight: 500,
                    }}
                    title={`${getName(cn)} ${getKind(cn)}`}
                  >
                    {getName(cn)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowNodes.map(rn => (
                <tr key={rn.id}>
                  <td
                    onClick={() => onNodeSelect?.(rn.id)}
                    style={{
                      position: 'sticky', left: 0, zIndex: 1,
                      background: headerBg, border: `1px solid ${cellBorder}`,
                      padding: '4px 8px', cursor: 'pointer', fontWeight: 500,
                      whiteSpace: 'nowrap', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis',
                      color: t.text,
                    }}
                    title={`${getName(rn)} ${getKind(rn)}`}
                  >
                    {getName(rn)}
                  </td>
                  {colNodes.map(cn => {
                    const rels = matrix.get(rn.id)?.get(cn.id) ?? [];
                    return (
                      <td
                        key={cn.id}
                        style={{
                          border: `1px solid ${cellBorder}`,
                          padding: '2px 4px', textAlign: 'center', minWidth: 28,
                          background: rels.length > 0 ? ('#f0f0ff') : 'transparent',
                        }}
                        title={rels.join(', ')}
                      >
                        {rels.map((rel, i) => (
                          <span key={i} style={{ color: REL_COLORS[rel] ?? t.text, fontWeight: 700, fontSize: 12 }}>
                            {REL_SYMBOLS[rel] ?? '•'}
                          </span>
                        ))}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
