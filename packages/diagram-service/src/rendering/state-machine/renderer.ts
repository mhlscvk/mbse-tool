// State-machine renderer — IR → SModelRoot.
//
// Translates the discriminated-union StateMachineIR (produced by Slice 2a's
// transformer) into the flat Sprotty SModelRoot the frontend already knows
// how to lay out and draw. Visual nesting (composite states containing
// sub-states + entry/do/exit actions) is signalled via `composition` edges,
// not via nested SNode.children — DiagramViewer.tsx:527-535 derives the
// parent-child relation from those edges (see Slice 2b prerequisite 4.1).
//
// Encoding follows the legacy `bdd-transformer.ts` patterns so the frontend
// renders new pipelines byte-identically to the legacy STV:
//   • states           → cssClasses ['stateusage'], 140×60, [«state», name]
//   • pseudo-initials  → cssClasses ['startnode'],  24×24,  [«start», 'start']
//   • pseudo-finals    → cssClasses ['donenode'],   24×24,  [«done», 'done']
//   • entry/do/exit    → cssClasses ['entryactionusage'|'doactionusage'|
//                                    'exitactionusage'],   140×50,
//                                    [«entry action»|…, action name]
//   • transitions      → cssClasses ['transition'], optional label child
//                                    combining trigger + via + guard + effect
//   • compositions     → cssClasses ['composition'], no label (nesting hint)
//
// ADR-005 §D1 v1.2 — SysML v2 syntax (keywords, identifiers, structural
// punctuation) is preserved verbatim in SLabel.text. `data.i18nKey` is NEVER
// set on labels produced here; the frontend's labelText() helper short-
// circuits to `label.text` for every SLabel this renderer emits.

import type {
  StateMachineIR,
  StateMachineNode,
  TransitionEdge,
  TransitionLabel,
  SModelRoot,
  SNode,
  SEdge,
  SLabel,
} from '@systemodel/shared-types';

const STATE_SIZE = { width: 140, height: 60 };
const PSEUDO_STATE_SIZE = { width: 24, height: 24 };
const BEHAVIOR_SIZE = { width: 140, height: 50 };

function label(id: string, text: string): SLabel {
  return { type: 'label', id, text };
}

function combineLabel(label: TransitionLabel): string {
  const parts: string[] = [];
  if (label.trigger) {
    parts.push(label.modifier ? `${label.trigger} ${label.modifier}` : label.trigger);
  }
  if (label.guard) parts.push(`[${label.guard}]`);
  if (label.effect) parts.push(`/ ${label.effect}`);
  return parts.join(' ');
}

// Bare name for a state used in composition-edge ids — strips the IR prefix
// and lowercases the remainder. Mirrors the transformer's edge id scheme.
function bareNodeTag(irId: string): string {
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

// Bare name for an exploded behavior SNode used in composition-edge ids.
// Source ids look like behavior__On_entry_activation; strip the parent name
// so the composition id stays scoped to the relationship: `entry_activation`.
function bareBehaviorTag(behaviorId: string, parentStateName: string): string {
  const prefix = `behavior__${parentStateName}_`;
  if (behaviorId.startsWith(prefix)) {
    return behaviorId.slice(prefix.length);
  }
  return behaviorId.replace(/^behavior__/, '');
}

function compartmentKeyword(kind: 'entry' | 'do' | 'exit' | 'internal'): string {
  // SysML v2 syntax, preserved verbatim across locales (ADR-005 §D1 v1.2).
  switch (kind) {
    case 'entry': return '«entry action»';
    case 'do': return '«do action»';
    case 'exit': return '«exit action»';
    case 'internal': return '«internal action»';
  }
}

function compartmentCssClass(kind: 'entry' | 'do' | 'exit' | 'internal'): string {
  switch (kind) {
    case 'entry': return 'entryactionusage';
    case 'do': return 'doactionusage';
    case 'exit': return 'exitactionusage';
    case 'internal': return 'internalactionusage';
  }
}

function pseudoCssClass(kind: 'pseudo-initial' | 'pseudo-final' | 'pseudo-choice' | 'pseudo-junction'): string {
  // Map IR pseudo-state kinds onto the legacy CSS classes the frontend
  // already styles (filled circle, bull's-eye, diamond). Choice/junction
  // reuse the merge/decide diamonds until their own styles land.
  switch (kind) {
    case 'pseudo-initial': return 'startnode';
    case 'pseudo-final': return 'donenode';
    case 'pseudo-choice': return 'decisionnode';
    case 'pseudo-junction': return 'mergenode';
  }
}

function pseudoKeyword(kind: 'pseudo-initial' | 'pseudo-final' | 'pseudo-choice' | 'pseudo-junction'): string {
  switch (kind) {
    case 'pseudo-initial': return '«start»';
    case 'pseudo-final': return '«done»';
    case 'pseudo-choice': return '«choice»';
    case 'pseudo-junction': return '«junction»';
  }
}

function pseudoFallbackName(kind: 'pseudo-initial' | 'pseudo-final' | 'pseudo-choice' | 'pseudo-junction'): string {
  switch (kind) {
    case 'pseudo-initial': return 'start';
    case 'pseudo-final': return 'done';
    case 'pseudo-choice': return 'choice';
    case 'pseudo-junction': return 'junction';
  }
}

export function stateMachineToSModelRoot(ir: StateMachineIR): SModelRoot {
  const sourceFile = ir.metadata.sourceFile ?? '';
  const children: (SNode | SEdge)[] = [];

  // ── 1. Emit SNodes in IR order; for each state, emit its behavior SNodes
  //       (entry → do → exit) right after the state itself. Pseudo-states
  //       emit as plain SNodes. This matches the order in expected-smodel.json.

  for (const irNode of ir.nodes) {
    if (irNode.kind === 'state') {
      children.push(stateToSNode(irNode));
      for (const compartment of irNode.compartments ?? []) {
        for (const action of compartment.actions) {
          children.push(behaviorToSNode(action.semanticRef.astNodeId, action.name, compartment.kind));
        }
      }
    } else {
      children.push(pseudoStateToSNode(irNode));
    }
  }

  // ── 2. Emit transition SEdges in IR edge order (S5 — AST source order).

  for (const edge of ir.edges) {
    children.push(transitionToSEdge(edge));
  }

  // ── 3. Emit composition SEdges so the frontend can nest visually. Order
  //       matches the SNode order from step 1: for each state, behaviors
  //       first (entry/do/exit), then nested children with depth-first recursion.

  emitCompositionEdges(ir, children);

  return {
    type: 'graph',
    id: `state-machine__${sourceFile}`,
    children,
  };
}

function stateToSNode(node: StateMachineNode): SNode {
  const name = node.name ?? '';
  return {
    type: 'node',
    id: node.id,
    position: { x: 0, y: 0 },
    size: { ...STATE_SIZE },
    children: [
      label(`${node.id}__kind`, '«state»'),
      label(`${node.id}__label`, name),
    ],
    cssClasses: ['stateusage'],
  };
}

function pseudoStateToSNode(node: StateMachineNode): SNode {
  const kind = node.kind as 'pseudo-initial' | 'pseudo-final' | 'pseudo-choice' | 'pseudo-junction';
  const name = node.name ?? pseudoFallbackName(kind);
  return {
    type: 'node',
    id: node.id,
    position: { x: 0, y: 0 },
    size: { ...PSEUDO_STATE_SIZE },
    children: [
      label(`${node.id}__kind`, pseudoKeyword(kind)),
      label(`${node.id}__label`, name),
    ],
    cssClasses: [pseudoCssClass(kind)],
  };
}

function behaviorToSNode(
  id: string,
  actionName: string,
  kind: 'entry' | 'do' | 'exit' | 'internal',
): SNode {
  return {
    type: 'node',
    id,
    position: { x: 0, y: 0 },
    size: { ...BEHAVIOR_SIZE },
    children: [
      label(`${id}__kind`, compartmentKeyword(kind)),
      label(`${id}__label`, actionName),
    ],
    cssClasses: [compartmentCssClass(kind)],
  };
}

function transitionToSEdge(edge: TransitionEdge): SEdge {
  const text = combineLabel(edge.label);
  const labels: SLabel[] = text ? [label(`${edge.id}__label`, text)] : [];
  return {
    type: 'edge',
    id: edge.id,
    sourceId: edge.sourceId,
    targetId: edge.targetId,
    children: labels,
    cssClasses: ['transition'],
  };
}

function emitCompositionEdges(ir: StateMachineIR, sink: (SNode | SEdge)[]): void {
  const nodeById = new Map(ir.nodes.map(n => [n.id, n]));

  function emitFor(state: StateMachineNode): void {
    if (state.kind !== 'state') return;
    const parentTag = bareNodeTag(state.id);

    // Behavior children first, in compartment order.
    for (const compartment of state.compartments ?? []) {
      for (const action of compartment.actions) {
        const childTag = bareBehaviorTag(action.semanticRef.astNodeId, state.name ?? '');
        sink.push({
          type: 'edge',
          id: `comp__${parentTag}_to_${childTag}`,
          sourceId: state.id,
          targetId: action.semanticRef.astNodeId,
          children: [],
          cssClasses: ['composition'],
        });
      }
    }

    // Then nested children (sub-states + scoped pseudo-states). Recurse so
    // each composite's full subtree is emitted before its parent's next
    // sibling — matches the expected-smodel.json ordering.
    for (const childId of state.containedNodes ?? []) {
      const child = nodeById.get(childId);
      if (!child) continue;
      const childTag = bareNodeTag(child.id);
      // Sub-state-of-a-state shorthand: drop the leading "state_" so the
      // composition id is `comp__on_to_normal` rather than
      // `comp__on_to_state_normal`.
      const shortChildTag = child.kind === 'state'
        ? childTag
        : child.kind === 'pseudo-initial' || child.kind === 'pseudo-final'
          ? `pseudo_${child.kind === 'pseudo-initial' ? 'initial' : 'final'}`
          : childTag;
      sink.push({
        type: 'edge',
        id: `comp__${parentTag}_to_${shortChildTag}`,
        sourceId: state.id,
        targetId: child.id,
        children: [],
        cssClasses: ['composition'],
      });
      emitFor(child);
    }
  }

  // Top-level states (those not contained by any other state) — drive the
  // recursion from each one.
  const containedSet = new Set<string>();
  for (const n of ir.nodes) {
    for (const c of n.containedNodes ?? []) containedSet.add(c);
  }
  for (const n of ir.nodes) {
    if (containedSet.has(n.id)) continue;
    if (n.kind !== 'state') continue;
    emitFor(n);
  }
}
