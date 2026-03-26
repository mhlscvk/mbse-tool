import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import type { SModelRoot, SNode, SEdge } from '@systemodel/shared-types';
import { useTheme } from '../../store/theme.js';

interface SequenceRendererProps {
  model: SModelRoot | null;
  onNodeSelect?: (nodeId: string) => void;
  /** Increment to trigger fit-to-window */
  fitTrigger?: number;
}

// ── Data model ───────────────────────────────────────────────────────────────

interface SeqLifeline {
  id: string;
  name: string;          // partName : TypeName
  cssClass: string;
  x: number;             // center x of header
  groupId?: string;      // parent part id (for containment grouping)
}

interface SeqGroup {
  id: string;
  name: string;
  lifelineIds: string[];
  x: number;
  width: number;
}

interface SeqMessage {
  id: string;
  label: string;
  sourceId: string;
  targetId: string;
  y: number;
  kind: 'sync' | 'async' | 'return' | 'self' | 'flow';
  edgeKind: string;      // original edge cssClass
}

interface SeqActivation {
  lifelineId: string;
  startY: number;
  endY: number;
}

interface SeqFragment {
  id: string;
  operator: string;      // alt, opt, loop, par, ref
  coveredIds: string[];
  topY: number;
  bottomY: number;
  guards: string[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const LL_WIDTH = 160;
const LL_GAP = 40;
const LL_HEADER_H = 44;
const GROUP_HEADER_H = 22;
const GROUP_PAD = 8;
const MSG_STEP = 50;
const ACT_BAR_W = 14;
const PAD_TOP = 60;         // room for sd frame label
const PAD_LEFT = 40;
const PAD_BOTTOM = 50;
const FRAME_PAD = 20;

// ── Component ────────────────────────────────────────────────────────────────

export default function SequenceRenderer({ model, onNodeSelect, fitTrigger }: SequenceRendererProps) {
  const t = useTheme();
  const isDark = t.mode === 'dark';
  const svgRef = useRef<SVGSVGElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const transformRef = useRef(transform);
  const [hoveredMsg, setHoveredMsg] = useState<string | null>(null);
  const [hoveredLL, setHoveredLL] = useState<string | null>(null);
  useEffect(() => { transformRef.current = transform; }, [transform]);

  // ── Build view model from SModel ─────────────────────────────────────────

  const { lifelines, messages, activations, fragments, groups, totalW, totalH, title } = useMemo(() => {
    const empty = { lifelines: [] as SeqLifeline[], messages: [] as SeqMessage[], activations: [] as SeqActivation[], fragments: [] as SeqFragment[], groups: [] as SeqGroup[], totalW: 400, totalH: 300, title: 'sd' };
    if (!model) return empty;

    const nodes = model.children.filter((c): c is SNode => c.type === 'node');
    const edges = model.children.filter((c): c is SEdge => c.type === 'edge');
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // Helper: extract name from node
    const nodeName = (n: SNode) => n.children.find(c => c.id.endsWith('__label'))?.text ?? n.id.split('__').pop() ?? n.id;
    const nodeKind = (n: SNode) => n.children.find(c => c.id.endsWith('__kind'))?.text ?? '';
    const nodeType = (n: SNode) => (n.data?.qualifiedName as string) ?? '';

    // 1. Collect message/flow edges
    const msgEdgeKinds = new Set(['message', 'flow', 'successionflow']);
    const msgEdges = edges.filter(e => msgEdgeKinds.has(e.cssClasses?.[0] ?? ''));

    // Also collect succession edges for ordering (first X then Y)
    const succEdges = edges.filter(e => {
      const k = e.cssClasses?.[0] ?? '';
      return k === 'succession' || k === 'transition';
    });

    // 2. Identify send/accept action nodes
    const sendNodes = new Set<string>();
    const acceptNodes = new Set<string>();
    const performNodes = new Set<string>();
    const controlNodes = new Map<string, string>(); // id → operator (fork/join/decide/merge/if/while/for)
    for (const n of nodes) {
      const css = n.cssClasses?.[0] ?? '';
      if (css === 'sendactionusage') sendNodes.add(n.id);
      else if (css === 'acceptactionusage') acceptNodes.add(n.id);
      else if (css === 'performactionusage') performNodes.add(n.id);
      else if (css === 'forknode') controlNodes.set(n.id, 'par');
      else if (css === 'joinnode') controlNodes.set(n.id, 'par');
      else if (css === 'decisionnode') controlNodes.set(n.id, 'alt');
      else if (css === 'mergenode') controlNodes.set(n.id, 'alt');
      else if (css === 'ifactionusage') controlNodes.set(n.id, 'opt');
      else if (css === 'forloopactionusage') controlNodes.set(n.id, 'loop');
      else if (css === 'whileloopactionusage') controlNodes.set(n.id, 'loop');
    }

    // 3. Determine lifelines: endpoints of message edges, or fallback to part/action nodes
    const lifelineIds = new Set<string>();
    for (const e of msgEdges) {
      lifelineIds.add(e.sourceId);
      lifelineIds.add(e.targetId);
    }

    // If no messages, show all top-level parts/actions as lifelines
    if (lifelineIds.size === 0) {
      for (const n of nodes) {
        const css = n.cssClasses?.[0] ?? '';
        if (css.includes('partusage') || css.includes('actionusage') || css.includes('itemusage') ||
            css.includes('partdefinition') || css.includes('actiondefinition')) {
          lifelineIds.add(n.id);
        }
        if (lifelineIds.size >= 20) break;
      }
    }

    // 3b. Build parent map from composition edges (child → parent)
    const parentOf = new Map<string, string>();
    for (const e of edges) {
      if (e.cssClasses?.[0] === 'composition' && lifelineIds.has(e.targetId) && lifelineIds.has(e.sourceId)) {
        parentOf.set(e.targetId, e.sourceId);
      }
    }
    // Also detect parent from node naming: if lifeline X has a composition to lifeline Y anywhere
    // in the full edge set, even if Y is the parent not in lifelineIds directly
    for (const e of edges) {
      if (e.cssClasses?.[0] === 'composition' && lifelineIds.has(e.targetId) && !parentOf.has(e.targetId)) {
        // Check if source is also a lifeline
        if (lifelineIds.has(e.sourceId)) {
          parentOf.set(e.targetId, e.sourceId);
        }
      }
    }

    // Sort lifelines: group children after their parent
    const sortedIds = [...lifelineIds];
    sortedIds.sort((a, b) => {
      const pa = parentOf.get(a);
      const pb = parentOf.get(b);
      // Parents come first, then children grouped under their parent
      if (pa === b) return 1;   // a is child of b → b first
      if (pb === a) return -1;  // b is child of a → a first
      if (pa && pb && pa === pb) return 0; // siblings
      if (pa && !pb) return 1;  // a has parent, b doesn't → b first (unless b is a's parent)
      if (!pa && pb) return -1;
      return 0;
    });

    // Build lifeline array with groupId
    const llArr: SeqLifeline[] = sortedIds.map((id, i) => {
      const node = nodeMap.get(id);
      let name = node ? nodeName(node) : id.split('__').pop() ?? id;
      if (node && !name.includes(':')) {
        const typeName = nodeType(node);
        if (typeName && typeName !== name) name = `${name} : ${typeName}`;
      }
      return {
        id,
        name,
        cssClass: node?.cssClasses?.[0] ?? 'default',
        x: PAD_LEFT + i * (LL_WIDTH + LL_GAP),
        groupId: parentOf.get(id),
      };
    });

    // Build groups: parent lifelines that contain children
    const groupMap = new Map<string, SeqGroup>();
    for (const ll of llArr) {
      if (!ll.groupId) continue;
      const group = groupMap.get(ll.groupId);
      if (group) {
        group.lifelineIds.push(ll.id);
        const llRight = ll.x + LL_WIDTH;
        group.width = Math.max(group.width, llRight - group.x + GROUP_PAD);
      } else {
        const parentLL = llArr.find(l => l.id === ll.groupId);
        const parentName = parentLL?.name ?? ll.groupId.split('__').pop() ?? '';
        // Group starts at the parent's x or the first child's x, whichever is leftmost
        const startX = parentLL ? Math.min(parentLL.x, ll.x) - GROUP_PAD : ll.x - GROUP_PAD;
        groupMap.set(ll.groupId, {
          id: ll.groupId,
          name: parentName,
          lifelineIds: [ll.id],
          x: startX,
          width: (ll.x + LL_WIDTH) - startX + GROUP_PAD,
        });
      }
    }
    const groupArr = [...groupMap.values()];

    // Adjust: if a parent is itself a lifeline, extend the group to include it
    for (const g of groupArr) {
      const parentLL = llArr.find(l => l.id === g.id);
      if (parentLL) {
        const minX = Math.min(g.x, parentLL.x - GROUP_PAD);
        const maxX = Math.max(g.x + g.width, parentLL.x + LL_WIDTH + GROUP_PAD);
        g.x = minX;
        g.width = maxX - minX;
      }
    }

    const hasGroups = groupArr.length > 0;
    const groupHeaderOffset = hasGroups ? GROUP_HEADER_H + GROUP_PAD : 0;
    const llMap = new Map(llArr.map(l => [l.id, l]));

    // 4. Build messages
    let msgY = PAD_TOP + groupHeaderOffset + LL_HEADER_H + 30;
    const msgArr: SeqMessage[] = [];

    for (const e of msgEdges) {
      const srcNode = nodeMap.get(e.sourceId);
      const edgeKind = e.cssClasses?.[0] ?? 'message';
      const isSelf = e.sourceId === e.targetId;

      // Determine message kind
      let kind: SeqMessage['kind'] = 'sync';
      if (isSelf) kind = 'self';
      else if (edgeKind === 'flow' || edgeKind === 'successionflow') kind = 'flow';
      else if (srcNode && sendNodes.has(srcNode.id)) kind = 'sync';
      else if (srcNode && acceptNodes.has(srcNode.id)) kind = 'async';

      // Label: edge label, or derive from edge name/kind
      let label = e.children.find(c => c.id.endsWith('__label'))?.text ?? '';

      msgArr.push({
        id: e.id, label, sourceId: e.sourceId, targetId: e.targetId,
        y: msgY, kind, edgeKind,
      });
      msgY += MSG_STEP;
    }

    // 5. Build activation bars (paired send→accept on same lifeline)
    const actArr: SeqActivation[] = [];
    // Track active messages per lifeline
    const llActive = new Map<string, number[]>(); // lifelineId → [startY indices]
    for (const msg of msgArr) {
      const tgtLL = llMap.get(msg.targetId);
      if (!tgtLL || msg.kind === 'self') continue;
      // Start activation at target lifeline
      const starts = llActive.get(msg.targetId) ?? [];
      starts.push(msg.y);
      llActive.set(msg.targetId, starts);
    }
    // Each activation starts at message receipt and extends for one message step
    for (const [llId, starts] of llActive) {
      for (const startY of starts) {
        actArr.push({ lifelineId: llId, startY, endY: startY + MSG_STEP * 0.7 });
      }
    }

    // 6. Build combined fragments from control nodes that are referenced in successions
    const fragArr: SeqFragment[] = [];
    for (const [nodeId, operator] of controlNodes) {
      // Find messages that span this control region
      const node = nodeMap.get(nodeId);
      if (!node) continue;
      const name = nodeName(node);
      // Find succession edges from/to this control node to determine Y range
      const incoming = succEdges.filter(e => e.targetId === nodeId);
      const outgoing = succEdges.filter(e => e.sourceId === nodeId);
      if (incoming.length === 0 && outgoing.length === 0) continue;

      // Estimate Y range from messages near these connected nodes
      const connectedIds = new Set([...incoming.map(e => e.sourceId), ...outgoing.map(e => e.targetId)]);
      const relatedMsgs = msgArr.filter(m => connectedIds.has(m.sourceId) || connectedIds.has(m.targetId));
      if (relatedMsgs.length === 0) continue;

      const topY = Math.min(...relatedMsgs.map(m => m.y)) - 15;
      const bottomY = Math.max(...relatedMsgs.map(m => m.y)) + 25;
      const coveredIds = [...new Set(relatedMsgs.flatMap(m => [m.sourceId, m.targetId]))].filter(id => llMap.has(id));
      if (coveredIds.length === 0) continue;

      fragArr.push({
        id: nodeId, operator, coveredIds, topY, bottomY,
        guards: [name],
      });
    }

    // 7. Compute totals
    const lastMsgY = msgArr.length > 0 ? msgArr[msgArr.length - 1].y : PAD_TOP + LL_HEADER_H + 30;
    const h = lastMsgY + PAD_BOTTOM + 40;
    const w = PAD_LEFT * 2 + llArr.length * (LL_WIDTH + LL_GAP);

    // Title from model id
    const sdTitle = 'sd';

    return { lifelines: llArr, messages: msgArr, activations: actArr, fragments: fragArr, groups: groupArr, totalW: w, totalH: h, title: sdTitle };
  }, [model]);

  const llMap = useMemo(() => new Map(lifelines.map(l => [l.id, l])), [lifelines]);

  // ── Pan/Zoom ───────────────────────────────────────────────────────────────

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
    setTransform(prev => ({
      x: prev.x, y: prev.y,
      scale: Math.max(0.1, Math.min(3, prev.scale * factor)),
    }));
  }, []);

  // Fit-to-window
  useEffect(() => {
    if (fitTrigger === undefined || fitTrigger === 0) return;
    const svg = svgRef.current;
    if (!svg || totalW === 0 || totalH === 0) return;
    const rect = svg.getBoundingClientRect();
    const padX = 20, padY = 20;
    const scaleX = (rect.width - padX * 2) / totalW;
    const scaleY = (rect.height - padY * 2) / totalH;
    const s = Math.min(scaleX, scaleY, 2);
    const tx = (rect.width - totalW * s) / 2;
    const ty = (rect.height - totalH * s) / 2;
    setTransform({ x: tx, y: ty, scale: s });
  }, [fitTrigger, totalW, totalH]);

  // ── Colors ─────────────────────────────────────────────────────────────────

  const textColor = isDark ? '#e8eef6' : '#1a1a2e';
  const dimText = isDark ? '#888' : '#999';
  const lineColor = isDark ? '#555' : '#bbb';
  const syncColor = isDark ? '#4ec9b0' : '#2a8a70';
  const asyncColor = isDark ? '#9cdcfe' : '#3a6a9a';
  const returnColor = isDark ? '#888' : '#999';
  const flowColor = isDark ? '#c586c0' : '#7a3a9a';
  const headerBg = isDark ? '#1c3f6e' : '#c8daf0';
  const headerStroke = isDark ? '#4a8ab0' : '#8a8aaa';
  const actBarFill = isDark ? '#2a5a8a' : '#a0c8e8';
  const actBarStroke = isDark ? '#4a8ab0' : '#6a8aaa';
  const frameBg = isDark ? 'rgba(30,30,30,0.3)' : 'rgba(245,245,245,0.3)';
  const frameStroke = isDark ? '#555' : '#bbb';
  const fragBg = isDark ? 'rgba(40,40,50,0.5)' : 'rgba(230,230,240,0.5)';
  const fragStroke = isDark ? '#6a6a8a' : '#9a9ab0';
  const fragLabel = isDark ? '#c0c0e0' : '#4a4a7a';
  const highlightColor = isDark ? '#f0c040' : '#d0a020';
  const groupBg = isDark ? 'rgba(40,50,70,0.3)' : 'rgba(200,215,240,0.3)';
  const groupStroke = isDark ? '#4a6a8a' : '#8aaaba';
  const groupText = isDark ? '#8ab0d0' : '#4a6a8a';

  // Compute lifeline header Y (shifted down if groups exist)
  const hasGroups = groups.length > 0;
  const llHeaderY = PAD_TOP + (hasGroups ? GROUP_HEADER_H + GROUP_PAD : 0);

  if (!model) {
    return <div style={{ padding: 40, color: t.textSecondary, textAlign: 'center' }}>No model data for Sequence View</div>;
  }

  const msgColor = (kind: SeqMessage['kind']) => {
    switch (kind) {
      case 'sync': return syncColor;
      case 'async': return asyncColor;
      case 'return': return returnColor;
      case 'flow': return flowColor;
      case 'self': return syncColor;
      default: return syncColor;
    }
  };

  const isHighlightedLL = (id: string) => hoveredLL === id || messages.some(m => (m.sourceId === id || m.targetId === id) && hoveredMsg === m.id);

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
        {/* Filled arrowhead (sync) */}
        <marker id="seq-sync" viewBox="0 0 10 8" refX="10" refY="4" markerWidth="8" markerHeight="6" orient="auto">
          <polygon points="0,0 10,4 0,8" fill={syncColor} />
        </marker>
        {/* Open arrowhead (async) */}
        <marker id="seq-async" viewBox="0 0 10 8" refX="10" refY="4" markerWidth="8" markerHeight="6" orient="auto">
          <polyline points="0,0 10,4 0,8" fill="none" stroke={asyncColor} strokeWidth="1.5" />
        </marker>
        {/* Return arrowhead (dashed) */}
        <marker id="seq-return" viewBox="0 0 10 8" refX="10" refY="4" markerWidth="8" markerHeight="6" orient="auto">
          <polyline points="0,0 10,4 0,8" fill="none" stroke={returnColor} strokeWidth="1.5" />
        </marker>
        {/* Flow arrowhead */}
        <marker id="seq-flow" viewBox="0 0 10 8" refX="10" refY="4" markerWidth="8" markerHeight="6" orient="auto">
          <polygon points="0,0 10,4 0,8" fill={flowColor} />
        </marker>
      </defs>

      <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
        {/* SD Frame */}
        {lifelines.length > 0 && <>
          <rect
            x={FRAME_PAD / 2} y={FRAME_PAD / 2}
            width={totalW - FRAME_PAD} height={totalH - FRAME_PAD}
            rx={3} fill={frameBg} stroke={frameStroke} strokeWidth={1}
          />
          {/* Pentagon label */}
          <path
            d={`M ${FRAME_PAD / 2} ${FRAME_PAD / 2} h ${title.length * 6.5 + 20} v 20 l -10 10 h ${-(title.length * 6.5 + 10)} z`}
            fill={isDark ? '#2a2a3a' : '#e0e0ee'} stroke={frameStroke} strokeWidth={1}
          />
          <text x={FRAME_PAD / 2 + 8} y={FRAME_PAD / 2 + 16} fill={textColor} fontSize={11} fontWeight={600}>{title}</text>
        </>}

        {/* Combined fragments */}
        {fragments.map(frag => {
          const coveredLLs = frag.coveredIds.map(id => llMap.get(id)).filter(Boolean) as SeqLifeline[];
          if (coveredLLs.length === 0) return null;
          const minX = Math.min(...coveredLLs.map(l => l.x)) - 20;
          const maxX = Math.max(...coveredLLs.map(l => l.x + LL_WIDTH)) + 20;
          return (
            <g key={frag.id}>
              <rect x={minX} y={frag.topY} width={maxX - minX} height={frag.bottomY - frag.topY} rx={2} fill={fragBg} stroke={fragStroke} strokeWidth={1} />
              {/* Pentagon operator label */}
              <path
                d={`M ${minX} ${frag.topY} h ${frag.operator.length * 7 + 16} v 14 l -8 8 h ${-(frag.operator.length * 7 + 8)} z`}
                fill={isDark ? '#2a2a4a' : '#d0d0e8'} stroke={fragStroke} strokeWidth={1}
              />
              <text x={minX + 6} y={frag.topY + 14} fill={fragLabel} fontSize={10} fontWeight={700}>{frag.operator}</text>
              {/* Guard text */}
              {frag.guards.map((g, i) => (
                <text key={i} x={minX + frag.operator.length * 7 + 24} y={frag.topY + 14} fill={fragLabel} fontSize={9} fontStyle="italic">[{g}]</text>
              ))}
            </g>
          );
        })}

        {/* Containment groups (behind lifelines) */}
        {groups.map(g => (
          <g key={`group-${g.id}`}>
            <rect
              x={g.x} y={PAD_TOP}
              width={g.width} height={LL_HEADER_H + GROUP_HEADER_H + GROUP_PAD + 4}
              rx={6} fill={groupBg} stroke={groupStroke} strokeWidth={1}
            />
            <text
              x={g.x + g.width / 2} y={PAD_TOP + 14}
              textAnchor="middle" fill={groupText} fontSize={10} fontWeight={600}
            >
              {g.name}
            </text>
          </g>
        ))}

        {/* Lifeline dashed stems (behind everything) */}
        {lifelines.map(ll => (
          <line
            key={`stem-${ll.id}`}
            x1={ll.x + LL_WIDTH / 2} y1={llHeaderY + LL_HEADER_H}
            x2={ll.x + LL_WIDTH / 2} y2={totalH - PAD_BOTTOM}
            stroke={isHighlightedLL(ll.id) ? highlightColor : lineColor} strokeWidth={1} strokeDasharray="6,4"
          />
        ))}

        {/* Activation bars */}
        {activations.map((act, i) => {
          const ll = llMap.get(act.lifelineId);
          if (!ll) return null;
          const cx = ll.x + LL_WIDTH / 2;
          return (
            <rect
              key={`act-${i}`}
              x={cx - ACT_BAR_W / 2} y={act.startY - 4}
              width={ACT_BAR_W} height={act.endY - act.startY + 8}
              rx={2} fill={actBarFill} stroke={actBarStroke} strokeWidth={1}
            />
          );
        })}

        {/* Messages */}
        {messages.map(msg => {
          const src = llMap.get(msg.sourceId);
          const tgt = llMap.get(msg.targetId);
          if (!src || !tgt) return null;
          const x1 = src.x + LL_WIDTH / 2;
          const x2 = tgt.x + LL_WIDTH / 2;
          const color = msgColor(msg.kind);
          const isHovered = hoveredMsg === msg.id;
          const markerId = msg.kind === 'async' ? 'seq-async' : msg.kind === 'return' ? 'seq-return' : msg.kind === 'flow' ? 'seq-flow' : 'seq-sync';
          const dashArray = msg.kind === 'return' ? '6,3' : undefined;

          if (msg.kind === 'self') {
            const loopW = 40;
            const loopH = 24;
            return (
              <g key={msg.id}
                onMouseEnter={() => setHoveredMsg(msg.id)} onMouseLeave={() => setHoveredMsg(null)}
                style={{ cursor: 'pointer' }}
              >
                <path
                  d={`M ${x1} ${msg.y} h ${loopW} v ${loopH} h ${-loopW}`}
                  fill="none" stroke={isHovered ? highlightColor : color} strokeWidth={isHovered ? 2 : 1.5}
                  markerEnd="url(#seq-sync)"
                />
                <text x={x1 + loopW + 6} y={msg.y + loopH / 2 + 3} fill={color} fontSize={10}>{msg.label}</text>
              </g>
            );
          }

          const labelX = (x1 + x2) / 2;
          const goesRight = x2 > x1;
          return (
            <g key={msg.id}
              onMouseEnter={() => setHoveredMsg(msg.id)} onMouseLeave={() => setHoveredMsg(null)}
              style={{ cursor: 'pointer' }}
            >
              <line
                x1={x1} y1={msg.y} x2={x2} y2={msg.y}
                stroke={isHovered ? highlightColor : color} strokeWidth={isHovered ? 2.5 : 1.5}
                strokeDasharray={dashArray}
                markerEnd={`url(#${markerId})`}
              />
              {msg.label && (
                <text
                  x={labelX} y={msg.y - 8}
                  textAnchor="middle" fill={isHovered ? highlightColor : color} fontSize={10}
                  fontWeight={isHovered ? 600 : 400}
                >
                  {msg.label}
                </text>
              )}
              {/* Sequence number */}
              <text
                x={goesRight ? x1 + 4 : x1 - 4} y={msg.y + 14}
                textAnchor={goesRight ? 'start' : 'end'} fill={dimText} fontSize={8}
              >
                {messages.indexOf(msg) + 1}
              </text>
            </g>
          );
        })}

        {/* Lifeline headers (on top of everything) */}
        {lifelines.map(ll => {
          const highlighted = isHighlightedLL(ll.id);
          return (
            <g key={ll.id}
              onClick={() => onNodeSelect?.(ll.id)}
              onMouseEnter={() => setHoveredLL(ll.id)} onMouseLeave={() => setHoveredLL(null)}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={ll.x} y={llHeaderY}
                width={LL_WIDTH} height={LL_HEADER_H}
                rx={4}
                fill={highlighted ? (isDark ? '#2a4a7a' : '#b0c8e8') : headerBg}
                stroke={highlighted ? highlightColor : headerStroke}
                strokeWidth={highlighted ? 2 : 1.5}
              />
              <text
                x={ll.x + LL_WIDTH / 2} y={llHeaderY + LL_HEADER_H / 2 + 4}
                textAnchor="middle" fill={textColor} fontSize={11} fontWeight={600}
              >
                {ll.name.length > 22 ? ll.name.slice(0, 21) + '…' : ll.name}
              </text>
            </g>
          );
        })}

        {/* Empty state */}
        {lifelines.length === 0 && (
          <text x={200} y={120} fill={dimText} fontSize={13} textAnchor="middle">
            No lifelines found. Add message statements to see the sequence diagram.
          </text>
        )}

        {/* Legend — bottom-left */}
        {messages.length > 0 && (
          <g transform={`translate(${FRAME_PAD},${totalH - 38})`}>
            <line x1={0} y1={0} x2={20} y2={0} stroke={syncColor} strokeWidth={1.5} markerEnd="url(#seq-sync)" />
            <text x={24} y={4} fill={dimText} fontSize={9}>sync/send</text>
            <line x1={90} y1={0} x2={110} y2={0} stroke={flowColor} strokeWidth={1.5} markerEnd="url(#seq-flow)" />
            <text x={114} y={4} fill={dimText} fontSize={9}>flow</text>
            <line x1={150} y1={0} x2={170} y2={0} stroke={returnColor} strokeWidth={1.5} strokeDasharray="6,3" markerEnd="url(#seq-return)" />
            <text x={174} y={4} fill={dimText} fontSize={9}>return</text>
          </g>
        )}
      </g>
    </svg>
  );
}
