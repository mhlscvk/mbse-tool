// Bridges the legacy request-level `ViewType` (`'general' | 'interconnection'
// | 'state-transition' | ...` — what the frontend sends, what view filters
// understand) and the new IR-level `DiagramViewType` (`'state-machine' |
// 'block-definition' | ...` — what view-specific renderers are registered
// under).
//
// Phase 0: no mappings yet — every legacy value returns null and the wedge
// falls through to the old pipeline. Phase 1 wires
// `'state-transition' → 'state-machine'`; later phases follow.

import type { ViewType, DiagramViewType } from '@systemodel/shared-types';

export function mapToDiagramViewType(legacy: ViewType): DiagramViewType | null {
  switch (legacy) {
    // Phase 1: case 'state-transition': return 'state-machine';
    // Phase 2+: other view kinds...
    default:
      return null;
  }
}
