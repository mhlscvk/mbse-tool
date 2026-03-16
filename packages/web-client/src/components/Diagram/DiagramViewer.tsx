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
  hiddenEdgeIds?: Set<string>;
  storageKey?: string;
  viewMode?: 'nested' | 'tree';
  onViewModeChange?: (mode: 'nested' | 'tree') => void;
  onNodeSelect?: (range: { start: { line: number; character: number }; end: { line: number; character: number } }) => void;
  onHideNode?: (id: string) => void;
  onHideEdge?: (id: string) => void;
}

interface ContextMenu {
  x: number;
  y: number;
  type: 'node' | 'edge';
  id: string;
  label: string;
}

const LAYOUT_PADDING = 48;

const NODE_COLORS: Record<string, string> = {
  package:              '#2a2a3a',
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
  actionin:             '#082828',
  actionout:            '#1a1008',
  actioninout:          '#1a2828',
  stdlib:               '#0a2018',
  default:              '#252525',
};

// SysML v2 compliant edge styles
// - Specialization (subclassification): solid line, hollow triangle at supertype
// - Composition (ownership): solid line, filled diamond at owner, NO arrowhead at target
// - Association (connection): solid line, open arrowhead at target
// - Flow (succession): dashed line, open arrowhead at target
// - Type reference: dashed line, open arrowhead at type
const EDGE_STYLES: Record<string, { stroke: string; dash?: string; markerEnd: string; markerStart?: string; labelColor: string }> = {
  dependency:    { stroke: '#9e9e9e', dash: undefined, markerEnd: 'url(#tri-spec)',                                      labelColor: '#9e9e9e' },
  composition:   { stroke: '#9cdcfe', dash: undefined, markerEnd: '',                markerStart: 'url(#diamond-comp)',  labelColor: '#9cdcfe' },
  association:   { stroke: '#777',    dash: undefined, markerEnd: 'url(#arrow-assoc)',                                   labelColor: '#777'    },
  flow:          { stroke: '#4ec9b0', dash: '6,3',     markerEnd: 'url(#arrow-flow)',                                    labelColor: '#4ec9b0' },
  typereference: { stroke: '#6a7a8a', dash: '3,3',     markerEnd: 'url(#arrow-typeref)',                                 labelColor: '#6a7a8a' },
};
const DEFAULT_EDGE_STYLE = EDGE_STYLES.association;

// SysML v2: definitions have sharp corners, usages have rounded corners, packages have sharp + tab
const DEF_CLASSES = new Set([
  'package', 'partdefinition', 'attributedefinition', 'connectiondefinition',
  'portdefinition', 'actiondefinition', 'statedefinition', 'itemdefinition',
]);
const isDefinition = (cssClass: string) => DEF_CLASSES.has(cssClass);
const isPackage = (cssClass: string) => cssClass === 'package';
const nodeRadius = (cssClass: string) => isDefinition(cssClass) || cssClass === 'stdlib' ? 0 : 10;

export default function DiagramViewer({
  model, hiddenNodeIds, hiddenEdgeIds, storageKey, viewMode = 'nested', onViewModeChange, onNodeSelect, onHideNode, onHideEdge,
}: DiagramViewerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
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

  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [layoutPending, setLayoutPending] = useState(false);
  const [layoutTrigger, setLayoutTrigger] = useState(0);
  const positionOverridesRef = useRef(positionOverrides);
  positionOverridesRef.current = positionOverrides;

  // IBD: container sizes computed by ELK compound layout
  const [layoutSizes, setIbdSizes] = useState(new Map<string, { w: number; h: number }>());

  // ELK-computed edge routes (tree mode): edge id → SVG path string
  const [elkEdgeRoutes, setElkEdgeRoutes] = useState(new Map<string, string>());

  const allNodes = useMemo(
    () => model?.children.filter((c): c is SNode => c.type === 'node') ?? [],
    [model],
  );
  const allNodeMap = useMemo(
    () => new Map(allNodes.map(n => [n.id, n])),
    [allNodes],
  );
  const allEdges = useMemo(
    () => model?.children.filter((c): c is SEdge => c.type === 'edge') ?? [],
    [model],
  );

  const nodes = useMemo(() => {
    const hidden = hiddenNodeIds ?? new Set<string>();
    return allNodes.filter((n) => !hidden.has(n.id));
  }, [allNodes, hiddenNodeIds]);

  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  const edges = useMemo(() => {
    const visibleIds = new Set(nodes.map((n) => n.id));
    const hiddenE = hiddenEdgeIds ?? new Set<string>();
    return allEdges.filter((e) =>
      visibleIds.has(e.sourceId) && visibleIds.has(e.targetId) && !hiddenE.has(e.id),
    );
  }, [allEdges, nodes, hiddenEdgeIds]);

  // Derive parent-child relationships directly from composition edges.
  // Each composition edge means: source owns target (target is nested inside source).
  const parentOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of allEdges) {
      if (e.cssClasses?.[0] === 'composition') map.set(e.targetId, e.sourceId);
    }
    return map;
  }, [allEdges]);

  const childrenOf = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const [child, parent] of parentOf) {
      const arr = map.get(parent) ?? [];
      arr.push(child);
      map.set(parent, arr);
    }
    return map;
  }, [parentOf]);

  const visibleNodeIds = useMemo(() => new Set(nodes.map(n => n.id)), [nodes]);

  const effectiveSize = useCallback((node: SNode) => {
    const override = sizeOverrides.get(node.id);
    return {
      w: override ? override.w : node.size.width,
      h: override ? Math.max(override.h, node.size.height) : node.size.height,
    };
  }, [sizeOverrides]);


  const visibleKey = nodes.map((n) => n.id).sort().join(',');
  const sizesKey = nodes.map((n) => { const s = effectiveSize(n); return `${n.id}:${s.w}x${s.h}`; }).join(',');
  const edgesKey = edges.map((e) => `${e.sourceId}→${e.targetId}`).sort().join(',');


  // ── ELK layout (General View) ──────────────────────────────────
  useEffect(() => {
    if (nodes.length === 0) return;
    let cancelled = false;
    setLayoutPending(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let elkGraph: any;

    if (viewMode === 'tree') {
      // ── Tree View: flat layout, all nodes at root, all edges routed by ELK ──
      const elkChildren = nodes.map(n => {
        const { w, h } = effectiveSize(n);
        return { id: n.id, width: w, height: h };
      });

      const elkEdges = edges.map(e => ({
        id: e.id,
        sources: [e.sourceId],
        targets: [e.targetId],
      }));

      elkGraph = {
        id: 'graph',
        layoutOptions: {
          'elk.algorithm': 'layered',
          'elk.direction': 'DOWN',
          'elk.spacing.nodeNode': '40',
          'elk.layered.spacing.nodeNodeBetweenLayers': '60',
          'elk.edgeRouting': 'ORTHOGONAL',
        },
        children: elkChildren,
        edges: elkEdges,
      };
    } else {
      // ── Nested View: compound ELK layout (recursive, respects expand state) ──
      const elkVisibleIds = visibleNodeIds ?? new Set(nodes.map(n => n.id));

      const visiting = new Set<string>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function buildElkNode(nodeId: string): any {
        if (visiting.has(nodeId)) return { id: nodeId, width: 140, height: 50 };
        visiting.add(nodeId);
        const n = nodeMap.get(nodeId);
        const { w, h } = n ? effectiveSize(n) : { w: 140, h: 50 };
        const cssClass = n?.cssClasses?.[0] ?? 'default';
        const childIds = (childrenOf.get(nodeId) ?? []).filter(id => elkVisibleIds.has(id));

        if (childIds.length > 0) {
          const isPkgNode = cssClass === 'package';
          const minW = Math.max(w, 140);
          const minH = Math.max(h, isPkgNode ? 80 : 70);
          const result = {
            id: nodeId,
            layoutOptions: {
              'elk.padding': `[top=${isPkgNode ? 48 : 44},left=${isPkgNode ? 20 : 28},bottom=${isPkgNode ? 20 : 16},right=${isPkgNode ? 20 : 16}]`,
              'elk.algorithm': 'layered',
              'elk.direction': isPkgNode ? 'DOWN' : 'RIGHT',
              'elk.spacing.nodeNode': isPkgNode ? '30' : '20',
              'elk.layered.spacing.nodeNodeBetweenLayers': isPkgNode ? '40' : '20',
              'elk.nodeSize.constraints': 'MINIMUM_SIZE',
              'elk.nodeSize.minimum': `(${minW},${minH})`,
            },
            children: childIds.map(cId => buildElkNode(cId)),
          };
          visiting.delete(nodeId);
          return result;
        }
        visiting.delete(nodeId);
        return { id: nodeId, width: w, height: h };
      }

      // A node is top-level if it has no parent, or its parent is hidden (not visible)
      const topLevel = nodes.filter(n => {
        if (!elkVisibleIds.has(n.id)) return false;
        const pid = parentOf.get(n.id);
        return !pid || !elkVisibleIds.has(pid);
      });
      const elkChildren = topLevel.map(n => buildElkNode(n.id));

      elkGraph = {
        id: 'graph',
        layoutOptions: {
          'elk.algorithm': 'layered',
          'elk.direction': 'DOWN',
          'elk.spacing.nodeNode': '60',
          'elk.layered.spacing.nodeNodeBetweenLayers': '80',
        },
        children: elkChildren,
        edges: [],
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    elk.layout(elkGraph).then((result: any) => {
      if (cancelled) return;

      const newPositions = new Map<string, { x: number; y: number }>();
      const newIbdSizes = new Map<string, { w: number; h: number }>();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function collectPos(elkNode: any, ox: number, oy: number) {
        const ax = (elkNode.x ?? 0) + ox;
        const ay = (elkNode.y ?? 0) + oy;
        newPositions.set(elkNode.id, { x: ax, y: ay });
        if (elkNode.width != null && elkNode.height != null) {
          newIbdSizes.set(elkNode.id, { w: elkNode.width, h: elkNode.height });
        }
        for (const child of elkNode.children ?? []) collectPos(child, ax, ay);
      }
      for (const child of result.children ?? []) collectPos(child, 0, 0);

      // Collect ELK-computed edge routes (tree mode)
      const newEdgeRoutes = new Map<string, string>();
      if (viewMode === 'tree' && result.edges) {
        for (const elkEdge of result.edges) {
          if (!elkEdge.sections || elkEdge.sections.length === 0) continue;
          const pathParts: string[] = [];
          for (const section of elkEdge.sections) {
            const start = section.startPoint;
            pathParts.push(`M ${start.x} ${start.y}`);
            for (const bp of section.bendPoints ?? []) {
              pathParts.push(`L ${bp.x} ${bp.y}`);
            }
            const end = section.endPoint;
            pathParts.push(`L ${end.x} ${end.y}`);
          }
          newEdgeRoutes.set(elkEdge.id, pathParts.join(' '));
        }
      }
      setElkEdgeRoutes(newEdgeRoutes);

      setPositions(newPositions);
      setIbdSizes(newIbdSizes);
      setLayoutPending(false);

      // Auto-fit
      if (!svgRef.current) return;
      const svgRect = svgRef.current.getBoundingClientRect();
      if (svgRect.width === 0 || svgRect.height === 0) return;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [id, pos] of newPositions) {
        const sz = newIbdSizes.get(id);
        if (!sz) continue;
        minX = Math.min(minX, pos.x);
        minY = Math.min(minY, pos.y);
        maxX = Math.max(maxX, pos.x + sz.w);
        maxY = Math.max(maxY, pos.y + sz.h);
      }
      const bbW = maxX - minX, bbH = maxY - minY;
      if (!isFinite(bbW) || !isFinite(bbH) || bbW <= 0 || bbH <= 0) return;
      const scale = Math.max(0.05, Math.min(
        (svgRect.width - LAYOUT_PADDING * 2) / bbW,
        (svgRect.height - LAYOUT_PADDING * 2) / bbH,
        1.5,
      ));
      setTransform({
        x: svgRect.width / 2 - (minX + bbW / 2) * scale,
        y: svgRect.height / 2 - (minY + bbH / 2) * scale,
        scale,
      });
    }).catch(() => { if (!cancelled) setLayoutPending(false); });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleKey, sizesKey, edgesKey, layoutTrigger, viewMode]);

  const fitToWindow = useCallback(() => {
    setPositionOverrides(new Map());
    setLayoutTrigger((n) => n + 1);
  }, [setPositionOverrides]);

  const nodePos = (id: string) => positionOverrides.get(id) ?? positions.get(id) ?? { x: 0, y: 0 };
  const nodeSz = (id: string) => {
    const ibd = layoutSizes.get(id);
    if (ibd) return ibd;
    const n = nodeMap.get(id);
    return n ? effectiveSize(n) : { w: 160, h: 60 };
  };

  const nodeCenter = (id: string): { x: number; y: number } => {
    const pos = nodePos(id);
    const sz = nodeSz(id);
    return { x: pos.x + sz.w / 2, y: pos.y + sz.h / 2 };
  };

  // Compute the point on a node's border closest to a target point
  const borderPoint = (
    center: { x: number; y: number },
    size: { w: number; h: number },
    target: { x: number; y: number },
  ) => {
    const dx = target.x - center.x;
    const dy = target.y - center.y;
    if (dx === 0 && dy === 0) return center;
    const hw = size.w / 2;
    const hh = size.h / 2;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    // Scale factor to reach the rectangle border
    const scale = absDy * hw > absDx * hh
      ? hh / absDy
      : hw / absDx;
    return { x: center.x + dx * scale, y: center.y + dy * scale };
  };

  const edgePath = (edge: SEdge): string => {
    // Use ELK-computed route in tree mode if available
    const elkRoute = elkEdgeRoutes.get(edge.id);
    if (elkRoute) return elkRoute;
    // Fallback: straight line between node border intersection points
    const src = nodeCenter(edge.sourceId);
    const tgt = nodeCenter(edge.targetId);
    const srcSz = nodeSz(edge.sourceId);
    const tgtSz = nodeSz(edge.targetId);
    const srcPt = borderPoint(src, srcSz, tgt);
    const tgtPt = borderPoint(tgt, tgtSz, src);
    return `M ${srcPt.x} ${srcPt.y} L ${tgtPt.x} ${tgtPt.y}`;
  };

  const edgeCenter = (edge: SEdge) => {
    const src = nodeCenter(edge.sourceId);
    const tgt = nodeCenter(edge.targetId);
    return { x: (src.x + tgt.x) / 2, y: (src.y + tgt.y) / 2 };
  };

  const onNodeClick = useCallback((e: React.MouseEvent, node: SNode) => {
    e.stopPropagation();
    setSelectedNodeId(node.id);
    if (onNodeSelect) {
      const range = node.data?.range as
        | { start: { line: number; character: number }; end: { line: number; character: number } }
        | undefined;
      if (range) onNodeSelect(range);
    }
  }, [onNodeSelect]);

  const onSvgMouseDown = (e: React.MouseEvent) => {
    setContextMenu(null);
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

  // Depth of each node in the composition tree (for render ordering)
  const nodeDepth = useMemo(() => {
    const depth = new Map<string, number>();
    for (const node of nodes) {
      if (!parentOf.has(node.id)) depth.set(node.id, 0);
    }
    const queue = [...depth.keys()];
    while (queue.length > 0) {
      const id = queue.shift()!;
      const d = depth.get(id)!;
      for (const childId of childrenOf.get(id) ?? []) {
        if (!depth.has(childId)) { depth.set(childId, d + 1); queue.push(childId); }
      }
    }
    return depth;
  }, [nodes, parentOf, childrenOf]);

  if (!model || allNodes.length === 0) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 32 }}>&#x2B21;</div>
        <div>No diagram to display</div>
        <div style={{ fontSize: 12, color: '#444' }}>Start editing to generate a diagram</div>
      </div>
    );
  }

  // ── Render helpers ──────────────────────────────────────────────────────────

  // Render outermost containers first so children paint on top
  const renderNodes = [...nodes]
    .filter(n => visibleNodeIds.has(n.id))
    .sort((a, b) => (nodeDepth.get(a.id) ?? 0) - (nodeDepth.get(b.id) ?? 0));

  // In nested mode, hide composition edges (rendered as nesting); in tree mode, show all
  const renderEdges = viewMode === 'tree'
    ? edges.filter(e => visibleNodeIds.has(e.sourceId) && visibleNodeIds.has(e.targetId))
    : edges.filter(e =>
        e.cssClasses?.[0] !== 'composition' &&
        visibleNodeIds.has(e.sourceId) &&
        visibleNodeIds.has(e.targetId),
      );

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
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
        <div style={{ display: 'flex', gap: 2 }}>
          {(['nested', 'tree'] as const).map(mode => {
            const active = viewMode === mode;
            return (
              <button
                key={mode}
                onClick={() => {
                  if (onViewModeChange && mode !== viewMode) {
                    setPositionOverrides(new Map());
                    onViewModeChange(mode);
                  }
                }}
                title={mode === 'nested' ? 'Nested containment view' : 'Tree view (flat BDD-style)'}
                style={{
                  background: active ? '#007acc' : '#2d2d2d',
                  border: '1px solid', borderColor: active ? '#007acc' : '#555',
                  color: active ? '#fff' : '#ccc',
                  fontSize: 11, borderRadius: 3, padding: '3px 8px', cursor: 'pointer',
                  fontWeight: active ? 600 : 400,
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = '#4a4a4a'; } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = '#2d2d2d'; } }}
              >
                {mode === 'nested' ? '⊞ Nested' : '⊟ Tree'}
              </button>
            );
          })}
        </div>
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
        onContextMenu={(e) => e.preventDefault()}
      >
        <defs>
          {/* Specialization / subclassification: hollow triangle at supertype */}
          <marker id="tri-spec" markerWidth="14" markerHeight="10" refX="13" refY="5" orient="auto">
            <polygon points="0 0, 12 5, 0 10" fill="#1e1e1e" stroke="#9e9e9e" strokeWidth="1.5" />
          </marker>
          {/* Composition: filled diamond at owner end */}
          <marker id="diamond-comp" markerWidth="16" markerHeight="9" refX="1" refY="4.5" orient="auto">
            <polygon points="1 4.5, 7 1, 13 4.5, 7 8" fill="#9cdcfe" stroke="#9cdcfe" strokeWidth="1" />
          </marker>
          {/* Association / connection: open arrowhead */}
          <marker id="arrow-assoc" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
            <polyline points="0 0, 9 4, 0 8" fill="none" stroke="#777" strokeWidth="1.5" />
          </marker>
          {/* Flow / succession: open arrowhead */}
          <marker id="arrow-flow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
            <polyline points="0 0, 9 4, 0 8" fill="none" stroke="#4ec9b0" strokeWidth="1.5" />
          </marker>
          {/* Type reference: open arrowhead */}
          <marker id="arrow-typeref" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
            <polyline points="0 0, 9 4, 0 8" fill="none" stroke="#6a7a8a" strokeWidth="1.5" />
          </marker>
        </defs>

        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
          {/* Edges */}
          {renderEdges.map((edge) => {
            const kind = edge.cssClasses?.[0] ?? 'association';
            const style = EDGE_STYLES[kind] ?? DEFAULT_EDGE_STYLE;
            const c = edgeCenter(edge);
            const label = edge.children[0];
            const edgeLabel = label?.text || kind;
            return (
              <g key={edge.id} onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setContextMenu({ x: e.clientX, y: e.clientY, type: 'edge', id: edge.id, label: edgeLabel });
              }}>
                {/* Invisible wide hit area for easier right-click */}
                <path
                  d={edgePath(edge)}
                  stroke="transparent"
                  strokeWidth={12}
                  fill="none"
                  style={{ cursor: 'context-menu' }}
                />
                <path
                  d={edgePath(edge)}
                  stroke={style.stroke}
                  strokeWidth={1.5}
                  strokeDasharray={style.dash}
                  fill="none"
                  {...(style.markerEnd ? { markerEnd: style.markerEnd } : {})}
                  {...(style.markerStart ? { markerStart: style.markerStart } : {})}
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
          {renderNodes.map((node) => {
            const cssClass = node.cssClasses?.[0] ?? 'default';
            const color = NODE_COLORS[cssClass] ?? NODE_COLORS.default;
            const kindLabel  = node.children.find((c) => c.id.endsWith('__kind'));
            const nameLabel  = node.children.find((c) => c.id.endsWith('__label'));
            const { w, h }   = nodeSz(node.id);
            const pos        = nodePos(node.id);
            const isHovered   = hoveredNodeId === node.id;
            const isSelected  = selectedNodeId === node.id;
            const hasChildren = (childrenOf.get(node.id)?.length ?? 0) > 0;
            const isContainer = viewMode === 'nested' && hasChildren;
            const isPkg = isPackage(cssClass);

            const rx = nodeRadius(cssClass);

            const nodeName = nameLabel?.text || node.id;
            const onNodeContextMenu = (e: React.MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
              setContextMenu({ x: e.clientX, y: e.clientY, type: 'node', id: node.id, label: nodeName });
            };

            // ── SysML v2 Package: always tab-rectangle notation ──
            if (isPkg) {
              const borderColor = isSelected ? '#f0c040' : isHovered ? '#4d9ad4' : '#6a6a8a';
              const tabW = Math.min(w * 0.4, Math.max(80, (nodeName.length + 2) * 7));
              const tabH = 18;

              return (
                <g
                  key={node.id}
                  transform={`translate(${pos.x},${pos.y})`}
                  onClick={(e) => onNodeClick(e, node)}
                  onContextMenu={onNodeContextMenu}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Tab */}
                  <rect width={tabW} height={tabH} fill={color} fillOpacity={0.9}
                    stroke={borderColor} strokeWidth={isSelected ? 2.5 : isHovered ? 2 : 1.5} />
                  <text x={tabW / 2} y={tabH - 4} fill="#9a9ac0" fontSize={9} textAnchor="middle" fontStyle="italic">
                    {kindLabel?.text}
                  </text>
                  {/* Main body below tab */}
                  <rect y={tabH} width={w} height={h - tabH}
                    fill={color} fillOpacity={isContainer ? 0.15 : 0.35}
                    stroke={borderColor}
                    strokeWidth={isSelected ? 2.5 : isHovered ? 2 : 1.5} />
                  {/* Package name */}
                  <text x={12} y={tabH + 20} fill="#d0d0e8" fontSize={13} fontWeight="bold">
                    {nameLabel?.text}
                  </text>
                  {isSelected && (
                    <>
                      <rect width={tabW} height={tabH} fill="none" stroke="#f0c040" strokeWidth={3} opacity={0.2} />
                      <rect y={tabH} width={w} height={h - tabH} fill="none" stroke="#f0c040" strokeWidth={3} opacity={0.2} />
                    </>
                  )}
                </g>
              );
            }

            // ── Non-package container (nested mode only): title-bar + children area ──
            if (isContainer) {
              const borderColor = isSelected ? '#f0c040' : isHovered ? '#4d9ad4' : '#4a8ab0';

              return (
                <g
                  key={node.id}
                  transform={`translate(${pos.x},${pos.y})`}
                  onClick={(e) => onNodeClick(e, node)}
                  onContextMenu={onNodeContextMenu}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Container border */}
                  <rect
                    width={w} height={h} rx={rx}
                    fill={color} fillOpacity={0.25}
                    stroke={borderColor}
                    strokeWidth={isSelected ? 2.5 : isHovered ? 2 : 1.5}
                  />
                  {/* Title bar background */}
                  <rect width={w} height={40} rx={rx} fill={color} fillOpacity={0.9} />
                  {rx === 0
                    ? <rect y={0} width={w} height={40} fill={color} fillOpacity={0.9} />
                    : <rect y={4} width={w} height={36} fill={color} fillOpacity={0.9} />
                  }
                  {/* Title bar separator */}
                  <line x1={0} y1={40} x2={w} y2={40} stroke={borderColor} strokeWidth={1.5} />
                  {/* SysML v2 keyword label */}
                  {kindLabel && (
                    <text x={w / 2} y={14} fill="#b0c8e8" fontSize={10} textAnchor="middle" fontStyle="italic">
                      {kindLabel.text}
                    </text>
                  )}
                  {/* Name label */}
                  {nameLabel && (
                    <text x={w / 2} y={30} fill="#e8eef6" fontSize={13} textAnchor="middle" fontWeight="bold">
                      {nameLabel.text}
                    </text>
                  )}
                  {isSelected && (
                    <rect width={w} height={h} rx={rx} fill="none" stroke="#f0c040" strokeWidth={3} opacity={0.2} />
                  )}
                </g>
              );
            }

            // ── Leaf / tree-mode node: SysML v2 two-compartment box ──
            // Definitions: sharp corners (rx=0), Usages: rounded corners (rx=10)
            return (
              <g
                key={node.id}
                transform={`translate(${pos.x},${pos.y})`}
                onClick={(e) => onNodeClick(e, node)}
                onContextMenu={onNodeContextMenu}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                style={{ cursor: 'pointer' }}
              >
                {(() => {
                  const isIn    = cssClass === 'actionin';
                  const isOut   = cssClass === 'actionout';
                  const isInOut = cssClass === 'actioninout';
                  const isParam = isIn || isOut || isInOut;
                  const borderColor = isSelected ? '#f0c040' : isHovered
                    ? (isIn ? '#60ffb0' : isOut ? '#ffb060' : isInOut ? '#60b0ff' : '#4d9ad4')
                    : (isIn ? '#30a060' : isOut ? '#a06020' : isInOut ? '#2060a0' : '#4a5a7a');
                  return (
                    <>
                      <rect width={w} height={h} rx={rx} fill={color} stroke={borderColor} strokeWidth={isSelected ? 2 : isHovered ? 1.5 : 1} />
                      {isSelected && <rect width={w} height={h} rx={rx} fill="none" stroke="#f0c040" strokeWidth={3} opacity={0.25} />}
                      <line x1={0} y1={26} x2={w} y2={26} stroke={borderColor} strokeWidth={0.5} />
                      {/* Direction badge for action in/out/inout params */}
                      {isParam && (
                        <text x={6} y={17} fill={isIn ? '#40c080' : isOut ? '#c07030' : '#4090c0'} fontSize={10} fontWeight="bold">
                          {isIn ? '▶ in' : isOut ? '◀ out' : '◆ inout'}
                        </text>
                      )}
                      {!isParam && kindLabel && (
                        <text x={w / 2} y={17} fill="#b0c0d8" fontSize={10} textAnchor="middle" fontStyle="italic">{kindLabel.text}</text>
                      )}
                    </>
                  );
                })()}
                {nameLabel && (
                  <text x={w / 2} y={42} fill="#e8eef6" fontSize={13} textAnchor="middle" fontWeight="bold">{nameLabel.text}</text>
                )}
              </g>
            );
          })}

        </g>

        {/* SysML v2 General View Legend */}
        <g transform="translate(10,10)">
          {/* Node shape legend */}
          <g transform="translate(0,0)">
            <rect width={10} height={6} fill="#2a2a3a" stroke="#6a6a8a" strokeWidth={1} />
            <rect y={6} width={14} height={8} fill="#2a2a3a" stroke="#6a6a8a" strokeWidth={1} />
            <text x={18} y={11} fill="#9a9ac0" fontSize={9}>Package (tab)</text>
          </g>
          <g transform="translate(0,18)">
            <rect width={12} height={10} rx={0} fill="#1c3f6e" stroke="#4a8ab0" strokeWidth={1} y={2} />
            <text x={16} y={11} fill="#9ab8d8" fontSize={9}>Definition (sharp)</text>
          </g>
          <g transform="translate(0,34)">
            <rect width={12} height={10} rx={4} fill="#0a2040" stroke="#4a8ab0" strokeWidth={1} y={2} />
            <text x={16} y={11} fill="#9ab8d8" fontSize={9}>Usage (rounded)</text>
          </g>
          {/* Edge legend */}
          {[
            ...(viewMode === 'tree' ? [{ label: '◆── composition',    color: '#9cdcfe', dash: undefined }] : []),
            { label: '◁── specialization',  color: '#9e9e9e', dash: undefined },
            { label: '──▷ connection',       color: '#777',    dash: undefined },
            { label: '- -▷ flow',            color: '#4ec9b0', dash: '6,3'     },
            { label: '- -▷ typed by',        color: '#6a7a8a', dash: '3,3'     },
          ].map(({ label, color, dash }, i) => (
            <g key={label} transform={`translate(0,${54 + i * 16})`}>
              <line x1={0} y1={7} x2={20} y2={7} stroke={color} strokeWidth={1.5} strokeDasharray={dash} />
              <text x={24} y={11} fill={color} fontSize={9}>{label}</text>
            </g>
          ))}
        </g>
      </svg>

      {/* Right-click context menu */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 100,
            background: '#252526', border: '1px solid #454545', borderRadius: 4,
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)', padding: '4px 0',
            minWidth: 160, fontSize: 12, color: '#d4d4d4',
          }}
          onMouseLeave={() => setContextMenu(null)}
        >
          <div style={{ padding: '4px 12px', color: '#888', fontSize: 10, borderBottom: '1px solid #333', marginBottom: 2 }}>
            {contextMenu.type === 'node' ? 'Element' : 'Relationship'}: {contextMenu.label}
          </div>
          <button
            onClick={() => {
              if (contextMenu.type === 'node' && onHideNode) onHideNode(contextMenu.id);
              if (contextMenu.type === 'edge' && onHideEdge) onHideEdge(contextMenu.id);
              setContextMenu(null);
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '6px 12px', background: 'none', border: 'none',
              color: '#d4d4d4', cursor: 'pointer', textAlign: 'left', fontSize: 12,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#094771')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
          >
            <span style={{ opacity: 0.7 }}>&#x2716;</span> Hide {contextMenu.type === 'node' ? 'element' : 'relationship'}
          </button>
        </div>
      )}
    </div>
  );
}
