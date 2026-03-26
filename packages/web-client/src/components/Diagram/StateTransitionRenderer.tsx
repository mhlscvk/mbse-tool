import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import type { SModelRoot, SNode, SEdge } from '@systemodel/shared-types';
import { useTheme } from '../../store/theme.js';

interface StateTransitionRendererProps {
  model: SModelRoot | null;
  onNodeSelect?: (nodeId: string) => void;
  fitTrigger?: number;
}

// ── Data model ───────────────────────────────────────────────────────────────

interface STState {
  id: string;
  name: string;
  kind: 'simple' | 'composite' | 'pseudostate';
  pseudoKind?: 'initial' | 'final' | 'terminate' | 'fork' | 'join' | 'decision' | 'merge';
  stereotype?: string;       // «state def», «exhibit», etc.
  entryActions: string[];
  doActions: string[];
  exitActions: string[];
  isParallel: boolean;
  childIds: string[];
  x: number;
  y: number;
  w: number;
  h: number;
}

interface STTransition {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;             // trigger [guard] / effect
  isSelf: boolean;
}

// ── Constants ────────────────────────────────────────────────────────────────

const STATE_MIN_W = 140;
const STATE_H_BASE = 40;
const COMPARTMENT_H = 18;
const STATE_RADIUS = 12;
const PSEUDO_R = 10;
const BAR_W = 60;
const BAR_H = 6;
const PAD = 50;
const FRAME_PAD = 16;

// ── Component ────────────────────────────────────────────────────────────────

export default function StateTransitionRenderer({ model, onNodeSelect, fitTrigger }: StateTransitionRendererProps) {
  const t = useTheme();
  const isDark = t.mode === 'dark';
  const svgRef = useRef<SVGSVGElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const transformRef = useRef(transform);
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  const [hoveredTrans, setHoveredTrans] = useState<string | null>(null);
  useEffect(() => { transformRef.current = transform; }, [transform]);

  // ── Build view model ────────────────────────────────────────────────────

  const { states, transitions, totalW, totalH, title } = useMemo(() => {
    const empty = { states: [] as STState[], transitions: [] as STTransition[], totalW: 400, totalH: 300, title: 'stm' };
    if (!model) return empty;

    const nodes = model.children.filter((c): c is SNode => c.type === 'node');
    const edges = model.children.filter((c): c is SEdge => c.type === 'edge');
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    const getName = (n: SNode) => n.children.find(c => c.id.endsWith('__label'))?.text ?? n.id.split('__').pop() ?? n.id;
    const getKind = (n: SNode) => n.children.find(c => c.id.endsWith('__kind'))?.text ?? '';
    const getCss = (n: SNode) => n.cssClasses?.[0] ?? '';

    // Categorize nodes
    const pseudoMap: Record<string, STState['pseudoKind']> = {
      startnode: 'initial', donenode: 'final', terminatenode: 'terminate',
      forknode: 'fork', joinnode: 'join', decisionnode: 'decision', mergenode: 'merge',
    };

    const stateArr: STState[] = [];
    const stateSet = new Set<string>();

    // Find entry/do/exit child nodes and map them to their parent state
    const behaviorsByParent = new Map<string, { entry: string[]; doA: string[]; exit: string[] }>();
    for (const n of nodes) {
      const css = getCss(n);
      if (css === 'entryactionusage' || css === 'doactionusage' || css === 'exitactionusage') {
        // Find parent via composition edges
        const parentEdge = edges.find(e => e.targetId === n.id && (e.cssClasses?.[0] === 'composition'));
        const parentId = parentEdge?.sourceId;
        if (parentId) {
          const b = behaviorsByParent.get(parentId) ?? { entry: [], doA: [], exit: [] };
          const name = getName(n);
          if (css === 'entryactionusage') b.entry.push(name);
          else if (css === 'doactionusage') b.doA.push(name);
          else b.exit.push(name);
          behaviorsByParent.set(parentId, b);
        }
      }
    }

    // Identify composition children for composite states
    const childrenOf = new Map<string, string[]>();
    for (const e of edges) {
      if (e.cssClasses?.[0] === 'composition') {
        const parentNode = nodeMap.get(e.sourceId);
        const childNode = nodeMap.get(e.targetId);
        if (!parentNode || !childNode) continue;
        const parentCss = getCss(parentNode);
        const childCss = getCss(childNode);
        if ((parentCss === 'stateusage' || parentCss === 'statedefinition') &&
            (childCss === 'stateusage' || childCss === 'statedefinition' || childCss === 'exhibitstateusage' || pseudoMap[childCss])) {
          const kids = childrenOf.get(e.sourceId) ?? [];
          kids.push(e.targetId);
          childrenOf.set(e.sourceId, kids);
        }
      }
    }

    // Build state nodes
    for (const n of nodes) {
      const css = getCss(n);
      const behaviors = behaviorsByParent.get(n.id);
      const childIds = childrenOf.get(n.id) ?? [];

      // Skip entry/do/exit action nodes (they're shown as compartments)
      if (css === 'entryactionusage' || css === 'doactionusage' || css === 'exitactionusage') continue;

      if (pseudoMap[css]) {
        const pk = pseudoMap[css]!;
        const isBar = pk === 'fork' || pk === 'join';
        stateArr.push({
          id: n.id, name: getName(n),
          kind: 'pseudostate', pseudoKind: pk,
          stereotype: undefined,
          entryActions: [], doActions: [], exitActions: [],
          isParallel: false, childIds: [],
          x: n.position.x, y: n.position.y,
          w: isBar ? BAR_W : PSEUDO_R * 2,
          h: isBar ? BAR_H : PSEUDO_R * 2,
        });
        stateSet.add(n.id);
      } else if (css === 'stateusage' || css === 'statedefinition' || css === 'exhibitstateusage') {
        const name = getName(n);
        const kindText = getKind(n);
        const compartmentCount = (behaviors?.entry.length ?? 0) + (behaviors?.doA.length ?? 0) + (behaviors?.exit.length ?? 0);
        const h = STATE_H_BASE + compartmentCount * COMPARTMENT_H;
        const textW = Math.max(name.length * 8 + 32, STATE_MIN_W);
        const isComposite = childIds.length > 0;
        const isParallel = !!(n.data?.isParallel);

        stateArr.push({
          id: n.id, name,
          kind: isComposite ? 'composite' : 'simple',
          stereotype: kindText || undefined,
          entryActions: behaviors?.entry ?? [],
          doActions: behaviors?.doA ?? [],
          exitActions: behaviors?.exit ?? [],
          isParallel, childIds,
          x: n.position.x, y: n.position.y,
          w: textW, h,
        });
        stateSet.add(n.id);
      }
    }

    // If ELK positions are all 0, do a simple auto-layout
    const allZero = stateArr.every(s => s.x === 0 && s.y === 0);
    if (allZero && stateArr.length > 0) {
      // Simple grid layout
      const cols = Math.ceil(Math.sqrt(stateArr.length));
      const colW = 200;
      const rowH = 100;
      stateArr.forEach((s, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        s.x = PAD + col * colW;
        s.y = PAD + row * rowH;
      });
    } else {
      // Use ELK positions but add padding offset
      const minX = Math.min(...stateArr.map(s => s.x));
      const minY = Math.min(...stateArr.map(s => s.y));
      stateArr.forEach(s => { s.x += PAD - minX; s.y += PAD - minY; });
    }

    const stMap = new Map(stateArr.map(s => [s.id, s]));

    // Build transitions
    const transArr: STTransition[] = [];
    for (const e of edges) {
      const ek = e.cssClasses?.[0] ?? '';
      if (ek !== 'transition' && ek !== 'succession') continue;
      if (!stMap.has(e.sourceId) || !stMap.has(e.targetId)) continue;
      const label = e.children.find(c => c.id.endsWith('__label'))?.text ?? '';
      transArr.push({
        id: e.id,
        sourceId: e.sourceId,
        targetId: e.targetId,
        label,
        isSelf: e.sourceId === e.targetId,
      });
    }

    // Totals
    const maxX = Math.max(...stateArr.map(s => s.x + s.w), 400);
    const maxY = Math.max(...stateArr.map(s => s.y + s.h), 300);
    const tw = maxX + PAD;
    const th = maxY + PAD;

    const sdTitle = 'stm ' + (model.id.replace(/^.*\/\//, '').replace(/\?.*$/, '').split('/').pop() ?? 'StateMachine');

    return { states: stateArr, transitions: transArr, totalW: tw, totalH: th, title: sdTitle };
  }, [model]);

  const stMap = useMemo(() => new Map(states.map(s => [s.id, s])), [states]);

  // ── Pan/Zoom ───────────────────────────────────────────────────────────

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragging.current = true;
    dragStart.current = { x: e.clientX - transformRef.current.x, y: e.clientY - transformRef.current.y };
  }, []);
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    setTransform(prev => ({ ...prev, x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y }));
  }, []);
  const onMouseUp = useCallback(() => { dragging.current = false; }, []);
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform(prev => ({ ...prev, scale: Math.max(0.1, Math.min(3, prev.scale * factor)) }));
  }, []);

  useEffect(() => {
    if (fitTrigger === undefined || fitTrigger === 0) return;
    const svg = svgRef.current;
    if (!svg || totalW === 0 || totalH === 0) return;
    const rect = svg.getBoundingClientRect();
    const px = 20, py = 20;
    const sx = (rect.width - px * 2) / totalW;
    const sy = (rect.height - py * 2) / totalH;
    const s = Math.min(sx, sy, 2);
    setTransform({ x: (rect.width - totalW * s) / 2, y: (rect.height - totalH * s) / 2, scale: s });
  }, [fitTrigger, totalW, totalH]);

  // ── Colors ─────────────────────────────────────────────────────────────

  const textColor = isDark ? '#e8eef6' : '#1a1a2e';
  const dimText = isDark ? '#888' : '#999';
  const stateFill = isDark ? '#2a2a10' : '#f0f0d0';
  const stateStroke = isDark ? '#8a8a3a' : '#aaaa5a';
  const stateDefFill = isDark ? '#3a3a10' : '#e8e8b8';
  const stateDefStroke = isDark ? '#9a9a4a' : '#bbbb6a';
  const compartmentLine = isDark ? '#5a5a2a' : '#cccc8a';
  const compartmentText = isDark ? '#b0c8b0' : '#3a5a3a';
  const transColor = isDark ? '#4ec9b0' : '#2a8a70';
  const transLabelBg = isDark ? 'rgba(30,30,30,0.85)' : 'rgba(255,255,255,0.9)';
  const pseudoFill = isDark ? '#d0d0d0' : '#333';
  const frameBg = isDark ? 'rgba(30,30,30,0.3)' : 'rgba(245,245,245,0.3)';
  const frameStroke = isDark ? '#555' : '#bbb';
  const highlightStroke = isDark ? '#f0c040' : '#d0a020';

  if (!model) {
    return <div style={{ padding: 40, color: t.textSecondary, textAlign: 'center' }}>No model data for State Transition View</div>;
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  const isHighlighted = (stateId: string) => {
    if (hoveredState === stateId) return true;
    return transitions.some(tr => hoveredTrans === tr.id && (tr.sourceId === stateId || tr.targetId === stateId));
  };

  // Simple edge path between two states
  const transPath = (tr: STTransition) => {
    const src = stMap.get(tr.sourceId);
    const tgt = stMap.get(tr.targetId);
    if (!src || !tgt) return null;

    const srcCx = src.x + src.w / 2, srcCy = src.y + src.h / 2;
    const tgtCx = tgt.x + tgt.w / 2, tgtCy = tgt.y + tgt.h / 2;

    if (tr.isSelf) {
      // Self-transition arc on top-right
      const ax = src.x + src.w - 10, ay = src.y;
      return {
        d: `M ${ax} ${ay} C ${ax + 30} ${ay - 30}, ${ax + 50} ${ay + 10}, ${ax + 5} ${ay + 20}`,
        labelX: ax + 40, labelY: ay - 15,
      };
    }

    // Compute edge points on state boundaries
    const angle = Math.atan2(tgtCy - srcCy, tgtCx - srcCx);
    const x1 = srcCx + Math.cos(angle) * (src.w / 2 + 2);
    const y1 = srcCy + Math.sin(angle) * (src.h / 2 + 2);
    const x2 = tgtCx - Math.cos(angle) * (tgt.w / 2 + 2);
    const y2 = tgtCy - Math.sin(angle) * (tgt.h / 2 + 2);
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;

    return { d: `M ${x1} ${y1} L ${x2} ${y2}`, labelX: mx, labelY: my - 10 };
  };

  return (
    <svg
      ref={svgRef}
      width="100%" height="100%"
      style={{ cursor: dragging.current ? 'grabbing' : 'grab' }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onWheel={onWheel}
    >
      <defs>
        <marker id="stv-arrow" viewBox="0 0 10 8" refX="10" refY="4" markerWidth="8" markerHeight="6" orient="auto">
          <polygon points="0,0 10,4 0,8" fill={transColor} />
        </marker>
        <marker id="stv-arrow-hl" viewBox="0 0 10 8" refX="10" refY="4" markerWidth="8" markerHeight="6" orient="auto">
          <polygon points="0,0 10,4 0,8" fill={highlightStroke} />
        </marker>
      </defs>

      <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
        {/* Frame */}
        {states.length > 0 && <>
          <rect x={FRAME_PAD / 2} y={FRAME_PAD / 2} width={totalW - FRAME_PAD} height={totalH - FRAME_PAD} rx={3} fill={frameBg} stroke={frameStroke} strokeWidth={1} />
          <path
            d={`M ${FRAME_PAD / 2} ${FRAME_PAD / 2} h ${title.length * 6.5 + 20} v 20 l -10 10 h ${-(title.length * 6.5 + 10)} z`}
            fill={isDark ? '#2a2a3a' : '#e0e0ee'} stroke={frameStroke} strokeWidth={1}
          />
          <text x={FRAME_PAD / 2 + 8} y={FRAME_PAD / 2 + 16} fill={textColor} fontSize={11} fontWeight={600}>{title}</text>
        </>}

        {/* Transitions (behind states) */}
        {transitions.map(tr => {
          const p = transPath(tr);
          if (!p) return null;
          const hl = hoveredTrans === tr.id;
          const color = hl ? highlightStroke : transColor;
          return (
            <g key={tr.id}
              onMouseEnter={() => setHoveredTrans(tr.id)} onMouseLeave={() => setHoveredTrans(null)}
              style={{ cursor: 'pointer' }}
            >
              <path d={p.d} fill="none" stroke={color} strokeWidth={hl ? 2.5 : 1.5} markerEnd={hl ? 'url(#stv-arrow-hl)' : 'url(#stv-arrow)'} />
              {tr.label && <>
                <rect x={p.labelX - tr.label.length * 3 - 4} y={p.labelY - 10} width={tr.label.length * 6 + 8} height={14} rx={3} fill={transLabelBg} stroke={color} strokeWidth={0.5} opacity={0.9} />
                <text x={p.labelX} y={p.labelY} textAnchor="middle" fill={color} fontSize={10} fontWeight={hl ? 600 : 400}>{tr.label}</text>
              </>}
            </g>
          );
        })}

        {/* State nodes */}
        {states.map(st => {
          const hl = isHighlighted(st.id);
          const stroke = hl ? highlightStroke : (st.kind === 'simple' ? stateStroke : stateDefStroke);
          const sw = hl ? 2.5 : 1.5;

          // Pseudostates
          if (st.kind === 'pseudostate') {
            const cx = st.x + st.w / 2, cy = st.y + st.h / 2;

            if (st.pseudoKind === 'initial') {
              return (
                <circle key={st.id} cx={cx} cy={cy} r={PSEUDO_R - 3} fill={pseudoFill}
                  onClick={() => onNodeSelect?.(st.id)} style={{ cursor: 'pointer' }} />
              );
            }
            if (st.pseudoKind === 'final') {
              return (
                <g key={st.id} onClick={() => onNodeSelect?.(st.id)} style={{ cursor: 'pointer' }}>
                  <circle cx={cx} cy={cy} r={PSEUDO_R} fill="none" stroke={pseudoFill} strokeWidth={2} />
                  <circle cx={cx} cy={cy} r={PSEUDO_R - 4} fill={pseudoFill} />
                </g>
              );
            }
            if (st.pseudoKind === 'terminate') {
              return (
                <g key={st.id} onClick={() => onNodeSelect?.(st.id)} style={{ cursor: 'pointer' }}>
                  <circle cx={cx} cy={cy} r={PSEUDO_R} fill="none" stroke={pseudoFill} strokeWidth={2} />
                  <line x1={cx - 6} y1={cy - 6} x2={cx + 6} y2={cy + 6} stroke={pseudoFill} strokeWidth={2} />
                  <line x1={cx + 6} y1={cy - 6} x2={cx - 6} y2={cy + 6} stroke={pseudoFill} strokeWidth={2} />
                </g>
              );
            }
            if (st.pseudoKind === 'fork' || st.pseudoKind === 'join') {
              return (
                <rect key={st.id} x={st.x} y={st.y} width={BAR_W} height={BAR_H} rx={2} fill={pseudoFill}
                  onClick={() => onNodeSelect?.(st.id)} style={{ cursor: 'pointer' }} />
              );
            }
            if (st.pseudoKind === 'decision' || st.pseudoKind === 'merge') {
              const dw = 28, dh = 28;
              return (
                <polygon key={st.id}
                  points={`${cx},${cy - dh / 2} ${cx + dw / 2},${cy} ${cx},${cy + dh / 2} ${cx - dw / 2},${cy}`}
                  fill={isDark ? '#3a3a2a' : '#e8e8d8'} stroke={stroke} strokeWidth={sw}
                  onClick={() => onNodeSelect?.(st.id)} style={{ cursor: 'pointer' }}
                />
              );
            }
            return null;
          }

          // Regular state (simple or composite)
          const fill = st.stereotype?.includes('def') ? stateDefFill : stateFill;
          const hasCompartments = st.entryActions.length > 0 || st.doActions.length > 0 || st.exitActions.length > 0;
          const compartments: { prefix: string; actions: string[] }[] = [];
          if (st.entryActions.length > 0) compartments.push({ prefix: 'entry', actions: st.entryActions });
          if (st.doActions.length > 0) compartments.push({ prefix: 'do', actions: st.doActions });
          if (st.exitActions.length > 0) compartments.push({ prefix: 'exit', actions: st.exitActions });
          const totalH = STATE_H_BASE + compartments.reduce((sum, c) => sum + c.actions.length * COMPARTMENT_H, 0);

          return (
            <g key={st.id}
              onClick={() => onNodeSelect?.(st.id)}
              onMouseEnter={() => setHoveredState(st.id)} onMouseLeave={() => setHoveredState(null)}
              style={{ cursor: 'pointer' }}
            >
              {/* State rectangle */}
              <rect
                x={st.x} y={st.y} width={st.w} height={totalH}
                rx={STATE_RADIUS} fill={fill} stroke={stroke} strokeWidth={sw}
                strokeDasharray={st.stereotype?.includes('exhibit') ? '6,3' : undefined}
              />

              {/* State name */}
              <text x={st.x + st.w / 2} y={st.y + 16} textAnchor="middle" fill={textColor} fontSize={12} fontWeight={600}>
                {st.name}
              </text>

              {/* Stereotype label (small, below name) */}
              {st.stereotype && (
                <text x={st.x + st.w / 2} y={st.y + 30} textAnchor="middle" fill={dimText} fontSize={9}>
                  {st.stereotype}
                </text>
              )}

              {/* Parallel indicator */}
              {st.isParallel && (
                <text x={st.x + st.w - 8} y={st.y + 14} textAnchor="end" fill={dimText} fontSize={9}>||</text>
              )}

              {/* Compartment divider and actions */}
              {hasCompartments && <>
                <line x1={st.x + 8} y1={st.y + STATE_H_BASE - 4} x2={st.x + st.w - 8} y2={st.y + STATE_H_BASE - 4} stroke={compartmentLine} strokeWidth={0.5} />
                {(() => {
                  let cy = st.y + STATE_H_BASE + 8;
                  return compartments.flatMap(comp =>
                    comp.actions.map((a, i) => {
                      const y = cy;
                      cy += COMPARTMENT_H;
                      return (
                        <text key={`${comp.prefix}-${i}`} x={st.x + 10} y={y} fill={compartmentText} fontSize={10}>
                          {comp.prefix} / {a}
                        </text>
                      );
                    }),
                  );
                })()}
              </>}
            </g>
          );
        })}

        {/* Empty state */}
        {states.length === 0 && (
          <text x={200} y={120} fill={dimText} fontSize={13} textAnchor="middle">
            No states found. Add state definitions with transitions to see the state diagram.
          </text>
        )}
      </g>
    </svg>
  );
}
