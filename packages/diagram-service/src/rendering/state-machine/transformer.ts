// State-machine transformer — AST → StateMachineIR.
//
// Maps parser output (SysMLModel) to the discriminated-union IR defined in
// shared-types. Builds:
//   • state nodes from StateUsage AST nodes (Off, On, Normal, Degraded, …)
//   • pseudo-states from StartNode / DoneNode / TerminateNode, scoped per
//     container so On's local initial is distinct from the top-level one
//   • compartments from EntryActionUsage / DoActionUsage / ExitActionUsage
//     children of each state, dropping empty exits per ADR-005 §S1
//   • transitions with structured TransitionLabel (last `::` segment for
//     trigger, "via X" as modifier) — Bug-SM-01 is unrepresentable at the
//     type level
//   • containedNodes / containedEdges for composite states so the renderer
//     can nest sub-states inside their parent
//
// IR ids follow ADR-005 §IR ID Convention (state__Name, pseudo-initial__on,
// edge__src_to_tgt with discriminator suffix on collision). Parser ids are
// preserved in `semanticRef.astNodeId` for traceability; they are
// source-text-fragile (ADR-005 §Decisions deferred §6) and excluded from
// snapshot equality.

import type {
  SysMLModel,
  SysMLNode,
  SysMLConnection,
  StateMachineIR,
  StateMachineNode,
  StateCompartment,
  StateAction,
  TransitionEdge,
  TransitionLabel,
} from '@systemodel/shared-types';
import type { ViewSpec } from '../view-registry.js';

const RENDERER_VERSION = 'state-machine-1.0.0';

export function transformAstToStateMachineIR(
  model: SysMLModel,
  _viewSpec: ViewSpec,
): StateMachineIR {
  const nodesById = new Map(model.nodes.map(n => [n.id, n]));

  // Composition is the only "owns" relation we care about here. Build both
  // directions so we can answer "children of X" and "parent of X" in O(1).
  const childrenByParent = new Map<string, SysMLNode[]>();
  const parentByChild = new Map<string, SysMLNode>();
  for (const c of model.connections) {
    if (c.kind !== 'composition') continue;
    const parent = nodesById.get(c.sourceId);
    const child = nodesById.get(c.targetId);
    if (!parent || !child) continue;
    const bucket = childrenByParent.get(parent.id);
    if (bucket) bucket.push(child);
    else childrenByParent.set(parent.id, [child]);
    parentByChild.set(child.id, parent);
  }

  const isState = (n: SysMLNode) => n.kind === 'StateUsage';
  const isStateDef = (n: SysMLNode) => n.kind === 'StateDefinition';
  const isPseudoInitial = (n: SysMLNode) => n.kind === 'StartNode';
  const isPseudoFinal = (n: SysMLNode) => n.kind === 'DoneNode' || n.kind === 'TerminateNode';

  // Container tag for a pseudo-state: the lowercase name of the enclosing
  // state usage, or 'top' when it sits directly under the state definition.
  // (ADR-005 §S2: per-container pseudo-state instances.)
  function pseudoContainerTag(pseudo: SysMLNode): string {
    const parent = parentByChild.get(pseudo.id);
    if (!parent) return 'top';
    if (isStateDef(parent)) return 'top';
    if (isState(parent)) return parent.name.toLowerCase();
    return 'top';
  }

  // qualifiedName walks the composition chain upward, stopping at the
  // enclosing Package (which we don't include — `SensorSystemStates::On`,
  // not `SensorSystems::SensorSystemStates::On`).
  function qualifiedName(n: SysMLNode): string {
    const chain: string[] = [n.name];
    let current = parentByChild.get(n.id);
    while (current && current.kind !== 'Package') {
      chain.unshift(current.name);
      current = parentByChild.get(current.id);
    }
    return chain.join('::');
  }

  // ── States ───────────────────────────────────────────────────────────────
  const irNodes: StateMachineNode[] = [];
  const stateIrIdByAstId = new Map<string, string>();
  const pseudoIrIdByAstId = new Map<string, string>();

  // Detect state-name collisions across the whole diagram so the collision
  // suffix is applied uniformly (ADR-005 §Collision rule — not just to the
  // second occurrence).
  const stateNameCount = new Map<string, number>();
  for (const n of model.nodes) {
    if (!isState(n)) continue;
    stateNameCount.set(n.name, (stateNameCount.get(n.name) ?? 0) + 1);
  }

  function deriveStateIrId(n: SysMLNode): string {
    let irId = `state__${n.name}`;
    if ((stateNameCount.get(n.name) ?? 0) > 1) {
      const parent = parentByChild.get(n.id);
      const suffix = parent && isState(parent) ? parent.name.toLowerCase() : 'top';
      irId = `state__${n.name}__${suffix}`;
    }
    return irId;
  }

  function lineOf(n: SysMLNode): number {
    return n.range?.start.line ?? 0;
  }

  // Emit nodes in DFS-by-composition order so the IR scans top-to-bottom
  // alongside the model source. Each container emits:
  //   1. its direct state children (in source order)
  //      — for a composite state, recurse to emit its descendants
  //   2. its direct pseudo-states (initial first, then final, by source order)
  // ADR-005 §S2 keeps per-container pseudo-states distinct.
  function emitContainer(containerId: string) {
    const children = childrenByParent.get(containerId) ?? [];
    const childStates = children.filter(isState).sort((a, b) => lineOf(a) - lineOf(b));
    for (const s of childStates) {
      const irId = deriveStateIrId(s);
      stateIrIdByAstId.set(s.id, irId);
      irNodes.push({
        id: irId,
        kind: 'state',
        name: s.name,
        semanticRef: { astNodeId: s.id, qualifiedName: qualifiedName(s) },
        compartments: [],
      });
      // Recurse — if s is composite, its descendants follow immediately.
      emitContainer(s.id);
    }
    // Pseudo-states scoped to this container come AFTER the state children
    // (matches the way expected-ir.json reads inside-out: states first,
    // then the small pseudo-state markers that connect them).
    const childPseudos = children
      .filter(c => isPseudoInitial(c) || isPseudoFinal(c))
      .sort((a, b) => {
        // initial before final, then by source line
        const aRank = isPseudoInitial(a) ? 0 : 1;
        const bRank = isPseudoInitial(b) ? 0 : 1;
        if (aRank !== bRank) return aRank - bRank;
        return lineOf(a) - lineOf(b);
      });
    for (const p of childPseudos) {
      const tag = pseudoContainerTag(p);
      const kind = isPseudoInitial(p) ? 'pseudo-initial' : 'pseudo-final';
      const irId = `${kind}__${tag}`;
      pseudoIrIdByAstId.set(p.id, irId);
      irNodes.push({
        id: irId,
        kind,
        semanticRef: { astNodeId: p.id, qualifiedName: qualifiedName(p) },
      });
    }
  }

  // Find the diagram root (StateDefinition) and walk from there.
  const stateDef = model.nodes.find(isStateDef);
  if (stateDef) {
    emitContainer(stateDef.id);
  }

  // ── Compartments ─────────────────────────────────────────────────────────
  // Behavior nodes are named like "entry action / checkPowerSource". A bare
  // "exit action" (no slash) is the empty-action form (`exit action ;`),
  // which we drop per ADR-005 §S1.
  function actionNameFromBehaviorName(name: string): string | undefined {
    const m = name.match(/\/\s*(.+)$/);
    if (!m) return undefined;
    const trimmed = m[1].trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  for (const stateAst of model.nodes) {
    if (!isState(stateAst)) continue;
    const irNode = irNodes.find(n => n.id === stateIrIdByAstId.get(stateAst.id))!;
    const children = childrenByParent.get(stateAst.id) ?? [];

    const buildCompartment = (
      kind: 'entry' | 'do' | 'exit',
      childKind: SysMLNode['kind'],
    ): StateCompartment | undefined => {
      const actions: StateAction[] = [];
      for (const ch of children) {
        if (ch.kind !== childKind) continue;
        const actionName = actionNameFromBehaviorName(ch.name);
        if (!actionName) continue;
        actions.push({ name: actionName, semanticRef: { astNodeId: ch.id } });
      }
      if (actions.length === 0) return undefined;
      return { kind, actions };
    };

    const compartments: StateCompartment[] = [];
    const entry = buildCompartment('entry', 'EntryActionUsage');
    const doc = buildCompartment('do', 'DoActionUsage');
    const exit = buildCompartment('exit', 'ExitActionUsage');
    if (entry) compartments.push(entry);
    if (doc) compartments.push(doc);
    if (exit) compartments.push(exit);
    irNode.compartments = compartments;
  }

  // ── Transitions ──────────────────────────────────────────────────────────
  function parseLabel(name: string | undefined): TransitionLabel {
    if (!name) return {};
    const viaMatch = name.match(/^(.+?)\s+via\s+(\S+)$/);
    const triggerPart = viaMatch ? viaMatch[1] : name;
    const viaPort = viaMatch?.[2];
    const segments = triggerPart.split('::');
    const last = segments[segments.length - 1];
    const label: TransitionLabel = {};
    if (last) label.trigger = last;
    if (viaPort) label.modifier = `via ${viaPort}`;
    return label;
  }

  // Translate IR ids back to the short forms used in edge ids.
  function bareName(irId: string): string {
    if (irId.startsWith('state__')) {
      return irId.slice('state__'.length).toLowerCase().replace(/__/g, '_');
    }
    if (irId.startsWith('pseudo-initial__')) {
      return `${irId.slice('pseudo-initial__'.length)}_initial`;
    }
    if (irId.startsWith('pseudo-final__')) {
      return `${irId.slice('pseudo-final__'.length)}_final`;
    }
    return irId.toLowerCase();
  }

  function irIdForAst(astId: string): string | undefined {
    return stateIrIdByAstId.get(astId) ?? pseudoIrIdByAstId.get(astId);
  }

  // S5: preserve AST source order. Anonymous transition ids encode the
  // source offset (`transition__anon_${offset}`); named ones default to 0
  // and end up at the top, which is acceptable for the current fixture.
  function transitionOffset(c: SysMLConnection): number {
    const m = c.id.match(/_(\d+)$/);
    return m ? parseInt(m[1], 10) : 0;
  }

  const transitions = model.connections
    .filter(c => c.kind === 'transition')
    .sort((a, b) => transitionOffset(a) - transitionOffset(b));

  // Provisional edges so collisions can be detected before assigning ids.
  interface Provisional {
    astId: string;
    sourceId: string;
    targetId: string;
    baseId: string;
    label: TransitionLabel;
  }
  const provisional: Provisional[] = [];
  for (const c of transitions) {
    const srcIr = irIdForAst(c.sourceId);
    const tgtIr = irIdForAst(c.targetId);
    if (!srcIr || !tgtIr) continue;
    provisional.push({
      astId: c.id,
      sourceId: srcIr,
      targetId: tgtIr,
      baseId: `edge__${bareName(srcIr)}_to_${bareName(tgtIr)}`,
      label: parseLabel(c.name),
    });
  }

  const baseCount = new Map<string, number>();
  for (const p of provisional) baseCount.set(p.baseId, (baseCount.get(p.baseId) ?? 0) + 1);

  const edges: TransitionEdge[] = [];
  const usedIds = new Set<string>();
  let anonCounter = 0;
  for (const p of provisional) {
    let id = p.baseId;
    if ((baseCount.get(p.baseId) ?? 0) > 1) {
      // Discriminator: trigger name lowercased (alphanumeric-only) or
      // "notrigger" for unconditional edges; fall back to anon<N> if even
      // the discriminator collides.
      const triggerSlug = p.label.trigger?.toLowerCase().replace(/[^a-z0-9]/g, '');
      let suffix = triggerSlug && triggerSlug.length > 0 ? triggerSlug : 'notrigger';
      if (usedIds.has(`${p.baseId}_${suffix}`)) {
        suffix = `anon${anonCounter++}`;
      }
      id = `${p.baseId}_${suffix}`;
    }
    usedIds.add(id);
    edges.push({
      id,
      kind: 'transition',
      sourceId: p.sourceId,
      targetId: p.targetId,
      semanticRef: { astNodeId: p.astId },
      label: p.label,
    });
  }

  // ── Containment (composite states) ───────────────────────────────────────
  for (const stateAst of model.nodes) {
    if (!isState(stateAst)) continue;
    const irNode = irNodes.find(n => n.id === stateIrIdByAstId.get(stateAst.id))!;
    const childIrIds: string[] = [];
    for (const ch of childrenByParent.get(stateAst.id) ?? []) {
      const childIr = irIdForAst(ch.id);
      if (childIr) childIrIds.push(childIr);
    }
    if (childIrIds.length === 0) continue;

    irNode.containedNodes = childIrIds;
    // Edges contained: both endpoints sit inside this composite (and neither
    // is the composite itself — that would be an incoming/outgoing edge).
    const childIrIdSet = new Set(childIrIds);
    const containedEdges: string[] = [];
    for (const e of edges) {
      if (e.sourceId === irNode.id || e.targetId === irNode.id) continue;
      if (childIrIdSet.has(e.sourceId) && childIrIdSet.has(e.targetId)) {
        containedEdges.push(e.id);
      }
    }
    irNode.containedEdges = containedEdges;
  }

  return {
    viewType: 'state-machine',
    metadata: {
      generatedAt: new Date().toISOString(),
      rendererVersion: RENDERER_VERSION,
      sourceFile: model.uri,
    },
    nodes: irNodes,
    edges,
  };
}
