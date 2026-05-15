// RendererStats — in-memory counter for which pipeline produced each render.
//
// Surfaces via /internal/renderer-stats (proxied by api-server's
// /api/admin/renderer-stats). Resets on process restart; Phase 0 accepts the
// volatility since the counter is for dogfooding observability, not billing.
// Phase 7+ can swap in Redis if persistence becomes useful.
//
// Bucket-naming policy (Slice 5+):
//   - If mapToDiagramViewType returns a DiagramViewType, the bucket is
//     keyed by that (e.g. 'state-machine'). All four RendererOutcomes are
//     meaningful here.
//   - If the legacy ViewType has no mapping yet, the bucket is keyed by
//     the *raw legacy ViewType* (e.g. 'general', 'state-transition'),
//     not by a generic 'unknown'. This lets the Phase 1 brief see
//     which legacy views generate the most traffic and prioritise the
//     next renderer accordingly. `unmapped` in the snapshot remains the
//     total of all such legacy buckets.

import type {
  DiagramViewType,
  RendererOutcome,
  ViewType,
} from '@systemodel/shared-types';
import { isDiagramViewType } from '@systemodel/shared-types';

// Either a new IR-side view tag or the request-level legacy enum value.
// Both are string literal unions with disjoint members; the union covers
// every bucket key that can arrive here.
type ViewTypeKey = DiagramViewType | ViewType;

export interface RendererStatsSnapshot {
  totalRenders: number;
  byViewType: Record<string, Partial<Record<RendererOutcome, number>>>;
  unmapped: number;
}

export class RendererStats {
  private counts = new Map<string, number>();

  record(viewType: ViewTypeKey, outcome: RendererOutcome): void {
    const key = `${viewType}:${outcome}`;
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
  }

  snapshot(): RendererStatsSnapshot {
    const byViewType: RendererStatsSnapshot['byViewType'] = {};
    let totalRenders = 0;
    let unmapped = 0;

    for (const [key, n] of this.counts) {
      const sep = key.indexOf(':');
      const viewType = key.slice(0, sep);
      const outcome = key.slice(sep + 1) as RendererOutcome;
      // Any bucket that isn't a known DiagramViewType is a legacy
      // ViewType that fell through to the old pipeline; sum these into
      // the `unmapped` rollup so admins keep the single-number view.
      if (!isDiagramViewType(viewType)) unmapped += n;
      const bucket = byViewType[viewType] ?? (byViewType[viewType] = {});
      bucket[outcome] = n;
      totalRenders += n;
    }

    return { totalRenders, byViewType, unmapped };
  }

  // Test-only: reset all counters.
  reset(): void {
    this.counts.clear();
  }
}

export const rendererStats = new RendererStats();
