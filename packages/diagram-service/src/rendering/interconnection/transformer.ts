// Interconnection transformer — AST → InterconnectionIR (Slice 6a porto).
//
// The wedge applies `filterInterconnectionView` before calling us
// (pipeline.ts:102), so `model` here is already the IV subset: only
// IV_NODE_KINDS / IV_EDGE_KINDS survive (view-filters.ts:12-21). Our job is a
// faithful projection of that filtered AST onto InterconnectionIR plus the two
// pre-render flags the legacy transformer computed inline. The heavy per-kind
// rendering (sizes, labels, compartments) is the renderer's job (W3) — here we
// only carry the fields it reads.
//
// Pre-render steps from legacy `transformToBDD` that DO NOT apply to IV and are
// deliberately omitted (brief §3.W2):
//   • hiddenNodeIds — general-view-only; for IV it is always empty (the
//     entry/do/exit hiding at bdd-transformer.ts:665 targets kinds the filter
//     already removed), so every filtered node is visible.
//   • resolveActionUsageParams — gated on cloneDefParamsAsUsagePins, which is
//     false for IV (view-config.ts:61).
//   • typereference / hidden-endpoint edge dropping (bdd-transformer.ts:694-702)
//     — moot: the filter keeps no typereference edge and no edge with a dropped
//     endpoint, so the edge list is projected 1:1.

import type {
  SysMLModel,
  SysMLNode,
  SysMLConnection,
  SysMLAttribute,
  InterconnectionIR,
  InterconnectionNode,
  InterconnectionEdge,
  InterconnectionAttribute,
} from '@systemodel/shared-types';
import type { ViewSpec } from '../view-registry.js';

const RENDERER_VERSION = 'interconnection-1.0.0';

// Note (Slice 6a CP-1.5): resolveInheritedAttributes is intentionally NOT called
// for the interconnection view. That function only consumes dependency
// '«specializes»' and typereference edges (bdd-transformer.ts:430,494), both of
// which filterInterconnectionView strips (view-filters.ts:18-21 — neither is in
// IV_EDGE_KINDS). Empirically verified: transformToBDD(model,'interconnection',true)
// === transformToBDD(model,'interconnection',false) byte-for-byte. The `showInherited`
// flag in ViewSpec is therefore a no-op here and the param stays unused.
// Guard: tests/fixtures/interconnection/inheritance/ runs both flag values and
// asserts identical output, so a future filter change (e.g. admitting
// typereference) that broke this invariant would fail the differential oracle.
// IMPORTANT (Slice 7+): this no-op is IV-specific. Pass-through views (general)
// and others may keep those edges — re-verify showInherited per view; do not
// assume IV's result transfers.
export function transformAstToInterconnectionIR(
  model: SysMLModel,
  _viewSpec: ViewSpec,
): InterconnectionIR {
  // nodesWithChildren → hasVisibleChildren (skipCompartments). A node is a
  // "parent with visible children" when it is the source of a composition or
  // noncomposite edge whose target survived. hiddenNodeIds is empty for IV, so
  // every filtered node is visible (bdd-transformer.ts:681-688).
  const visibleIds = new Set(model.nodes.map(n => n.id));
  const nodesWithChildren = new Set<string>();
  for (const c of model.connections) {
    if ((c.kind === 'composition' || c.kind === 'noncomposite') && visibleIds.has(c.targetId)) {
      nodesWithChildren.add(c.sourceId);
    }
  }

  const nodes: InterconnectionNode[] = model.nodes.map(n =>
    projectNode(n, nodesWithChildren.has(n.id)),
  );
  const edges: InterconnectionEdge[] = model.connections.map(projectEdge);

  return {
    viewType: 'interconnection',
    metadata: {
      generatedAt: new Date().toISOString(),
      rendererVersion: RENDERER_VERSION,
      sourceFile: model.uri,
    },
    nodes,
    edges,
  };
}

function projectNode(n: SysMLNode, hasVisibleChildren: boolean): InterconnectionNode {
  const node: InterconnectionNode = {
    id: n.id,
    kind: n.kind,
    name: n.name,
    hasVisibleChildren,
    isStdlib: n.id.startsWith('stdlib__'),
  };
  // Only carry defined optionals so the IR JSON (and golden fixtures) stays
  // clean; the renderer reads these exactly as nodeToSNode read the AST node.
  if (n.qualifiedName !== undefined) node.qualifiedName = n.qualifiedName;
  if (n.direction !== undefined) node.direction = n.direction;
  if (n.multiplicity !== undefined) node.multiplicity = n.multiplicity;
  if (n.isAbstract !== undefined) node.isAbstract = n.isAbstract;
  if (n.isRef !== undefined) node.isRef = n.isRef;
  if (n.isIndividual !== undefined) node.isIndividual = n.isIndividual;
  if (n.isParallel !== undefined) node.isParallel = n.isParallel;
  if (n.portionKind !== undefined) node.portionKind = n.portionKind;
  if (n.ownerIsPortOrActionUsage !== undefined) node.ownerIsPortOrActionUsage = n.ownerIsPortOrActionUsage;
  if (n.range !== undefined) node.range = n.range;

  const attrs = (n.attributes ?? []).map(projectAttr);
  if (attrs.length > 0) node.attributes = attrs;
  return node;
}

function projectAttr(a: SysMLAttribute): InterconnectionAttribute {
  const attr: InterconnectionAttribute = { name: a.name };
  if (a.type !== undefined) attr.type = a.type;
  if (a.value !== undefined) attr.value = a.value;
  if (a.isDerived !== undefined) attr.isDerived = a.isDerived;
  if (a.inherited !== undefined) attr.inherited = a.inherited;
  return attr;
}

function projectEdge(c: SysMLConnection): InterconnectionEdge {
  const edge: InterconnectionEdge = {
    id: c.id,
    kind: c.kind,
    sourceId: c.sourceId,
    targetId: c.targetId,
  };
  if (c.name !== undefined) edge.name = c.name;
  if (c.sourcePort !== undefined) edge.sourcePort = c.sourcePort;
  if (c.targetPort !== undefined) edge.targetPort = c.targetPort;
  if (c.range !== undefined) edge.range = c.range;
  return edge;
}
