import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import ELKModule from 'elkjs/lib/elk.bundled.js';
import type { SModelRoot, SNode, SEdge } from '@systemodel/shared-types';
import { useLocalStorage } from '../../hooks/useLocalStorage.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const elk = new (ELKModule as any)();

interface DiagramViewerProps {
  model: SModelRoot | null;
  hiddenNodeIds?: Set<string>;
  showCompartments?: boolean;
  storageKey?: string;
  onNodeSelect?: (range: { start: { line: number; character: number }; end: { line: number; character: number } }) => void;
}

const COMPACT_HEIGHT = 60;
const MIN_W = 80;
const MIN_H = 40;
const LAYOUT_PADDING = 48;

const NODE_COLORS: Record<string, string> = {
  partdefinition:       '#1c3f6e',  // SysML block — blue
  attributedefinition:  '#1e4d1e',  // attribute def — green
  connectiondefinition: '#4a2810',  // connection def — brown
  portdefinition:       '#3a1a5a',  // port def — purple
  actiondefinition:     '#0f4a4a',  // action def — teal
  statedefinition:      '#3a3a10',  // state def — olive
  itemdefinition:       '#4a2e08',  // item def — amber
  partusage:            '#0a2040',  // part usage — dark navy
  attributeusage:       '#102810',  // attribute usage — dark green
  connectionusage:      '#2a1408',  // connection usage — dark brown
  portusage:            '#1e0a30',  // port usage — dark purple
  actionusage:          '#082828',  // action usage — dark teal
  stateusage:           '#202008',  // state usage — dark olive
  itemusage:            '#201408',  // item usage — dark amber
  stdlib:               '#0a2018',  // stdlib — very dark green
  default:              '#252525',
};

const EDGE_STYLES: Record<string, { stroke: string; dash?: string; markerEnd: string; markerStart?: string; labelColor: string }> = {
  // Generalization (specializes): solid line, hollow triangle at parent (target)
  dependency:    { stroke: '#9e9e9e', dash: undefined, markerEnd: 'url(#tri-hollow)',             labelColor: '#9e9e9e' },
  // Composition: solid line, filled diamond at owner (source), open arrow at part (target)
  composition:   { stroke: '#9cdcfe', dash: undefined, markerEnd: 'url(#arrow-open)', markerStart: 'url(#diamond-comp)', labelColor: '#9cdcfe' },
  association:   { stroke: '#777',    dash: undefined, markerEnd: 'url(#arrow-open)',             labelColor: '#777'    },
  flow:          { stroke: '#4ec9b0', dash: '6,3',     markerEnd: 'url(#arrow-flow)',             labelColor: '#4ec9b0' },
  typereference: { stroke: '#6a7a8a', dash: '3,3',     markerEnd: 'url(#arrow-open)',             labelColor: '#6a7a8a' },
};
const DEFAULT_EDGE_STYLE = EDGE_STYLES.association;

export default function DiagramViewer({ model, hiddenNodeIds, showCompartments = true, storageKey, onNodeSelect }: DiagramViewerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const transformRef = useRef(transform);
  useEffect(() => { transformRef.current = transform; }, [transform]);

  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const [sizeOverrides, setSizeOverrides] = useLocalStorage<Map<string, { w: number; h: number }>>(
    storageKey ? `${storageKey}:sizes` : '',
    new Map(),
  );
  const [positionOverrides, setPositionOverrides] = useLocalStorage<Map<string, { x: number; y: number }>>(
    storageKey ? `${storageKey}:positions` : '',
    new Map(),
  );
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const resizing = useRef<{ id: string; startX: number; startY: number; startW: number; startH: number } | null>(null);
  const draggingNode = useRef<{ id: string; startMouseX: number; startMouseY: number; startX: number; startY: number } | null>(null);
  // Set to true during onMove if distance > threshold; read in onClick to suppress accidental click-after-drag
  const wasDragRef = useRef(false);

  // ELK-computed positions and routing after each re-layout
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [routes, setRoutes] = useState<Map<string, { x: number; y: number }[]>>(new Map());
  const [layoutPending, setLayoutPending] = useState(false);
  // Increment to force a fresh ELK run (e.g. when Fit is pressed)
  const [layoutTrigger, setLayoutTrigger] = useState(0);
  // Stable ref so ELK effect can read current overrides without them being a dependency
  const positionOverridesRef = useRef(positionOverrides);
  positionOverridesRef.current = positionOverrides;

  const allNodes = useMemo(
    () => model?.children.filter((c): c is SNode => c.type === 'node') ?? [],
    [model],
  );
  const allEdges = useMemo(
    () => model?.children.filter((c): c is SEdge => c.type === 'edge') ?? [],
    [model],
  );

  // Recompute visible nodes whenever hiddenNodeIds changes — explicit dep so
  // React never skips the recompute when the Set reference updates.
  const nodes = useMemo(() => {
    const hidden = hiddenNodeIds ?? new Set<string>();
    return allNodes.filter((n) => !hidden.has(n.id));
  }, [allNodes, hiddenNodeIds]);

  // Recompute visible edges whenever nodes change — edges whose endpoint is
  // hidden are removed immediately without waiting for an ELK re-layout.
  const edges = useMemo(() => {
    const visibleIds = new Set(nodes.map((n) => n.id));
    return allEdges.filter((e) => visibleIds.has(e.sourceId) && visibleIds.has(e.targetId));
  }, [allEdges, nodes]);

  const effectiveSize = useCallback((node: SNode) => {
    const hasUsages = node.children.some((c) => c.id.includes('__usage__'));
    const override = sizeOverrides.get(node.id);
    const naturalH = (!showCompartments && hasUsages) ? COMPACT_HEIGHT : node.size.height;
    let h: number;
    if (override) {
      if (!showCompartments && hasUsages) {
        // Collapsing: cap at compact height
        h = Math.min(override.h, COMPACT_HEIGHT);
      } else {
        // Expanding: never let an override hide compartments — enforce natural minimum
        h = Math.max(override.h, naturalH);
      }
    } else {
      h = naturalH;
    }
    return {
      w: override ? override.w : node.size.width,
      h,
    };
  }, [sizeOverrides, showCompartments]);

  // ── Re-layout with ELK whenever visible nodes, sizes, or edges change ──────
  const visibleKey = nodes.map((n) => n.id).sort().join(',');
  const sizesKey = nodes.map((n) => { const s = effectiveSize(n); return `${n.id}:${s.w}x${s.h}`; }).join(',');
  const edgesKey = edges.map((e) => `${e.sourceId}→${e.targetId}`).sort().join(',');

  useEffect(() => {
    if (nodes.length === 0) return;

    let cancelled = false;
    setLayoutPending(true);

    const elkGraph = {
      id: 'graph',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'DOWN',
        'elk.spacing.nodeNode': '40',
        'elk.layered.spacing.nodeNodeBetweenLayers': '60',
      },
      children: nodes.map((n) => {
        const { w, h } = effectiveSize(n);
        return { id: n.id, width: w, height: h };
      }),
      edges: edges
        .filter((e) => nodes.some((n) => n.id === e.sourceId) && nodes.some((n) => n.id === e.targetId))
        .map((e) => ({ id: e.id, sources: [e.sourceId], targets: [e.targetId] })),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    elk.layout(elkGraph).then((result: any) => {
      if (cancelled) return;

      const newPositions = new Map<string, { x: number; y: number }>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const child of result.children ?? []) {
        newPositions.set(child.id, { x: child.x ?? 0, y: child.y ?? 0 });
      }

      const newRoutes = new Map<string, { x: number; y: number }[]>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const edge of result.edges ?? []) {
        const section = edge.sections?.[0];
        if (section) {
          newRoutes.set(edge.id, [
            section.startPoint,
            ...(section.bendPoints ?? []),
            section.endPoint,
          ]);
        }
      }

      setPositions(newPositions);
      setRoutes(newRoutes);
      setLayoutPending(false);

      // Auto-fit viewport. If the user has manually-placed nodes (restored from storage),
      // fit to THOSE positions so the viewport actually shows them.
      // If no overrides exist (fresh layout / after Fit), fit to ELK positions.
      if (!svgRef.current) return;
      const svgRect = svgRef.current.getBoundingClientRect();
      const svgW = svgRect.width;
      const svgH = svgRect.height;
      if (svgW === 0 || svgH === 0) return;

      const overrides = positionOverridesRef.current;
      const hasOverrides = overrides.size > 0;

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const node of nodes) {
        const pos = hasOverrides
          ? (overrides.get(node.id) ?? newPositions.get(node.id) ?? { x: 0, y: 0 })
          : (newPositions.get(node.id) ?? { x: 0, y: 0 });
        const { w, h } = effectiveSize(node);
        minX = Math.min(minX, pos.x);
        minY = Math.min(minY, pos.y);
        maxX = Math.max(maxX, pos.x + w);
        maxY = Math.max(maxY, pos.y + h);
      }

      const bbW = maxX - minX;
      const bbH = maxY - minY;
      if (bbW === 0 || bbH === 0) return;

      const scale = Math.min(
        (svgW - LAYOUT_PADDING * 2) / bbW,
        (svgH - LAYOUT_PADDING * 2) / bbH,
        1.5,
      );
      setTransform({
        x: svgW / 2 - (minX + bbW / 2) * scale,
        y: svgH / 2 - (minY + bbH / 2) * scale,
        scale,
      });
    }).catch(() => { if (!cancelled) setLayoutPending(false); });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleKey, sizesKey, edgesKey, layoutTrigger]);

  // ── Fit: clear manual positions, re-run ELK, fit viewport ────────────────
  const fitToWindow = useCallback(() => {
    setPositionOverrides(new Map());   // wipe stored positions
    setLayoutTrigger((n) => n + 1);   // force a fresh ELK run
  }, [setPositionOverrides]);

  // ── Helpers using laid-out positions ──────────────────────────────────────
  const nodePos = (id: string) => positionOverrides.get(id) ?? positions.get(id) ?? { x: 0, y: 0 };
  const nodeSz  = (id: string) => {
    const n = nodes.find((n) => n.id === id);
    return n ? effectiveSize(n) : { w: 160, h: 60 };
  };

  const edgePath = (edge: SEdge): string => {
    const sp = nodePos(edge.sourceId); const ss = nodeSz(edge.sourceId);
    const tp = nodePos(edge.targetId); const ts = nodeSz(edge.targetId);
    // Use ELK routing only when neither endpoint has been manually moved
    const manuallyMoved = positionOverrides.has(edge.sourceId) || positionOverrides.has(edge.targetId);
    if (!manuallyMoved) {
      const pts = routes.get(edge.id);
      if (pts && pts.length >= 2) {
        return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      }
    }
    return `M ${sp.x + ss.w / 2} ${sp.y + ss.h / 2} L ${tp.x + ts.w / 2} ${tp.y + ts.h / 2}`;
  };

  const edgeCenter = (edge: SEdge) => {
    const pts = routes.get(edge.id);
    if (pts && pts.length >= 2) return pts[Math.floor(pts.length / 2)];
    const sp = nodePos(edge.sourceId); const ss = nodeSz(edge.sourceId);
    const tp = nodePos(edge.targetId); const ts = nodeSz(edge.targetId);
    return {
      x: (sp.x + ss.w / 2 + tp.x + ts.w / 2) / 2,
      y: (sp.y + ss.h / 2 + tp.y + ts.h / 2) / 2,
    };
  };

  // ── Resize handle ─────────────────────────────────────────────────────────
  const onResizeMouseDown = useCallback((e: React.MouseEvent, node: SNode) => {
    e.stopPropagation();
    e.preventDefault();
    const sz = effectiveSize(node);
    resizing.current = { id: node.id, startX: e.clientX, startY: e.clientY, startW: sz.w, startH: sz.h };
    document.body.style.cursor = 'se-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return;
      const scale = transformRef.current.scale;
      const { id, startX, startY, startW, startH } = resizing.current;
      setSizeOverrides((prev) => new Map(prev).set(id, {
        w: Math.max(MIN_W, startW + (ev.clientX - startX) / scale),
        h: Math.max(MIN_H, startH + (ev.clientY - startY) / scale),
      }));
    };
    const onUp = () => {
      resizing.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [effectiveSize]);

  const onResizeDoubleClick = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setSizeOverrides((prev) => { const next = new Map(prev); next.delete(nodeId); return next; });
  }, []);

  // ── Node drag-to-move ─────────────────────────────────────────────────────
  const onNodeMouseDown = useCallback((e: React.MouseEvent, node: SNode) => {
    e.stopPropagation(); // prevent background pan
    wasDragRef.current = false; // reset drag flag for this interaction
    const pos = positionOverrides.get(node.id) ?? positions.get(node.id) ?? { x: 0, y: 0 };
    draggingNode.current = {
      id: node.id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startX: pos.x,
      startY: pos.y,
    };
    document.body.style.cursor = 'move';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent) => {
      if (!draggingNode.current) return;
      const dx = ev.clientX - draggingNode.current.startMouseX;
      const dy = ev.clientY - draggingNode.current.startMouseY;
      // Ignore sub-threshold jitter so a normal click never moves the node
      if (Math.abs(dx) <= 4 && Math.abs(dy) <= 4) return;
      wasDragRef.current = true;
      const scale = transformRef.current.scale;
      const { id, startX, startY } = draggingNode.current;
      setPositionOverrides((prev) => new Map(prev).set(id, {
        x: startX + dx / scale,
        y: startY + dy / scale,
      }));
    };
    const onUp = () => {
      const info = draggingNode.current;
      draggingNode.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      // If the drag never exceeded the threshold, remove any accidental tiny offset
      if (!wasDragRef.current && info) {
        setPositionOverrides((prev) => {
          const next = new Map(prev);
          next.delete(info.id);
          return next;
        });
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [positions, positionOverrides]);

  // ── Node click (selection + editor navigation) ────────────────────────────
  const onNodeClick = useCallback((e: React.MouseEvent, node: SNode) => {
    e.stopPropagation();
    if (wasDragRef.current) return; // suppress click after drag
    setSelectedNodeId(node.id);
    if (onNodeSelect) {
      const range = node.data?.range as
        | { start: { line: number; character: number }; end: { line: number; character: number } }
        | undefined;
      if (range) onNodeSelect(range);
    }
  }, [onNodeSelect]);

  // ── SVG pan ───────────────────────────────────────────────────────────────
  const onSvgMouseDown = (e: React.MouseEvent) => {
    if (resizing.current || draggingNode.current) return;
    dragging.current = true;
    dragStart.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
  };
  const onSvgMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    setTransform((t) => ({ ...t, x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y }));
  };
  const onSvgMouseUp = () => { dragging.current = false; };
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform((t) => ({ ...t, scale: Math.max(0.1, Math.min(5, t.scale * delta)) }));
  };

  if (!model || allNodes.length === 0) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 32 }}>&#x2B21;</div>
        <div>No diagram to display</div>
        <div style={{ fontSize: 12, color: '#444' }}>Start editing to generate a Block Definition Diagram</div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Floating controls — top-right */}
      <div style={{
        position: 'absolute', top: 8, right: 8, zIndex: 10,
        display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end',
      }}>
        {layoutPending && (
          <div style={{
            background: '#007acc', color: '#fff', fontSize: 11, borderRadius: 3,
            padding: '2px 8px', pointerEvents: 'none',
          }}>
            Laying out…
          </div>
        )}
        <button
          onClick={fitToWindow}
          title="Fit all visible elements to window"
          style={{
            background: '#2d2d2d', border: '1px solid #555', color: '#ccc',
            fontSize: 11, borderRadius: 3, padding: '3px 8px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#007acc'; e.currentTarget.style.borderColor = '#007acc'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#2d2d2d'; e.currentTarget.style.borderColor = '#555'; }}
        >
          ⊡ Fit
        </button>
      </div>
      <svg
        ref={svgRef}
        style={{ width: '100%', height: '100%', background: '#1e1e1e', cursor: dragging.current ? 'grabbing' : 'default' }}
        onMouseDown={onSvgMouseDown}
        onMouseMove={onSvgMouseMove}
        onMouseUp={onSvgMouseUp}
        onMouseLeave={onSvgMouseUp}
        onWheel={onWheel}
      >
        <defs>
          {/* Generalization: hollow triangle at parent (target) — UML/SysML notation */}
          <marker id="tri-hollow" markerWidth="14" markerHeight="10" refX="13" refY="5" orient="auto">
            <polygon points="0 0, 12 5, 0 10" fill="#1e1e1e" stroke="#9e9e9e" strokeWidth="1.5" />
          </marker>
          {/* Open chevron arrowhead — for association, typereference, composition part-end */}
          <marker id="arrow-open" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
            <polyline points="0 0, 9 4, 0 8" fill="none" stroke="#777" strokeWidth="1.5" />
          </marker>
          {/* Flow arrow */}
          <marker id="arrow-flow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
            <polyline points="0 0, 9 4, 0 8" fill="none" stroke="#4ec9b0" strokeWidth="1.5" />
          </marker>
          {/* Composition: filled diamond at owner (source) — markerStart */}
          <marker id="diamond-comp" markerWidth="16" markerHeight="9" refX="1" refY="4.5" orient="auto">
            <polygon points="1 4.5, 7 1, 13 4.5, 7 8" fill="#9cdcfe" stroke="#9cdcfe" strokeWidth="1" />
          </marker>
        </defs>

        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
          {/* Edges */}
          {edges.map((edge) => {
            const kind = edge.cssClasses?.[0] ?? 'association';
            const style = EDGE_STYLES[kind] ?? DEFAULT_EDGE_STYLE;
            const c = edgeCenter(edge);
            const label = edge.children[0];
            return (
              <g key={edge.id}>
                <path
                  d={edgePath(edge)}
                  stroke={style.stroke}
                  strokeWidth={1.5}
                  strokeDasharray={style.dash}
                  fill="none"
                  markerEnd={style.markerEnd}
                  markerStart={style.markerStart}
                />
                {label && label.text && c && (
                  <text x={c.x} y={c.y - 6} fill={style.labelColor} fontSize={10} textAnchor="middle" fontStyle="italic">
                    {label.text}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const cssClass = node.cssClasses?.[0] ?? 'default';
            const color = NODE_COLORS[cssClass] ?? NODE_COLORS.default;
            const kindLabel  = node.children.find((c) => c.id.endsWith('__kind'));
            const nameLabel  = node.children.find((c) => c.id.endsWith('__label'));
            const usageLabels = node.children.filter((c) => c.id.includes('__usage__')).sort((a, b) => a.text.localeCompare(b.text));
            const hasUsages  = usageLabels.length > 0;
            const { w, h }   = effectiveSize(node);
            const pos        = nodePos(node.id);
            const isHovered   = hoveredNodeId === node.id;
            const isSelected  = selectedNodeId === node.id;
            const hasOverride = sizeOverrides.has(node.id);

            return (
              <g
                key={node.id}
                transform={`translate(${pos.x},${pos.y})`}
                onMouseDown={(e) => onNodeMouseDown(e, node)}
                onClick={(e) => onNodeClick(e, node)}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                style={{ cursor: 'move' }}
              >
                <rect width={w} height={h} rx={2} fill={color} stroke={isSelected ? '#f0c040' : isHovered ? '#4d9ad4' : '#4a5a7a'} strokeWidth={isSelected ? 2 : isHovered ? 1.5 : 1} />
                {isSelected && <rect width={w} height={h} rx={2} fill="none" stroke="#f0c040" strokeWidth={3} opacity={0.25} />}
                {/* Header compartment separator: kind label above, name below */}
                <line x1={0} y1={26} x2={w} y2={26} stroke="#4a5a7a" strokeWidth={0.5} />
                {kindLabel && (
                  <text x={w / 2} y={17} fill="#b0c0d8" fontSize={10} textAnchor="middle" fontStyle="italic">{kindLabel.text}</text>
                )}
                {nameLabel && (
                  <text x={w / 2} y={42} fill="#e8eef6" fontSize={13} textAnchor="middle" fontWeight="bold">{nameLabel.text}</text>
                )}
                {/* Compartment body separator */}
                {hasUsages && showCompartments && h > COMPACT_HEIGHT && (
                  <>
                    <line x1={0} y1={56} x2={w} y2={56} stroke="#4a5a7a" strokeWidth={1} />
                    {usageLabels.map((ul, i) => (
                      <text key={ul.id} x={8} y={71 + i * 18} fill="#c8d8e8" fontSize={10} fontFamily="'Consolas','Courier New',monospace">{ul.text}</text>
                    ))}
                  </>
                )}
                {/* Resize grip */}
                {isHovered && (
                  <g
                    transform={`translate(${w - 14},${h - 14})`}
                    onMouseDown={(e) => onResizeMouseDown(e, node)}
                    onDoubleClick={(e) => onResizeDoubleClick(e, node.id)}
                    style={{ cursor: 'se-resize' }}
                  >
                    {[0, 4, 8].map((d) => (
                      <React.Fragment key={d}>
                        <circle cx={12 - d} cy={12} r={1.2} fill={hasOverride ? '#007acc' : '#888'} />
                        {d < 8 && <circle cx={12} cy={12 - (8 - d)} r={1.2} fill={hasOverride ? '#007acc' : '#888'} />}
                      </React.Fragment>
                    ))}
                    <rect x={0} y={0} width={14} height={14} fill="transparent" />
                  </g>
                )}
              </g>
            );
          })}
        </g>

        {/* Legend */}
        <g transform="translate(10,10)">
          {[
            { label: 'generalization', color: '#9e9e9e', dash: undefined },
            { label: 'composition',    color: '#9cdcfe', dash: undefined },
            { label: 'association',    color: '#777',    dash: undefined },
            { label: 'flow',           color: '#4ec9b0', dash: '6,3'     },
            { label: 'type ref',       color: '#6a7a8a', dash: '3,3'     },
          ].map(({ label, color, dash }, i) => (
            <g key={label} transform={`translate(0,${i * 18})`}>
              <line x1={0} y1={7} x2={24} y2={7} stroke={color} strokeWidth={1.5} strokeDasharray={dash} />
              <text x={28} y={11} fill={color} fontSize={10}>{label}</text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
