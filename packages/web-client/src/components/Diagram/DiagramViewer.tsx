import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import ELKModule from 'elkjs/lib/elk.bundled.js';
import type { SModelRoot, SNode, SEdge, ViewType, ElementLock } from '@systemodel/shared-types';
import { getViewConfig } from '../../config/view-config.js';
import { useLocalStorage } from '../../hooks/useLocalStorage.js';
import { useTheme } from '../../store/theme.js';
import DiagramContextMenu from './DiagramContextMenu.js';
import type { ContextMenuData } from './DiagramContextMenu.js';
import SequenceRenderer from './SequenceRenderer.js';
import GridRenderer from './GridRenderer.js';
import BrowserRenderer from './BrowserRenderer.js';
import GeometryRenderer from './GeometryRenderer.js';

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
  /** Called to navigate to a relation's code by kind + source/target names */
  onEdgeGoToCode?: (edgeKind: string, sourceName?: string, targetName?: string) => void;
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
  /** Show/hide the legend overlay */
  showLegend?: boolean;
  /** Active SysML v2 standard view type */
  viewType?: ViewType;
  /** Called when user selects a different view type */
  onViewTypeChange?: (viewType: ViewType) => void;
  /** Show inherited features in definition compartments */
  showInherited?: boolean;
  /** Called when user toggles inherited features */
  onShowInheritedChange?: (show: boolean) => void;
  /** Called to show only a specific node and its descendants (hides everything else) */
  onShowOnly?: (id: string) => void;
  /** Called to reset all visibility (show all elements and edges) */
  onResetView?: () => void;
  /** Element locks for this file */
  locks?: ElementLock[];
  /** Current user ID for lock ownership */
  currentUserId?: string;
  /** Called to check out an element */
  onCheckOut?: (elementName: string) => void;
  /** Called to check in an element */
  onCheckIn?: (elementName: string) => void;
  /** Called to request a locked element from holder */
  onRequestLock?: (elementName: string) => void;
}

// ContextMenu type imported from DiagramContextMenu
type ContextMenu = ContextMenuData;

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

const NODE_COLORS_DARK: Record<string, string> = {
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
  actionusage:                '#082828',
  performactionusage:         '#082828',
  sendactionusage:            '#0a2838',
  acceptactionusage:          '#0a2838',
  ifactionusage:              '#082830',
  assignmentactionusage:      '#082830',
  forloopactionusage:         '#0a3030',
  whileloopactionusage:       '#0a3030',
  includeusecaseusage:        '#0e1a3a',
  assertconstraintusage:      '#3a1a0e',
  satisfyrequirementusage:    '#3a0e0e',
  eventoccurrenceusage:       '#1a2a1a',
  entryactionusage:           '#0a2820',
  doactionusage:              '#0a2820',
  exitactionusage:            '#0a2820',
  stateusage:                 '#202008',
  exhibitstateusage:          '#202008',
  itemusage:            '#201408',
  actionin:             '#0a2818',
  actionout:            '#2a0a0a',
  actioninout:          '#1a2828',
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
  casedefinition:              '#1a2a4a',
  caseusage:                   '#0e1a2a',
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
  metadatausage:               '#2a1a2a',
  flowusage:                   '#0a3a2a',
  successionflowusage:         '#0a3a2a',
  connectorasusage:            '#2a1408',
  bindingconnectorasusage:     '#2a1408',
  successionasusage:           '#082828',
  conjugatedportdefinition:    '#3a1a5a',
  occurrencedefinition:        '#2a3a2a',
  occurrenceusage:             '#1a2a1a',
  forknode:                    '#4a4a4a',
  joinnode:                    '#4a4a4a',
  mergenode:                   '#3a3a2a',
  decisionnode:                  '#3a3a2a',
  startnode:                   '#222222',
  donenode:                    '#222222',
  terminatenode:               '#3a3a3a',
  transitionusage:             '#2a2a2a',
  objectivemembership:         '#1a2a4a',
  subjectmembership:           '#1a2a4a',
  actormembership:             '#1a2a4a',
  stakeholdermembership:       '#1a2a4a',
  viewrenderingmembership:     '#0e2020',
  membershipexpose:            '#0e2020',
  namespaceexpose:             '#0e2020',
  referenceusage:              '#252530',
  alias:                '#2a2040',
  comment:              '#3a3520',
  stdlib:               '#0a2018',
  default:              '#252525',
};

const NODE_COLORS_LIGHT: Record<string, string> = {
  package:              '#e0e0ee',
  partdefinition:       '#c8daf0',
  attributedefinition:  '#c8e8c8',
  connectiondefinition: '#f0d8b8',
  portdefinition:       '#e0c8f0',
  actiondefinition:     '#b8e8e8',
  statedefinition:      '#e8e8b8',
  itemdefinition:       '#f0d8b0',
  partusage:            '#d8e8f8',
  attributeusage:       '#d8f0d8',
  connectionusage:      '#f8e8d0',
  portusage:            '#e8d8f8',
  actionusage:                '#d0f0f0',
  performactionusage:         '#d0f0f0',
  sendactionusage:            '#c8e8f0',
  acceptactionusage:          '#c8e8f0',
  ifactionusage:              '#c8f0e8',
  assignmentactionusage:      '#c8f0e8',
  forloopactionusage:         '#c0f0e0',
  whileloopactionusage:       '#c0f0e0',
  includeusecaseusage:        '#d8e0f8',
  assertconstraintusage:      '#f8e0d0',
  satisfyrequirementusage:    '#f8d8d8',
  eventoccurrenceusage:       '#d8f0d8',
  entryactionusage:           '#c0e8d8',
  doactionusage:              '#c0e8d8',
  exitactionusage:            '#c0e8d8',
  stateusage:                 '#f0f0d0',
  exhibitstateusage:          '#f0f0d0',
  itemusage:            '#f0e8d0',
  actionin:             '#d0f0d8',
  actionout:            '#f0d0d0',
  actioninout:          '#d8e8f0',
  requirementdefinition:       '#f0c8c8',
  requirementusage:            '#f8d8d8',
  constraintdefinition:        '#f0d0c0',
  constraintusage:             '#f8e0d0',
  interfacedefinition:         '#d0c8f0',
  interfaceusage:              '#e0d8f8',
  enumdefinition:              '#c0e8d8',
  enumusage:                   '#d0f0e8',
  calcdefinition:              '#c0e0f0',
  calcusage:                   '#d0e8f8',
  allocationdefinition:        '#f0d8b0',
  allocationusage:             '#f8e8c8',
  casedefinition:              '#c0d0e8',
  caseusage:                   '#d0d8f0',
  usecasedefinition:           '#c8d8f0',
  usecaseusage:                '#d8e0f8',
  analysiscasedefinition:      '#d0e0e8',
  analysiscaseusage:           '#d8e8f0',
  verificationcasedefinition:  '#e0d0e8',
  verificationcaseusage:       '#e8d8f0',
  concerndefinition:           '#e8d8c8',
  concernusage:                '#f0e8d8',
  viewdefinition:              '#c8e8e8',
  viewusage:                   '#d0f0f0',
  viewpointdefinition:         '#d0d0e8',
  viewpointusage:              '#d8d8f0',
  renderingdefinition:         '#e0e0e0',
  renderingusage:              '#e8e8e8',
  metadatadefinition:          '#e0d0e0',
  metadatausage:               '#e8d8e8',
  flowusage:                   '#c8e8d8',
  successionflowusage:         '#c8e8d8',
  connectorasusage:            '#f8e8d0',
  bindingconnectorasusage:     '#f8e8d0',
  successionasusage:           '#d0f0f0',
  conjugatedportdefinition:    '#e0c8f0',
  occurrencedefinition:        '#d0e0d0',
  occurrenceusage:             '#d8f0d8',
  forknode:                    '#c0c0c0',
  joinnode:                    '#c0c0c0',
  mergenode:                   '#d0d0c0',
  decisionnode:                  '#d0d0c0',
  startnode:                   '#b0b0b0',
  donenode:                    '#b0b0b0',
  terminatenode:               '#c8c8c8',
  transitionusage:             '#d8d8d8',
  objectivemembership:         '#c0d0e8',
  subjectmembership:           '#c0d0e8',
  actormembership:             '#c0d0e8',
  stakeholdermembership:       '#c0d0e8',
  viewrenderingmembership:     '#d0f0f0',
  membershipexpose:            '#d0f0f0',
  namespaceexpose:             '#d0f0f0',
  referenceusage:              '#e0e0e8',
  alias:                '#d8d0e8',
  comment:              '#f0e8c0',
  stdlib:               '#c8e8d8',
  default:              '#e8e8e8',
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
  dependency:          { stroke: '#9e9e9e', dash: '6,3',     markerEnd: 'url(#tri-spec)',                                      labelColor: '#9e9e9e' },
  subsetting:          { stroke: '#9e9e9e', dash: undefined, markerEnd: 'url(#arrow-open)',                                    labelColor: '#9e9e9e' },
  redefinition:        { stroke: '#9e9e9e', dash: undefined, markerEnd: 'url(#arrow-open)',  markerStart: 'url(#bar-redef)',   labelColor: '#9e9e9e' },
  composition:         { stroke: '#9cdcfe', dash: undefined, markerEnd: '',                  markerStart: 'url(#diamond-comp)',labelColor: '#9cdcfe' },
  noncomposite:        { stroke: '#9cdcfe', dash: undefined, markerEnd: '',                  markerStart: 'url(#diamond-noncomp)',labelColor: '#9cdcfe' },
  crossing:            { stroke: '#9e9e9e', dash: undefined, markerEnd: 'url(#arrow-open)',                                    labelColor: '#9e9e9e' },
  association:         { stroke: '#777',    dash: undefined, markerEnd: 'url(#arrow-assoc)',                                   labelColor: '#777'    },
  flow:                { stroke: '#4ec9b0', dash: undefined, markerEnd: 'url(#arrow-flow-filled)',                             labelColor: '#4ec9b0' },
  succession:          { stroke: '#4ec9b0', dash: undefined, markerEnd: 'url(#arrow-open)',                                    labelColor: '#4ec9b0' },
  transition:          { stroke: '#4ec9b0', dash: undefined, markerEnd: 'url(#arrow-flow-filled)',                             labelColor: '#4ec9b0' },
  typereference:       { stroke: '#6a7a8a', dash: '4,3',     markerEnd: 'url(#tri-typeref)',                                   labelColor: '#6a7a8a' },
  referencesubsetting: { stroke: '#9e9e9e', dash: undefined, markerEnd: 'url(#arrow-open)',                                    labelColor: '#9e9e9e' },
  satisfy:             { stroke: '#e06060', dash: '6,3',     markerEnd: 'url(#arrow-satisfy)',                                 labelColor: '#e06060' },
  verify:              { stroke: '#60b060', dash: '6,3',     markerEnd: 'url(#arrow-verify)',                                  labelColor: '#60b060' },
  allocate:            { stroke: '#c0a060', dash: '6,3',     markerEnd: 'url(#arrow-allocate)',                                labelColor: '#c0a060' },
  successionflow:      { stroke: '#4ec9b0', dash: '6,3',     markerEnd: 'url(#arrow-flow-filled)',                             labelColor: '#4ec9b0' },
  message:             { stroke: '#c0a0e0', dash: undefined, markerEnd: 'url(#arrow-message)',                                labelColor: '#c0a0e0' },
  bind:                { stroke: '#9090c0', dash: '4,3',     markerEnd: 'url(#circle-bind-end)',  markerStart: 'url(#circle-bind-start)', labelColor: '#9090c0' },
  annotate:            { stroke: '#a0a060', dash: '4,3',     markerEnd: '',                                                     labelColor: '#a0a060' },
  conjugation:         { stroke: '#9a7aba', dash: '4,3',     markerEnd: 'url(#arrow-open)',                                    labelColor: '#9a7aba' },
};
const DEFAULT_EDGE_STYLE = EDGE_STYLES.association;

// SysML v2: definitions have sharp corners, usages have rounded corners, packages have sharp + tab
const DEF_CLASSES = new Set([
  'package', 'partdefinition', 'attributedefinition', 'connectiondefinition',
  'portdefinition', 'actiondefinition', 'statedefinition', 'itemdefinition',
  'requirementdefinition', 'constraintdefinition', 'interfacedefinition', 'enumdefinition',
  'calcdefinition', 'allocationdefinition', 'casedefinition', 'usecasedefinition',
  'analysiscasedefinition', 'verificationcasedefinition',
  'concerndefinition', 'viewdefinition', 'viewpointdefinition',
  'renderingdefinition', 'metadatadefinition', 'conjugatedportdefinition', 'occurrencedefinition',
]);
const isDefinition = (cssClass: string) => DEF_CLASSES.has(cssClass);
const isPackage = (cssClass: string) => cssClass === 'package';
const isComment = (cssClass: string) => cssClass === 'comment';
// Per spec: state defs also use rounded corners (Section 8.2.3.18)
const nodeRadius = (cssClass: string) => (isDefinition(cssClass) && cssClass !== 'statedefinition') || cssClass === 'stdlib' ? 0 : 10;
const CONTROL_CSS = new Set(['forknode', 'joinnode', 'mergenode', 'decisionnode', 'startnode', 'donenode', 'terminatenode']);
const PORT_CSS = new Set(['portusage']);
const PARAM_CSS = new Set(['actionin', 'actionout', 'actioninout']);
const PORT_BORDER_SIZE = 16;

export default function DiagramViewer({
  model, hiddenNodeIds, hiddenEdgeIds, storageKey, viewMode = 'nested', onViewModeChange, onNodeSelect, onEdgeSelect, onEdgeGoToCode, onHideNode, onHideEdge,
  onHideNodes, onHideEdges,
  selectedNodeId: controlledNodeId, selectedEdgeId: controlledEdgeId,
  onSelectedNodeChange, onSelectedEdgeChange,
  showLegend = true,
  viewType = 'general',
  onViewTypeChange,
  showInherited = false,
  onShowInheritedChange,
  onShowOnly, onResetView,
  locks, currentUserId, onCheckOut, onCheckIn, onRequestLock,
}: DiagramViewerProps) {
  const t = useTheme();
  const isDark = t.mode === 'dark';
  const NODE_COLORS = isDark ? NODE_COLORS_DARK : NODE_COLORS_LIGHT;
  // Themed SVG text/stroke colors
  const svgText = isDark ? '#e8eef6' : '#1a1a2e';
  const svgTextSub = isDark ? '#b0c8e8' : '#3a4a6a';
  const svgTextDim = isDark ? '#888' : '#777';
  const svgStroke = isDark ? '#4a8ab0' : '#8a8aaa';
  const svgPkgStroke = isDark ? '#6a6a8a' : '#9a9ab0';
  const svgPkgText = isDark ? '#d0d0e8' : '#2a2a4a';
  const svgPkgLabel = isDark ? '#9a9ac0' : '#5a5a8a';
  const svgCtrlFill = isDark ? '#ccc' : '#555';
  const svgCtrlStroke = isDark ? '#888' : '#999';
  const svgPortText = isDark ? '#c0b0e0' : '#5a3a8a';
  const svgPortStroke = isDark ? '#7a5a9a' : '#9a7aba';
  const svgCommentText = isDark ? '#e8e0c0' : '#4a4020';
  const svgCommentBody = isDark ? '#c0b880' : '#6a6040';
  const svgCommentLabel = isDark ? '#c0b060' : '#7a6a30';
  const svgCommentStroke = isDark ? '#8a7a40' : '#b0a060';
  const svgCommentFill = isDark ? '#3a3520' : '#f0e8c0';
  const svgCommentFold = isDark ? '#2a2810' : '#e0d8b0';
  const svgAttrText = isDark ? '#b0c8e0' : '#3a5a7a';
  const svgLegendText = isDark ? '#ccc' : '#333';
  // IV is always nested per SysML v2 spec (Section 9.2.20, 8.2.3.11):
  // "Default compartment for a part" — nested features as nested nodes with boundary ports
  const effectiveViewMode: 'nested' | 'tree' = viewMode;
  const vcfg = useMemo(() => getViewConfig(viewType), [viewType]);

  // Lock lookup by element name
  const lockMap = useMemo(() => {
    const map = new Map<string, ElementLock>();
    if (locks) locks.forEach(l => map.set(l.elementName, l));
    return map;
  }, [locks]);

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

  // ELK-computed edge routes: edge id → SVG path string (all modes)
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

  // Clear all positions when the set of visible nodes changes (prevents stale edge rendering)
  const nodeIdSetKey = useMemo(() => [...nodes].map(n => n.id).sort().join(','), [nodes]);
  const prevNodeIdSetKey = useRef(nodeIdSetKey);
  useEffect(() => {
    if (prevNodeIdSetKey.current !== nodeIdSetKey) {
      prevNodeIdSetKey.current = nodeIdSetKey;
      setPositions(new Map());
      setIbdSizes(new Map());
      setElkEdgeRoutes(new Map());
      setPositionOverrides(new Map());
    }
  }, [nodeIdSetKey]);

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
      if (e.cssClasses?.[0] === 'composition' || e.cssClasses?.[0] === 'noncomposite') map.set(e.targetId, e.sourceId);
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

  const CONTROL_NODE_CSS = new Set(['forknode', 'joinnode', 'mergenode', 'decisionnode', 'startnode', 'donenode', 'terminatenode']);

  const effectiveSize = useCallback((node: SNode) => {
    const override = sizeOverrides.get(node.id);
    if (override) {
      return { w: override.w, h: Math.max(override.h, node.size.height) };
    }

    // Small boundary squares only in nested mode (when configured for this view)
    const css = node.cssClasses?.[0];
    if (effectiveViewMode === 'nested' && css && vcfg.pinCssClasses.has(css)) {
      return { w: PORT_BORDER_SIZE, h: PORT_BORDER_SIZE };
    }

    // Control nodes keep their fixed sizes (bar, diamond, circle)
    if (css && CONTROL_NODE_CSS.has(css)) {
      return { w: node.size.width, h: node.size.height };
    }

    // Dynamically compute size based on content labels
    const kindLabel = node.children.find((c) => c.id.endsWith('__kind'));
    const nameLabel = node.children.find((c) => c.id.endsWith('__label'));
    const attrLabels = node.children.filter((c) => c.id.includes('__usage__') || c.id.includes('__inherited__'));

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
  }, [sizeOverrides, viewType]);


  const visibleKey = useMemo(() => nodes.map((n) => n.id).sort().join(','), [nodes]);
  const sizesKey = useMemo(() => nodes.map((n) => { const s = effectiveSize(n); return `${n.id}:${s.w}x${s.h}`; }).join(','), [nodes, effectiveSize]);
  const edgesKey = useMemo(() => edges.map((e) => `${e.sourceId}→${e.targetId}`).sort().join(','), [edges]);
  // Stable string key for positions — avoids Map reference changes triggering recomputation
  const positionsKey = useMemo(() => {
    const parts: string[] = [];
    for (const [id, p] of positions) parts.push(`${id}:${Math.round(p.x)},${Math.round(p.y)}`);
    for (const [id, p] of positionOverrides) parts.push(`o${id}:${Math.round(p.x)},${Math.round(p.y)}`);
    for (const [id, s] of layoutSizes) parts.push(`s${id}:${s.w},${s.h}`);
    return parts.join('|');
  }, [positions, layoutSizes, positionOverrides]);


  // ── ELK layout (General View) ──────────────────────────────────
  useEffect(() => {
    if (nodes.length === 0) return;
    let cancelled = false;
    setLayoutPending(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let elkGraph: any;

    if (effectiveViewMode === 'tree') {
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
        'actiondefinition', 'actionusage', 'performactionusage',
        'sendactionusage', 'acceptactionusage', 'ifactionusage', 'assignmentactionusage',
        'forloopactionusage', 'whileloopactionusage', 'includeusecaseusage',
        'statedefinition', 'stateusage', 'exhibitstateusage',
        'portdefinition',
        'casedefinition', 'caseusage',
        'usecasedefinition', 'usecaseusage',
        'analysiscasedefinition', 'analysiscaseusage',
        'verificationcasedefinition', 'verificationcaseusage',
      ]);

      // Index flow edges by parent container for behavioural containers.
      // When a container is hidden, find the nearest visible ancestor so
      // succession edges are still used for layout.
      function effectiveParent(nodeId: string): string | undefined {
        let cur = parentOf.get(nodeId);
        while (cur && !elkVisibleIds.has(cur)) cur = parentOf.get(cur);
        return cur;
      }
      const flowEdgesByParent = new Map<string, Array<{ id: string; sources: string[]; targets: string[] }>>();
      for (const e of allEdges) {
        const ek = e.cssClasses?.[0];
        if (ek !== 'flow' && ek !== 'succession' && ek !== 'transition') continue;
        if (!elkVisibleIds.has(e.sourceId) || !elkVisibleIds.has(e.targetId)) continue;
        // Both source and target must share the same effective parent
        const srcParent = effectiveParent(e.sourceId);
        const tgtParent = effectiveParent(e.targetId);
        if (srcParent && srcParent === tgtParent) {
          const arr = flowEdgesByParent.get(srcParent) ?? [];
          arr.push({ id: e.id, sources: [e.sourceId], targets: [e.targetId] });
          flowEdgesByParent.set(srcParent, arr);
        } else if (srcParent && tgtParent && srcParent !== tgtParent) {
          // Pin-to-pin flow: lift to action-usage-to-action-usage for layout ordering
          // srcParent and tgtParent are sibling action usages — find their common grandparent
          const srcGrand = effectiveParent(srcParent);
          const tgtGrand = effectiveParent(tgtParent);
          if (srcGrand && srcGrand === tgtGrand) {
            const arr = flowEdgesByParent.get(srcGrand) ?? [];
            arr.push({ id: `${e.id}__layout`, sources: [srcParent], targets: [tgtParent] });
            flowEdgesByParent.set(srcGrand, arr);
          }
        }
      }

      const visiting = new Set<string>();
      const MAX_ELK_DEPTH = 50;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function buildElkNode(nodeId: string, depth = 0): any {
        if (depth > MAX_ELK_DEPTH || visiting.has(nodeId)) return { id: nodeId, width: 140, height: 50 };
        visiting.add(nodeId);
        const n = nodeMap.get(nodeId);
        const { w, h } = n ? effectiveSize(n) : { w: 140, h: 50 };
        const cssClass = n?.cssClasses?.[0] ?? 'default';
        const childIds = (childrenOf.get(nodeId) ?? []).filter(id => elkVisibleIds.has(id));

        if (childIds.length > 0) {
          const isPkgNode = cssClass === 'package';
          const isBehavioural = BEHAVIOURAL_KINDS.has(cssClass);
          // Check if all children are small pins (actionin/actionout/actioninout/portusage)
          const allChildrenArePins = vcfg.compactPinContainers && childIds.every(cId => {
            const cn = nodeMap.get(cId);
            const cc = cn?.cssClasses?.[0] ?? '';
            return vcfg.pinCssClasses.has(cc);
          });
          // Use DOWN layout for packages, behavioural, and containers with 3+ children
          // (RIGHT direction causes horizontal cramming with many children)
          const isDownLayout = isPkgNode || isBehavioural || childIds.length >= 3;
          const minW = allChildrenArePins ? Math.max(w, 80) : Math.max(w, 140);
          const minH = allChildrenArePins ? Math.max(h, 40) : Math.max(h, isPkgNode ? 80 : 70);

          // Collect internal flow edges for behavioural containers (successions)
          const internalEdges = isBehavioural ? (flowEdgesByParent.get(nodeId) ?? []) : [];

          const padTop = isPkgNode ? 48 : allChildrenArePins ? 30 : isBehavioural ? 50 : 52;
          const padSide = isPkgNode ? 20 : allChildrenArePins ? 10 : isBehavioural ? 24 : 20;
          const padBottom = isPkgNode ? 20 : allChildrenArePins ? 10 : 20;

          const result = {
            id: nodeId,
            layoutOptions: {
              'elk.padding': `[top=${padTop},left=${padSide},bottom=${padBottom},right=${padSide}]`,
              'elk.algorithm': 'layered',
              'elk.direction': isDownLayout ? 'DOWN' : 'RIGHT',
              'elk.spacing.nodeNode': isPkgNode ? '30' : isBehavioural ? String(vcfg.behavioralNodeSpacing) : '24',
              'elk.layered.spacing.nodeNodeBetweenLayers': isPkgNode ? '40' : isBehavioural ? String(vcfg.behavioralLayerSpacing) : '30',
              'elk.edgeRouting': 'ORTHOGONAL',
              'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
              'elk.nodeSize.constraints': 'MINIMUM_SIZE',
              'elk.nodeSize.minimum': `(${minW},${minH})`,
            },
            children: childIds.map(cId => buildElkNode(cId, depth + 1)),
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
      const topLevelIds = new Set(topLevel.map(n => n.id));

      // Build map: nodeId → top-level ancestor id
      function topAncestor(id: string): string | undefined {
        let cur = id;
        while (cur) {
          if (topLevelIds.has(cur)) return cur;
          const p = parentOf.get(cur);
          if (!p) return undefined;
          cur = p;
        }
        return undefined;
      }

      // Collect cross-container edges AND top-level flow edges
      const crossEdgePairs = new Set<string>();
      const crossElkEdges: Array<{ id: string; sources: string[]; targets: string[] }> = [];
      // Also collect flow edges whose endpoints are top-level (orphaned from hidden container)
      const topLevelFlowEdges: Array<{ id: string; sources: string[]; targets: string[] }> = [];
      for (const e of edges) {
        const ek3 = e.cssClasses?.[0];
        if (ek3 === 'composition' || ek3 === 'noncomposite') continue;
        // Flow/succession edges between top-level nodes go directly into top-level layout
        if (ek3 === 'flow' || ek3 === 'succession' || ek3 === 'transition') {
          const srcTop = topAncestor(e.sourceId);
          const tgtTop = topAncestor(e.targetId);
          if (srcTop && tgtTop && srcTop !== tgtTop) {
            // Both are top-level themselves — add as direct flow edge for layout
            if (topLevelIds.has(e.sourceId) && topLevelIds.has(e.targetId)) {
              topLevelFlowEdges.push({ id: e.id, sources: [e.sourceId], targets: [e.targetId] });
            }
          }
          continue;
        }
        const srcTop = topAncestor(e.sourceId);
        const tgtTop = topAncestor(e.targetId);
        if (!srcTop || !tgtTop || srcTop === tgtTop) continue;
        const pairKey = srcTop < tgtTop ? `${srcTop}|${tgtTop}` : `${tgtTop}|${srcTop}`;
        if (crossEdgePairs.has(pairKey)) continue;
        crossEdgePairs.add(pairKey);
        crossElkEdges.push({ id: `cross_${pairKey}`, sources: [srcTop], targets: [tgtTop] });
      }

      const allTopEdges = [...crossElkEdges, ...topLevelFlowEdges];
      const hasCrossEdges = crossElkEdges.length > 0;
      const hasTopFlowEdges = topLevelFlowEdges.length > 0;
      elkGraph = {
        id: 'graph',
        layoutOptions: {
          'elk.algorithm': 'layered',
          'elk.direction': 'DOWN',
          'elk.spacing.nodeNode': hasCrossEdges ? '100' : hasTopFlowEdges ? '40' : '60',
          'elk.layered.spacing.nodeNodeBetweenLayers': hasCrossEdges ? '120' : hasTopFlowEdges ? '50' : '80',
          ...(hasCrossEdges ? { 'elk.spacing.edgeNode': '30' } : {}),
        },
        children: elkChildren,
        edges: allTopEdges,
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

      // Snap pin nodes to parent boundary (nested mode only, config-driven)
      if (effectiveViewMode === 'nested' && vcfg.pinCssClasses.size > 0) {
        const half = PORT_BORDER_SIZE / 2;
        const pp = vcfg.pinPlacement;
        for (const n of nodes) {
          const css = n.cssClasses?.[0] ?? '';
          if (!vcfg.pinCssClasses.has(css)) continue;
          const pid = parentOf.get(n.id);
          if (!pid) continue;
          const parentPos = newPositions.get(pid);
          const parentSz = newIbdSizes.get(pid);
          const pinPos = newPositions.get(n.id);
          if (!parentPos || !parentSz || !pinPos) continue;

          const cx = pinPos.x + half;
          const cy = pinPos.y + half;
          const dir = n.data?.direction as 'in' | 'out' | 'inout' | undefined;

          // Determine side from config placement
          let side: 'left' | 'right' | 'top' | 'bottom';
          const placement = dir ? pp[dir] : 'nearest';
          if (placement === 'nearest') {
            const dL = Math.abs(cx - parentPos.x);
            const dR = Math.abs(cx - (parentPos.x + parentSz.w));
            const dT = Math.abs(cy - parentPos.y);
            const dB = Math.abs(cy - (parentPos.y + parentSz.h));
            const minD = Math.min(dL, dR, dT, dB);
            side = minD === dR ? 'right' : minD === dT ? 'top' : minD === dB ? 'bottom' : 'left';
          } else {
            side = placement;
          }

          // Snap to straddle parent edge
          if (side === 'left') {
            newPositions.set(n.id, { x: parentPos.x - half, y: cy - half });
          } else if (side === 'right') {
            newPositions.set(n.id, { x: parentPos.x + parentSz.w - half, y: cy - half });
          } else if (side === 'top') {
            newPositions.set(n.id, { x: cx - half, y: parentPos.y - half });
          } else {
            newPositions.set(n.id, { x: cx - half, y: parentPos.y + parentSz.h - half });
          }
          newIbdSizes.set(n.id, { w: PORT_BORDER_SIZE, h: PORT_BORDER_SIZE });
        }
      }

      // Collect ELK-computed edge routes from all levels (top-level + internal container edges)
      const newEdgeRoutes = new Map<string, string>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function collectEdgeRoutes(elkNode: any, ox: number, oy: number) {
        for (const elkEdge of elkNode.edges ?? []) {
          if (!elkEdge.sections || elkEdge.sections.length === 0) continue;
          const pathParts: string[] = [];
          for (const section of elkEdge.sections) {
            const start = section.startPoint;
            pathParts.push(`M ${start.x + ox} ${start.y + oy}`);
            for (const bp of section.bendPoints ?? []) {
              pathParts.push(`L ${bp.x + ox} ${bp.y + oy}`);
            }
            const end = section.endPoint;
            pathParts.push(`L ${end.x + ox} ${end.y + oy}`);
          }
          newEdgeRoutes.set(elkEdge.id, pathParts.join(' '));
        }
        for (const child of elkNode.children ?? []) {
          const cx = (child.x ?? 0) + ox;
          const cy = (child.y ?? 0) + oy;
          collectEdgeRoutes(child, cx, cy);
        }
      }
      collectEdgeRoutes(result, 0, 0);
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
  }, [visibleKey, sizesKey, edgesKey, layoutTrigger, effectiveViewMode, viewType]);

  const fitToWindow = useCallback(() => {
    setPositionOverrides(new Map());
    setLayoutTrigger((n) => n + 1);
  }, [setPositionOverrides]);

  const nodePos = useCallback((id: string) => positionOverrides.get(id) ?? positions.get(id) ?? { x: 0, y: 0 }, [positionOverrides, positions]);
  const nodeSz = useCallback((id: string) => {
    const ibd = layoutSizes.get(id);
    if (ibd) return ibd;
    const n = nodeMap.get(id);
    return n ? effectiveSize(n) : { w: 160, h: 60 };
  }, [layoutSizes, nodeMap, effectiveSize]);

  const nodeCenter = useCallback((id: string): { x: number; y: number } => {
    const pos = nodePos(id);
    const sz = nodeSz(id);
    return { x: pos.x + sz.w / 2, y: pos.y + sz.h / 2 };
  }, [nodePos, nodeSz]);

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

  // Index parallel edges: edges sharing the same node pair get spread apart via curves
  const CURVE_SPACING = 30; // perpendicular offset between parallel edges
  const edgeCurveOffset = useMemo(() => {
    const pairMap = new Map<string, string[]>();
    for (const e of edges) {
      if (e.cssClasses?.[0] === 'composition' || e.cssClasses?.[0] === 'noncomposite') continue;
      const a = e.sourceId < e.targetId ? e.sourceId : e.targetId;
      const b = e.sourceId < e.targetId ? e.targetId : e.sourceId;
      const key = `${a}|${b}`;
      const arr = pairMap.get(key) ?? [];
      arr.push(e.id);
      pairMap.set(key, arr);
    }
    const offsets = new Map<string, number>();
    for (const [, ids] of pairMap) {
      if (ids.length === 1) { offsets.set(ids[0], 0); continue; }
      for (let i = 0; i < ids.length; i++) {
        // Center the fan: offsets are ..., -1, 0, 1, ... multiplied by spacing
        offsets.set(ids[i], (i - (ids.length - 1) / 2) * CURVE_SPACING);
      }
    }
    return offsets;
  }, [edges]);

  // ── Orthogonal edge routing for nested mode ──────────────────────────
  // Cached ancestor/descendant lookups — computed once per layout, not per edge
  const ancestorCache = useMemo(() => {
    const cache = new Map<string, Set<string>>();
    function get(id: string): Set<string> {
      const cached = cache.get(id);
      if (cached) return cached;
      const anc = new Set<string>();
      let cur = parentOf.get(id);
      while (cur) { anc.add(cur); cur = parentOf.get(cur); }
      cache.set(id, anc);
      return anc;
    }
    return get;
  }, [parentOf]);
  const ancestorsOf = ancestorCache;

  const descendantCache = useMemo(() => {
    const cache = new Map<string, Set<string>>();
    function get(id: string): Set<string> {
      const cached = cache.get(id);
      if (cached) return cached;
      const desc = new Set<string>();
      const stack = [...(childrenOf.get(id) ?? [])];
      while (stack.length > 0) {
        const c = stack.pop()!;
        desc.add(c);
        for (const gc of childrenOf.get(c) ?? []) stack.push(gc);
      }
      cache.set(id, desc);
      return desc;
    }
    return get;
  }, [childrenOf]);
  const descendantsOf = descendantCache;

  // Check if an axis-aligned segment intersects a rectangle (with margin)
  const OBSTACLE_MARGIN = 18;
  const segmentHitsRect = (
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    rx: number, ry: number, rw: number, rh: number,
  ): boolean => {
    const m = OBSTACLE_MARGIN;
    const left = rx - m, right = rx + rw + m, top = ry - m, bottom = ry + rh + m;
    // Horizontal segment
    if (Math.abs(p1.y - p2.y) < 1) {
      const y = p1.y;
      if (y < top || y > bottom) return false;
      const minX = Math.min(p1.x, p2.x), maxX = Math.max(p1.x, p2.x);
      return maxX > left && minX < right;
    }
    // Vertical segment
    if (Math.abs(p1.x - p2.x) < 1) {
      const x = p1.x;
      if (x < left || x > right) return false;
      const minY = Math.min(p1.y, p2.y), maxY = Math.max(p1.y, p2.y);
      return maxY > top && minY < bottom;
    }
    // Fallback for non-axis-aligned (shouldn't happen in orthogonal routing)
    return false;
  };

  type OrthoObstacle = { x: number; y: number; w: number; h: number };

  // Check if an orthogonal path (array of waypoints) is free of obstacle collisions
  const pathClear = (wp: { x: number; y: number }[], obstacles: OrthoObstacle[]): boolean => {
    for (let i = 0; i < wp.length - 1; i++) {
      for (const obs of obstacles) {
        if (segmentHitsRect(wp[i], wp[i + 1], obs.x, obs.y, obs.w, obs.h)) return false;
      }
    }
    return true;
  };

  // Compute the total length of an orthogonal path
  const pathLength = (wp: { x: number; y: number }[]): number => {
    let len = 0;
    for (let i = 1; i < wp.length; i++) {
      len += Math.abs(wp[i].x - wp[i - 1].x) + Math.abs(wp[i].y - wp[i - 1].y);
    }
    return len;
  };

  // Side-aware border point for orthogonal routing: exits from the center of a side
  const sideBorderPoint = (
    center: { x: number; y: number },
    size: { w: number; h: number },
    side: 'top' | 'bottom' | 'left' | 'right',
  ): { x: number; y: number } => {
    switch (side) {
      case 'top': return { x: center.x, y: center.y - size.h / 2 };
      case 'bottom': return { x: center.x, y: center.y + size.h / 2 };
      case 'left': return { x: center.x - size.w / 2, y: center.y };
      case 'right': return { x: center.x + size.w / 2, y: center.y };
    }
  };

  // Determine the best exit/entry sides for an orthogonal connection
  const chooseSides = (
    srcCenter: { x: number; y: number }, srcSz: { w: number; h: number },
    tgtCenter: { x: number; y: number }, tgtSz: { w: number; h: number },
  ): { srcSide: 'top' | 'bottom' | 'left' | 'right'; tgtSide: 'top' | 'bottom' | 'left' | 'right' } => {
    const dx = tgtCenter.x - srcCenter.x;
    const dy = tgtCenter.y - srcCenter.y;
    // Use aspect-ratio-aware direction detection
    if (Math.abs(dx) / (srcSz.w / 2 + tgtSz.w / 2) > Math.abs(dy) / (srcSz.h / 2 + tgtSz.h / 2)) {
      // Primarily horizontal
      return dx > 0
        ? { srcSide: 'right', tgtSide: 'left' }
        : { srcSide: 'left', tgtSide: 'right' };
    } else {
      // Primarily vertical
      return dy > 0
        ? { srcSide: 'bottom', tgtSide: 'top' }
        : { srcSide: 'top', tgtSide: 'bottom' };
    }
  };

  // Route an edge orthogonally around obstacle nodes
  const routeOrthogonal = useCallback((
    srcId: string,
    tgtId: string,
  ): { x: number; y: number }[] | null => {
    if (effectiveViewMode === 'tree') return null;

    const srcCenter = nodeCenter(srcId);
    const tgtCenter = nodeCenter(tgtId);
    const srcSz = nodeSz(srcId);
    const tgtSz = nodeSz(tgtId);

    // Determine exit/entry sides and compute border points
    const { srcSide, tgtSide } = chooseSides(srcCenter, srcSz, tgtCenter, tgtSz);
    const srcPt = sideBorderPoint(srcCenter, srcSz, srcSide);
    const tgtPt = sideBorderPoint(tgtCenter, tgtSz, tgtSide);

    // Collect ids to exclude: source, target, their ancestors + all descendants
    // of those ancestors (the edge must pass freely through ancestor containers),
    // plus descendants of source and target themselves.
    const excludeIds = new Set<string>([srcId, tgtId]);
    for (const a of ancestorsOf(srcId)) {
      excludeIds.add(a);
      for (const d of descendantsOf(a)) excludeIds.add(d);
    }
    for (const a of ancestorsOf(tgtId)) {
      excludeIds.add(a);
      for (const d of descendantsOf(a)) excludeIds.add(d);
    }
    for (const d of descendantsOf(srcId)) excludeIds.add(d);
    for (const d of descendantsOf(tgtId)) excludeIds.add(d);

    // Build obstacle list from visible nodes
    const obstacles: OrthoObstacle[] = [];
    for (const n of nodes) {
      if (excludeIds.has(n.id)) continue;
      if (!visibleNodeIds.has(n.id)) continue;
      const pos = nodePos(n.id);
      const sz = nodeSz(n.id);
      obstacles.push({ x: pos.x, y: pos.y, w: sz.w, h: sz.h });
    }

    const isHorizontal = srcSide === 'left' || srcSide === 'right';
    const m = OBSTACLE_MARGIN;
    const GAP = 12; // extra gap when routing past a node edge

    // Generate candidate orthogonal paths and pick the shortest clear one
    const candidates: { x: number; y: number }[][] = [];

    if (isHorizontal) {
      // Sides exit horizontally — use a vertical channel between src and tgt
      // Z-shape: src -> (channelX, srcPt.y) -> (channelX, tgtPt.y) -> tgt
      const midX = (srcPt.x + tgtPt.x) / 2;
      candidates.push([srcPt, { x: midX, y: srcPt.y }, { x: midX, y: tgtPt.y }, tgtPt]);

      // If src and tgt at same Y, the Z collapses to a straight line
      if (Math.abs(srcPt.y - tgtPt.y) < 2) {
        candidates.push([srcPt, tgtPt]);
      }

      // Try channels at obstacle boundaries (left/right edges + margin)
      const channelXs = new Set<number>([midX]);
      for (const obs of obstacles) {
        channelXs.add(obs.x - m - GAP);
        channelXs.add(obs.x + obs.w + m + GAP);
      }
      for (const cx of channelXs) {
        // Only consider channels between src and tgt (or slightly outside)
        const minX = Math.min(srcPt.x, tgtPt.x) - 100;
        const maxX = Math.max(srcPt.x, tgtPt.x) + 100;
        if (cx < minX || cx > maxX) continue;
        candidates.push([srcPt, { x: cx, y: srcPt.y }, { x: cx, y: tgtPt.y }, tgtPt]);
      }

      // U-shape: route above or below nearby obstacles (limit extension to prevent orphaned arrows)
      const nearbyObs = obstacles.filter(o => {
        const oMidX = o.x + o.w / 2;
        return oMidX >= Math.min(srcPt.x, tgtPt.x) - 200 && oMidX <= Math.max(srcPt.x, tgtPt.x) + 200;
      });
      const allMinY = Math.min(srcPt.y, tgtPt.y, ...nearbyObs.map(o => o.y)) - m - GAP;
      const allMaxY = Math.max(srcPt.y, tgtPt.y, ...nearbyObs.map(o => o.y + o.h)) + m + GAP;
      // U-shape going above
      candidates.push([
        srcPt,
        { x: srcPt.x, y: allMinY },
        { x: tgtPt.x, y: allMinY },
        tgtPt,
      ]);
      // U-shape going below
      candidates.push([
        srcPt,
        { x: srcPt.x, y: allMaxY },
        { x: tgtPt.x, y: allMaxY },
        tgtPt,
      ]);
    } else {
      // Sides exit vertically — use a horizontal channel between src and tgt
      // Z-shape: src -> (srcPt.x, channelY) -> (tgtPt.x, channelY) -> tgt
      const midY = (srcPt.y + tgtPt.y) / 2;
      candidates.push([srcPt, { x: srcPt.x, y: midY }, { x: tgtPt.x, y: midY }, tgtPt]);

      // If src and tgt at same X, the Z collapses to a straight line
      if (Math.abs(srcPt.x - tgtPt.x) < 2) {
        candidates.push([srcPt, tgtPt]);
      }

      // Try channels at obstacle boundaries (top/bottom edges + margin)
      const channelYs = new Set<number>([midY]);
      for (const obs of obstacles) {
        channelYs.add(obs.y - m - GAP);
        channelYs.add(obs.y + obs.h + m + GAP);
      }
      for (const cy of channelYs) {
        const minY = Math.min(srcPt.y, tgtPt.y) - 100;
        const maxY = Math.max(srcPt.y, tgtPt.y) + 100;
        if (cy < minY || cy > maxY) continue;
        candidates.push([srcPt, { x: srcPt.x, y: cy }, { x: tgtPt.x, y: cy }, tgtPt]);
      }

      // U-shape: route left or right of nearby obstacles (limit extension to prevent orphaned arrows)
      const nearbyObsV = obstacles.filter(o => {
        const oMidY = o.y + o.h / 2;
        return oMidY >= Math.min(srcPt.y, tgtPt.y) - 200 && oMidY <= Math.max(srcPt.y, tgtPt.y) + 200;
      });
      const allMinX = Math.min(srcPt.x, tgtPt.x, ...nearbyObsV.map(o => o.x)) - m - GAP;
      const allMaxX = Math.max(srcPt.x, tgtPt.x, ...nearbyObsV.map(o => o.x + o.w)) + m + GAP;
      candidates.push([
        srcPt,
        { x: allMinX, y: srcPt.y },
        { x: allMinX, y: tgtPt.y },
        tgtPt,
      ]);
      candidates.push([
        srcPt,
        { x: allMaxX, y: srcPt.y },
        { x: allMaxX, y: tgtPt.y },
        tgtPt,
      ]);
    }

    // Pick the shortest obstacle-free candidate
    let bestPath: { x: number; y: number }[] | null = null;
    let bestLen = Infinity;
    for (const cand of candidates) {
      if (!pathClear(cand, obstacles)) continue;
      const len = pathLength(cand);
      if (len < bestLen) { bestLen = len; bestPath = cand; }
    }

    // Fallback: return the default Z-shape even if blocked
    if (!bestPath) {
      if (isHorizontal) {
        const midX = (srcPt.x + tgtPt.x) / 2;
        bestPath = [srcPt, { x: midX, y: srcPt.y }, { x: midX, y: tgtPt.y }, tgtPt];
      } else {
        const midY = (srcPt.y + tgtPt.y) / 2;
        bestPath = [srcPt, { x: srcPt.x, y: midY }, { x: tgtPt.x, y: midY }, tgtPt];
      }
    }

    // Sanity check: if the path extends too far beyond both endpoints, use a direct line
    const MAX_EXTENSION = 300;
    const pathMinX = Math.min(...bestPath.map(p => p.x));
    const pathMaxX = Math.max(...bestPath.map(p => p.x));
    const pathMinY = Math.min(...bestPath.map(p => p.y));
    const pathMaxY = Math.max(...bestPath.map(p => p.y));
    const endpointMinX = Math.min(srcPt.x, tgtPt.x);
    const endpointMaxX = Math.max(srcPt.x, tgtPt.x);
    const endpointMinY = Math.min(srcPt.y, tgtPt.y);
    const endpointMaxY = Math.max(srcPt.y, tgtPt.y);
    if (pathMinX < endpointMinX - MAX_EXTENSION || pathMaxX > endpointMaxX + MAX_EXTENSION ||
        pathMinY < endpointMinY - MAX_EXTENSION || pathMaxY > endpointMaxY + MAX_EXTENSION) {
      // Path extends too far — fall back to direct line
      return [srcPt, tgtPt];
    }

    // Remove redundant collinear waypoints
    const cleaned: { x: number; y: number }[] = [bestPath[0]];
    for (let i = 1; i < bestPath.length - 1; i++) {
      const prev = cleaned[cleaned.length - 1];
      const cur = bestPath[i];
      const next = bestPath[i + 1];
      // Skip if all three are on the same horizontal or vertical line
      const sameX = Math.abs(prev.x - cur.x) < 1 && Math.abs(cur.x - next.x) < 1;
      const sameY = Math.abs(prev.y - cur.y) < 1 && Math.abs(cur.y - next.y) < 1;
      if (!sameX && !sameY) cleaned.push(cur);
    }
    cleaned.push(bestPath[bestPath.length - 1]);

    return cleaned.length >= 2 ? cleaned : null;
  }, [effectiveViewMode, nodes, visibleNodeIds, nodePos, nodeSz, ancestorCache, descendantCache, parentOf, childrenOf]);

  // Cache routed paths for nested mode
  const routedEdgePaths = useMemo(() => {
    if (effectiveViewMode === 'tree') return new Map<string, { x: number; y: number }[]>();
    const cache = new Map<string, { x: number; y: number }[]>();
    for (const e of edges) {
      const ek2 = e.cssClasses?.[0];
      if (ek2 === 'composition' || ek2 === 'noncomposite' || ek2 === 'flow' || ek2 === 'succession' || ek2 === 'transition') continue;
      const path = routeOrthogonal(e.sourceId, e.targetId);
      if (path && path.length >= 2) {
        cache.set(e.id, path);
      }
    }
    return cache;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edges, effectiveViewMode, positionsKey]);

  const edgePath = (edge: SEdge): string => {
    // Use ELK-computed route in tree mode if available
    const elkRoute = elkEdgeRoutes.get(edge.id);
    if (elkRoute) return elkRoute;

    // Use orthogonal-routed path if available (nested mode)
    const routed = routedEdgePaths.get(edge.id);
    if (routed && routed.length >= 2) {
      const parts = [`M ${routed[0].x} ${routed[0].y}`];
      for (let i = 1; i < routed.length; i++) {
        parts.push(`L ${routed[i].x} ${routed[i].y}`);
      }
      return parts.join(' ');
    }

    const src = nodeCenter(edge.sourceId);
    const tgt = nodeCenter(edge.targetId);
    const offset = edgeCurveOffset.get(edge.id) ?? 0;

    if (offset === 0) {
      // Single edge between this pair — straight line
      const srcSz = nodeSz(edge.sourceId);
      const tgtSz = nodeSz(edge.targetId);
      const srcPt = borderPoint(src, srcSz, tgt);
      const tgtPt = borderPoint(tgt, tgtSz, src);
      return `M ${srcPt.x} ${srcPt.y} L ${tgtPt.x} ${tgtPt.y}`;
    }

    // Curved edge: offset the control point perpendicular to the src→tgt line
    const dx = tgt.x - src.x;
    const dy = tgt.y - src.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    // Perpendicular unit vector (rotated 90°)
    const px = -dy / len;
    const py = dx / len;
    const mx = (src.x + tgt.x) / 2 + px * offset;
    const my = (src.y + tgt.y) / 2 + py * offset;

    // Compute border points aiming at the control point for a natural curve exit
    const srcSz = nodeSz(edge.sourceId);
    const tgtSz = nodeSz(edge.targetId);
    const srcPt = borderPoint(src, srcSz, { x: mx, y: my });
    const tgtPt = borderPoint(tgt, tgtSz, { x: mx, y: my });
    return `M ${srcPt.x} ${srcPt.y} Q ${mx} ${my} ${tgtPt.x} ${tgtPt.y}`;
  };

  const edgeCenter = (edge: SEdge) => {
    // Helper: find best label position on a set of path points
    const bestLabelOnPath = (points: { x: number; y: number }[]) => {
      const segments: Array<{ idx: number; len: number; mx: number; my: number }> = [];
      for (let i = 1; i < points.length; i++) {
        const sl = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
        segments.push({
          idx: i - 1, len: sl,
          mx: (points[i - 1].x + points[i].x) / 2,
          my: (points[i - 1].y + points[i].y) / 2,
        });
      }
      // Check which segments' midpoints are NOT inside any visible node
      const isInsideNode = (px: number, py: number) => {
        for (const n of nodes) {
          if (n.id === edge.sourceId || n.id === edge.targetId) continue;
          const np = nodePos(n.id);
          const ns = nodeSz(n.id);
          if (px >= np.x - 5 && px <= np.x + ns.w + 5 && py >= np.y - 5 && py <= np.y + ns.h + 5) return true;
        }
        return false;
      };
      // First: try longest non-overlapping segment
      const free = segments.filter(s => !isInsideNode(s.mx, s.my)).sort((a, b) => b.len - a.len);
      if (free.length > 0) return { x: free[0].mx, y: free[0].my };
      // Fallback: use longest segment regardless
      segments.sort((a, b) => b.len - a.len);
      return { x: segments[0].mx, y: segments[0].my };
    };

    // Use ELK-computed route if available (works for internal container edges)
    const elkRoute = elkEdgeRoutes.get(edge.id);
    if (elkRoute) {
      // Parse SVG path "M x y L x y L x y ..." into points
      const points: { x: number; y: number }[] = [];
      const parts = elkRoute.split(/\s+/);
      for (let i = 0; i < parts.length; i++) {
        if ((parts[i] === 'M' || parts[i] === 'L') && i + 2 < parts.length) {
          points.push({ x: parseFloat(parts[i + 1]), y: parseFloat(parts[i + 2]) });
          i += 2;
        }
      }
      if (points.length >= 2) return bestLabelOnPath(points);
    }

    // Use orthogonal-routed path if available (nested mode)
    const routed = routedEdgePaths.get(edge.id);
    if (routed && routed.length >= 2) {
      return bestLabelOnPath(routed);
    }

    const src = nodeCenter(edge.sourceId);
    const tgt = nodeCenter(edge.targetId);
    const offset = edgeCurveOffset.get(edge.id) ?? 0;
    if (offset === 0) {
      return { x: (src.x + tgt.x) / 2, y: (src.y + tgt.y) / 2 };
    }
    // For curved edges, the label sits at the quadratic bezier midpoint (t=0.5)
    // Q bezier at t=0.5: P = 0.25*P0 + 0.5*CP + 0.25*P2
    const dx = tgt.x - src.x;
    const dy = tgt.y - src.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const px = -dy / len;
    const py = dx / len;
    const mx = (src.x + tgt.x) / 2 + px * offset;
    const my = (src.y + tgt.y) / 2 + py * offset;
    return {
      x: 0.25 * src.x + 0.5 * mx + 0.25 * tgt.x,
      y: 0.25 * src.y + 0.5 * my + 0.25 * tgt.y,
    };
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
  }, [onSelectedNodeChange, onSelectedEdgeChange, multiSelectedNodeIds.size]);

  const onEdgeClick = useCallback((e: React.MouseEvent, edge: SEdge) => {
    e.stopPropagation();
    if (multiSelectedNodeIds.size > 0) setMultiSelectedNodeIds(new Set());
    setInternalSelectedEdgeId(edge.id);
    setInternalSelectedNodeId(null);
    if (onSelectedEdgeChange) onSelectedEdgeChange(edge.id);
    if (onSelectedNodeChange) onSelectedNodeChange(null);
  }, [onSelectedEdgeChange, onSelectedNodeChange, multiSelectedNodeIds.size]);

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

  // ── Touch support (mobile: single-finger pan, two-finger pinch zoom) ──────
  const touchRef = useRef<{ startTouches: { x: number; y: number }[]; startTransform: typeof transform } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      // Single finger — pan
      dragging.current = true;
      dragStart.current = { x: e.touches[0].clientX - transform.x, y: e.touches[0].clientY - transform.y };
      touchRef.current = null;
    } else if (e.touches.length === 2) {
      // Two fingers — pinch zoom
      e.preventDefault();
      dragging.current = false;
      touchRef.current = {
        startTouches: [
          { x: e.touches[0].clientX, y: e.touches[0].clientY },
          { x: e.touches[1].clientX, y: e.touches[1].clientY },
        ],
        startTransform: { ...transform },
      };
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && dragging.current) {
      // Single finger pan
      const t = e.touches[0];
      setTransform((prev) => ({ ...prev, x: t.clientX - dragStart.current.x, y: t.clientY - dragStart.current.y }));
    } else if (e.touches.length === 2 && touchRef.current) {
      // Pinch zoom
      e.preventDefault();
      const { startTouches, startTransform } = touchRef.current;
      const curDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      const startDist = Math.hypot(
        startTouches[0].x - startTouches[1].x,
        startTouches[0].y - startTouches[1].y,
      );
      if (startDist < 1) return;
      const ratio = curDist / startDist;
      const newScale = Math.max(0.1, Math.min(5, startTransform.scale * ratio));
      // Zoom toward the midpoint between the two fingers
      const svg = svgRef.current;
      if (!svg) return;
      const bounds = svg.getBoundingClientRect();
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - bounds.left;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - bounds.top;
      const scaleChange = newScale / startTransform.scale;
      setTransform({
        x: midX - (midX - startTransform.x) * scaleChange,
        y: midY - (midY - startTransform.y) * scaleChange,
        scale: newScale,
      });
    }
  };
  const onTouchEnd = () => {
    dragging.current = false;
    touchRef.current = null;
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

  const isEmpty = !model || allNodes.length === 0;
  const emptyHint = (() => {
    if (!isEmpty) return '';
    if (!model) return 'Start editing to generate a diagram.';
    const viewHints: Record<string, string> = {
      'interconnection': 'No parts, ports, or connections found for this view.',
      'action-flow': 'No actions, successions, or flows found for this view.',
      'state-transition': 'No states or transitions found for this view.',
    };
    return viewHints[viewType] ?? 'No elements to display for this view.';
  })();

  // ── Render helpers ──────────────────────────────────────────────────────────

  // Render outermost containers first so children paint on top
  const renderNodes = [...nodes]
    .filter(n => visibleNodeIds.has(n.id))
    .sort((a, b) => (nodeDepth.get(a.id) ?? 0) - (nodeDepth.get(b.id) ?? 0));

  // In nested mode, hide composition edges (rendered as nesting); in tree mode, show all
  // Also filter out edges whose endpoints don't have positions yet (prevents stale rendering)
  const renderEdges = (effectiveViewMode === 'tree'
    ? edges.filter(e => visibleNodeIds.has(e.sourceId) && visibleNodeIds.has(e.targetId))
    : edges.filter(e =>
        e.cssClasses?.[0] !== 'composition' && e.cssClasses?.[0] !== 'noncomposite' &&
        visibleNodeIds.has(e.sourceId) &&
        visibleNodeIds.has(e.targetId),
      )
  ).filter(e => {
    // Only render edges where both endpoints have real layout positions
    const hasPos = (id: string) => positions.has(id) || positionOverrides.has(id);
    if (!hasPos(e.sourceId) || !hasPos(e.targetId)) return false;
    // Skip edges where source and target overlap at origin (fallback position)
    const sp = nodePos(e.sourceId);
    const tp = nodePos(e.targetId);
    if (sp.x === 0 && sp.y === 0 && tp.x === 0 && tp.y === 0) return false;

    // Skip edges whose routed path extends too far beyond both endpoint nodes
    const routed = routedEdgePaths.get(e.id);
    if (routed && routed.length >= 2) {
      const ss = nodeSz(e.sourceId);
      const ts = nodeSz(e.targetId);
      // Bounding box of both endpoint nodes (with generous margin)
      const margin = 150;
      const minX = Math.min(sp.x, tp.x) - margin;
      const maxX = Math.max(sp.x + ss.w, tp.x + ts.w) + margin;
      const minY = Math.min(sp.y, tp.y) - margin;
      const maxY = Math.max(sp.y + ss.h, tp.y + ts.h) + margin;
      // Check if any route point is way outside this box
      const outOfBounds = routed.some(pt => pt.x < minX - 200 || pt.x > maxX + 200 || pt.y < minY - 200 || pt.y > maxY + 200);
      if (outOfBounds) return false;
    }
    return true;
  });

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
        {/* View type selector */}
        <div style={{ display: 'flex', gap: 1 }}>
          {([
            { key: 'general' as ViewType, label: 'GV', title: 'General View — all elements' },
            { key: 'interconnection' as ViewType, label: 'IV', title: 'Interconnection View — parts, ports, connections' },
            { key: 'action-flow' as ViewType, label: 'AFV', title: 'Action Flow View — actions, successions, flows' },
            { key: 'state-transition' as ViewType, label: 'STV', title: 'State Transition View — states, transitions' },
            { key: 'sequence' as ViewType, label: 'SEQ', title: 'Sequence View — lifelines, messages, time ordering' },
            { key: 'grid' as ViewType, label: 'GRD', title: 'Grid View — relationship matrix (satisfy, verify, allocate)' },
            { key: 'browser' as ViewType, label: 'BRW', title: 'Browser View — hierarchical tree of model elements' },
            { key: 'geometry' as ViewType, label: 'GEO', title: 'Geometry View — 3D spatial visualization (coming soon)' },
          ]).map(({ key, label, title }) => {
            const active = viewType === key;
            return (
              <button
                key={key}
                onClick={() => { if (onViewTypeChange && key !== viewType) onViewTypeChange(key); }}
                title={title}
                style={{
                  background: active ? t.statusBar : t.bgSecondary,
                  border: '1px solid', borderColor: active ? t.statusBar : t.btnBorder,
                  color: active ? '#fff' : t.text,
                  fontSize: 10, borderRadius: 3, padding: '3px 6px', cursor: 'pointer',
                  fontWeight: active ? 700 : 400, letterSpacing: 0.5,
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = t.btnBgHover; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = t.bgSecondary; }}
              >
                {label}
              </button>
            );
          })}
        </div>
        {/* Layout mode selector */}
        {<>
          <span style={{ color: t.textDim, fontSize: 10 }}>|</span>
          <div style={{ display: 'flex', gap: 2 }}>
            {(['nested', 'tree'] as const).map(mode => {
              const active = effectiveViewMode === mode;
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
                    background: active ? t.statusBar : t.bgSecondary,
                    border: '1px solid', borderColor: active ? t.statusBar : t.btnBorder,
                    color: active ? '#fff' : t.text,
                    fontSize: 11, borderRadius: 3, padding: '3px 8px', cursor: 'pointer',
                    fontWeight: active ? 600 : 400,
                  }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.background = t.btnBgHover; } }}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.background = t.bgSecondary; } }}
                >
                  {mode === 'nested' ? '⊞ Nested' : '⊟ Tree'}
                </button>
              );
            })}
          </div>
        </>}
        {onShowInheritedChange && (
          <button
            onClick={() => onShowInheritedChange(!showInherited)}
            title={showInherited ? 'Hide inherited features' : 'Show inherited features from parent definitions'}
            style={{
              background: showInherited ? t.statusBar : t.bgSecondary,
              border: '1px solid', borderColor: showInherited ? t.statusBar : t.btnBorder,
              color: showInherited ? '#fff' : t.text,
              fontSize: 10, borderRadius: 3, padding: '3px 6px', cursor: 'pointer',
              fontWeight: showInherited ? 700 : 400,
            }}
            onMouseEnter={e => { if (!showInherited) e.currentTarget.style.background = t.btnBgHover; }}
            onMouseLeave={e => { if (!showInherited) e.currentTarget.style.background = t.bgSecondary; }}
          >
            Inherited
          </button>
        )}
        <button
          onClick={fitToWindow}
          title="Fit all visible elements to window"
          style={{
            background: t.bgSecondary, border: `1px solid ${t.btnBorder}`, color: t.text,
            fontSize: 11, borderRadius: 3, padding: '3px 8px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = t.statusBar; e.currentTarget.style.borderColor = t.statusBar; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = t.bgSecondary; e.currentTarget.style.borderColor = t.btnBorder; e.currentTarget.style.color = t.text; }}
        >
          ⊡ Fit
        </button>
        <button
          onClick={() => setTransform((t) => ({ ...t, scale: Math.min(5, t.scale * 1.3) }))}
          title="Zoom in"
          style={{
            background: t.bgSecondary, border: `1px solid ${t.btnBorder}`, color: t.text,
            fontSize: 14, borderRadius: 3, padding: '3px 8px', cursor: 'pointer', lineHeight: 1,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = t.statusBar; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = t.bgSecondary; e.currentTarget.style.color = t.text; }}
        >+</button>
        <button
          onClick={() => setTransform((t) => ({ ...t, scale: Math.max(0.1, t.scale * 0.7) }))}
          title="Zoom out"
          style={{
            background: t.bgSecondary, border: `1px solid ${t.btnBorder}`, color: t.text,
            fontSize: 14, borderRadius: 3, padding: '3px 8px', cursor: 'pointer', lineHeight: 1,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = t.statusBar; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = t.bgSecondary; e.currentTarget.style.color = t.text; }}
        >−</button>
        {onResetView && (
          <button
            onClick={() => { onResetView(); setTimeout(fitToWindow, 100); }}
            title="Reset view: show all elements and relations, then fit to window"
            style={{
              background: t.bgSecondary, border: `1px solid ${t.btnBorder}`, color: t.text,
              fontSize: 11, borderRadius: 3, padding: '3px 8px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = t.statusBar; e.currentTarget.style.borderColor = t.statusBar; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = t.bgSecondary; e.currentTarget.style.borderColor = t.btnBorder; e.currentTarget.style.color = t.text; }}
          >
            ↺ Default
          </button>
        )}
      </div>
      {/* Non-graph views: delegate to specialized renderers */}
      {viewType === 'sequence' && (
        <SequenceRenderer model={model} onNodeSelect={onNodeSelect ? (id) => {
          const n = allNodeMap.get(id);
          const r = n?.data?.range as { start: { line: number; character: number }; end: { line: number; character: number } } | undefined;
          if (r) onNodeSelect(r);
        } : undefined} />
      )}
      {viewType === 'grid' && (
        <GridRenderer model={model} onNodeSelect={onNodeSelect ? (id) => {
          const n = allNodeMap.get(id);
          const r = n?.data?.range as { start: { line: number; character: number }; end: { line: number; character: number } } | undefined;
          if (r) onNodeSelect(r);
        } : undefined} />
      )}
      {viewType === 'browser' && (
        <BrowserRenderer model={model} selectedNodeId={selectedNodeId} onNodeSelect={onNodeSelect ? (id) => {
          const n = allNodeMap.get(id);
          const r = n?.data?.range as { start: { line: number; character: number }; end: { line: number; character: number } } | undefined;
          if (r) onNodeSelect(r);
        } : undefined} />
      )}
      {viewType === 'geometry' && (
        <GeometryRenderer />
      )}
      {/* Standard graph views */}
      {isEmpty && !['sequence', 'grid', 'browser', 'geometry'].includes(viewType) && (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textDim }}>
          <div style={{ fontSize: 12 }}>{emptyHint}</div>
        </div>
      )}
      <svg
        ref={svgRef}
        style={{ width: '100%', height: '100%', background: t.bg, cursor: selecting.current ? 'crosshair' : dragging.current ? 'grabbing' : 'default', ...((isEmpty || ['sequence', 'grid', 'browser', 'geometry'].includes(viewType)) ? { display: 'none' } : {}) }}
        onMouseDown={onSvgMouseDown}
        onMouseMove={onSvgMouseMove}
        onMouseUp={onSvgMouseUp}
        onMouseLeave={(e) => onSvgMouseUp(e)}
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
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
            <polygon points="0 0, 12 5, 0 10" fill={t.bg} stroke="#9e9e9e" strokeWidth="1.5" />
          </marker>
          {/* ── Typing (defined by): hollow triangle on dashed line ── */}
          <marker id="tri-typeref" markerWidth="14" markerHeight="10" refX="13" refY="5" orient="auto">
            <polygon points="0 0, 12 5, 0 10" fill={t.bg} stroke="#6a7a8a" strokeWidth="1.5" />
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
          {/* ── Noncomposite (ref): open diamond at owner end ── */}
          <marker id="diamond-noncomp" markerWidth="16" markerHeight="9" refX="1" refY="4.5" orient="auto">
            <polygon points="1 4.5, 7 1, 13 4.5, 7 8" fill={t.bg} stroke="#9cdcfe" strokeWidth="1" />
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
          {/* ── Message: filled arrowhead ── */}
          <marker id="arrow-message" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
            <polygon points="0 0, 9 4, 0 8" fill="#c0a0e0" stroke="#c0a0e0" strokeWidth="1" />
          </marker>
          {/* ── Binding: open circle at both ends (per spec 8.2.3.13) ── */}
          <marker id="circle-bind-end" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <circle cx="4" cy="4" r="3" fill={t.bg} stroke="#9090c0" strokeWidth="1.5" />
          </marker>
          <marker id="circle-bind-start" markerWidth="8" markerHeight="8" refX="1" refY="4" orient="auto">
            <circle cx="4" cy="4" r="3" fill={t.bg} stroke="#9090c0" strokeWidth="1.5" />
          </marker>
        </defs>

        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
          {/* Nodes (rendered first so edges paint on top) */}
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
            const isContainer = effectiveViewMode === 'nested' && hasChildren;
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
                const nodeRange = node.data?.range as ContextMenu['range'] | undefined;
                setContextMenu({ x: e.clientX, y: e.clientY, type: 'node', id: node.id, label: nodeName, range: nodeRange });
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
                  <text x={tabW / 2} y={tabH - 4} fill={svgPkgLabel} fontSize={9} textAnchor="middle" fontStyle="italic">
                    {kindLabel?.text}
                  </text>
                  {/* Main body below tab */}
                  <rect y={tabH} width={w} height={h - tabH}
                    fill={color} fillOpacity={isContainer ? 0.15 : 0.35}
                    stroke={borderColor}
                    strokeWidth={isSelected ? 2.5 : isHovered ? 2 : 1.5} />
                  {/* Package name */}
                  <text x={12} y={tabH + 20} fill={svgPkgText} fontSize={13} fontWeight="bold">
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
            // Control nodes (fork/join/merge/decide) should never render as containers
            if (isContainer && !CONTROL_CSS.has(cssClass)) {
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
                    {...(node.data?.isRef ? { strokeDasharray: '6 3' } : {})}
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
                    <text x={w / 2} y={14} fill={svgTextSub} fontSize={10} textAnchor="middle" fontStyle="italic">
                      {kindLabel.text}
                    </text>
                  )}
                  {/* Name label */}
                  {nameLabel && (
                    <text x={w / 2} y={(node.data as Record<string, unknown>)?.isParallel ? 26 : 30} fill={svgText} fontSize={13} textAnchor="middle" fontWeight="bold">
                      {nameLabel.text}
                    </text>
                  )}
                  {/* Parallel indicator */}
                  {!!(node.data as Record<string, unknown>)?.isParallel && (
                    <text x={w / 2} y={38} fill={svgTextSub} fontSize={9} textAnchor="middle" fontStyle="italic">
                      «parallel»
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
            const isMergeDecide = cssClass === 'mergenode' || cssClass === 'decisionnode';
            if (isForkJoin) {
              const borderColor = isSelected ? '#f0c040' : isHovered ? '#aaa' : '#888';
              return (
                <g key={node.id} transform={`translate(${pos.x},${pos.y})`}
                  onClick={(e) => onNodeClick(e, node)}
                  onContextMenu={onNodeContextMenu}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  style={{ cursor: 'pointer' }}>
                  <rect width={w} height={h} fill={isDark ? '#aaa' : '#666'} stroke={borderColor} strokeWidth={1.5} rx={2} />
                  <text x={w / 2} y={h + 14} fill={svgTextDim} fontSize={9} textAnchor="middle">{nameLabel?.text}</text>
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
                  <text x={cx} y={h + 14} fill={svgTextDim} fontSize={9} textAnchor="middle">{nameLabel?.text}</text>
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
                  <circle cx={cx} cy={cy} r={r} fill={svgCtrlFill} stroke={borderColor} strokeWidth={1.5} />
                </g>
              );
            }

            // ── Done node: bull's-eye (flow final — outer circle + inner filled circle) ──
            if (cssClass === 'donenode') {
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
                  <circle cx={cx} cy={cy} r={r} fill="none" stroke={borderColor} strokeWidth={1.5} />
                  <circle cx={cx} cy={cy} r={r * 0.55} fill={svgCtrlFill} stroke="none" />
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

            // ── Port node: small square on parent boundary (nested only, config-driven) ──
            if (effectiveViewMode === 'nested' && PORT_CSS.has(cssClass) && vcfg.pinCssClasses.has(cssClass)) {
              const borderColor = isSelected ? '#f0c040' : isHovered ? '#b080e0' : '#7a5a9a';
              const portColor = NODE_COLORS[cssClass] ?? '#1e0a30';
              const portName = nameLabel?.text ?? node.id;

              // Determine which side of parent this port is on (for label placement & arrow)
              const pid = parentOf.get(node.id);
              let side: 'left' | 'right' | 'top' | 'bottom' = 'left';
              if (pid) {
                const pp = nodePos(pid);
                const ps = nodeSz(pid);
                const cx = pos.x + PORT_BORDER_SIZE / 2;
                const cy = pos.y + PORT_BORDER_SIZE / 2;
                const dL = Math.abs(cx - pp.x);
                const dR = Math.abs(cx - (pp.x + ps.w));
                const dT = Math.abs(cy - pp.y);
                const dB = Math.abs(cy - (pp.y + ps.h));
                const minD = Math.min(dL, dR, dT, dB);
                if (minD === dR) side = 'right';
                else if (minD === dT) side = 'top';
                else if (minD === dB) side = 'bottom';
              }

              // Direction-aware arrow: in=inward, out=outward, inout=bidirectional, none=inward default
              const s = PORT_BORDER_SIZE;
              const portDir = node.data?.direction as string | undefined;
              const aRight = `M${s * 0.3},${s * 0.3} L${s * 0.7},${s * 0.5} L${s * 0.3},${s * 0.7}`;
              const aLeft  = `M${s * 0.7},${s * 0.3} L${s * 0.3},${s * 0.5} L${s * 0.7},${s * 0.7}`;
              const aDown  = `M${s * 0.3},${s * 0.3} L${s * 0.5},${s * 0.7} L${s * 0.7},${s * 0.3}`;
              const aUp    = `M${s * 0.3},${s * 0.7} L${s * 0.5},${s * 0.3} L${s * 0.7},${s * 0.7}`;
              // Inward: arrow points INTO the parent (left side → right arrow, right side → left arrow)
              const arrowInward: Record<string, string> = {
                left: aRight, right: aLeft, top: aDown, bottom: aUp,
              };
              // Outward: arrow points AWAY from the parent
              const arrowOutward: Record<string, string> = {
                left: aLeft, right: aRight, top: aUp, bottom: aDown,
              };

              // Label placement outside parent boundary
              const labelProps: { x: number; y: number; textAnchor: 'start' | 'middle' | 'end' } =
                side === 'left'   ? { x: -4, y: s / 2 + 4, textAnchor: 'end' } :
                side === 'right'  ? { x: s + 4, y: s / 2 + 4, textAnchor: 'start' } :
                side === 'top'    ? { x: s / 2, y: -4, textAnchor: 'middle' } :
                                    { x: s / 2, y: s + 12, textAnchor: 'middle' };

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
                  {/* Port square — straddling parent boundary */}
                  <rect width={s} height={s} rx={2}
                    fill={portColor} stroke={borderColor}
                    strokeWidth={isSelected ? 2 : isHovered ? 1.5 : 1} />
                  {isSelected && <rect width={s} height={s} rx={2} fill="none" stroke="#f0c040" strokeWidth={3} opacity={0.25} />}
                  {/* Directional arrow: in=inward, out=outward, inout/none=horizontal line */}
                  {portDir === 'in' ? (
                    <path d={arrowInward[side]} fill="none" stroke="#40c080" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                  ) : portDir === 'out' ? (
                    <path d={arrowOutward[side]} fill="none" stroke="#c07030" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                  ) : (
                    <path d={`M${s * 0.2},${s * 0.5} L${s * 0.8},${s * 0.5}`} fill="none" stroke={portDir === 'inout' ? '#4090c0' : '#b0a0d0'} strokeWidth={1.5} strokeLinecap="round" />
                  )}
                  {/* Label outside parent */}
                  <text x={labelProps.x} y={labelProps.y} fill={svgPortText} fontSize={9} textAnchor={labelProps.textAnchor}>
                    {portName}
                  </text>
                </g>
              );
            }

            // ── Parameter/port node: small square on parent boundary (nested only, config-driven) ──
            if (effectiveViewMode === 'nested' && vcfg.pinCssClasses.has(cssClass) && !PORT_CSS.has(cssClass)) {
              const portDir = node.data?.direction as string | undefined;
              const isIn = cssClass === 'actionin' || portDir === 'in';
              const isOut = cssClass === 'actionout' || portDir === 'out';
              const dirColor = isIn ? '#40c080' : isOut ? '#c07030' : '#4090c0';
              const borderColor = isSelected ? '#f0c040' : isHovered ? dirColor : '#6a7a7a';
              const paramColor = NODE_COLORS[cssClass] ?? '#082828';
              const paramName = nameLabel?.text ?? node.id;

              const pid = parentOf.get(node.id);
              let side: 'left' | 'right' | 'top' | 'bottom' = 'left';
              if (pid) {
                const pp = nodePos(pid);
                const ps = nodeSz(pid);
                const cx = pos.x + PORT_BORDER_SIZE / 2;
                const cy = pos.y + PORT_BORDER_SIZE / 2;
                const dL = Math.abs(cx - pp.x);
                const dR = Math.abs(cx - (pp.x + ps.w));
                const dT = Math.abs(cy - pp.y);
                const dB = Math.abs(cy - (pp.y + ps.h));
                const minD = Math.min(dL, dR, dT, dB);
                if (minD === dR) side = 'right';
                else if (minD === dT) side = 'top';
                else if (minD === dB) side = 'bottom';
              }

              const s = PORT_BORDER_SIZE;
              // Direction arrow: in=pointing inward (into action), out=pointing outward (out of action)
              // left side: inward=right arrow, outward=left arrow
              // right side: inward=left arrow, outward=right arrow
              const arrowRight = `M${s * 0.3},${s * 0.3} L${s * 0.7},${s * 0.5} L${s * 0.3},${s * 0.7}`;
              const arrowLeft  = `M${s * 0.7},${s * 0.3} L${s * 0.3},${s * 0.5} L${s * 0.7},${s * 0.7}`;
              const arrowDown  = `M${s * 0.3},${s * 0.3} L${s * 0.5},${s * 0.7} L${s * 0.7},${s * 0.3}`;
              const arrowUp    = `M${s * 0.3},${s * 0.7} L${s * 0.5},${s * 0.3} L${s * 0.7},${s * 0.7}`;
              const arrowIn: Record<string, string> = {
                left: arrowRight, right: arrowLeft, top: arrowDown, bottom: arrowUp,
              };
              const arrowOut: Record<string, string> = {
                left: arrowLeft, right: arrowRight, top: arrowUp, bottom: arrowDown,
              };
              const arrowPath = isIn ? arrowIn[side] : isOut ? arrowOut[side] : `M${s * 0.3},${s * 0.5} L${s * 0.7},${s * 0.5}`;

              const labelProps: { x: number; y: number; textAnchor: 'start' | 'middle' | 'end' } =
                side === 'left'   ? { x: -4, y: s / 2 + 4, textAnchor: 'end' } :
                side === 'right'  ? { x: s + 4, y: s / 2 + 4, textAnchor: 'start' } :
                side === 'top'    ? { x: s / 2, y: -4, textAnchor: 'middle' } :
                                    { x: s / 2, y: s + 12, textAnchor: 'middle' };

              return (
                <g key={node.id} transform={`translate(${pos.x},${pos.y})`}
                  onClick={(e) => onNodeClick(e, node)}
                  onContextMenu={onNodeContextMenu}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  style={{ cursor: 'pointer' }}>
                  <rect width={s} height={s} rx={2} fill={paramColor} stroke={borderColor} strokeWidth={isSelected ? 2 : isHovered ? 1.5 : 1} />
                  {isSelected && <rect width={s} height={s} rx={2} fill="none" stroke="#f0c040" strokeWidth={3} opacity={0.25} />}
                  <path d={arrowPath} fill="none" stroke={dirColor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                  <text x={labelProps.x} y={labelProps.y} fill={svgPortText} fontSize={9} textAnchor={labelProps.textAnchor}>
                    {paramName}
                  </text>
                </g>
              );
            }

            // ── Comment node: folded-corner (note) shape ──
            if (isComment(cssClass)) {
              const fold = 14;
              const bodyLabel = node.children.find((c) => c.id.includes('__usage__'));
              const bodyText = bodyLabel?.text ?? '';
              const commentDisplayName = nameLabel?.text ?? '';
              // Show name if it's a real name (not "[comment]")
              const showName = commentDisplayName && commentDisplayName !== '[comment]';
              // Word-wrap the body text into lines
              const maxChars = Math.max(18, Math.floor((w - 16) / 6.5));
              const words = bodyText.split(/\s+/);
              const lines: string[] = [];
              let line = '';
              for (const word of words) {
                if (line && (line + ' ' + word).length > maxChars) { lines.push(line); line = word; }
                else { line = line ? line + ' ' + word : word; }
              }
              if (line) lines.push(line);

              const HEADER_H = showName ? 44 : 22;
              const LINE_H = 14;
              const dynamicH = Math.max(h, HEADER_H + lines.length * LINE_H + 12);
              const dynamicW = Math.max(w, 120);
              const borderColor = isSelected ? '#f0c040' : isHovered ? '#c0a040' : '#8a7a40';

              const foldPath = `M0,0 L${dynamicW - fold},0 L${dynamicW},${fold} L${dynamicW},${dynamicH} L0,${dynamicH} Z`;
              const foldTriangle = `M${dynamicW - fold},0 L${dynamicW - fold},${fold} L${dynamicW},${fold}`;

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
                  <path d={foldPath} fill={svgCommentFill} stroke={borderColor} strokeWidth={isSelected ? 2 : 1} />
                  <path d={foldTriangle} fill={svgCommentFold} stroke={borderColor} strokeWidth={0.5} />
                  {isSelected && <path d={foldPath} fill="none" stroke="#f0c040" strokeWidth={3} opacity={0.25} />}
                  {kindLabel && (
                    <text x={dynamicW / 2} y={15} fill={svgCommentLabel} fontSize={10} textAnchor="middle" fontStyle="italic">{kindLabel.text}</text>
                  )}
                  {showName && (
                    <text x={dynamicW / 2} y={34} fill={svgCommentText} fontSize={13} textAnchor="middle" fontWeight="bold">{commentDisplayName}</text>
                  )}
                  {lines.map((ln, i) => (
                    <text key={i} x={8} y={HEADER_H + 4 + (i + 1) * LINE_H - 2} fill={svgCommentBody} fontSize={10}>{ln}</text>
                  ))}
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
              const ownLabels = node.children.filter((c) => c.id.includes('__usage__'));
              const inheritedLabels = node.children.filter((c) => c.id.includes('__inherited__'));
              const attrLabels = [...ownLabels, ...inheritedLabels];
              const HEADER_H = 48;
              const ROW_H = 18;
              const hasCompartment = attrLabels.length > 0;
              const hasInherited = inheritedLabels.length > 0;
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
                  {/* Element-specific shapes per SysML v2 spec */}
                  {cssClass === 'usecasedefinition' || cssClass === 'usecaseusage' ? (
                    // Use case: ellipse/oval (spec 8.2.3.25)
                    <ellipse cx={dynamicW / 2} cy={dynamicH / 2} rx={dynamicW / 2} ry={dynamicH / 2} fill={color} stroke={borderColor} strokeWidth={isSelected ? 2 : isHovered ? 1.5 : 1} />
                  ) : cssClass === 'sendactionusage' ? (
                    // Send action: convex pentagon (arrow shape → pointing right) (spec 8.2.3.17)
                    <polygon
                      points={`0,0 ${dynamicW - 12},0 ${dynamicW},${dynamicH / 2} ${dynamicW - 12},${dynamicH} 0,${dynamicH}`}
                      fill={color} stroke={borderColor} strokeWidth={isSelected ? 2 : isHovered ? 1.5 : 1}
                    />
                  ) : cssClass === 'acceptactionusage' ? (
                    // Accept action: concave pentagon (notched ← on left) (spec 8.2.3.17)
                    <polygon
                      points={`12,0 ${dynamicW},0 ${dynamicW},${dynamicH} 12,${dynamicH} 0,${dynamicH / 2}`}
                      fill={color} stroke={borderColor} strokeWidth={isSelected ? 2 : isHovered ? 1.5 : 1}
                    />
                  ) : (
                    <rect width={dynamicW} height={dynamicH} rx={rx} fill={color} stroke={borderColor} strokeWidth={isSelected ? 2 : isHovered ? 1.5 : 1} {...(node.data?.isRef ? { strokeDasharray: '6 3' } : {})} />
                  )}
                  {isSelected && (cssClass === 'usecasedefinition' || cssClass === 'usecaseusage'
                    ? <ellipse cx={dynamicW / 2} cy={dynamicH / 2} rx={dynamicW / 2} ry={dynamicH / 2} fill="none" stroke="#f0c040" strokeWidth={3} opacity={0.25} />
                    : cssClass === 'sendactionusage'
                    ? <polygon points={`0,0 ${dynamicW - 12},0 ${dynamicW},${dynamicH / 2} ${dynamicW - 12},${dynamicH} 0,${dynamicH}`} fill="none" stroke="#f0c040" strokeWidth={3} opacity={0.25} />
                    : cssClass === 'acceptactionusage'
                    ? <polygon points={`12,0 ${dynamicW},0 ${dynamicW},${dynamicH} 12,${dynamicH} 0,${dynamicH / 2}`} fill="none" stroke="#f0c040" strokeWidth={3} opacity={0.25} />
                    : <rect width={dynamicW} height={dynamicH} rx={rx} fill="none" stroke="#f0c040" strokeWidth={3} opacity={0.25} />
                  )}
                  {/* Requirement text icon (spec 8.2.3.21) */}
                  {(cssClass === 'requirementdefinition' || cssClass === 'requirementusage') && (
                    <g transform={`translate(${dynamicW - 14},3)`} opacity={0.6}>
                      <rect width={8} height={10} rx={1} fill="none" stroke={svgTextSub} strokeWidth={0.8} />
                      <line x1={2} y1={3} x2={6} y2={3} stroke={svgTextSub} strokeWidth={0.6} />
                      <line x1={2} y1={5.5} x2={6} y2={5.5} stroke={svgTextSub} strokeWidth={0.6} />
                      <line x1={2} y1={8} x2={5} y2={8} stroke={svgTextSub} strokeWidth={0.6} />
                    </g>
                  )}
                  {/* Header separator (skip for ellipse and pentagons) */}
                  {cssClass !== 'usecasedefinition' && cssClass !== 'usecaseusage' && cssClass !== 'sendactionusage' && cssClass !== 'acceptactionusage' && (
                    <line x1={0} y1={26} x2={dynamicW} y2={26} stroke={borderColor} strokeWidth={0.5} />
                  )}
                  {/* Direction badge for action in/out/inout params */}
                  {isParam && (
                    <text x={6} y={17} fill={isIn ? '#40c080' : isOut ? '#c07030' : '#4090c0'} fontSize={10} fontWeight="bold">
                      {isIn ? '▶ in' : isOut ? '◀ out' : '◆ inout'}
                    </text>
                  )}
                  {!isParam && kindLabel && (
                    <text x={dynamicW / 2} y={17} fill={svgTextSub} fontSize={10} textAnchor="middle" fontStyle="italic">
                      {kindLabel.text}{(node.data as Record<string, unknown>)?.isParallel ? ' «parallel»' : ''}
                    </text>
                  )}
                  {nameLabel && (
                    <text x={dynamicW / 2} y={42} fill={svgText} fontSize={13} textAnchor="middle" fontWeight="bold">{nameLabel.text}</text>
                  )}
                  {/* Compartment: attribute/usage rows */}
                  {hasCompartment && (
                    <>
                      <line x1={0} y1={HEADER_H} x2={dynamicW} y2={HEADER_H} stroke={borderColor} strokeWidth={0.5} />
                      {ownLabels.map((label, i) => (
                        <text
                          key={label.id}
                          x={8}
                          y={HEADER_H + 6 + (i + 1) * ROW_H - 4}
                          fill={svgAttrText}
                          fontSize={10}
                          fontFamily="monospace"
                        >
                          {label.text}
                        </text>
                      ))}
                      {hasInherited && (
                        <>
                          <line x1={4} y1={HEADER_H + 6 + ownLabels.length * ROW_H + 2} x2={dynamicW - 4} y2={HEADER_H + 6 + ownLabels.length * ROW_H + 2} stroke={borderColor} strokeWidth={0.3} strokeDasharray="3 2" />
                          {inheritedLabels.map((label, i) => (
                            <text
                              key={label.id}
                              x={8}
                              y={HEADER_H + 6 + (ownLabels.length + i + 1) * ROW_H - 4}
                              fill={svgAttrText}
                              fontSize={10}
                              fontFamily="monospace"
                              fontStyle="italic"
                              opacity={0.6}
                            >
                              {label.text}
                            </text>
                          ))}
                        </>
                      )}
                    </>
                  )}
                </g>
              );
            }
          })}

          {/* Edges (rendered after nodes so lines are visible on top) */}
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
                    const edgeRange = edge.data?.range as ContextMenu['range'] | undefined;
                    // Store edge kind + source/target names for code search fallback
                    const edgeKind = edge.cssClasses?.[0] ?? '';
                    const srcNode = allNodes.find(n => n.id === edge.sourceId);
                    const tgtNode = allNodes.find(n => n.id === edge.targetId);
                    const srcName = srcNode?.children.find(c => c.id.endsWith('__label'))?.text;
                    const tgtName = tgtNode?.children.find(c => c.id.endsWith('__label'))?.text;
                    setContextMenu({
                      x: e.clientX, y: e.clientY, type: 'edge', id: edge.id, label: edgeLabel, range: edgeRange,
                      edgeKind, edgeSourceName: srcName, edgeTargetName: tgtName,
                    });
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
                {/* Dark outline behind edge for contrast against node backgrounds */}
                <path
                  d={edgePath(edge)}
                  stroke={t.bg}
                  strokeWidth={4}
                  fill="none"
                  opacity={0.6}
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
                {label && label.text && c && (() => {
                  const labelW = label.text.length * 6.4 + 8;
                  // Place label at the edge midpoint, offset upward to sit above the line
                  const lx = c.x;
                  const ly = c.y - 8;
                  return (
                    <>
                      <rect
                        x={lx - labelW / 2}
                        y={ly - 11}
                        width={labelW}
                        height={14}
                        rx={2}
                        fill={t.bg}
                        fillOpacity={0.9}
                      />
                      <text x={lx} y={ly} fill={style.labelColor} fontSize={10} textAnchor="middle" fontStyle="italic">
                        {label.text}
                      </text>
                    </>
                  );
                })()}
              </g>
            );
          })}

          {/* Rubber-band selection rectangle */}
          {selectionRect && <SelectionRectOverlay rect={selectionRect} scale={transform.scale} />}
        </g>

        {/* SysML v2 View Legend — dynamic per view type */}
        {showLegend && (() => {
          // ── Node legend items (per view type) ──
          type NodeLegendItem = { label: string; fill: string; stroke: string; rx: number; textColor: string; icon?: 'pkg' | 'port' | 'ctrl-fork' | 'ctrl-join' | 'ctrl-decision' | 'ctrl-merge' | 'ctrl-start' | 'ctrl-done' | 'ctrl-terminate' };
          const nodeItems: NodeLegendItem[] = [];

          // Package — all views
          nodeItems.push({ label: 'Package', fill: NODE_COLORS.package, stroke: svgPkgStroke, rx: 0, textColor: svgPkgLabel, icon: 'pkg' });

          if (viewType === 'general' || viewType === 'interconnection') {
            nodeItems.push({ label: 'Part def', fill: NODE_COLORS.partdefinition, stroke: svgStroke, rx: 0, textColor: svgTextSub });
            nodeItems.push({ label: 'Part usage', fill: NODE_COLORS.partusage, stroke: svgStroke, rx: 4, textColor: svgTextSub });
            nodeItems.push({ label: 'Attribute def', fill: NODE_COLORS.attributedefinition, stroke: isDark ? '#4a8a4a' : '#8aaa8a', rx: 0, textColor: isDark ? '#a8d8a8' : '#3a6a3a' });
            nodeItems.push({ label: 'Connection def', fill: NODE_COLORS.connectiondefinition, stroke: isDark ? '#8a6a4a' : '#aa8a6a', rx: 0, textColor: isDark ? '#d8b888' : '#6a4a2a' });
            nodeItems.push({ label: 'Port def', fill: NODE_COLORS.portdefinition, stroke: svgPortStroke, rx: 0, textColor: svgPortText });
            nodeItems.push({ label: 'Port usage', fill: NODE_COLORS.portusage, stroke: svgPortStroke, rx: 0, textColor: svgPortText, icon: 'port' });
            nodeItems.push({ label: 'Item def', fill: NODE_COLORS.itemdefinition, stroke: isDark ? '#8a6a30' : '#aa8a50', rx: 0, textColor: isDark ? '#d8b878' : '#6a4a20' });
            nodeItems.push({ label: 'Interface def', fill: NODE_COLORS.interfacedefinition, stroke: isDark ? '#6a4a8a' : '#8a6aaa', rx: 0, textColor: isDark ? '#c0a0e0' : '#5a3a8a' });
            nodeItems.push({ label: 'Enum def', fill: NODE_COLORS.enumdefinition, stroke: isDark ? '#4a8a6a' : '#6aaa8a', rx: 0, textColor: isDark ? '#a8d8c0' : '#2a5a40' });
            nodeItems.push({ label: 'Requirement def', fill: NODE_COLORS.requirementdefinition, stroke: isDark ? '#8a4a4a' : '#aa6a6a', rx: 0, textColor: isDark ? '#f0a0a0' : '#6a2a2a' });
            nodeItems.push({ label: 'Requirement usage', fill: NODE_COLORS.requirementusage, stroke: isDark ? '#8a4a4a' : '#aa6a6a', rx: 4, textColor: isDark ? '#f0a0a0' : '#6a2a2a' });
            nodeItems.push({ label: 'Constraint def', fill: NODE_COLORS.constraintdefinition, stroke: isDark ? '#8a5a3a' : '#aa7a5a', rx: 0, textColor: isDark ? '#e0b898' : '#6a3a1a' });
            nodeItems.push({ label: 'Use case def', fill: NODE_COLORS.usecasedefinition, stroke: isDark ? '#4a5a8a' : '#6a7aaa', rx: 10, textColor: isDark ? '#a0b8e8' : '#3a4a7a' });
            nodeItems.push({ label: 'Calculation def', fill: NODE_COLORS.calcdefinition, stroke: isDark ? '#3a7a8a' : '#5a9aaa', rx: 0, textColor: isDark ? '#90d0e0' : '#2a5a6a' });
            nodeItems.push({ label: 'Allocation def', fill: NODE_COLORS.allocationdefinition, stroke: isDark ? '#8a7030' : '#aa9050', rx: 0, textColor: isDark ? '#d8c070' : '#6a5010' });
            nodeItems.push({ label: 'View def', fill: NODE_COLORS.viewdefinition, stroke: isDark ? '#4a8a8a' : '#6aaaaa', rx: 0, textColor: isDark ? '#a0d8d8' : '#2a6a6a' });
            nodeItems.push({ label: 'Viewpoint def', fill: NODE_COLORS.viewpointdefinition, stroke: isDark ? '#5a5a8a' : '#7a7aaa', rx: 0, textColor: isDark ? '#b0b0e0' : '#4a4a7a' });
            nodeItems.push({ label: 'Metadata def', fill: NODE_COLORS.metadatadefinition, stroke: isDark ? '#6a4a6a' : '#8a6a8a', rx: 0, textColor: isDark ? '#c0a0c0' : '#5a3a5a' });
            nodeItems.push({ label: 'Comment', fill: NODE_COLORS.comment, stroke: svgCommentStroke, rx: 0, textColor: svgCommentLabel });
          }

          if (viewType === 'action-flow') {
            nodeItems.push({ label: 'Action def', fill: NODE_COLORS.actiondefinition, stroke: isDark ? '#3a8a8a' : '#5aaaaa', rx: 0, textColor: isDark ? '#90d0d0' : '#2a6a6a' });
            nodeItems.push({ label: 'Action usage', fill: NODE_COLORS.actionusage, stroke: isDark ? '#3a8a8a' : '#5aaaaa', rx: 4, textColor: isDark ? '#90d0d0' : '#2a6a6a' });
            nodeItems.push({ label: 'Send action', fill: NODE_COLORS.sendactionusage, stroke: isDark ? '#3a7a9a' : '#5a9aba', rx: 4, textColor: isDark ? '#80c0e0' : '#2a5a7a' });
            nodeItems.push({ label: 'Accept action', fill: NODE_COLORS.acceptactionusage, stroke: isDark ? '#3a7a9a' : '#5a9aba', rx: 4, textColor: isDark ? '#80c0e0' : '#2a5a7a' });
            nodeItems.push({ label: 'If action', fill: NODE_COLORS.ifactionusage, stroke: isDark ? '#3a8090' : '#5aa0b0', rx: 4, textColor: isDark ? '#80c8d8' : '#2a6070' });
            nodeItems.push({ label: 'For loop', fill: NODE_COLORS.forloopactionusage, stroke: isDark ? '#3a9090' : '#5ab0b0', rx: 4, textColor: isDark ? '#80d0d0' : '#2a7070' });
            nodeItems.push({ label: 'Action in', fill: NODE_COLORS.actionin, stroke: isDark ? '#3a8a58' : '#5aaa78', rx: 2, textColor: isDark ? '#80d0a0' : '#2a6a40' });
            nodeItems.push({ label: 'Action out', fill: NODE_COLORS.actionout, stroke: isDark ? '#8a3a3a' : '#aa5a5a', rx: 2, textColor: isDark ? '#e09090' : '#7a2a2a' });
            nodeItems.push({ label: 'Fork node', fill: NODE_COLORS.forknode, stroke: isDark ? '#888' : '#999', rx: 0, textColor: isDark ? '#ccc' : '#555', icon: 'ctrl-fork' });
            nodeItems.push({ label: 'Join node', fill: NODE_COLORS.joinnode, stroke: isDark ? '#888' : '#999', rx: 0, textColor: isDark ? '#ccc' : '#555', icon: 'ctrl-join' });
            nodeItems.push({ label: 'Decision node', fill: NODE_COLORS.decisionnode, stroke: isDark ? '#8a8a5a' : '#aaaaaa', rx: 0, textColor: isDark ? '#d0d0a0' : '#5a5a3a', icon: 'ctrl-decision' });
            nodeItems.push({ label: 'Merge node', fill: NODE_COLORS.mergenode, stroke: isDark ? '#8a8a5a' : '#aaaaaa', rx: 0, textColor: isDark ? '#d0d0a0' : '#5a5a3a', icon: 'ctrl-merge' });
            nodeItems.push({ label: 'Start', fill: NODE_COLORS.startnode, stroke: isDark ? '#888' : '#999', rx: 0, textColor: isDark ? '#ccc' : '#555', icon: 'ctrl-start' });
            nodeItems.push({ label: 'Done', fill: NODE_COLORS.donenode, stroke: isDark ? '#888' : '#999', rx: 0, textColor: isDark ? '#ccc' : '#555', icon: 'ctrl-done' });
          }

          if (viewType === 'state-transition') {
            nodeItems.push({ label: 'State def', fill: NODE_COLORS.statedefinition, stroke: isDark ? '#8a8a3a' : '#aaaa5a', rx: 0, textColor: isDark ? '#d8d880' : '#5a5a20' });
            nodeItems.push({ label: 'State usage', fill: NODE_COLORS.stateusage, stroke: isDark ? '#8a8a3a' : '#aaaa5a', rx: 10, textColor: isDark ? '#d8d880' : '#5a5a20' });
            nodeItems.push({ label: 'Entry/Do/Exit', fill: NODE_COLORS.entryactionusage, stroke: isDark ? '#3a8a70' : '#5aaa90', rx: 4, textColor: isDark ? '#80d0b8' : '#2a6a50' });
            nodeItems.push({ label: 'Start', fill: NODE_COLORS.startnode, stroke: isDark ? '#888' : '#999', rx: 0, textColor: isDark ? '#ccc' : '#555', icon: 'ctrl-start' });
            nodeItems.push({ label: 'Done', fill: NODE_COLORS.donenode, stroke: isDark ? '#888' : '#999', rx: 0, textColor: isDark ? '#ccc' : '#555', icon: 'ctrl-done' });
            nodeItems.push({ label: 'Terminate', fill: NODE_COLORS.terminatenode, stroke: isDark ? '#888' : '#999', rx: 0, textColor: isDark ? '#ccc' : '#555', icon: 'ctrl-terminate' });
          }

          // ── Edge legend items (per view type) ──
          type EdgeLegendItem = { label: string; color: string; dash?: string };
          const edgeItems: EdgeLegendItem[] = [];
          if (effectiveViewMode === 'tree') {
            edgeItems.push({ label: '◆── composition', color: '#9cdcfe' });
            edgeItems.push({ label: '◇── noncomposite (ref)', color: '#9cdcfe' });
          }
          if (viewType === 'general' || viewType === 'interconnection') {
            edgeItems.push({ label: '◁── specializes :>', color: '#9e9e9e' });
            edgeItems.push({ label: '──▷ subsets :>', color: '#9e9e9e' });
            edgeItems.push({ label: '|──▷ redefines :>>', color: '#9e9e9e' });
            edgeItems.push({ label: '- -◁ defined by :', color: '#6a7a8a', dash: '4,3' });
            edgeItems.push({ label: '──▶ flow', color: '#4ec9b0' });
            edgeItems.push({ label: '──▷ connection', color: '#777' });
          }
          if (viewType === 'interconnection') {
            edgeItems.push({ label: '- - bind', color: '#9090c0', dash: '4,3' });
          }
          if (viewType === 'action-flow') {
            edgeItems.push({ label: '──▷ succession', color: '#4ec9b0' });
            edgeItems.push({ label: '──▶ flow', color: '#4ec9b0' });
          }
          if (viewType === 'state-transition') {
            edgeItems.push({ label: '──▶ transition', color: '#4ec9b0' });
          }
          if (viewType === 'general') {
            edgeItems.push({ label: '──▷ succession', color: '#4ec9b0' });
            edgeItems.push({ label: '──▷ ref subsets ::>', color: '#9e9e9e' });
            edgeItems.push({ label: '- -▷ satisfy', color: '#e06060', dash: '6,3' });
            edgeItems.push({ label: '- -▷ verify', color: '#60b060', dash: '6,3' });
            edgeItems.push({ label: '- -▷ allocate', color: '#c0a060', dash: '6,3' });
            edgeItems.push({ label: '- - annotate', color: '#a0a060', dash: '4,3' });
          }
          // Deduplicate edges
          const seenEdge = new Set<string>();
          const uniqueEdges = edgeItems.filter(item => { if (seenEdge.has(item.label)) return false; seenEdge.add(item.label); return true; });

          // Compute layout
          const viewLabel = ({ 'general': 'General View', 'interconnection': 'Interconnection View', 'action-flow': 'Action Flow View', 'state-transition': 'State Transition View', 'sequence': 'Sequence View', 'grid': 'Grid View', 'browser': 'Browser View', 'geometry': 'Geometry View' } as Record<string, string>)[viewType];
          const ROW = 16;
          const nodeStart = 18;
          const edgeStart = nodeStart + nodeItems.length * ROW + 6;
          const totalH = edgeStart + uniqueEdges.length * ROW + 4;

          return (
            <g transform="translate(10,10)">
              {/* Background */}
              <rect x={-6} y={-4} width={170} height={totalH} rx={4} fill={isDark ? 'rgba(30,30,30,0.85)' : 'rgba(245,245,245,0.9)'} stroke={isDark ? '#444' : '#ccc'} strokeWidth={0.5} />
              {/* View type label */}
              <text x={0} y={10} fill={svgCtrlFill} fontSize={10} fontWeight={600}>{viewLabel}</text>
              {/* Node shapes */}
              {nodeItems.map((item, i) => (
                <g key={item.label} transform={`translate(0,${nodeStart + i * ROW})`}>
                  {item.icon === 'pkg' ? <>
                    <rect width={10} height={5} fill={item.fill} stroke={item.stroke} strokeWidth={1} />
                    <rect y={5} width={14} height={7} fill={item.fill} stroke={item.stroke} strokeWidth={1} />
                  </> : item.icon === 'port' ? <>
                    <rect width={10} height={10} rx={1} fill={item.fill} stroke={item.stroke} strokeWidth={1} y={1} />
                    <path d="M7,3 L4,6 L7,9" fill="none" stroke={item.stroke} strokeWidth={1} />
                  </> : item.icon === 'ctrl-fork' || item.icon === 'ctrl-join' ? <>
                    <rect width={14} height={3} fill={item.stroke} rx={1} y={5} />
                  </> : item.icon === 'ctrl-decision' || item.icon === 'ctrl-merge' ? <>
                    <polygon points="7,1 14,6 7,11 0,6" fill={item.fill} stroke={item.stroke} strokeWidth={1} />
                  </> : item.icon === 'ctrl-start' ? <>
                    <circle cx={6} cy={6} r={5} fill={isDark ? '#e0e0e0' : '#333'} />
                  </> : item.icon === 'ctrl-done' ? <>
                    <circle cx={6} cy={6} r={5} fill="none" stroke={isDark ? '#e0e0e0' : '#333'} strokeWidth={1.5} />
                    <circle cx={6} cy={6} r={3} fill={isDark ? '#e0e0e0' : '#333'} />
                  </> : item.icon === 'ctrl-terminate' ? <>
                    <circle cx={6} cy={6} r={5} fill="none" stroke={isDark ? '#e0e0e0' : '#333'} strokeWidth={1.5} />
                    <line x1={2} y1={2} x2={10} y2={10} stroke={isDark ? '#e0e0e0' : '#333'} strokeWidth={1.5} />
                    <line x1={10} y1={2} x2={2} y2={10} stroke={isDark ? '#e0e0e0' : '#333'} strokeWidth={1.5} />
                  </> : <>
                    <rect width={12} height={10} rx={item.rx} fill={item.fill} stroke={item.stroke} strokeWidth={1} y={1} />
                  </>}
                  <text x={18} y={10} fill={item.textColor} fontSize={9}>{item.label}</text>
                </g>
              ))}
              {/* Divider */}
              <line x1={0} y1={edgeStart - 3} x2={150} y2={edgeStart - 3} stroke={isDark ? '#444' : '#ccc'} strokeWidth={0.5} />
              {/* Edge styles */}
              {uniqueEdges.map(({ label, color, dash }, i) => (
                <g key={label} transform={`translate(0,${edgeStart + i * ROW})`}>
                  <line x1={0} y1={7} x2={20} y2={7} stroke={color} strokeWidth={1.5} strokeDasharray={dash} />
                  <text x={24} y={11} fill={color} fontSize={9}>{label}</text>
                </g>
              ))}
            </g>
          );
        })()}
      </svg>

      {/* Right-click context menu */}
      {contextMenu && (
        <DiagramContextMenu
          menu={contextMenu}
          onClose={() => setContextMenu(null)}
          onHideNode={onHideNode}
          onHideEdge={onHideEdge}
          onHideNodes={onHideNodes}
          onHideEdges={onHideEdges}
          onShowOnly={onShowOnly}
          onNodeSelect={onNodeSelect}
          onEdgeSelect={onEdgeSelect}
          onEdgeGoToCode={onEdgeGoToCode}
          lockMap={lockMap}
          currentUserId={currentUserId}
          onCheckOut={onCheckOut}
          onCheckIn={onCheckIn}
          onRequestLock={onRequestLock}
          getDescendants={descendantCache}
          clearMultiSelection={() => setMultiSelectedNodeIds(new Set())}
        />
      )}
    </div>
  );
}
