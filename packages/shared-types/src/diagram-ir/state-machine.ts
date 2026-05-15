// Diagram IR — state-machine view.
// Structured edge labels (TransitionLabel) make Bug-SM-01 (package name leaking
// into transition labels) unrepresentable at the type level.

import type { IRMetadata, IRPosition, IRSemanticRef } from './common.js';

export type StateMachineNodeKind =
  | 'state'
  | 'pseudo-initial'
  | 'pseudo-final'
  | 'pseudo-choice'
  | 'pseudo-junction';

export interface StateAction {
  name: string;
  semanticRef: IRSemanticRef;
}

export interface StateCompartment {
  kind: 'entry' | 'do' | 'exit' | 'internal';
  actions: StateAction[];
}

export interface StateMachineNode {
  id: string;
  kind: StateMachineNodeKind;
  name?: string;                        // undefined for pseudo-states
  semanticRef: IRSemanticRef;
  compartments?: StateCompartment[];    // only when kind === 'state'
  containedNodes?: string[];            // ids of nested states (composite states)
  containedEdges?: string[];            // ids of transitions enclosed by this state
  position?: IRPosition;                // set after layout
}

export interface TransitionLabel {
  trigger?: string;       // e.g. "PowerOn" — never the qualified name
  guard?: string;         // contents of [...]
  effect?: string;        // contents after /
  modifier?: string;      // e.g. "via sensor2Platform"
}

export interface TransitionEdge {
  id: string;
  kind: 'transition';
  sourceId: string;
  targetId: string;
  semanticRef: IRSemanticRef;
  label: TransitionLabel;
  position?: { points: IRPosition[] };  // set after layout
}

export interface StateMachineIR {
  viewType: 'state-machine';
  metadata: IRMetadata;
  nodes: StateMachineNode[];
  edges: TransitionEdge[];
}
