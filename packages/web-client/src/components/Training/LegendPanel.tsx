import React, { useState } from 'react';
import { LEGEND_ITEMS } from '../../training/tasks.js';
import type { LegendItem, LegendShapeType } from '../../training/tasks.js';

// ─── Shape preview SVG ────────────────────────────────────────────────────────

function ShapePreview({ shapeType }: { shapeType: LegendShapeType }) {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 22,
    fontSize: 9,
    fontFamily: 'monospace',
    flexShrink: 0,
    borderRadius: 2,
  };

  switch (shapeType) {
    case 'definition':
      return (
        <div style={{ ...base, border: '1.5px solid #569cd6', background: '#1c3f6e', color: '#9cdcfe' }}>
          def
        </div>
      );
    case 'usage':
      return (
        <div style={{ ...base, border: '1.5px solid #4ec9b0', background: '#0a2040', color: '#4ec9b0', borderRadius: 5 }}>
          part
        </div>
      );
    case 'attribute':
      return (
        <div style={{ ...base, border: '1px solid #444', background: '#252526', color: '#888', height: 16 }}>
          + attr
        </div>
      );
    case 'port':
      return (
        <div style={{ ...base, border: '1.5px solid #c586c0', background: '#2a0a3a', color: '#c586c0' }}>
          port
        </div>
      );
    case 'item':
      return (
        <div style={{ ...base, border: '1.5px solid #ce9178', background: '#3a1a08', color: '#ce9178' }}>
          item
        </div>
      );
    case 'edge-generalization':
      return (
        <div style={{ width: 40, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="40" height="22" viewBox="0 0 40 22">
            <line x1="4" y1="11" x2="28" y2="11" stroke="#9cdcfe" strokeWidth="1.5" />
            <polygon points="28,5 38,11 28,17" fill="none" stroke="#9cdcfe" strokeWidth="1.5" />
          </svg>
        </div>
      );
    case 'edge-composition':
      return (
        <div style={{ width: 40, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="40" height="22" viewBox="0 0 40 22">
            <line x1="14" y1="11" x2="38" y2="11" stroke="#9cdcfe" strokeWidth="1.5" />
            <polygon points="2,11 10,6 18,11 10,16" fill="#9cdcfe" />
          </svg>
        </div>
      );
    case 'edge-subsetting':
      return (
        <div style={{ width: 40, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="40" height="22" viewBox="0 0 40 22">
            <line x1="4" y1="11" x2="28" y2="11" stroke="#9e9e9e" strokeWidth="1.5" />
            <polygon points="28,5 38,11 28,17" fill="none" stroke="#9e9e9e" strokeWidth="1.5" />
          </svg>
        </div>
      );
    case 'edge-redefinition':
      return (
        <div style={{ width: 40, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="40" height="22" viewBox="0 0 40 22">
            <line x1="4" y1="11" x2="28" y2="11" stroke="#9e9e9e" strokeWidth="1.5" />
            <polygon points="28,5 38,11 28,17" fill="none" stroke="#9e9e9e" strokeWidth="1.5" />
          </svg>
        </div>
      );
    case 'enum':
      return (
        <div style={{ ...base, border: '1.5px solid #dcdcaa', background: '#2a2a08', color: '#dcdcaa' }}>
          enum
        </div>
      );
    case 'action':
      return (
        <div style={{ ...base, border: '1.5px solid #4fc1ff', background: '#0a2040', color: '#4fc1ff', borderRadius: 8 }}>
          act
        </div>
      );
    case 'state':
      return (
        <div style={{ ...base, border: '1.5px solid #c586c0', background: '#2a0a2a', color: '#c586c0', borderRadius: 10 }}>
          state
        </div>
      );
    case 'requirement':
      return (
        <div style={{ ...base, border: '1.5px solid #f48771', background: '#2a0e0e', color: '#f48771' }}>
          req
        </div>
      );
    case 'constraint':
      return (
        <div style={{ ...base, border: '1.5px solid #b5cea8', background: '#1a2a1a', color: '#b5cea8' }}>
          cst
        </div>
      );
    case 'connection':
      return (
        <div style={{ width: 40, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="40" height="22" viewBox="0 0 40 22">
            <line x1="4" y1="11" x2="36" y2="11" stroke="#569cd6" strokeWidth="1.5" />
            <circle cx="4" cy="11" r="3" fill="#569cd6" />
            <circle cx="36" cy="11" r="3" fill="#569cd6" />
          </svg>
        </div>
      );
    case 'interface':
      return (
        <div style={{ ...base, border: '1.5px solid #9070c0', background: '#2a1a5a', color: '#c0a0e0' }}>
          ifc
        </div>
      );
    case 'allocation':
      return (
        <div style={{ ...base, border: '1.5px solid #c0a060', background: '#4a3010', color: '#d8c070' }}>
          alloc
        </div>
      );
    case 'occurrence':
      return (
        <div style={{ ...base, border: '1.5px solid #80b080', background: '#2a3a2a', color: '#a0d0a0' }}>
          occ
        </div>
      );
    case 'metadata':
      return (
        <div style={{ ...base, border: '1.5px solid #b080b0', background: '#3a2a3a', color: '#c0a0c0' }}>
          meta
        </div>
      );
    case 'concern':
      return (
        <div style={{ ...base, border: '1.5px solid #c0a080', background: '#4a3a2a', color: '#d8c0a0' }}>
          con
        </div>
      );
    case 'verification':
      return (
        <div style={{ ...base, border: '1.5px solid #a080c0', background: '#3a2a4a', color: '#c0a0e0' }}>
          ver
        </div>
      );
    case 'analysis':
      return (
        <div style={{ ...base, border: '1.5px solid #80a0c0', background: '#2a3a4a', color: '#a0c0e0' }}>
          ana
        </div>
      );
    case 'calculation':
      return (
        <div style={{ ...base, border: '1.5px solid #60b0c0', background: '#0a3a4a', color: '#90d0e0' }}>
          calc
        </div>
      );
    case 'package':
      return (
        <div style={{ ...base, border: '1.5px solid #888', background: '#1e1e1e', color: '#888', height: 22, position: 'relative' as const }}>
          <div style={{ position: 'absolute', top: -4, left: 2, fontSize: 6, background: '#1e1e1e', padding: '0 2px', border: '1px solid #888', borderRadius: 1 }}>pkg</div>
          <span style={{ fontSize: 8 }}>{ }</span>
        </div>
      );
    case 'usecase':
      return (
        <div style={{ ...base, border: '1.5px solid #d7ba7d', background: '#2a2008', color: '#d7ba7d', borderRadius: 11 }}>
          uc
        </div>
      );
    case 'view':
      return (
        <div style={{ ...base, border: '1.5px dashed #888', background: '#1e1e1e', color: '#999' }}>
          view
        </div>
      );
    case 'edge-succession':
      return (
        <div style={{ width: 40, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="40" height="22" viewBox="0 0 40 22">
            <line x1="4" y1="11" x2="30" y2="11" stroke="#4fc1ff" strokeWidth="1.5" />
            <polygon points="30,7 38,11 30,15" fill="#4fc1ff" />
          </svg>
        </div>
      );
    case 'edge-satisfy':
      return (
        <div style={{ width: 40, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="40" height="22" viewBox="0 0 40 22">
            <line x1="4" y1="11" x2="30" y2="11" stroke="#f48771" strokeWidth="1.5" strokeDasharray="4 2" />
            <polygon points="30,7 38,11 30,15" fill="#f48771" />
          </svg>
        </div>
      );
    default:
      return <div style={{ width: 40, flexShrink: 0 }} />;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface LegendPanelProps {
  currentLevel: number;
}

export default function LegendPanel({ currentLevel }: LegendPanelProps) {
  const [expandedLabel, setExpandedLabel] = useState<string | null>(null);

  const visible = LEGEND_ITEMS.filter((item) => item.minLevel <= currentLevel);
  const locked = LEGEND_ITEMS.filter((item) => item.minLevel > currentLevel);

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{
        fontSize: 10, fontWeight: 600, color: '#666',
        textTransform: 'uppercase', letterSpacing: 0.8,
        padding: '8px 12px 4px',
      }}>
        Notation Reference
      </div>

      {visible.map((item: LegendItem) => {
        const expanded = expandedLabel === item.label;
        return (
          <div
            key={item.label}
            onClick={() => setExpandedLabel(expanded ? null : item.label)}
            style={{
              padding: '6px 12px',
              cursor: 'pointer',
              borderBottom: '1px solid #222',
              background: expanded ? '#2a2d2e' : 'transparent',
            }}
            onMouseEnter={(e) => {
              if (!expanded) (e.currentTarget as HTMLElement).style.background = '#252526';
            }}
            onMouseLeave={(e) => {
              if (!expanded) (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShapePreview shapeType={item.shapeType} />
              <span style={{ fontSize: 12, color: '#d4d4d4', flex: 1 }}>{item.label}</span>
              <span style={{ fontSize: 9, color: '#444' }}>{expanded ? '▲' : '▼'}</span>
            </div>

            {expanded && (
              <div style={{ marginTop: 8, paddingLeft: 2 }}>
                <div style={{ fontSize: 11, color: '#999', lineHeight: 1.5, marginBottom: 6 }}>
                  {item.explanation}
                </div>
                <div style={{
                  fontFamily: 'monospace', fontSize: 11, color: '#9cdcfe',
                  background: '#1e1e1e', borderRadius: 3,
                  padding: '5px 8px', border: '1px solid #333',
                  whiteSpace: 'pre',
                }}>
                  {item.textualSyntax}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {locked.length > 0 && (
        <div style={{
          padding: '6px 12px',
          borderTop: '1px solid #2a2a2a',
          marginTop: 2,
        }}>
          <div style={{ fontSize: 10, color: '#444', fontStyle: 'italic' }}>
            {locked.length} element{locked.length > 1 ? 's' : ''} unlock in later levels
          </div>
        </div>
      )}
    </div>
  );
}
