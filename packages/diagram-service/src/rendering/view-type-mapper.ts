// Bridges the legacy request-level `ViewType` (`'general' | 'interconnection'
// | 'state-transition' | ...` — what the frontend sends, what view filters
// understand) and the new IR-level `DiagramViewType` (`'state-machine' |
// 'block-definition' | ...` — what view-specific renderers are registered
// under).
//
// Phase 1 wires `'state-transition' → 'state-machine'`; later phases follow.
// Legacy view types with no IR equivalent still return null and the wedge
// falls through to the old pipeline.

import type { ViewType, DiagramViewType } from '@systemodel/shared-types';

export function mapToDiagramViewType(legacy: ViewType): DiagramViewType | null {
  switch (legacy) {
    case 'state-transition': return 'state-machine';
    case 'interconnection': return 'interconnection';  // Phase 2 Slice 6a porto
    // Phase 2+: other view kinds...
    default:
      return null;
  }
}
