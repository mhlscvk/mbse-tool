import React, { useRef, useState } from 'react';
import type { SModelRoot, SNode, SEdge } from '@systemodel/shared-types';

interface DiagramViewerProps {
  model: SModelRoot | null;
}

const NODE_COLORS: Record<string, string> = {
  partdefinition: '#0e639c',
  attributedefinition: '#3d6b22',
  connectiondefinition: '#6b3d22',
  portdefinition: '#6b226b',
  actiondefinition: '#226b6b',
  default: '#3c3c3c',
};

export default function DiagramViewer({ model }: DiagramViewerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const nodes = model?.children.filter((c): c is SNode => c.type === 'node') ?? [];
  const edges = model?.children.filter((c): c is SEdge => c.type === 'edge') ?? [];

  const getNode = (id: string) => nodes.find((n) => n.id === id);

  const edgeCenter = (edge: SEdge) => {
    if (edge.routingPoints && edge.routingPoints.length >= 2) {
      const pts = edge.routingPoints;
      return pts[Math.floor(pts.length / 2)];
    }
    const src = getNode(edge.sourceId);
    const tgt = getNode(edge.targetId);
    if (!src || !tgt) return null;
    return {
      x: (src.position.x + src.size.width / 2 + tgt.position.x + tgt.size.width / 2) / 2,
      y: (src.position.y + src.size.height / 2 + tgt.position.y + tgt.size.height / 2) / 2,
    };
  };

  const edgePath = (edge: SEdge): string => {
    if (edge.routingPoints && edge.routingPoints.length >= 2) {
      return edge.routingPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    }
    const src = getNode(edge.sourceId);
    const tgt = getNode(edge.targetId);
    if (!src || !tgt) return '';
    return `M ${src.position.x + src.size.width / 2} ${src.position.y + src.size.height / 2} L ${tgt.position.x + tgt.size.width / 2} ${tgt.position.y + tgt.size.height / 2}`;
  };

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    dragStart.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    setTransform((t) => ({ ...t, x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y }));
  };

  const onMouseUp = () => { dragging.current = false; };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform((t) => ({ ...t, scale: Math.max(0.1, Math.min(5, t.scale * delta)) }));
  };

  if (!model || nodes.length === 0) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 32 }}>&#x2B21;</div>
        <div>No diagram to display</div>
        <div style={{ fontSize: 12, color: '#444' }}>Start editing to generate a Block Definition Diagram</div>
      </div>
    );
  }

  return (
    <svg
      ref={svgRef}
      style={{ width: '100%', height: '100%', background: '#1e1e1e', cursor: dragging.current ? 'grabbing' : 'grab' }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onWheel={onWheel}
    >
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#555" />
        </marker>
      </defs>
      <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
        {edges.map((edge) => (
          <g key={edge.id}>
            <path
              d={edgePath(edge)}
              stroke="#555"
              strokeWidth={1.5}
              fill="none"
              markerEnd="url(#arrowhead)"
            />
            {edge.children[0] && (() => {
              const c = edgeCenter(edge);
              return c ? (
                <text x={c.x} y={c.y - 4} fill="#888" fontSize={10} textAnchor="middle">
                  {edge.children[0].text}
                </text>
              ) : null;
            })()}
          </g>
        ))}
        {nodes.map((node) => {
          const cssClass = node.cssClasses?.[0] ?? 'default';
          const color = NODE_COLORS[cssClass] ?? NODE_COLORS.default;
          const kindLabel = node.children.find((c) => c.id.endsWith('__kind'));
          const nameLabel = node.children.find((c) => c.id.endsWith('__label'));
          return (
            <g key={node.id} transform={`translate(${node.position.x},${node.position.y})`}>
              <rect
                width={node.size.width}
                height={node.size.height}
                rx={4}
                fill={color}
                stroke="#666"
                strokeWidth={1}
              />
              {kindLabel && (
                <text x={node.size.width / 2} y={18} fill="#aaa" fontSize={10} textAnchor="middle" fontStyle="italic">
                  {kindLabel.text}
                </text>
              )}
              {nameLabel && (
                <text x={node.size.width / 2} y={38} fill="#fff" fontSize={13} textAnchor="middle" fontWeight="bold">
                  {nameLabel.text}
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
