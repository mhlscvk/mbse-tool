// RendererStats — in-memory counter for which pipeline produced each render.
//
// Surfaces via /internal/renderer-stats (proxied by api-server's
// /api/admin/renderer-stats). Resets on process restart; Phase 0 accepts the
// volatility since the counter is for dogfooding observability, not billing.
// Phase 7+ can swap in Redis if persistence becomes useful.

import type {
  DiagramViewType,
  RendererOutcome,
} from '@systemodel/shared-types';

// Counters are keyed by `${viewType}:${outcome}` so the snapshot can
// reconstruct a nested shape without holding two maps. 'unknown' is a valid
// viewType bucket for legacy ViewType values the mapper doesn't translate
// (e.g. 'general'); those always go through the old pipeline.
type ViewTypeKey = DiagramViewType | 'unknown';

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
      if (viewType === 'unknown') unmapped += n;
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
