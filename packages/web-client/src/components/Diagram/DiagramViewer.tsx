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
  showCompartments?: boolean;
  storageKey?: string;
  mode?: 'bdd' | 'ibd';
  onNodeSelect?: (range: { start: { line: number; character: number }; end: { line: number; character: number } }) => void;
}

const COMPACT_HEIGHT = 60;
const MIN_W = 80;
const MIN_H = 40;
const LAYOUT_PADDING = 48;
const PORT_SIZE = 12;

const NODE_COLORS: Record<string, string> = {
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
  stdlib:               '#0a2018',
  default:              '#252525',
};

const EDGE_STYLES: Record<string, { stroke: string; dash?: string; markerEnd: string; markerStart?: string; labelColor: string }> = {
  dependency:    { stroke: '#9e9e9e', dash: undefined, markerEnd: 'url(#tri-hollow)',             labelColor: '#9e9e9e' },
  composition:   { stroke: '#9cdcfe', dash: undefined, markerEnd: 'url(#arrow-open)', markerStart: 'url(#diamond-comp)', labelColor: '#9cdcfe' },
  association:   { stroke: '#777',    dash: undefined, markerEnd: 'url(#arrow-open)',             labelColor: '#777'    },
  flow:          { stroke: '#4ec9b0', dash: '6,3',     markerEnd: 'url(#arrow-flow)',             labelColor: '#4ec9b0' },
  typereference: { stroke: '#6a7a8a', dash: '3,3',     markerEnd: 'url(#arrow-open)',             labelColor: '#6a7a8a' },
};
const DEFAULT_EDGE_STYLE = EDGE_STYLES.association;

export default function DiagramViewer({
  model, hiddenNodeIds, hiddenEdgeIds, showCompartments = true, storageKey, mode = 'bdd', onNodeSelect,
}: DiagramViewerProps) {
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
  const wasDragRef = useRef(false);

  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [routes, setRoutes] = useState<Map<string, { x: number; y: number }[]>>(new Map());
  const [layoutPending, setLayoutPending] = useState(false);
  const [layoutTrigger, setLayoutTrigger] = useState(0);
  const positionOverridesRef = useRef(positionOverrides);
  positionOverridesRef.current = positionOverrides;

  // IBD: container sizes computed by ELK compound layout
  const [ibdSizes, setIbdSizes] = useState(new Map<string, { w: number; h: number }>());

  const allNodes = useMemo(
    () => model?.children.filter((c): c is SNode => c.type === 'node') ?? [],
    [model],
  );
  const allEdges = useMemo(
    () => model?.children.filter((c): c is SEdge => c.type === 'edge') ?? [],
    [model],
  );

  const nodes = useMemo(() => {
    const hidden = hiddenNodeIds ?? new Set<string>();
    return allNodes.filter((n) => !hidden.has(n.id));
  }, [allNodes, hiddenNodeIds]);

  const edges = useMemo(() => {
    const visibleIds = new Set(nodes.map((n) => n.id));
    const hiddenE = hiddenEdgeIds ?? new Set<string>();
    return allEdges.filter((e) =>
      visibleIds.has(e.sourceId) && visibleIds.has(e.targetId) && !hiddenE.has(e.id),
    );
  }, [allEdges, nodes, hiddenEdgeIds]);

  // IBD: derive parent-child relationships from composition edges,
  // then remap each type def's structural children to sit under their usage instance.
  // This makes every usage block show its internal structure when expanded.
  const ibdParentOf = useMemo(() => {
    if (mode !== 'ibd') return new Map<string, string>();
    const map = new Map<string, string>();
    for (const e of allEdges) {
      if (e.cssClasses?.[0] === 'composition') map.set(e.targetId, e.sourceId);
    }

    // Build: defId → list of usage IDs that reference it via typereference
    const usagesOfDef = new Map<string, string[]>();
    for (const e of allEdges) {
      if (e.cssClasses?.[0] !== 'typereference') continue;
      const arr = usagesOfDef.get(e.targetId) ?? [];
      arr.push(e.sourceId);
      usagesOfDef.set(e.targetId, arr);
    }

    // For defs with exactly one usage: move the def's structural children under that usage.
    // Ports stay under the def (handled separately by inheritedPortsMap / portAnchors).
    for (const [defId, usages] of usagesOfDef) {
      if (usages.length !== 1) continue;
      const usageId = usages[0];
      for (const [childId, parentId] of [...map]) {
        if (parentId !== defId) continue;
        if (allNodes.find(n => n.id === childId)?.cssClasses?.[0] === 'portusage') continue;
        map.set(childId, usageId);
      }
    }

    // For multi-instance action defs: create virtual param IDs for each usage instance.
    // actparam::${usageId}::${paramId} lets each usage show the def's in/out params as children.
    for (const [defId, usages] of usagesOfDef) {
      if (usages.length <= 1) continue; // single-instance already handled above
      const actionParamIds = [...map]
        .filter(([childId, parentId]) => {
          if (parentId !== defId) return false;
          const css = allNodes.find(n => n.id === childId)?.cssClasses?.[0];
          return css === 'actionin' || css === 'actionout';
        })
        .map(([childId]) => childId);
      if (actionParamIds.length === 0) continue;
      for (const usageId of usages) {
        for (const paramId of actionParamIds) {
          map.set(`actparam::${usageId}::${paramId}`, usageId);
        }
      }
    }

    return map;
  }, [mode, allEdges, allNodes]);

  const ibdChildrenOf = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const [child, parent] of ibdParentOf) {
      const arr = map.get(parent) ?? [];
      arr.push(child);
      map.set(parent, arr);
    }
    return map;
  }, [ibdParentOf]);

  // Synthetic SNode objects for virtual action param IDs (multi-instance action defs).
  // Each virtual node copies the source param node but uses the virtual ID for positioning.
  const virtualActionParams = useMemo(() => {
    const vmap = new Map<string, SNode>();
    if (mode !== 'ibd') return vmap;
    for (const [childId] of ibdParentOf) {
      if (!childId.startsWith('actparam::')) continue;
      const paramId = childId.split('::').slice(2).join('::');
      const sourceNode = allNodes.find(n => n.id === paramId);
      if (sourceNode) vmap.set(childId, { ...sourceNode, id: childId });
    }
    return vmap;
  }, [mode, ibdParentOf, allNodes]);

  const [expandedNodeIds, setExpandedNodeIds] = useLocalStorage<Set<string>>(
    storageKey ? `${storageKey}:ibd-expanded` : '',
    new Set(),
  );
  const toggleExpanded = useCallback((id: string) => {
    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, [setExpandedNodeIds]);

  // Depth of each node in the composition tree (roots = 0)
  const ibdDepth = useMemo(() => {
    const depth = new Map<string, number>();
    for (const node of nodes) {
      if (!ibdParentOf.has(node.id)) depth.set(node.id, 0);
    }
    const queue = [...depth.keys()];
    while (queue.length > 0) {
      const id = queue.shift()!;
      const d = depth.get(id)!;
      for (const childId of ibdChildrenOf.get(id) ?? []) {
        if (!depth.has(childId)) { depth.set(childId, d + 1); queue.push(childId); }
      }
    }
    return depth;
  }, [nodes, ibdParentOf, ibdChildrenOf]);

  // Visibility:
  //   depth-0 roots: expanded by default — in expandedNodeIds means user collapsed them
  //   depth-1+: collapsed by default — in expandedNodeIds means user expanded them
  const ibdVisibleNodeIds = useMemo(() => {
    if (mode !== 'ibd') return null;
    const visible = new Set<string>();
    for (const node of nodes) {
      if (!ibdParentOf.has(node.id)) visible.add(node.id);
    }
    const queue = [...visible];
    while (queue.length > 0) {
      const id = queue.shift()!;
      const depth = ibdDepth.get(id) ?? 0;
      const showChildren = depth === 0 ? !expandedNodeIds.has(id) : expandedNodeIds.has(id);
      if (showChildren) {
        for (const childId of ibdChildrenOf.get(id) ?? []) {
          if (!visible.has(childId)) { visible.add(childId); queue.push(childId); }
        }
      }
    }
    return visible;
  }, [mode, nodes, ibdParentOf, ibdDepth, ibdChildrenOf, expandedNodeIds]);

  // effectiveSize must be declared BEFORE portAnchors (which calls it)
  const effectiveSize = useCallback((node: SNode) => {
    const hasUsages = node.children.some((c) => c.id.includes('__usage__'));
    const override = sizeOverrides.get(node.id);
    const naturalH = (!showCompartments && hasUsages) ? COMPACT_HEIGHT : node.size.height;
    let h: number;
    if (override) {
      if (!showCompartments && hasUsages) {
        h = Math.min(override.h, COMPACT_HEIGHT);
      } else {
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

  // IBD: for each nested usage node, find the ports of its type def so we can
  // render inherited port squares on the usage block's border.
  // Key: `inh::${usageNodeId}::${portNodeId}` → anchor {x, y}
  const inheritedPortsMap = useMemo(() => {
    if (mode !== 'ibd') return new Map<string, { portNodeId: string; portName: string }[]>();
    const map = new Map<string, { portNodeId: string; portName: string }[]>();
    for (const edge of allEdges) {
      if (edge.cssClasses?.[0] !== 'typereference') continue;
      const usageId = edge.sourceId;
      const defId   = edge.targetId;
      if (!ibdParentOf.has(usageId)) continue; // only nested usages
      const defPortIds = (ibdChildrenOf.get(defId) ?? [])
        .filter(id => allNodes.find(n => n.id === id)?.cssClasses?.[0] === 'portusage')
        .sort();
      if (defPortIds.length === 0) continue;
      map.set(usageId, defPortIds.map(portId => {
        const portNode = allNodes.find(n => n.id === portId);
        const nameLabel = portNode?.children.find(c => c.id.endsWith('__label'));
        return { portNodeId: portId, portName: nameLabel?.text ?? portId.split('__').pop() ?? '?' };
      }));
    }
    return map;
  }, [mode, allEdges, ibdParentOf, ibdChildrenOf, allNodes]);

  // IBD: absolute anchor positions for port nodes — placed on the left border of their parent
  const portAnchors = useMemo(() => {
    if (mode !== 'ibd') return new Map<string, { x: number; y: number }>();
    const anchors = new Map<string, { x: number; y: number }>();
    const hidden = hiddenNodeIds ?? new Set<string>();

    const resolveSize = (id: string) =>
      ibdSizes.get(id) ?? (() => { const n = nodes.find(x => x.id === id); return n ? effectiveSize(n) : { w: 160, h: 60 }; })();

    const resolvePos = (id: string) => positionOverrides.get(id) ?? positions.get(id);

    // Direct ports + action in/out params on parent block borders
    for (const [parentId, childIds] of ibdChildrenOf) {
      const parentPos = resolvePos(parentId);
      if (!parentPos) continue;
      const parentSz = resolveSize(parentId);

      const portIds = childIds
        .filter(id => allNodes.find(x => x.id === id)?.cssClasses?.[0] === 'portusage' && !hidden.has(id))
        .sort();
      portIds.forEach((portId, i) => {
        const usableH = Math.max(1, parentSz.h - 44);
        const y = parentPos.y + 44 + ((i + 1) / (portIds.length + 1)) * usableH;
        anchors.set(portId, { x: parentPos.x, y });
      });

    }

    // Inherited ports: ports of a type def shown on each usage instance of that type
    for (const [usageId, ports] of inheritedPortsMap) {
      const usagePos = resolvePos(usageId);
      if (!usagePos) continue;
      const usageSz = resolveSize(usageId);
      const sorted = [...ports].sort((a, b) => a.portName.localeCompare(b.portName));
      sorted.forEach((port, i) => {
        const vKey = `inh::${usageId}::${port.portNodeId}`;
        const y = usagePos.y + ((i + 1) / (sorted.length + 1)) * usageSz.h;
        anchors.set(vKey, { x: usagePos.x, y });
      });
    }

    return anchors;
  }, [mode, ibdChildrenOf, inheritedPortsMap, positions, positionOverrides, ibdSizes, nodes, hiddenNodeIds, effectiveSize]);

  const visibleKey = nodes.map((n) => n.id).sort().join(',');
  const sizesKey = nodes.map((n) => { const s = effectiveSize(n); return `${n.id}:${s.w}x${s.h}`; }).join(',');
  const ibdExpandKey = mode === 'ibd' ? [...expandedNodeIds].sort().join(',') : '';
  const edgesKey = edges.map((e) => `${e.sourceId}→${e.targetId}`).sort().join(',');

  // Clear stale positions when mode changes so old BDD/IBD coords don't bleed across
  useEffect(() => {
    setPositions(new Map());
    setIbdSizes(new Map());
  }, [mode]);

  // ── ELK layout — mode-aware ──────────────────────────────────────────────
  useEffect(() => {
    if (nodes.length === 0) return;
    let cancelled = false;
    setLayoutPending(true);

    if (mode === 'ibd') {
      // ── IBD: compound ELK layout (recursive, respects expand state) ──────
      const elkVisibleIds = ibdVisibleNodeIds ?? new Set(nodes.map(n => n.id));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function buildElkNode(nodeId: string): any {
        const n = nodes.find(x => x.id === nodeId) ?? virtualActionParams.get(nodeId);
        const { w, h } = n ? effectiveSize(n) : { w: 140, h: 50 };
        const childIds = (ibdChildrenOf.get(nodeId) ?? []).filter(id => {
          if (!elkVisibleIds.has(id)) return false;
          return nodes.find(x => x.id === id)?.cssClasses?.[0] !== 'portusage';
        });
        if (childIds.length > 0) {
          return {
            id: nodeId,
            layoutOptions: {
              'elk.padding': '[top=44,left=28,bottom=16,right=16]',
              'elk.algorithm': 'layered',
              'elk.direction': 'RIGHT',
              'elk.spacing.nodeNode': '20',
            },
            children: childIds.map(cId => buildElkNode(cId)),
          };
        }
        return { id: nodeId, width: w, height: h };
      }

      const topLevel = nodes.filter(n => !ibdParentOf.has(n.id) && elkVisibleIds.has(n.id));
      const elkChildren = topLevel.map(n => buildElkNode(n.id));

      // Don't pass edges to ELK in compound mode — cross-hierarchy edges (nested node → root node)
      // cause ELK to throw. We draw IBD edges as straight lines anyway (routes are cleared).
      const ibdEdges: never[] = [];

      const elkGraph = {
        id: 'graph',
        layoutOptions: {
          'elk.algorithm': 'layered',
          'elk.direction': 'DOWN',
          'elk.spacing.nodeNode': '60',
          'elk.layered.spacing.nodeNodeBetweenLayers': '80',
        },
        children: elkChildren,
        edges: ibdEdges,
      };

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

        setPositions(newPositions);
        setIbdSizes(newIbdSizes);
        setRoutes(new Map()); // no edge routing in IBD compound mode
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

    } else {
      // ── BDD: flat ELK layout ──────────────────────────────────────────────
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
        for (const child of result.children ?? []) {
          newPositions.set(child.id, { x: child.x ?? 0, y: child.y ?? 0 });
        }

        const newRoutes = new Map<string, { x: number; y: number }[]>();
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
        setIbdSizes(new Map());
        setLayoutPending(false);

        if (!svgRef.current) return;
        const svgRect = svgRef.current.getBoundingClientRect();
        if (svgRect.width === 0 || svgRect.height === 0) return;

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
    }

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleKey, sizesKey, edgesKey, ibdExpandKey, layoutTrigger, mode]);

  const fitToWindow = useCallback(() => {
    setPositionOverrides(new Map());
    setLayoutTrigger((n) => n + 1);
  }, [setPositionOverrides]);

  const nodePos = (id: string) => positionOverrides.get(id) ?? positions.get(id) ?? { x: 0, y: 0 };
  const nodeSz = (id: string) => {
    if (mode === 'ibd') {
      const ibd = ibdSizes.get(id);
      if (ibd) return ibd;
    }
    const n = nodes.find((n) => n.id === id) ?? virtualActionParams.get(id);
    return n ? effectiveSize(n) : { w: 160, h: 60 };
  };

  // Returns the connection point for a node — port anchor if it's a port in IBD, otherwise center
  const nodeCenter = (id: string): { x: number; y: number } => {
    const anchor = portAnchors.get(id);
    if (anchor) return anchor;
    const pos = nodePos(id);
    const sz = nodeSz(id);
    return { x: pos.x + sz.w / 2, y: pos.y + sz.h / 2 };
  };

  const edgePath = (edge: SEdge): string => {
    const manuallyMoved = positionOverrides.has(edge.sourceId) || positionOverrides.has(edge.targetId);
    if (!manuallyMoved && mode === 'bdd') {
      const pts = routes.get(edge.id);
      if (pts && pts.length >= 2) {
        return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      }
    }
    const src = nodeCenter(edge.sourceId);
    const tgt = nodeCenter(edge.targetId);
    return `M ${src.x} ${src.y} L ${tgt.x} ${tgt.y}`;
  };

  const edgeCenter = (edge: SEdge) => {
    if (mode === 'bdd') {
      const pts = routes.get(edge.id);
      if (pts && pts.length >= 2) return pts[Math.floor(pts.length / 2)];
    }
    const src = nodeCenter(edge.sourceId);
    const tgt = nodeCenter(edge.targetId);
    return { x: (src.x + tgt.x) / 2, y: (src.y + tgt.y) / 2 };
  };

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

  const onNodeMouseDown = useCallback((e: React.MouseEvent, node: SNode) => {
    e.stopPropagation();
    wasDragRef.current = false;
    const pos = positionOverrides.get(node.id) ?? positions.get(node.id) ?? { x: 0, y: 0 };

    // Collect all descendants recursively so they travel with their container
    const getAllDescendants = (id: string): string[] => {
      const children = ibdChildrenOf.get(id) ?? [];
      return children.flatMap(childId => [childId, ...getAllDescendants(childId)]);
    };
    const descendants = mode === 'ibd' ? getAllDescendants(node.id) : [];
    const descendantStarts = new Map<string, { x: number; y: number }>();
    for (const descId of descendants) {
      descendantStarts.set(descId, positionOverrides.get(descId) ?? positions.get(descId) ?? { x: 0, y: 0 });
    }

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
      if (Math.abs(dx) <= 4 && Math.abs(dy) <= 4) return;
      wasDragRef.current = true;
      const scale = transformRef.current.scale;
      const { id, startX, startY } = draggingNode.current;
      setPositionOverrides((prev) => {
        const next = new Map(prev);
        next.set(id, { x: startX + dx / scale, y: startY + dy / scale });
        for (const [descId, descStart] of descendantStarts) {
          next.set(descId, { x: descStart.x + dx / scale, y: descStart.y + dy / scale });
        }
        return next;
      });
    };
    const onUp = () => {
      const info = draggingNode.current;
      draggingNode.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (!wasDragRef.current && info) {
        setPositionOverrides((prev) => {
          const next = new Map(prev);
          next.delete(info.id);
          for (const descId of descendants) next.delete(descId);
          return next;
        });
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [positions, positionOverrides, mode, ibdChildrenOf]);

  const onNodeClick = useCallback((e: React.MouseEvent, node: SNode) => {
    e.stopPropagation();
    if (wasDragRef.current) return;
    setSelectedNodeId(node.id);
    if (onNodeSelect) {
      const range = node.data?.range as
        | { start: { line: number; character: number }; end: { line: number; character: number } }
        | undefined;
      if (range) onNodeSelect(range);
    }
  }, [onNodeSelect]);

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
        <div style={{ fontSize: 12, color: '#444' }}>Start editing to generate a diagram</div>
      </div>
    );
  }

  // ── Render helpers ──────────────────────────────────────────────────────────

  // In IBD mode: render containers before children; exclude port nodes (rendered as border squares)
  const renderNodes = mode === 'ibd'
    ? [...nodes, ...virtualActionParams.values()]
        .filter(n => !portAnchors.has(n.id) && ibdVisibleNodeIds!.has(n.id))
        .sort((a, b) => {
          const aIsContainer = (ibdChildrenOf.get(a.id)?.length ?? 0) > 0;
          const bIsContainer = (ibdChildrenOf.get(b.id)?.length ?? 0) > 0;
          return (bIsContainer ? 1 : 0) - (aIsContainer ? 1 : 0);
        })
    : nodes;

  // In IBD mode, hide composition edges and edges to hidden nodes
  const renderEdges = mode === 'ibd'
    ? edges.filter(e =>
        e.cssClasses?.[0] !== 'composition' &&
        ibdVisibleNodeIds!.has(e.sourceId) &&
        ibdVisibleNodeIds!.has(e.targetId),
      )
    : edges;

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
          <marker id="tri-hollow" markerWidth="14" markerHeight="10" refX="13" refY="5" orient="auto">
            <polygon points="0 0, 12 5, 0 10" fill="#1e1e1e" stroke="#9e9e9e" strokeWidth="1.5" />
          </marker>
          <marker id="arrow-open" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
            <polyline points="0 0, 9 4, 0 8" fill="none" stroke="#777" strokeWidth="1.5" />
          </marker>
          <marker id="arrow-flow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
            <polyline points="0 0, 9 4, 0 8" fill="none" stroke="#4ec9b0" strokeWidth="1.5" />
          </marker>
          <marker id="diamond-comp" markerWidth="16" markerHeight="9" refX="1" refY="4.5" orient="auto">
            <polygon points="1 4.5, 7 1, 13 4.5, 7 8" fill="#9cdcfe" stroke="#9cdcfe" strokeWidth="1" />
          </marker>
        </defs>

        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
          {/* Edges */}
          {renderEdges.map((edge) => {
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

          {/* IBD Inherited Ports — type ports rendered on each usage instance */}
          {mode === 'ibd' && Array.from(inheritedPortsMap.entries()).flatMap(([usageId, ports]) =>
            !ibdVisibleNodeIds!.has(usageId) ? [] :
            [...ports].sort((a, b) => a.portName.localeCompare(b.portName)).map((port) => {
              const vKey = `inh::${usageId}::${port.portNodeId}`;
              const anchor = portAnchors.get(vKey);
              if (!anchor) return null;
              return (
                <g key={vKey} transform={`translate(${anchor.x - PORT_SIZE / 2},${anchor.y - PORT_SIZE / 2})`}>
                  <rect width={PORT_SIZE} height={PORT_SIZE} fill="#1a0828" stroke="#7050a0" strokeWidth={1.5} strokeDasharray="2,1" />
                  <text x={PORT_SIZE + 4} y={PORT_SIZE / 2 + 3} fill="#9070c0" fontSize={9} fontFamily="monospace">
                    {port.portName}
                  </text>
                </g>
              );
            })
          )}

          {/* IBD Ports — small squares on parent block borders */}
          {mode === 'ibd' && nodes.filter(n => portAnchors.has(n.id) && ibdVisibleNodeIds!.has(ibdParentOf.get(n.id) ?? '')).map(n => {
            const anchor = portAnchors.get(n.id)!;
            const nameLabel = n.children.find(c => c.id.endsWith('__label'));
            const name = nameLabel?.text ?? n.id.split('__').pop() ?? '?';
            const isHovered  = hoveredNodeId  === n.id;
            const isSelected = selectedNodeId === n.id;
            return (
              <g
                key={n.id}
                transform={`translate(${anchor.x - PORT_SIZE / 2},${anchor.y - PORT_SIZE / 2})`}
                onMouseEnter={() => setHoveredNodeId(n.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                onClick={(e) => onNodeClick(e, n)}
                style={{ cursor: 'pointer' }}
              >
                <rect
                  width={PORT_SIZE} height={PORT_SIZE}
                  fill="#2a0a3a"
                  stroke={isSelected ? '#f0c040' : isHovered ? '#c090ff' : '#8060b0'}
                  strokeWidth={isSelected ? 2 : 1.5}
                />
                {isSelected && <rect width={PORT_SIZE} height={PORT_SIZE} fill="none" stroke="#f0c040" strokeWidth={2.5} opacity={0.4} />}
                <text x={PORT_SIZE + 4} y={PORT_SIZE / 2 + 3} fill={isSelected ? '#f0c040' : isHovered ? '#d0b0ff' : '#a080d0'} fontSize={9} fontFamily="monospace">
                  {name}
                </text>
              </g>
            );
          })}

          {/* Nodes */}
          {renderNodes.map((node) => {
            const cssClass = node.cssClasses?.[0] ?? 'default';
            const color = NODE_COLORS[cssClass] ?? NODE_COLORS.default;
            const kindLabel  = node.children.find((c) => c.id.endsWith('__kind'));
            const nameLabel  = node.children.find((c) => c.id.endsWith('__label'));
            const usageLabels = node.children.filter((c) => c.id.includes('__usage__')).sort((a, b) => a.text.localeCompare(b.text));
            const hasUsages  = usageLabels.length > 0;
            const { w, h }   = nodeSz(node.id);
            const pos        = nodePos(node.id);
            const isHovered   = hoveredNodeId === node.id;
            const isSelected  = selectedNodeId === node.id;
            const hasOverride = sizeOverrides.has(node.id);
            const isIBDContainer = mode === 'ibd' && (ibdChildrenOf.get(node.id)?.length ?? 0) > 0;

            if (isIBDContainer) {
              // IBD container: box with title bar, transparent interior so children show through
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
                  {/* Container border */}
                  <rect
                    width={w} height={h} rx={4}
                    fill={color} fillOpacity={0.25}
                    stroke={isSelected ? '#f0c040' : isHovered ? '#4d9ad4' : '#4a8ab0'}
                    strokeWidth={isSelected ? 2.5 : isHovered ? 2 : 1.5}
                  />
                  {/* Title bar background */}
                  <rect width={w} height={40} rx={4} fill={color} fillOpacity={0.9} />
                  <rect y={4} width={w} height={36} fill={color} fillOpacity={0.9} />
                  {/* Title bar separator */}
                  <line x1={0} y1={40} x2={w} y2={40} stroke={isSelected ? '#f0c040' : '#4a8ab0'} strokeWidth={1.5} />
                  {/* Stereotype label */}
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
                  {/* Expand / collapse toggle — all container levels */}
                  {(() => {
                    const depth = ibdDepth.get(node.id) ?? 0;
                    const childrenVisible = depth === 0 ? !expandedNodeIds.has(node.id) : expandedNodeIds.has(node.id);
                    return (
                      <g
                        transform={`translate(${w - 26},8)`}
                        onClick={(e) => { e.stopPropagation(); toggleExpanded(node.id); }}
                        onMouseDown={(e) => e.stopPropagation()}
                        style={{ cursor: 'pointer' }}
                      >
                        <rect width={20} height={20} rx={3} fill="#ffffff18" stroke="#4a8ab060" strokeWidth={1} />
                        <text x={10} y={14} fill="#9ab8d8" fontSize={13} textAnchor="middle" fontFamily="monospace" fontWeight="bold">
                          {childrenVisible ? '−' : '+'}
                        </text>
                      </g>
                    );
                  })()}
                  {isSelected && <rect width={w} height={h} rx={4} fill="none" stroke="#f0c040" strokeWidth={3} opacity={0.2} />}
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
            }

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
                {(() => {
                  const isIn  = cssClass === 'actionin';
                  const isOut = cssClass === 'actionout';
                  const borderColor = isSelected ? '#f0c040' : isHovered
                    ? (isIn ? '#60ffb0' : isOut ? '#ffb060' : '#4d9ad4')
                    : (isIn ? '#30a060' : isOut ? '#a06020' : '#4a5a7a');
                  return (
                    <>
                      <rect width={w} height={h} rx={2} fill={color} stroke={borderColor} strokeWidth={isSelected ? 2 : isHovered ? 1.5 : 1} />
                      {isSelected && <rect width={w} height={h} rx={2} fill="none" stroke="#f0c040" strokeWidth={3} opacity={0.25} />}
                      <line x1={0} y1={26} x2={w} y2={26} stroke={borderColor} strokeWidth={0.5} />
                      {/* Direction badge for action in/out params */}
                      {(isIn || isOut) && (
                        <text x={6} y={17} fill={isIn ? '#40c080' : '#c07030'} fontSize={10} fontWeight="bold">
                          {isIn ? '▶ in' : '◀ out'}
                        </text>
                      )}
                      {!(isIn || isOut) && kindLabel && (
                        <text x={w / 2} y={17} fill="#b0c0d8" fontSize={10} textAnchor="middle" fontStyle="italic">{kindLabel.text}</text>
                      )}
                    </>
                  );
                })()}
                {nameLabel && (
                  <text x={w / 2} y={42} fill="#e8eef6" fontSize={13} textAnchor="middle" fontWeight="bold">{nameLabel.text}</text>
                )}
                {hasUsages && showCompartments && h > COMPACT_HEIGHT && (
                  <>
                    <line x1={0} y1={56} x2={w} y2={56} stroke="#4a5a7a" strokeWidth={1} />
                    {usageLabels.map((ul, i) => (
                      <text key={ul.id} x={8} y={71 + i * 18} fill="#c8d8e8" fontSize={10} fontFamily="'Consolas','Courier New',monospace">{ul.text}</text>
                    ))}
                  </>
                )}
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
          {(mode === 'bdd'
            ? [
                { label: 'generalization', color: '#9e9e9e', dash: undefined },
                { label: 'composition',    color: '#9cdcfe', dash: undefined },
                { label: 'association',    color: '#777',    dash: undefined },
                { label: 'flow',           color: '#4ec9b0', dash: '6,3'     },
                { label: 'type ref',       color: '#6a7a8a', dash: '3,3'     },
              ]
            : [
                { label: 'generalization', color: '#9e9e9e', dash: undefined },
                { label: 'association',    color: '#777',    dash: undefined },
                { label: 'flow',           color: '#4ec9b0', dash: '6,3'     },
                { label: 'type ref',       color: '#6a7a8a', dash: '3,3'     },
              ]
          ).map(({ label, color, dash }, i) => (
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
