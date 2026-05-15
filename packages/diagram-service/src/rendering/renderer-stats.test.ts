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

  it('tracks unmapped legacy views in the unmapped counter', () => {
    const s = new RendererStats();
    s.record('unknown', 'old-default');
    s.record('unknown', 'old-default');
    s.record('state-machine', 'new');

    const snap = s.snapshot();
    expect(snap.unmapped).toBe(2);
    expect(snap.totalRenders).toBe(3);
  });

  it('reset clears all counters', () => {
    const s = new RendererStats();
    s.record('state-machine', 'new');
    s.reset();
    expect(s.snapshot()).toEqual({ totalRenders: 0, byViewType: {}, unmapped: 0 });
  });
});
