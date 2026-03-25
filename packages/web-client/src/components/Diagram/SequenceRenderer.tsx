import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import type { SModelRoot, SNode, SEdge } from '@systemodel/shared-types';
import { useTheme } from '../../store/theme.js';

interface SequenceRendererProps {
  model: SModelRoot | null;
  onNodeSelect?: (nodeId: string) => void;
}

interface Lifeline {
  id: string;
  name: string;
  cssClass: string;
  x: number;
}

interface Message {
  id: string;
  name: string;
  sourceId: string;
  targetId: string;
  y: number;
  kind: string;
}

const LIFELINE_WIDTH = 120;
const LIFELINE_SPACING = 60;
const LIFELINE_HEADER_HEIGHT = 40;
const MESSAGE_SPACING = 40;
const TOP_PADDING = 20;
const LEFT_PADDING = 30;

export default function SequenceRenderer({ model, onNodeSelect }: SequenceRendererProps) {
  const t = useTheme();
  const isDark = t.mode === 'dark';
  const svgRef = useRef<SVGSVGElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const transformRef = useRef(transform);
  useEffect(() => { transformRef.current = transform; }, [transform]);

  const { lifelines, messages, totalHeight, totalWidth } = useMemo(() => {
    if (!model) return { lifelines: [] as Lifeline[], messages: [] as Message[], totalHeight: 200, totalWidth: 400 };

    const nodes = model.children.filter((c): c is SNode => c.type === 'node');
    const edges = model.children.filter((c): c is SEdge => c.type === 'edge');

    // Find message edges
    const messageEdges = edges.filter(e => {
      const kind = e.cssClasses?.[0] ?? '';
      return kind === 'message' || kind === 'flow' || kind === 'successionflow';
    });

    if (messageEdges.length === 0) {
      // Fallback: show all top-level part/action nodes as lifelines
      const fallbackLifelines: Lifeline[] = nodes
        .filter(n => {
          const css = n.cssClasses?.[0] ?? '';
          return css.includes('part') || css.includes('action') || css.includes('item');
        })
        .slice(0, 20)
        .map((n, i) => ({
          id: n.id,
          name: n.children.find(c => c.id.endsWith('__label'))?.text ?? n.id,
          cssClass: n.cssClasses?.[0] ?? 'default',
          x: LEFT_PADDING + i * (LIFELINE_WIDTH + LIFELINE_SPACING),
        }));
      return {
        lifelines: fallbackLifelines,
        messages: [] as Message[],
        totalHeight: 300,
        totalWidth: LEFT_PADDING * 2 + fallbackLifelines.length * (LIFELINE_WIDTH + LIFELINE_SPACING),
      };
    }

    // Collect unique lifeline IDs from message endpoints
    const lifelineIds = new Set<string>();
    for (const e of messageEdges) {
      lifelineIds.add(e.sourceId);
      lifelineIds.add(e.targetId);
    }

    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const lifelineArr: Lifeline[] = [...lifelineIds].map((id, i) => {
      const node = nodeMap.get(id);
      return {
        id,
        name: node?.children.find(c => c.id.endsWith('__label'))?.text ?? id.split('__').pop() ?? id,
        cssClass: node?.cssClasses?.[0] ?? 'default',
        x: LEFT_PADDING + i * (LIFELINE_WIDTH + LIFELINE_SPACING),
      };
    });

    const msgArr: Message[] = messageEdges.map((e, i) => ({
      id: e.id,
      name: e.children.find(c => c.id.endsWith('__label'))?.text ?? '',
      sourceId: e.sourceId,
      targetId: e.targetId,
      y: TOP_PADDING + LIFELINE_HEADER_HEIGHT + 30 + i * MESSAGE_SPACING,
      kind: e.cssClasses?.[0] ?? 'message',
    }));

    const h = TOP_PADDING + LIFELINE_HEADER_HEIGHT + 30 + msgArr.length * MESSAGE_SPACING + 60;
    const w = LEFT_PADDING * 2 + lifelineArr.length * (LIFELINE_WIDTH + LIFELINE_SPACING);

    return { lifelines: lifelineArr, messages: msgArr, totalHeight: h, totalWidth: w };
  }, [model]);

  const lifelineMap = useMemo(() => new Map(lifelines.map(l => [l.id, l])), [lifelines]);

  // Pan handlers
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

  const textColor = isDark ? '#e8eef6' : '#1a1a2e';
  const lineColor = isDark ? '#555' : '#bbb';
  const arrowColor = isDark ? '#4ec9b0' : '#2a8a70';
  const headerBg = isDark ? '#1c3f6e' : '#c8daf0';
  const headerStroke = isDark ? '#4a8ab0' : '#8a8aaa';

  if (!model) {
    return <div style={{ padding: 40, color: t.textSecondary, textAlign: 'center' }}>No model data for Sequence View</div>;
  }

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
        <marker id="seq-arrow" viewBox="0 0 10 8" refX="10" refY="4" markerWidth="8" markerHeight="6" orient="auto">
          <polygon points="0,0 10,4 0,8" fill={arrowColor} />
        </marker>
      </defs>
      <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
        {/* Lifeline headers */}
        {lifelines.map(ll => (
          <g key={ll.id} onClick={() => onNodeSelect?.(ll.id)} style={{ cursor: 'pointer' }}>
            <rect
              x={ll.x} y={TOP_PADDING}
              width={LIFELINE_WIDTH} height={LIFELINE_HEADER_HEIGHT}
              rx={4} fill={headerBg} stroke={headerStroke} strokeWidth={1.5}
            />
            <text
              x={ll.x + LIFELINE_WIDTH / 2} y={TOP_PADDING + LIFELINE_HEADER_HEIGHT / 2 + 4}
              textAnchor="middle" fill={textColor} fontSize={11} fontWeight={600}
            >
              {ll.name.length > 14 ? ll.name.slice(0, 13) + '…' : ll.name}
            </text>
          </g>
        ))}

        {/* Lifeline dashed vertical lines */}
        {lifelines.map(ll => (
          <line
            key={`line-${ll.id}`}
            x1={ll.x + LIFELINE_WIDTH / 2} y1={TOP_PADDING + LIFELINE_HEADER_HEIGHT}
            x2={ll.x + LIFELINE_WIDTH / 2} y2={totalHeight - 20}
            stroke={lineColor} strokeWidth={1} strokeDasharray="6,4"
          />
        ))}

        {/* Messages */}
        {messages.map(msg => {
          const src = lifelineMap.get(msg.sourceId);
          const tgt = lifelineMap.get(msg.targetId);
          if (!src || !tgt) return null;
          const x1 = src.x + LIFELINE_WIDTH / 2;
          const x2 = tgt.x + LIFELINE_WIDTH / 2;
          const isSelf = src.id === tgt.id;

          if (isSelf) {
            // Self-message: loop arrow
            const loopW = 30;
            return (
              <g key={msg.id}>
                <path
                  d={`M ${x1} ${msg.y} h ${loopW} v ${20} h ${-loopW}`}
                  fill="none" stroke={arrowColor} strokeWidth={1.5} markerEnd="url(#seq-arrow)"
                />
                <text x={x1 + loopW + 4} y={msg.y + 12} fill={arrowColor} fontSize={10}>{msg.name}</text>
              </g>
            );
          }

          const labelX = (x1 + x2) / 2;
          return (
            <g key={msg.id}>
              <line
                x1={x1} y1={msg.y} x2={x2} y2={msg.y}
                stroke={arrowColor} strokeWidth={1.5} markerEnd="url(#seq-arrow)"
              />
              {msg.name && (
                <text
                  x={labelX} y={msg.y - 6}
                  textAnchor="middle" fill={arrowColor} fontSize={10}
                >
                  {msg.name}
                </text>
              )}
            </g>
          );
        })}

        {/* Empty state */}
        {lifelines.length === 0 && (
          <text x={200} y={100} fill={isDark ? '#888' : '#999'} fontSize={13} textAnchor="middle">
            No lifelines found. Add message connections (message X from A to B;) to see the sequence.
          </text>
        )}
      </g>
    </svg>
  );
}
