import React, { useState } from 'react';
import { useTheme } from '../../store/theme.js';
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
        <div style={{ ...base, border: '1.5px solid #3a6a9a', background: '#d0e4f8', color: '#1a4a7a' }}>
          def
        </div>
      );
    case 'usage':
      return (
        <div style={{ ...base, border: '1.5px solid #2a8a70', background: '#d0f0e8', color: '#1a6a50', borderRadius: 5 }}>
          part
        </div>
      );
    case 'attribute':
      return (
        <div style={{ ...base, border: '1px solid #ccc', background: '#f0f0f0', color: '#666', height: 16 }}>
          + attr
        </div>
      );
    case 'port':
      return (
        <div style={{ ...base, border: '1.5px solid #9a6ab0', background: '#f0e0f8', color: '#6a3a8a' }}>
          port
        </div>
      );
    case 'item':
      return (
        <div style={{ ...base, border: '1.5px solid #b07040', background: '#f8e8d8', color: '#7a4020' }}>
          item
        </div>
      );
    case 'edge-generalization':
      return (
        <div style={{ width: 40, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="40" height="22" viewBox="0 0 40 22">
            <line x1="4" y1="11" x2="28" y2="11" stroke="#3a6a9a" strokeWidth="1.5" />
            <polygon points="28,5 38,11 28,17" fill="none" stroke="#3a6a9a" strokeWidth="1.5" />
          </svg>
        </div>
      );
    case 'edge-composition':
      return (
        <div style={{ width: 40, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="40" height="22" viewBox="0 0 40 22">
            <line x1="14" y1="11" x2="38" y2="11" stroke="#3a6a9a" strokeWidth="1.5" />
            <polygon points="2,11 10,6 18,11 10,16" fill="#3a6a9a" />
          </svg>
        </div>
      );
    case 'edge-subsetting':
      return (
        <div style={{ width: 40, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="40" height="22" viewBox="0 0 40 22">
            <line x1="4" y1="11" x2="28" y2="11" stroke="#7a7a7a" strokeWidth="1.5" />
            <polygon points="28,5 38,11 28,17" fill="none" stroke="#7a7a7a" strokeWidth="1.5" />
          </svg>
        </div>
      );
    case 'edge-redefinition':
      return (
        <div style={{ width: 40, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="40" height="22" viewBox="0 0 40 22">
            <line x1="4" y1="11" x2="28" y2="11" stroke="#7a7a7a" strokeWidth="1.5" />
            <polygon points="28,5 38,11 28,17" fill="none" stroke="#7a7a7a" strokeWidth="1.5" />
          </svg>
        </div>
      );
    case 'enum':
      return (
        <div style={{ ...base, border: '1.5px solid #9a9040', background: '#f8f0d0', color: '#6a6020' }}>
          enum
        </div>
      );
    case 'action':
      return (
        <div style={{ ...base, border: '1.5px solid #2a8ab0', background: '#d0f0ff', color: '#1a5a7a', borderRadius: 8 }}>
          act
        </div>
      );
    case 'state':
      return (
        <div style={{ ...base, border: '1.5px solid #9a5a9a', background: '#f0e0f0', color: '#6a2a6a', borderRadius: 10 }}>
          state
        </div>
      );
    case 'requirement':
      return (
        <div style={{ ...base, border: '1.5px solid #c04030', background: '#fce8e4', color: '#8a2020' }}>
          req
        </div>
      );
    case 'constraint':
      return (
        <div style={{ ...base, border: '1.5px solid #6a8a4a', background: '#e8f0d8', color: '#3a5a20' }}>
          cst
        </div>
      );
    case 'connection':
      return (
        <div style={{ width: 40, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="40" height="22" viewBox="0 0 40 22">
            <line x1="4" y1="11" x2="36" y2="11" stroke="#3a6a9a" strokeWidth="1.5" />
            <circle cx="4" cy="11" r="3" fill="#3a6a9a" />
            <circle cx="36" cy="11" r="3" fill="#3a6a9a" />
          </svg>
        </div>
      );
    case 'interface':
      return (
        <div style={{ ...base, border: '1.5px solid #7a5aaa', background: '#ece0f8', color: '#5a3a8a' }}>
          ifc
        </div>
      );
    case 'allocation':
      return (
        <div style={{ ...base, border: '1.5px solid #a08040', background: '#f8f0d8', color: '#6a5020' }}>
          alloc
        </div>
      );
    case 'occurrence':
      return (
        <div style={{ ...base, border: '1.5px solid #5a8a5a', background: '#e0f0e0', color: '#2a5a2a' }}>
          occ
        </div>
      );
    case 'individual':
      return (
        <div style={{ ...base, border: '1.5px solid #5a8a5a', background: '#e0f0e0', color: '#2a5a2a', fontWeight: 700 }}>
          ind
        </div>
      );
    case 'snapshot':
      return (
        <div style={{ ...base, border: '1.5px dashed #5a8a5a', background: '#e8f8e8', color: '#2a5a2a' }}>
          snap
        </div>
      );
    case 'timeslice':
      return (
        <div style={{ ...base, border: '1.5px solid #5a8a5a', background: '#e8f8e8', color: '#2a5a2a', borderStyle: 'double' }}>
          time
        </div>
      );
    case 'metadata':
      return (
        <div style={{ ...base, border: '1.5px solid #8a5a8a', background: '#f0e0f0', color: '#5a3a5a' }}>
          meta
        </div>
      );
    case 'concern':
      return (
        <div style={{ ...base, border: '1.5px solid #a08060', background: '#f8f0e0', color: '#6a5030' }}>
          con
        </div>
      );
    case 'verification':
      return (
        <div style={{ ...base, border: '1.5px solid #7a5a9a', background: '#ece0f8', color: '#5a3a7a' }}>
          ver
        </div>
      );
    case 'analysis':
      return (
        <div style={{ ...base, border: '1.5px solid #5a7a9a', background: '#e0f0f8', color: '#3a5a7a' }}>
          ana
        </div>
      );
    case 'calculation':
      return (
        <div style={{ ...base, border: '1.5px solid #3a8a9a', background: '#d8f0f8', color: '#1a5a6a' }}>
          calc
        </div>
      );
    case 'package':
      return (
        <div style={{ ...base, border: '1.5px solid #999', background: '#f0f0f0', color: '#666', height: 22, position: 'relative' as const }}>
          <div style={{ position: 'absolute', top: -4, left: 2, fontSize: 6, background: '#f0f0f0', padding: '0 2px', border: '1px solid #999', borderRadius: 1 }}>pkg</div>
          <span style={{ fontSize: 8 }}>{ }</span>
        </div>
      );
    case 'usecase':
      return (
        <div style={{ ...base, border: '1.5px solid #a08830', background: '#f8f0d0', color: '#6a5810', borderRadius: 11 }}>
          uc
        </div>
      );
    case 'view':
      return (
        <div style={{ ...base, border: '1.5px dashed #999', background: '#f5f5f5', color: '#666' }}>
          view
        </div>
      );
    case 'edge-succession':
      return (
        <div style={{ width: 40, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="40" height="22" viewBox="0 0 40 22">
            <line x1="4" y1="11" x2="30" y2="11" stroke="#2a8ab0" strokeWidth="1.5" />
            <polygon points="30,7 38,11 30,15" fill="#2a8ab0" />
          </svg>
        </div>
      );
    case 'edge-satisfy':
      return (
        <div style={{ width: 40, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="40" height="22" viewBox="0 0 40 22">
            <line x1="4" y1="11" x2="30" y2="11" stroke="#c04030" strokeWidth="1.5" strokeDasharray="4 2" />
            <polygon points="30,7 38,11 30,15" fill="#c04030" />
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
  const t = useTheme();
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
              borderBottom: `1px solid ${t.borderLight}`,
              background: expanded ? t.bgSelected : 'transparent',
            }}
            onMouseEnter={(e) => {
              if (!expanded) (e.currentTarget as HTMLElement).style.background = t.bgHover;
            }}
            onMouseLeave={(e) => {
              if (!expanded) (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShapePreview shapeType={item.shapeType} />
              <span style={{ fontSize: 12, color: t.text, flex: 1 }}>{item.label}</span>
              <span style={{ fontSize: 9, color: t.textDim }}>{expanded ? '▲' : '▼'}</span>
            </div>

            {expanded && (
              <div style={{ marginTop: 8, paddingLeft: 2 }}>
                <div style={{ fontSize: 11, color: t.textSecondary, lineHeight: 1.5, marginBottom: 6 }}>
                  {item.explanation}
                </div>
                <div style={{
                  fontFamily: 'monospace', fontSize: 11, color: '#0000ff',
                  background: t.codeBg, borderRadius: 3,
                  padding: '5px 8px', border: `1px solid ${t.border}`,
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
          borderTop: `1px solid ${t.borderLight}`,
          marginTop: 2,
        }}>
          <div style={{ fontSize: 10, color: t.textDim, fontStyle: 'italic' }}>
            {locked.length} element{locked.length > 1 ? 's' : ''} unlock in later levels
          </div>
        </div>
      )}
    </div>
  );
}
