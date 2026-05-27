// Diagram IR — discriminated union over per-view IR variants.
//
// Name note: this is `DiagramViewType` rather than `ViewType` to avoid
// colliding with the legacy `ViewType` (`'general' | 'interconnection' | ...`)
// in diagram.ts, which classifies SysML view filters, not IR shapes.
// The wedge in diagram-service maps between the two.

export * from './common.js';
export * from './state-machine.js';
export * from './interconnection.js';

import type { StateMachineIR } from './state-machine.js';
import type { InterconnectionIR } from './interconnection.js';

export type DiagramIR =
  | StateMachineIR
  | InterconnectionIR;   // Phase 2 Slice 6a — interconnection view porto
  // | RequirementIR      // later phase
  // | ActionIR           // later phase
  // | UseCaseIR          // later phase

export type DiagramViewType = DiagramIR['viewType'];

// Runtime set mirror of DiagramViewType. Used by RendererStats.snapshot()
// to classify counter keys as "DiagramViewType bucket" or "unmapped legacy
// ViewType bucket". When DiagramIR gains a variant in Phase 2+, add the
// new tag here too — the exhaustiveness check below will fail at compile
// time if you forget.
export const DIAGRAM_VIEW_TYPES = ['state-machine', 'interconnection'] as const;

// Compile-time guarantee that DIAGRAM_VIEW_TYPES covers every union tag.
// If a new IR variant lands without a corresponding entry, `_exhaustive`
// becomes `never` and the assignment errors.
type _ExhaustivenessCheck = DiagramViewType extends (typeof DIAGRAM_VIEW_TYPES)[number] ? true : never;
const _exhaustive: _ExhaustivenessCheck = true;
void _exhaustive;

export function isDiagramViewType(s: string): s is DiagramViewType {
  return (DIAGRAM_VIEW_TYPES as readonly string[]).includes(s);
}
