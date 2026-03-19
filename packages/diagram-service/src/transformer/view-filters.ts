import type { SysMLModel, SysMLNode, SysMLConnection, ViewType } from '@systemodel/shared-types';

interface FilteredModel {
  nodes: SysMLNode[];
  connections: SysMLConnection[];
}

// ── Interconnection View ────────────────────────────────────────────────────
// Shows: parts, ports, connections, interfaces, items, flows, bindings
// Hides: standalone defs, actions, states, successions

const IV_NODE_KINDS = new Set([
  'PartUsage', 'PortUsage', 'ConnectionUsage', 'InterfaceUsage', 'ItemUsage',
  'PartDefinition', 'PortDefinition', 'ConnectionDefinition', 'InterfaceDefinition', 'ItemDefinition',
  'Package',
]);

const IV_EDGE_KINDS = new Set([
  'composition', 'flow', 'bind', 'association', 'typereference',
  'subsetting', 'redefinition', 'referencesubsetting',
]);

function filterInterconnectionView(model: SysMLModel): FilteredModel {
  const keepIds = new Set<string>();
  for (const node of model.nodes) {
    if (IV_NODE_KINDS.has(node.kind)) keepIds.add(node.id);
  }

  const connections = model.connections.filter(c =>
    IV_EDGE_KINDS.has(c.kind) && keepIds.has(c.sourceId) && keepIds.has(c.targetId),
  );

  // Remove standalone defs that have no edges after filtering
  const connectedIds = new Set<string>();
  for (const c of connections) {
    connectedIds.add(c.sourceId);
    connectedIds.add(c.targetId);
  }
  const nodes = model.nodes.filter(n =>
    keepIds.has(n.id) && (connectedIds.has(n.id) || n.kind === 'Package'),
  );

  return { nodes, connections };
}

// ── Action Flow View ────────────────────────────────────────────────────────
// Shows: actions, perform, control nodes, parameters, successions, flows, transitions
// Hides: parts, ports, structural defs (unless they have behavioral content)

const AFV_NODE_KINDS = new Set([
  'ActionUsage', 'ActionDefinition', 'PerformActionUsage',
  'ForkNode', 'JoinNode', 'MergeNode', 'DecideNode', 'StartNode', 'DoneNode', 'TerminateNode',
  'Package',
]);

const AFV_EDGE_KINDS = new Set([
  'succession', 'flow', 'transition', 'composition', 'typereference',
]);

function filterActionFlowView(model: SysMLModel): FilteredModel {
  const keepIds = new Set<string>();
  for (const node of model.nodes) {
    if (AFV_NODE_KINDS.has(node.kind)) keepIds.add(node.id);
    // Keep parameters (in/out items inside actions)
    if ((node.kind === 'ItemUsage' || node.kind === 'AttributeUsage') && node.direction) keepIds.add(node.id);
  }

  // Collect behavioral node IDs
  const behavioralNodeIds = new Set<string>();
  for (const c of model.connections) {
    if (c.kind === 'succession' || c.kind === 'flow' || c.kind === 'transition') {
      behavioralNodeIds.add(c.sourceId);
      behavioralNodeIds.add(c.targetId);
    }
  }

  // Hide empty stub defs not connected to the flow
  const nodes = model.nodes.filter(n => {
    if (!keepIds.has(n.id)) return false;
    if (n.kind === 'ActionDefinition'
        && !behavioralNodeIds.has(n.id)
        && (n.attributes?.length ?? 0) === 0) {
      return false;
    }
    return true;
  });

  const nodeIdSet = new Set(nodes.map(n => n.id));
  const connections = model.connections.filter(c =>
    AFV_EDGE_KINDS.has(c.kind) && nodeIdSet.has(c.sourceId) && nodeIdSet.has(c.targetId),
  );

  return { nodes, connections };
}

// ── State Transition View ───────────────────────────────────────────────────
// Shows: states, transitions, exhibit, control nodes, state defs (with compartments)
// Hides: actions (non-state), parts, ports, structural elements

const STV_NODE_KINDS = new Set([
  'StateUsage', 'StateDefinition', 'ExhibitStateUsage', 'TransitionUsage',
  'ForkNode', 'JoinNode', 'MergeNode', 'DecideNode', 'StartNode', 'DoneNode', 'TerminateNode',
  'Package',
]);

const STV_EDGE_KINDS = new Set([
  'transition', 'succession', 'composition', 'typereference',
]);

function filterStateTransitionView(model: SysMLModel): FilteredModel {
  const keepIds = new Set<string>();
  for (const node of model.nodes) {
    if (STV_NODE_KINDS.has(node.kind)) keepIds.add(node.id);
  }

  // Build parent map from all composition edges
  const parentOf = new Map<string, string>();
  for (const c of model.connections) {
    if (c.kind === 'composition') parentOf.set(c.targetId, c.sourceId);
  }

  // Reparent: if a kept node's parent is filtered out, find nearest kept ancestor
  const reparentEdges: SysMLConnection[] = [];
  for (const nodeId of keepIds) {
    const directParent = parentOf.get(nodeId);
    if (directParent && !keepIds.has(directParent)) {
      // Walk up to find a kept ancestor
      let ancestor = parentOf.get(directParent);
      while (ancestor && !keepIds.has(ancestor)) ancestor = parentOf.get(ancestor);
      if (ancestor) {
        reparentEdges.push({ id: `reparent__${nodeId}`, sourceId: ancestor, targetId: nodeId, kind: 'composition', name: '' });
      }
    }
  }

  const nodes = model.nodes.filter(n => keepIds.has(n.id));
  const nodeIdSet = new Set(nodes.map(n => n.id));
  const connections = [
    ...model.connections.filter(c =>
      STV_EDGE_KINDS.has(c.kind) && nodeIdSet.has(c.sourceId) && nodeIdSet.has(c.targetId),
    ),
    ...reparentEdges,
  ];

  return { nodes, connections };
}

// ── General View (pass-through) ─────────────────────────────────────────────
function filterGeneralView(model: SysMLModel): FilteredModel {
  return { nodes: model.nodes, connections: model.connections };
}

// ── Public API ──────────────────────────────────────────────────────────────
const VIEW_FILTERS: Record<ViewType, (model: SysMLModel) => FilteredModel> = {
  'general': filterGeneralView,
  'interconnection': filterInterconnectionView,
  'action-flow': filterActionFlowView,
  'state-transition': filterStateTransitionView,
};

export function applyViewFilter(model: SysMLModel, viewType: ViewType): FilteredModel {
  return VIEW_FILTERS[viewType](model);
}
