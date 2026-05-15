import { describe, expect, it } from 'vitest';
import { RendererStats } from './renderer-stats.js';

describe('RendererStats', () => {
  it('starts empty', () => {
    const s = new RendererStats();
    expect(s.snapshot()).toEqual({ totalRenders: 0, byViewType: {}, unmapped: 0 });
  });

  it('records outcomes grouped by viewType', () => {
    const s = new RendererStats();
    s.record('state-machine', 'new');
    s.record('state-machine', 'new');
    s.record('state-machine', 'old-default');
    s.record('state-machine', 'old-fallback-from-new');

    const snap = s.snapshot();
    expect(snap.totalRenders).toBe(4);
    expect(snap.byViewType['state-machine']).toEqual({
      new: 2,
      'old-default': 1,
      'old-fallback-from-new': 1,
    });
    expect(snap.unmapped).toBe(0);
  });

  it('tracks unmapped legacy views by their raw ViewType name, summed into unmapped', () => {
    const s = new RendererStats();
    // Two distinct legacy ViewTypes with no mapper entry yet.
    s.record('general', 'old-default');
    s.record('general', 'old-default');
    s.record('state-transition', 'old-default');
    // One mapped DiagramViewType bucket — does not count toward unmapped.
    s.record('state-machine', 'new');

    const snap = s.snapshot();
    // Granular buckets — each legacy ViewType keeps its own identity so
    // Phase 1 prioritisation can see which view earns the biggest payoff.
    expect(snap.byViewType.general).toEqual({ 'old-default': 2 });
    expect(snap.byViewType['state-transition']).toEqual({ 'old-default': 1 });
    expect(snap.byViewType['state-machine']).toEqual({ new: 1 });
    // unmapped rollup: every bucket whose key is not a DiagramViewType.
    expect(snap.unmapped).toBe(3);
    expect(snap.totalRenders).toBe(4);
  });

  it('reset clears all counters', () => {
    const s = new RendererStats();
    s.record('state-machine', 'new');
    s.reset();
    expect(s.snapshot()).toEqual({ totalRenders: 0, byViewType: {}, unmapped: 0 });
  });
});
