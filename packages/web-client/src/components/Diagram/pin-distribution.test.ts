import { describe, it, expect } from 'vitest';
import { distributePinCoords } from './pin-distribution';

// Slice 6b W4 — regression tests for the K2.2 port-distribution core. The
// identity cases below are the cross-view regression guarantee: any view whose
// pins are single or already spaced (state-machine / AFV / STV / general)
// gets byte-identical coordinates, so this fix only moves coincident pins.

const MIN_GAP = 20; // PORT_BORDER_SIZE (16) + 4, as used by DiagramViewer

function minAdjacentGap(coords: number[]): number {
  const sorted = [...coords].sort((a, b) => a - b);
  let g = Infinity;
  for (let i = 1; i < sorted.length; i++) g = Math.min(g, sorted[i] - sorted[i - 1]);
  return g;
}
const mean = (a: number[]) => a.reduce((s, c) => s + c, 0) / a.length;

describe('distributePinCoords — identity (regression safety)', () => {
  it('returns a single pin unchanged', () => {
    expect(distributePinCoords([137], MIN_GAP)).toEqual([137]);
  });

  it('returns an empty array unchanged', () => {
    expect(distributePinCoords([], MIN_GAP)).toEqual([]);
  });

  it('leaves an already-spaced group untouched (gap > minGap)', () => {
    expect(distributePinCoords([100, 140, 180], MIN_GAP)).toEqual([100, 140, 180]);
  });

  it('leaves a group spaced exactly at minGap untouched', () => {
    expect(distributePinCoords([100, 120, 140], MIN_GAP)).toEqual([100, 120, 140]);
  });

  it('preserves input index order (does not sort the output)', () => {
    // Already spaced but given out of order — output must match input positions.
    expect(distributePinCoords([180, 100, 140], MIN_GAP)).toEqual([180, 100, 140]);
  });
});

describe('distributePinCoords — collision resolution (K2.2)', () => {
  it('splits two coincident pins symmetrically around their mean', () => {
    expect(distributePinCoords([220, 220], MIN_GAP)).toEqual([210, 230]);
  });

  it('distributes a mixed-coincident group with min gap, re-centred on the mean', () => {
    // Tarayıcı interfaces case shape: pairs at the same coordinate.
    const out = distributePinCoords([220, 220, 246, 246], MIN_GAP);
    expect(out).toEqual([203, 223, 243, 263]);
    expect(minAdjacentGap(out)).toBeGreaterThanOrEqual(MIN_GAP);
    expect(mean(out)).toBeCloseTo(mean([220, 220, 246, 246]));
  });

  it('fans a large all-coincident bundle (interfaces-scale) — all distinct, min gap kept, centred', () => {
    const input = new Array(10).fill(500);
    const out = distributePinCoords(input, MIN_GAP);
    expect(new Set(out).size).toBe(10);               // all distinct
    expect(minAdjacentGap(out)).toBeGreaterThanOrEqual(MIN_GAP);
    expect(mean(out)).toBeCloseTo(500);               // centred on original
  });

  it('only pushes the colliding members, keeping order', () => {
    // 100 and 105 collide (gap 5 < 20); 200 is already clear.
    const out = distributePinCoords([100, 105, 200], MIN_GAP);
    expect(minAdjacentGap(out)).toBeGreaterThanOrEqual(MIN_GAP);
    expect(mean(out)).toBeCloseTo(mean([100, 105, 200]));
    // sorted order preserved: out[0] < out[1] < out[2]
    expect(out[0]).toBeLessThan(out[1]);
    expect(out[1]).toBeLessThan(out[2]);
  });
});
