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
  onEdgeSelect?: (range: { start: { line: number; character: number }; end: { line: number; character: number } }) => void;
  onHideNode?: (id: string) => void;
  onHideEdge?: (id: string) => void;
  onHideNodes?: (ids: string[]) => void;
  onHideEdges?: (ids: string[]) => void;
  /** Controlled selected node id (synced with external panels) */
  selectedNodeId?: string | null;
  /** Controlled selected edge id (synced with external panels) */
  selectedEdgeId?: string | null;
  /** Called when user clicks a node in the diagram */
  onSelectedNodeChange?: (id: string | null) => void;
  /** Called when user clicks an edge in the diagram */
  onSelectedEdgeChange?: (id: string | null) => void;
}

interface ContextMenu {
  x: number;
  y: number;
  type: 'node' | 'edge' | 'multi';
  id: string;
  label: string;
  nodeIds?: string[];
  edgeIds?: string[];
}

interface SelectionRect {
  x1: number; y1: number;
  x2: number; y2: number;
}

function normalizeRect(r: SelectionRect) {
  return {
    x: Math.min(r.x1, r.x2),
    y: Math.min(r.y1, r.y2),
    w: Math.abs(r.x2 - r.x1),
    h: Math.abs(r.y2 - r.y1),
  };
}

function rectsIntersect(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function SelectionRectOverlay({ rect, scale }: { rect: SelectionRect; scale: number }) {
  const r = normalizeRect(rect);
  return (
    <rect
      x={r.x} y={r.y} width={r.w} height={r.h}
      fill="rgba(30,120,220,0.12)"
      stroke="#4a9eff"
      strokeWidth={1.5 / scale}
      strokeDasharray={`${6 / scale},${3 / scale}`}
      pointerEvents="none"
    />
  );
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
  // Extended definitions
  requirementdefinition:       '#5a1a1a',
  requirementusage:            '#3a0e0e',
  constraintdefinition:        '#5a2a1a',
  constraintusage:             '#3a1a0e',
  interfacedefinition:         '#2a1a5a',
  interfaceusage:              '#1a0e3a',
  enumdefinition:              '#1a4a3a',
  enumusage:                   '#0e2a20',
  calcdefinition:              '#0a3a4a',
  calcusage:                   '#062028',
  allocationdefinition:        '#4a3010',
  allocationusage:             '#2a1a08',
  usecasedefinition:           '#1a2a5a',
  usecaseusage:                '#0e1a3a',
  analysiscasedefinition:      '#2a3a4a',
  analysiscaseusage:           '#1a2028',
  verificationcasedefinition:  '#3a2a4a',
  verificationcaseusage:       '#201a28',
  concerndefinition:           '#4a3a2a',
  concernusage:                '#281e14',
  viewdefinition:              '#1a3a3a',
  viewusage:                   '#0e2020',
  viewpointdefinition:         '#2a2a4a',
  viewpointusage:              '#1a1a28',
  renderingdefinition:         '#3a3a3a',
  renderingusage:              '#202020',
  metadatadefinition:          '#3a2a3a',
  occurrencedefinition:        '#2a3a2a',
  occurrenceusage:             '#1a2a1a',
  // Control nodes
  forknode:                    '#4a4a4a',
  joinnode:                    '#4a4a4a',
  mergenode:                   '#3a3a2a',
  decidenode:                  '#3a3a2a',
  startnode:                   '#222222',
  terminatenode:               '#3a3a3a',
  transitionusage:             '#2a2a2a',
  stdlib:               '#0a2018',
  default:              '#252525',
};

// SysML v2.0 compliant edge styles (per OMG spec formal/2025-09-03, Section 8.2.3)
// - Subclassification:    solid line, hollow triangle at general end
// - Typing (defined by):  dashed line, hollow triangle at definition end
// - Subsetting :>:        solid line, open arrow (>) at subsetted end
// - Redefinition :>>:     solid line, open arrow (>) at redefined end, bar at redefining end
// - Ref subsetting ::>:   solid line, open arrow (>) at referenced end
// - Composition:          solid line, filled diamond at owner end
// - Connection:           solid line, end adornments
// - Flow:                 solid line, filled arrowhead at target
// - Succession:           solid line, open arrowhead at target
// - Transition:           solid line, filled arrowhead at target
// - Satisfy/Verify:       dashed line, open arrowhead
// - Allocate:             dashed line, open arrowhead
// - Binding:              dashed line, open circles at both ends
const EDGE_STYLES: Record<string, { stroke: string; dash?: string; markerEnd: string; markerStart?: string; labelColor: string }> = {
  dependency:          { stroke: '#9e9e9e', dash: undefined, markerEnd: 'url(#tri-spec)',                                      labelColor: '#9e9e9e' },
  subsetting:          { stroke: '#9e9e9e', dash: undefined, markerEnd: 'url(#arrow-open)',                                    labelColor: '#9e9e9e' },
  redefinition:        { stroke: '#9e9e9e', dash: undefined, markerEnd: 'url(#arrow-open)',  markerStart: 'url(#bar-redef)',   labelColor: '#9e9e9e' },
  composition:         { stroke: '#9cdcfe', dash: undefined, markerEnd: '',                  markerStart: 'url(#diamond-comp)',labelColor: '#9cdcfe' },
  association:         { stroke: '#777',    dash: undefined, markerEnd: 'url(#arrow-assoc)',                                   labelColor: '#777'    },
  flow:                { stroke: '#4ec9b0', dash: undefined, markerEnd: 'url(#arrow-flow-filled)',                             labelColor: '#4ec9b0' },
  typereference:       { stroke: '#6a7a8a', dash: '4,3',     markerEnd: 'url(#tri-typeref)',                                   labelColor: '#6a7a8a' },
  referencesubsetting: { stroke: '#9e9e9e', dash: undefined, markerEnd: 'url(#arrow-open)',                                    labelColor: '#9e9e9e' },
  satisfy:             { stroke: '#e06060', dash: '6,3',     markerEnd: 'url(#arrow-satisfy)',                                 labelColor: '#e06060' },
  verify:              { stroke: '#60b060', dash: '6,3',     markerEnd: 'url(#arrow-verify)',                                  labelColor: '#60b060' },
  allocate:            { stroke: '#c0a060', dash: '6,3',     markerEnd: 'url(#arrow-allocate)',                                labelColor: '#c0a060' },
  bind:                { stroke: '#9090c0', dash: '4,3',     markerEnd: '',                                                     labelColor: '#9090c0' },
};
const DEFAULT_EDGE_STYLE = EDGE_STYLES.association;

// SysML v2: definitions have sharp corners, usages have rounded corners, packages have sharp + tab
const DEF_CLASSES = new Set([
  'package', 'partdefinition', 'attributedefinition', 'connectiondefinition',
  'portdefinition', 'actiondefinition', 'itemdefinition',
  // Note: statedefinition intentionally excluded — states use rounded corners per SysML v2 spec
  'requirementdefinition', 'constraintdefinition', 'interfacedefinition', 'enumdefinition',
  'calcdefinition', 'allocationdefinition', 'usecasedefinition',
  'analysiscasedefinition', 'verificationcasedefinition',
  'concerndefinition', 'viewdefinition', 'viewpointdefinition',
  'renderingdefinition', 'metadatadefinition', 'occurrencedefinition',
]);
const isDefinition = (cssClass: string) => DEF_CLASSES.has(cssClass);
const isPackage = (cssClass: string) => cssClass === 'package';
const nodeRadius = (cssClass: string) => isDefinition(cssClass) || cssClass === 'stdlib' ? 0 : 10;

export default function DiagramViewer({
  model, hiddenNodeIds, hiddenEdgeIds, storageKey, viewMode = 'nested', onViewModeChange, onNodeSelect, onEdgeSelect, onHideNode, onHideEdge,
  onHideNodes, onHideEdges,
  selectedNodeId: controlledNodeId, selectedEdgeId: controlledEdgeId,
  onSelectedNodeChange, onSelectedEdgeChange,
}: DiagramViewerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const transformRef = useRef(transform);
  useEffect(() => { transformRef.current = transform; }, [transform]);

  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Multi-selection state
  const [multiSelectedNodeIds, setMultiSelectedNodeIds] = useState<Set<string>>(new Set());
  const selecting = useRef(false);
  const selectionBoundsRef = useRef<DOMRect | null>(null);
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const selectionRectRef = useRef<SelectionRect | null>(null);

  const [sizeOverrides, setSizeOverrides] = useLocalStorage<Map<string, { w: number; h: number }>>(
    storageKey ? `${storageKey}:sizes` : '',
    new Map(),
  );
  const [positionOverrides, setPositionOverrides] = useLocalStorage<Map<string, { x: number; y: number }>>(
    storageKey ? `${storageKey}:positions` : '',
    new Map(),
  );
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [internalSelectedNodeId, setInternalSelectedNodeId] = useState<string | null>(null);
  const [internalSelectedEdgeId, setInternalSelectedEdgeId] = useState<string | null>(null);

  // Use controlled props if provided, otherwise internal state
  const selectedNodeId = controlledNodeId !== undefined ? controlledNodeId : internalSelectedNodeId;
  const selectedEdgeId = controlledEdgeId !== undefined ? controlledEdgeId : internalSelectedEdgeId;

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

  // Auto-derive multi-selected edges: edges where both endpoints are multi-selected
  const multiSelectedEdgeIds = useMemo(() => {
    if (multiSelectedNodeIds.size === 0) return new Set<string>();
    const edgeIds = new Set<string>();
    for (const e of edges) {
      if (multiSelectedNodeIds.has(e.sourceId) && multiSelectedNodeIds.has(e.targetId)) {
        edgeIds.add(e.id);
      }
    }
    return edgeIds;
  }, [multiSelectedNodeIds, edges]);

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
    if (override) {
      return { w: override.w, h: Math.max(override.h, node.size.height) };
    }

    // Dynamically compute size based on content labels
    const kindLabel = node.children.find((c) => c.id.endsWith('__kind'));
    const nameLabel = node.children.find((c) => c.id.endsWith('__label'));
    const attrLabels = node.children.filter((c) => c.id.includes('__usage__'));

    if (attrLabels.length > 0) {
      const HEADER_H = 48;
      const ROW_H = 18;
      const h = HEADER_H + 6 + attrLabels.length * ROW_H + 4;
      const nameW = (nameLabel?.text.length ?? 0) * 8 + 24;
      const kindW = (kindLabel?.text.length ?? 0) * 6.2 + 24;
      const attrW = Math.max(...attrLabels.map((l) => l.text.length * 6.2 + 24));
      const w = Math.max(node.size.width, nameW, kindW, attrW);
      return { w, h };
    }

    // Non-compartment nodes: fit name and kind text
    const nameW = (nameLabel?.text.length ?? 0) * 8 + 24;
    const kindW = (kindLabel?.text.length ?? 0) * 6.2 + 24;
    const w = Math.max(node.size.width, nameW, kindW);
    return { w, h: node.size.height };
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

      // Behavioural container kinds: use DOWN direction + succession edges for flow ordering
      const BEHAVIOURAL_KINDS = new Set([
        'actiondefinition', 'actionusage', 'statedefinition', 'stateusage',
      ]);

      // Index flow edges by parent container for behavioural containers
      const flowEdgesByParent = new Map<string, Array<{ id: string; sources: string[]; targets: string[] }>>();
      for (const e of allEdges) {
        if (e.cssClasses?.[0] !== 'flow') continue;
        // Both source and target must share the same parent container
        const srcParent = parentOf.get(e.sourceId);
        const tgtParent = parentOf.get(e.targetId);
        if (srcParent && srcParent === tgtParent && elkVisibleIds.has(e.sourceId) && elkVisibleIds.has(e.targetId)) {
          const arr = flowEdgesByParent.get(srcParent) ?? [];
          arr.push({ id: e.id, sources: [e.sourceId], targets: [e.targetId] });
          flowEdgesByParent.set(srcParent, arr);
        }
      }

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
          const isBehavioural = BEHAVIOURAL_KINDS.has(cssClass);
          // Behavioural containers flow top-to-bottom like activity diagrams
          const isDownLayout = isPkgNode || isBehavioural;
          const minW = Math.max(w, 140);
          const minH = Math.max(h, isPkgNode ? 80 : 70);

          // Collect internal flow edges for behavioural containers (successions)
          const internalEdges = isBehavioural ? (flowEdgesByParent.get(nodeId) ?? []) : [];

          const result = {
            id: nodeId,
            layoutOptions: {
              'elk.padding': `[top=${isPkgNode ? 48 : 44},left=${isPkgNode ? 20 : isBehavioural ? 24 : 28},bottom=${isPkgNode ? 20 : 16},right=${isPkgNode ? 20 : isBehavioural ? 24 : 16}]`,
              'elk.algorithm': 'layered',
              'elk.direction': isDownLayout ? 'DOWN' : 'RIGHT',
              'elk.spacing.nodeNode': isPkgNode ? '30' : isBehavioural ? '24' : '20',
              'elk.layered.spacing.nodeNodeBetweenLayers': isPkgNode ? '40' : isBehavioural ? '32' : '20',
              ...(isBehavioural ? {
                'elk.edgeRouting': 'ORTHOGONAL',
                'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
              } : {}),
              'elk.nodeSize.constraints': 'MINIMUM_SIZE',
              'elk.nodeSize.minimum': `(${minW},${minH})`,
            },
            children: childIds.map(cId => buildElkNode(cId)),
            ...(internalEdges.length > 0 ? { edges: internalEdges } : {}),
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

  const clearSelection = useCallback(() => {
    if (multiSelectedNodeIds.size > 0) setMultiSelectedNodeIds(new Set());
    setInternalSelectedNodeId(null);
    setInternalSelectedEdgeId(null);
    if (onSelectedNodeChange) onSelectedNodeChange(null);
    if (onSelectedEdgeChange) onSelectedEdgeChange(null);
  }, [multiSelectedNodeIds.size, onSelectedNodeChange, onSelectedEdgeChange]);

  const onNodeClick = useCallback((e: React.MouseEvent, node: SNode) => {
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd+click: toggle node in/out of multi-selection
      setMultiSelectedNodeIds(prev => {
        const next = new Set(prev);
        if (next.has(node.id)) next.delete(node.id); else next.add(node.id);
        return next;
      });
      return;
    }
    if (multiSelectedNodeIds.size > 0) setMultiSelectedNodeIds(new Set());
    setInternalSelectedNodeId(node.id);
    setInternalSelectedEdgeId(null);
    if (onSelectedNodeChange) onSelectedNodeChange(node.id);
    if (onSelectedEdgeChange) onSelectedEdgeChange(null);
    if (onNodeSelect) {
      const range = node.data?.range as
        | { start: { line: number; character: number }; end: { line: number; character: number } }
        | undefined;
      if (range) onNodeSelect(range);
    }
  }, [onNodeSelect, onSelectedNodeChange, onSelectedEdgeChange, multiSelectedNodeIds.size]);

  const onEdgeClick = useCallback((e: React.MouseEvent, edge: SEdge) => {
    e.stopPropagation();
    if (multiSelectedNodeIds.size > 0) setMultiSelectedNodeIds(new Set());
    setInternalSelectedEdgeId(edge.id);
    setInternalSelectedNodeId(null);
    if (onSelectedEdgeChange) onSelectedEdgeChange(edge.id);
    if (onSelectedNodeChange) onSelectedNodeChange(null);
    if (onEdgeSelect) {
      // Try edge's own data range first, then fall back to source node's range
      const edgeRange = (edge as SEdge & { data?: Record<string, unknown> }).data?.range as
        | { start: { line: number; character: number }; end: { line: number; character: number } }
        | undefined;
      if (edgeRange) {
        onEdgeSelect(edgeRange);
        return;
      }
      // Fall back: navigate to the source node's range (where the relationship is declared)
      const sourceNode = allNodes.find(n => n.id === edge.sourceId);
      if (sourceNode) {
        const range = sourceNode.data?.range as
          | { start: { line: number; character: number }; end: { line: number; character: number } }
          | undefined;
        if (range) onEdgeSelect(range);
      }
    }
  }, [onEdgeSelect, allNodes, onSelectedEdgeChange, onSelectedNodeChange, multiSelectedNodeIds.size]);

  const screenToDiagram = useCallback((clientX: number, clientY: number) => {
    const t = transformRef.current;
    return { x: (clientX - t.x) / t.scale, y: (clientY - t.y) / t.scale };
  }, []);

  const onSvgMouseDown = (e: React.MouseEvent) => {
    setContextMenu(null);
    // Only handle left mouse button for drag/selection
    if (e.button !== 0) return;
    if (e.shiftKey) {
      // Shift+drag: start rubber-band selection
      const svg = svgRef.current;
      if (!svg) return;
      const bounds = svg.getBoundingClientRect();
      selectionBoundsRef.current = bounds;
      const pt = screenToDiagram(e.clientX - bounds.left, e.clientY - bounds.top);
      selecting.current = true;
      const selRect = { x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y };
      selectionRectRef.current = selRect;
      setSelectionRect(selRect);
      return;
    }
    dragging.current = true;
    dragStart.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
  };
  const onSvgMouseMove = (e: React.MouseEvent) => {
    if (selecting.current) {
      const bounds = selectionBoundsRef.current;
      if (!bounds) return;
      const pt = screenToDiagram(e.clientX - bounds.left, e.clientY - bounds.top);
      setSelectionRect(prev => {
        if (!prev) return null;
        const next = { ...prev, x2: pt.x, y2: pt.y };
        selectionRectRef.current = next;
        return next;
      });
      return;
    }
    if (!dragging.current) return;
    setTransform((t) => ({ ...t, x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y }));
  };
  const onSvgMouseUp = (e: React.MouseEvent) => {
    if (selecting.current) {
      selecting.current = false;
      selectionBoundsRef.current = null;
      const finalRect = selectionRectRef.current;
      if (finalRect) {
        const sel = normalizeRect(finalRect);
        // Only count as selection if dragged a meaningful distance
        if (sel.w > 5 || sel.h > 5) {
          const hitNodeIds = new Set<string>();
          for (const node of nodes) {
            const pos = nodePos(node.id);
            const sz = nodeSz(node.id);
            if (rectsIntersect(sel.x, sel.y, sel.w, sel.h, pos.x, pos.y, sz.w, sz.h)) {
              hitNodeIds.add(node.id);
            }
          }
          setMultiSelectedNodeIds(hitNodeIds);
          setInternalSelectedNodeId(null);
          setInternalSelectedEdgeId(null);
          if (onSelectedNodeChange) onSelectedNodeChange(null);
          if (onSelectedEdgeChange) onSelectedEdgeChange(null);
        }
      }
      selectionRectRef.current = null;
      setSelectionRect(null);
      return;
    }
    if (dragging.current) {
      dragging.current = false;
      // If it was a plain click (no meaningful drag), clear all selection
      const dx = Math.abs(e.clientX - (dragStart.current.x + transform.x));
      const dy = Math.abs(e.clientY - (dragStart.current.y + transform.y));
      if (dx < 3 && dy < 3) {
        clearSelection();
      }
    }
  };
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
        style={{ width: '100%', height: '100%', background: '#1e1e1e', cursor: selecting.current ? 'crosshair' : dragging.current ? 'grabbing' : 'default' }}
        onMouseDown={onSvgMouseDown}
        onMouseMove={onSvgMouseMove}
        onMouseUp={onSvgMouseUp}
        onMouseLeave={(e) => onSvgMouseUp(e)}
        onWheel={onWheel}
        onContextMenu={(e) => {
          e.preventDefault();
          // Right-click on background with multi-selection: show batch hide menu
          if (multiSelectedNodeIds.size > 0) {
            const nIds = [...multiSelectedNodeIds];
            const eIds = [...multiSelectedEdgeIds];
            setContextMenu({ x: e.clientX, y: e.clientY, type: 'multi', id: '', label: '', nodeIds: nIds, edgeIds: eIds });
          }
        }}
      >
        <defs>
          {/* ── Subclassification: hollow triangle at general end ── */}
          <marker id="tri-spec" markerWidth="14" markerHeight="10" refX="13" refY="5" orient="auto">
            <polygon points="0 0, 12 5, 0 10" fill="#1e1e1e" stroke="#9e9e9e" strokeWidth="1.5" />
          </marker>
          {/* ── Typing (defined by): hollow triangle on dashed line ── */}
          <marker id="tri-typeref" markerWidth="14" markerHeight="10" refX="13" refY="5" orient="auto">
            <polygon points="0 0, 12 5, 0 10" fill="#1e1e1e" stroke="#6a7a8a" strokeWidth="1.5" />
          </marker>
          {/* ── Subsetting / ref subsetting: open arrow (>) ── */}
          <marker id="arrow-open" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
            <polyline points="0 0, 9 4, 0 8" fill="none" stroke="#9e9e9e" strokeWidth="1.5" />
          </marker>
          {/* ── Redefinition: vertical bar at redefining (source) end ── */}
          <marker id="bar-redef" markerWidth="4" markerHeight="10" refX="2" refY="5" orient="auto">
            <line x1="2" y1="0" x2="2" y2="10" stroke="#9e9e9e" strokeWidth="1.5" />
          </marker>
          {/* ── Composition: filled diamond at owner end ── */}
          <marker id="diamond-comp" markerWidth="16" markerHeight="9" refX="1" refY="4.5" orient="auto">
            <polygon points="1 4.5, 7 1, 13 4.5, 7 8" fill="#9cdcfe" stroke="#9cdcfe" strokeWidth="1" />
          </marker>
          {/* ── Connection: open arrowhead ── */}
          <marker id="arrow-assoc" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
            <polyline points="0 0, 9 4, 0 8" fill="none" stroke="#777" strokeWidth="1.5" />
          </marker>
          {/* ── Flow / transition: filled arrowhead (per spec: solid, filled) ── */}
          <marker id="arrow-flow-filled" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
            <polygon points="0 0, 9 4, 0 8" fill="#4ec9b0" stroke="#4ec9b0" strokeWidth="1" />
          </marker>
          {/* ── Satisfy: open arrowhead (dashed) ── */}
          <marker id="arrow-satisfy" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
            <polyline points="0 0, 9 4, 0 8" fill="none" stroke="#e06060" strokeWidth="1.5" />
          </marker>
          {/* ── Verify: open arrowhead (dashed) ── */}
          <marker id="arrow-verify" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
            <polyline points="0 0, 9 4, 0 8" fill="none" stroke="#60b060" strokeWidth="1.5" />
          </marker>
          {/* ── Allocate: open arrowhead (dashed) ── */}
          <marker id="arrow-allocate" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
            <polyline points="0 0, 9 4, 0 8" fill="none" stroke="#c0a060" strokeWidth="1.5" />
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
            const isEdgeSelected = selectedEdgeId === edge.id || multiSelectedEdgeIds.has(edge.id);
            return (
              <g key={edge.id}
                onClick={(e) => onEdgeClick(e, edge)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (multiSelectedEdgeIds.has(edge.id) || multiSelectedNodeIds.size > 0) {
                    const nIds = [...multiSelectedNodeIds];
                    const eIds = [...multiSelectedEdgeIds];
                    setContextMenu({ x: e.clientX, y: e.clientY, type: 'multi', id: '', label: '', nodeIds: nIds, edgeIds: eIds });
                  } else {
                    setContextMenu({ x: e.clientX, y: e.clientY, type: 'edge', id: edge.id, label: edgeLabel });
                  }
                }}>
                {/* Invisible wide hit area for click and right-click */}
                <path
                  d={edgePath(edge)}
                  stroke="transparent"
                  strokeWidth={12}
                  fill="none"
                  style={{ cursor: 'pointer' }}
                />
                {/* Selection glow */}
                {isEdgeSelected && (
                  <path
                    d={edgePath(edge)}
                    stroke="#f0c040"
                    strokeWidth={4}
                    strokeDasharray={style.dash}
                    fill="none"
                    opacity={0.35}
                  />
                )}
                <path
                  d={edgePath(edge)}
                  stroke={isEdgeSelected ? '#f0c040' : style.stroke}
                  strokeWidth={isEdgeSelected ? 2 : 1.5}
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
            const isSelected  = selectedNodeId === node.id || multiSelectedNodeIds.has(node.id);
            const hasChildren = (childrenOf.get(node.id)?.length ?? 0) > 0;
            const isContainer = viewMode === 'nested' && hasChildren;
            const isPkg = isPackage(cssClass);

            const rx = nodeRadius(cssClass);

            const nodeName = nameLabel?.text || node.id;
            const onNodeContextMenu = (e: React.MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
              if (multiSelectedNodeIds.has(node.id)) {
                const nIds = [...multiSelectedNodeIds];
                const eIds = [...multiSelectedEdgeIds];
                setContextMenu({ x: e.clientX, y: e.clientY, type: 'multi', id: '', label: '', nodeIds: nIds, edgeIds: eIds });
              } else {
                setContextMenu({ x: e.clientX, y: e.clientY, type: 'node', id: node.id, label: nodeName });
              }
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

            // ── Control nodes: fork/join (bar) and merge/decide (diamond) ──
            const isForkJoin = cssClass === 'forknode' || cssClass === 'joinnode';
            const isMergeDecide = cssClass === 'mergenode' || cssClass === 'decidenode';
            if (isForkJoin) {
              const borderColor = isSelected ? '#f0c040' : isHovered ? '#aaa' : '#888';
              return (
                <g key={node.id} transform={`translate(${pos.x},${pos.y})`}
                  onClick={(e) => onNodeClick(e, node)}
                  onContextMenu={onNodeContextMenu}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  style={{ cursor: 'pointer' }}>
                  <rect width={w} height={h} fill="#aaa" stroke={borderColor} strokeWidth={1.5} rx={2} />
                  <text x={w / 2} y={h + 14} fill="#888" fontSize={9} textAnchor="middle">{nameLabel?.text}</text>
                </g>
              );
            }
            if (isMergeDecide) {
              const borderColor = isSelected ? '#f0c040' : isHovered ? '#aaa' : '#888';
              const cx = w / 2, cy = h / 2;
              return (
                <g key={node.id} transform={`translate(${pos.x},${pos.y})`}
                  onClick={(e) => onNodeClick(e, node)}
                  onContextMenu={onNodeContextMenu}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  style={{ cursor: 'pointer' }}>
                  <polygon points={`${cx},0 ${w},${cy} ${cx},${h} 0,${cy}`}
                    fill={color} stroke={borderColor} strokeWidth={1.5} />
                  <text x={cx} y={h + 14} fill="#888" fontSize={9} textAnchor="middle">{nameLabel?.text}</text>
                </g>
              );
            }

            // ── Start node: filled black circle ──
            if (cssClass === 'startnode') {
              const r = Math.min(w, h) / 2;
              const cx = w / 2, cy = h / 2;
              const borderColor = isSelected ? '#f0c040' : isHovered ? '#ccc' : '#888';
              return (
                <g key={node.id} transform={`translate(${pos.x},${pos.y})`}
                  onClick={(e) => onNodeClick(e, node)}
                  onContextMenu={onNodeContextMenu}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  style={{ cursor: 'pointer' }}>
                  <circle cx={cx} cy={cy} r={r} fill="#ccc" stroke={borderColor} strokeWidth={1.5} />
                </g>
              );
            }

            // ── Terminate node: circle with X cross ──
            if (cssClass === 'terminatenode') {
              const r = Math.min(w, h) / 2;
              const cx = w / 2, cy = h / 2;
              const borderColor = isSelected ? '#f0c040' : isHovered ? '#ccc' : '#888';
              const crossColor = isSelected ? '#f0c040' : isHovered ? '#ccc' : '#aaa';
              const d = r * 0.6;
              return (
                <g key={node.id} transform={`translate(${pos.x},${pos.y})`}
                  onClick={(e) => onNodeClick(e, node)}
                  onContextMenu={onNodeContextMenu}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  style={{ cursor: 'pointer' }}>
                  <circle cx={cx} cy={cy} r={r} fill="none" stroke={borderColor} strokeWidth={1.5} />
                  <line x1={cx - d} y1={cy - d} x2={cx + d} y2={cy + d} stroke={crossColor} strokeWidth={1.5} />
                  <line x1={cx + d} y1={cy - d} x2={cx - d} y2={cy + d} stroke={crossColor} strokeWidth={1.5} />
                </g>
              );
            }

            // ── Leaf / tree-mode node: SysML v2 two-compartment box ──
            // Definitions: sharp corners (rx=0), Usages: rounded corners (rx=10)
            {
              const isIn    = cssClass === 'actionin';
              const isOut   = cssClass === 'actionout';
              const isInOut = cssClass === 'actioninout';
              const isParam = isIn || isOut || isInOut;
              const borderColor = isSelected ? '#f0c040' : isHovered
                ? (isIn ? '#60ffb0' : isOut ? '#ffb060' : isInOut ? '#60b0ff' : '#4d9ad4')
                : (isIn ? '#30a060' : isOut ? '#a06020' : isInOut ? '#2060a0' : '#4a5a7a');

              // Compartment labels (attributes/usages inside definitions)
              const attrLabels = node.children.filter((c) => c.id.includes('__usage__'));
              const HEADER_H = 48;
              const ROW_H = 18;
              const hasCompartment = attrLabels.length > 0;
              // Dynamically compute height: header + compartment rows
              const dynamicH = hasCompartment
                ? HEADER_H + 6 + attrLabels.length * ROW_H + 4
                : h;
              // Width: fit longest label
              const attrTextWidths = attrLabels.map((l) => l.text.length * 6.2 + 24);
              const nameTextW = (nameLabel?.text.length ?? 0) * 8 + 24;
              const kindTextW = (kindLabel?.text.length ?? 0) * 6.2 + 24;
              const dynamicW = hasCompartment
                ? Math.max(w, nameTextW, kindTextW, ...attrTextWidths)
                : Math.max(w, nameTextW, kindTextW);

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
                  <rect width={dynamicW} height={dynamicH} rx={rx} fill={color} stroke={borderColor} strokeWidth={isSelected ? 2 : isHovered ? 1.5 : 1} />
                  {isSelected && <rect width={dynamicW} height={dynamicH} rx={rx} fill="none" stroke="#f0c040" strokeWidth={3} opacity={0.25} />}
                  {/* Header separator */}
                  <line x1={0} y1={26} x2={dynamicW} y2={26} stroke={borderColor} strokeWidth={0.5} />
                  {/* Direction badge for action in/out/inout params */}
                  {isParam && (
                    <text x={6} y={17} fill={isIn ? '#40c080' : isOut ? '#c07030' : '#4090c0'} fontSize={10} fontWeight="bold">
                      {isIn ? '▶ in' : isOut ? '◀ out' : '◆ inout'}
                    </text>
                  )}
                  {!isParam && kindLabel && (
                    <text x={dynamicW / 2} y={17} fill="#b0c0d8" fontSize={10} textAnchor="middle" fontStyle="italic">{kindLabel.text}</text>
                  )}
                  {nameLabel && (
                    <text x={dynamicW / 2} y={42} fill="#e8eef6" fontSize={13} textAnchor="middle" fontWeight="bold">{nameLabel.text}</text>
                  )}
                  {/* Compartment: attribute/usage rows */}
                  {hasCompartment && (
                    <>
                      <line x1={0} y1={HEADER_H} x2={dynamicW} y2={HEADER_H} stroke={borderColor} strokeWidth={0.5} />
                      {attrLabels.map((label, i) => (
                        <text
                          key={label.id}
                          x={8}
                          y={HEADER_H + 6 + (i + 1) * ROW_H - 4}
                          fill="#b0c8e0"
                          fontSize={10}
                          fontFamily="monospace"
                        >
                          {label.text}
                        </text>
                      ))}
                    </>
                  )}
                </g>
              );
            }
          })}

          {/* Rubber-band selection rectangle */}
          {selectionRect && <SelectionRectOverlay rect={selectionRect} scale={transform.scale} />}
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
            ...(viewMode === 'tree' ? [{ label: '◆── composition',      color: '#9cdcfe', dash: undefined }] : []),
            { label: '◁── specializes :>',     color: '#9e9e9e', dash: undefined },
            { label: '──▷ subsets :>',          color: '#9e9e9e', dash: undefined },
            { label: '|──▷ redefines :>>',      color: '#9e9e9e', dash: undefined },
            { label: '- -◁ defined by :',       color: '#6a7a8a', dash: '4,3'     },
            { label: '──▷ ref subsets ::>',     color: '#9e9e9e', dash: undefined },
            { label: '──▶ flow',                color: '#4ec9b0', dash: undefined },
            { label: '──▷ connection',          color: '#777',    dash: undefined },
            { label: '- -▷ satisfy',            color: '#e06060', dash: '6,3'     },
            { label: '- -▷ verify',             color: '#60b060', dash: '6,3'     },
            { label: '- -▷ allocate',           color: '#c0a060', dash: '6,3'     },
          ].map(({ label, color, dash }, i) => (
            <g key={label} transform={`translate(0,${54 + i * 16})`}>
              <line x1={0} y1={7} x2={20} y2={7} stroke={color} strokeWidth={1.5} strokeDasharray={dash} />
              <text x={24} y={11} fill={color} fontSize={9}>{label}</text>
            </g>
          ))}
        </g>
      </svg>

      {/* Right-click context menu (with backdrop for click-outside dismiss) */}
      {contextMenu && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 99 }}
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
          />
          <div
            style={{
              position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 100,
              background: '#252526', border: '1px solid #454545', borderRadius: 4,
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)', padding: '4px 0',
              minWidth: 160, fontSize: 12, color: '#d4d4d4',
            }}
          >
            {contextMenu.type === 'multi' ? (
              <>
                <div style={{ padding: '4px 12px', color: '#888', fontSize: 10, borderBottom: '1px solid #333', marginBottom: 2 }}>
                  {(contextMenu.nodeIds?.length ?? 0) + (contextMenu.edgeIds?.length ?? 0)} selected items
                </div>
                <button
                  onClick={() => {
                    const nIds = contextMenu.nodeIds ?? [];
                    const eIds = contextMenu.edgeIds ?? [];
                    setContextMenu(null);
                    if (nIds.length > 0 && onHideNodes) onHideNodes(nIds);
                    if (eIds.length > 0 && onHideEdges) onHideEdges(eIds);
                    setMultiSelectedNodeIds(new Set());
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    padding: '6px 12px', background: 'none', border: 'none',
                    color: '#d4d4d4', cursor: 'pointer', textAlign: 'left', fontSize: 12,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#094771')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                >
                  <span style={{ opacity: 0.7 }}>&#x2716;</span> Hide {(contextMenu.nodeIds?.length ?? 0) + (contextMenu.edgeIds?.length ?? 0)} selected items
                </button>
              </>
            ) : (
              <>
                <div style={{ padding: '4px 12px', color: '#888', fontSize: 10, borderBottom: '1px solid #333', marginBottom: 2 }}>
                  {contextMenu.type === 'node' ? 'Element' : 'Relationship'}: {contextMenu.label}
                </div>
                <button
                  onClick={() => {
                    const id = contextMenu.id;
                    const type = contextMenu.type;
                    setContextMenu(null);
                    if (type === 'node' && onHideNode) onHideNode(id);
                    if (type === 'edge' && onHideEdge) onHideEdge(id);
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
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
