import type { SysMLModel, SysMLNode, SysMLConnection, ViewType } from '@systemodel/shared-types';

interface FilteredModel {
  nodes: SysMLNode[];
  connections: SysMLConnection[];
}

// ── Interconnection View ────────────────────────────────────────────────────
// Shows: parts, ports, connections, interfaces, items, flows, bindings
// Hides: standalone defs, actions, states, successions

const IV_NODE_KINDS = new Set([
  'PartUsage', 'PortUsage', 'ConnectionUsage', 'InterfaceUsage', 'ItemUsage', 'AttributeUsage',
  'PartDefinition', 'PortDefinition', 'ConnectionDefinition', 'InterfaceDefinition', 'ItemDefinition', 'AttributeDefinition',
  'Package',
]);

const IV_EDGE_KINDS = new Set([
  'composition', 'noncomposite', 'flow', 'successionflow', 'message', 'bind', 'association', 'typereference',
  'subsetting', 'redefinition', 'referencesubsetting', 'crossing',
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
  'UseCaseUsage', 'UseCaseDefinition',
  'AnalysisCaseUsage', 'AnalysisCaseDefinition',
  'VerificationCaseUsage', 'VerificationCaseDefinition',
  'ForkNode', 'JoinNode', 'MergeNode', 'DecideNode', 'StartNode', 'DoneNode', 'TerminateNode',
  'Package',
]);

const AFV_EDGE_KINDS = new Set([
  'succession', 'flow', 'successionflow', 'transition', 'composition', 'noncomposite', 'typereference',
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
    if ((n.kind === 'ActionDefinition' || n.kind === 'UseCaseDefinition'
        || n.kind === 'AnalysisCaseDefinition' || n.kind === 'VerificationCaseDefinition')
        && !behavioralNodeIds.has(n.id)
        && (n.attributes?.length ?? 0) === 0) {
      return false;
    }
    return true;
  });

  const nodeIdSet = new Set(nodes.map(n => n.id));

  // Reparent: if a kept node's parent is filtered out, find nearest kept ancestor
  const parentOf = new Map<string, string>();
  for (const c of model.connections) {
    if (c.kind === 'composition' || c.kind === 'noncomposite') parentOf.set(c.targetId, c.sourceId);
  }
  const reparentEdges: SysMLConnection[] = [];
  for (const nodeId of nodeIdSet) {
    const directParent = parentOf.get(nodeId);
    if (directParent && !nodeIdSet.has(directParent)) {
      let ancestor = parentOf.get(directParent);
      const visited = new Set<string>();
      while (ancestor && !nodeIdSet.has(ancestor)) {
        if (visited.has(ancestor)) break;
        visited.add(ancestor);
        ancestor = parentOf.get(ancestor);
      }
      if (ancestor && nodeIdSet.has(ancestor)) {
        reparentEdges.push({ id: `reparent__${nodeId}`, sourceId: ancestor, targetId: nodeId, kind: 'composition', name: '' });
      }
    }
  }

  const connections = [
    ...model.connections.filter(c =>
      AFV_EDGE_KINDS.has(c.kind) && nodeIdSet.has(c.sourceId) && nodeIdSet.has(c.targetId),
    ),
    ...reparentEdges,
  ];

  // Remove orphan nodes (no edges to other visible nodes), except packages
  const connectedIds = new Set<string>();
  for (const c of connections) { connectedIds.add(c.sourceId); connectedIds.add(c.targetId); }
  const finalNodes = nodes.filter(n => connectedIds.has(n.id) || n.kind === 'Package');

  return { nodes: finalNodes, connections };
}

// ── State Transition View ───────────────────────────────────────────────────
// Shows: states, transitions, exhibit, control nodes, state defs (with compartments)
// Hides: actions (non-state), parts, ports, structural elements

const STV_NODE_KINDS = new Set([
  'StateUsage', 'StateDefinition', 'ExhibitStateUsage', 'TransitionUsage',
  'EntryActionUsage', 'DoActionUsage', 'ExitActionUsage',
  'ForkNode', 'JoinNode', 'MergeNode', 'DecideNode', 'StartNode', 'DoneNode', 'TerminateNode',
  'Package',
]);

const STV_EDGE_KINDS = new Set([
  'transition', 'succession', 'composition', 'noncomposite', 'typereference',
]);

function filterStateTransitionView(model: SysMLModel): FilteredModel {
  const keepIds = new Set<string>();
  for (const node of model.nodes) {
    if (STV_NODE_KINDS.has(node.kind)) keepIds.add(node.id);
  }

  // Build parent map from all composition edges
  const parentOf = new Map<string, string>();
  for (const c of model.connections) {
    if (c.kind === 'composition' || c.kind === 'noncomposite') parentOf.set(c.targetId, c.sourceId);
  }

  // Hide start nodes when an entry action node exists in the same parent
  // (entry action replaces the start circle in STV)
  const parentsWithEntry = new Set<string>();
  for (const node of model.nodes) {
    if (node.kind === 'EntryActionUsage') {
      const parent = parentOf.get(node.id);
      if (parent) parentsWithEntry.add(parent);
    }
  }
  for (const node of model.nodes) {
    if (node.kind === 'StartNode') {
      const parent = parentOf.get(node.id);
      if (parent && parentsWithEntry.has(parent)) {
        keepIds.delete(node.id);
      }
    }
  }

  // Reparent: if a kept node's parent is filtered out, find nearest kept ancestor
  const reparentEdges: SysMLConnection[] = [];
  for (const nodeId of keepIds) {
    const directParent = parentOf.get(nodeId);
    if (directParent && !keepIds.has(directParent)) {
      let ancestor = parentOf.get(directParent);
      const visited = new Set<string>();
      while (ancestor && !keepIds.has(ancestor)) {
        if (visited.has(ancestor)) break;
        visited.add(ancestor);
        ancestor = parentOf.get(ancestor);
      }
      if (ancestor && keepIds.has(ancestor)) {
        reparentEdges.push({ id: `reparent__${nodeId}`, sourceId: ancestor, targetId: nodeId, kind: 'composition', name: '' });
      }
    }
  }

  // Build start→entry remap: replace start node edges with entry action node edges
  // Pre-build parent→entryNodeId map for O(1) lookup
  const parentToEntryId = new Map<string, string>();
  for (const node of model.nodes) {
    if (node.kind === 'EntryActionUsage') {
      const parent = parentOf.get(node.id);
      if (parent) parentToEntryId.set(parent, node.id);
    }
  }
  const startToEntry = new Map<string, string>();
  for (const node of model.nodes) {
    if (node.kind === 'StartNode') {
      const parent = parentOf.get(node.id);
      if (parent && parentsWithEntry.has(parent)) {
        const entryId = parentToEntryId.get(parent);
        if (entryId) startToEntry.set(node.id, entryId);
      }
    }
  }

  const prelimNodes = model.nodes.filter(n => keepIds.has(n.id));
  const prelimNodeIdSet = new Set(prelimNodes.map(n => n.id));
  const connections = [
    ...model.connections
      .filter(c => STV_EDGE_KINDS.has(c.kind))
      .map(c => ({
        ...c,
        sourceId: startToEntry.get(c.sourceId) ?? c.sourceId,
        targetId: startToEntry.get(c.targetId) ?? c.targetId,
      }))
      .filter(c => prelimNodeIdSet.has(c.sourceId) && prelimNodeIdSet.has(c.targetId)),
    ...reparentEdges,
  ];

  // Remove orphan nodes: iteratively prune nodes that have no edges to
  // non-control, non-package content nodes. This handles chains of control
  // nodes (fork→join→fork) that connect only to each other.
  const CONTROL_KINDS = new Set(['ForkNode', 'JoinNode', 'MergeNode', 'DecideNode', 'StartNode', 'DoneNode', 'TerminateNode']);
  const finalNodeIds = new Set(prelimNodes.map(n => n.id));
  let changed = true;
  while (changed) {
    changed = false;
    for (const nId of finalNodeIds) {
      const node = prelimNodes.find(n => n.id === nId);
      if (!node || node.kind === 'Package') continue;
      // Check if this node has at least one edge to another non-control visible node
      const hasContentNeighbor = connections.some(c => {
        if (!finalNodeIds.has(c.sourceId) || !finalNodeIds.has(c.targetId)) return false;
        const otherId = c.sourceId === nId ? c.targetId : c.targetId === nId ? c.sourceId : null;
        if (!otherId) return false;
        const otherNode = prelimNodes.find(n => n.id === otherId);
        return otherNode && !CONTROL_KINDS.has(otherNode.kind) && otherNode.kind !== 'Package';
      });
      if (!hasContentNeighbor) {
        finalNodeIds.delete(nId);
        changed = true;
      }
    }
  }
  const nodes = prelimNodes.filter(n => finalNodeIds.has(n.id));
  const finalConnections = connections.filter(c => finalNodeIds.has(c.sourceId) && finalNodeIds.has(c.targetId));

  return { nodes, connections: finalConnections };
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
  const filter = VIEW_FILTERS[viewType] ?? filterGeneralView;
  return filter(model);
}
