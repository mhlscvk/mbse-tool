// Diagram IR — discriminated union over per-view IR variants.
//
// Name note: this is `DiagramViewType` rather than `ViewType` to avoid
// colliding with the legacy `ViewType` (`'general' | 'interconnection' | ...`)
// in diagram.ts, which classifies SysML view filters, not IR shapes.
// The wedge in diagram-service maps between the two.

export * from './common.js';
export * from './state-machine.js';

import type { StateMachineIR } from './state-machine.js';

export type DiagramIR =
  | StateMachineIR;
  // | BlockDefinitionIR   // Phase 2
  // | InternalBlockIR     // Phase 3
  // | RequirementIR       // Phase 4
  // | ActionIR            // Phase 5
  // | UseCaseIR           // Phase 6

export type DiagramViewType = DiagramIR['viewType'];
