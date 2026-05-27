// Diagram IR — interconnection view (Slice 6a porto).
//
// The interconnection view (legacy `viewType === 'interconnection'`) renders
// the structural backbone of a model: parts, ports, connections, interfaces,
// items and their definitions. Unlike the state-machine IR — whose structured
// TransitionLabel added semantic value by making Bug-SM-01 unrepresentable —
// this IR is a near-passthrough of the post-filter AST: `filterInterconnectionView`
// (view-filters.ts) already selects the IV node/edge subset, so the IR's job is
// to carry exactly the fields the renderer needs to reproduce the legacy
// `nodeToSNode` / `connectionToSEdge` output byte-identically, plus the two
// pre-render flags the legacy transformer computed inline:
//   • hasVisibleChildren — was `nodesWithChildren.has(id)` (skipCompartments);
//     a definition with visible graphical children omits its own compartments
//   • isStdlib           — was `id.startsWith('stdlib__')`; switches the kind
//     keyword to the qualified-name namespace and the cssClass to 'stdlib'
//
// Slice 6a is a pure refactor: every field here exists so the IV renderer can
// emit the identical SModelRoot the legacy pipeline does. Visual calibration
// (conjugated-port markers, edge styles, port layout) is Slice 6b and changes
// the renderer's IR→SModel mapping, never this schema or the transformer.

import type { IRMetadata } from './common.js';
import type { SysMLNodeKind, SysMLConnection, SourceRange } from '../ast.js';

// Compartment-row source for definition nodes. Mirrors the SysMLAttribute
// fields the legacy compartment-label builder reads (bdd-transformer.ts:339-372):
// keyword/value formatting, `:>`/`:>>`/`::>` operators, derived `/`, inherited `^`.
// Carried raw (including `__doc__` rows) — the renderer applies the same filtering
// the legacy code did, so the IR stays a faithful AST projection.
export interface InterconnectionAttribute {
  name: string;
  type?: string;
  value?: string;
  isDerived?: boolean;
  inherited?: boolean;
}

// One drawable node. `kind` drives the renderer's per-kind branch (Package
// tab-rectangle, Comment note, control node, PortUsage boundary square, directed
// usage, usage+inherited, definition+compartments) and the KIND_DISPLAY keyword
// lookup; the modifier flags (isAbstract/isRef/isIndividual/portionKind/isParallel)
// reproduce the guillemet decorations.
export interface InterconnectionNode {
  id: string;
  kind: SysMLNodeKind;
  name: string;
  qualifiedName?: string;                  // usage label "name[mult] : qualifiedName"; carries conjugated '~'
  direction?: 'in' | 'out' | 'inout';
  multiplicity?: string;

  isAbstract?: boolean;
  isRef?: boolean;
  isIndividual?: boolean;
  isParallel?: boolean;
  portionKind?: 'snapshot' | 'timeslice';
  ownerIsPortOrActionUsage?: boolean;      // directed-param-in-action-usage → small boundary square

  attributes?: InterconnectionAttribute[]; // compartment rows (definitions); raw, renderer filters

  // ── Pre-render flags computed by the transformer (were inline in transformToBDD) ──
  hasVisibleChildren: boolean;             // nodesWithChildren → skipCompartments
  isStdlib: boolean;                       // id.startsWith('stdlib__')

  range?: SourceRange;
}

// One drawable edge. The renderer sets `cssClasses: [kind]` verbatim (the legacy
// `connectionToSEdge` contract), so the frontend's EDGE_STYLES table styles it.
// sourcePort/targetPort feed the flow-edge label fallback (`a → b`) when `name`
// is empty (bdd-transformer.ts:397-404).
export interface InterconnectionEdge {
  id: string;
  kind: SysMLConnection['kind'];
  sourceId: string;
  targetId: string;
  name?: string;
  sourcePort?: string;
  targetPort?: string;
  range?: SourceRange;
}

export interface InterconnectionIR {
  viewType: 'interconnection';
  metadata: IRMetadata;
  nodes: InterconnectionNode[];
  edges: InterconnectionEdge[];
}
