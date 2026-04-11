import { describe, it, expect } from 'vitest';
import { resolveEdgeLabelOverlaps, type LabelRect, type ResolvedLabel } from './resolveEdgeLabelOverlaps.js';

/** Helper: check no pair of resolved labels overlaps (AABB with 2px gap) */
function hasNoOverlaps(labels: ResolvedLabel[]): boolean {
  const GAP = 2;
  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      const a = labels[i], b = labels[j];
      // Horizontal overlap
      const aLeft = a.x - a.w / 2, aRight = a.x + a.w / 2;
      const bLeft = b.x - b.w / 2, bRight = b.x + b.w / 2;
      if (aRight <= bLeft || bRight <= aLeft) continue;
      // Vertical overlap (rect sits above y, with gap)
      const aTop = a.y + a.dy - a.h - GAP / 2;
      const aBottom = a.y + a.dy + GAP / 2;
      const bTop = b.y + b.dy - b.h - GAP / 2;
      const bBottom = b.y + b.dy + GAP / 2;
      if (aBottom <= bTop || bBottom <= aTop) continue;
      return false; // overlap found
    }
  }
  return true;
}

function makeLabel(id: string, x: number, y: number, text = 'label'): LabelRect {
  return { id, x, y, w: text.length * 6.4 + 8, h: 14 };
}

describe('resolveEdgeLabelOverlaps', () => {
  it('returns empty array for empty input', () => {
    expect(resolveEdgeLabelOverlaps([])).toEqual([]);
  });

  it('returns dy=0 for a single label', () => {
    const result = resolveEdgeLabelOverlaps([makeLabel('e1', 100, 200)]);
    expect(result).toHaveLength(1);
    expect(result[0].dy).toBe(0);
    expect(result[0].id).toBe('e1');
  });

  it('does not nudge two labels that are far apart vertically', () => {
    const result = resolveEdgeLabelOverlaps([
      makeLabel('e1', 100, 100),
      makeLabel('e2', 100, 200),
    ]);
    expect(result).toHaveLength(2);
    for (const r of result) expect(r.dy).toBe(0);
  });

  it('does not nudge two labels that are far apart horizontally', () => {
    const result = resolveEdgeLabelOverlaps([
      makeLabel('e1', 0, 100),
      makeLabel('e2', 500, 100),
    ]);
    expect(result).toHaveLength(2);
    for (const r of result) expect(r.dy).toBe(0);
  });

  it('does not nudge labels overlapping vertically but not horizontally', () => {
    // Same Y but X positions far enough apart that rects don't overlap
    const result = resolveEdgeLabelOverlaps([
      makeLabel('e1', 0, 100, 'a'),    // narrow label
      makeLabel('e2', 100, 100, 'b'),   // narrow label far right
    ]);
    expect(result).toHaveLength(2);
    for (const r of result) expect(r.dy).toBe(0);
  });

  it('separates two labels at the exact same position', () => {
    const result = resolveEdgeLabelOverlaps([
      makeLabel('e1', 200, 200),
      makeLabel('e2', 200, 200),
    ]);
    expect(result).toHaveLength(2);
    expect(hasNoOverlaps(result)).toBe(true);
    // They should be pushed in opposite directions
    const dys = result.map(r => r.dy).sort((a, b) => a - b);
    expect(dys[0]).toBeLessThan(0);
    expect(dys[1]).toBeGreaterThan(0);
  });

  it('separates two labels that partially overlap vertically', () => {
    const result = resolveEdgeLabelOverlaps([
      makeLabel('e1', 200, 200),
      makeLabel('e2', 200, 205), // 5px apart, but h=14 so they overlap
    ]);
    expect(result).toHaveLength(2);
    expect(hasNoOverlaps(result)).toBe(true);
  });

  it('separates three labels at the same position', () => {
    const result = resolveEdgeLabelOverlaps([
      makeLabel('e1', 300, 300),
      makeLabel('e2', 300, 300),
      makeLabel('e3', 300, 300),
    ]);
    expect(result).toHaveLength(3);
    expect(hasNoOverlaps(result)).toBe(true);
  });

  it('handles a cluster of 10 labels without any remaining overlaps', () => {
    const labels: LabelRect[] = [];
    for (let i = 0; i < 10; i++) {
      labels.push(makeLabel(`e${i}`, 400, 400 + i * 2)); // 2px apart, all overlap
    }
    const result = resolveEdgeLabelOverlaps(labels);
    expect(result).toHaveLength(10);
    expect(hasNoOverlaps(result)).toBe(true);
  });

  it('handles long label text correctly (wide rects)', () => {
    const longText = 'Events::PowerOff then standby';
    const result = resolveEdgeLabelOverlaps([
      makeLabel('e1', 200, 200, longText),
      makeLabel('e2', 210, 200, longText), // offset 10px but wide labels overlap
    ]);
    expect(result).toHaveLength(2);
    expect(hasNoOverlaps(result)).toBe(true);
  });

  it('produces deterministic output on repeated calls', () => {
    const input: LabelRect[] = [
      makeLabel('e1', 100, 100),
      makeLabel('e2', 100, 105),
      makeLabel('e3', 100, 100),
    ];
    const r1 = resolveEdgeLabelOverlaps(input);
    const r2 = resolveEdgeLabelOverlaps(input);
    expect(r1).toEqual(r2);
  });

  it('preserves edge IDs in output (correct association)', () => {
    const input: LabelRect[] = [
      makeLabel('alpha', 100, 200),
      makeLabel('beta', 100, 200),
      makeLabel('gamma', 100, 200),
    ];
    const result = resolveEdgeLabelOverlaps(input);
    const ids = new Set(result.map(r => r.id));
    expect(ids).toEqual(new Set(['alpha', 'beta', 'gamma']));
  });

  it('does not modify labels that are already well-separated', () => {
    const result = resolveEdgeLabelOverlaps([
      makeLabel('e1', 100, 100),
      makeLabel('e2', 200, 200),
      makeLabel('e3', 300, 300),
      makeLabel('e4', 400, 400),
    ]);
    for (const r of result) expect(r.dy).toBe(0);
  });

  it('handles mixed: some overlapping, some not', () => {
    const result = resolveEdgeLabelOverlaps([
      makeLabel('e1', 100, 100),  // isolated
      makeLabel('e2', 500, 500),  // cluster
      makeLabel('e3', 500, 502),  // cluster
      makeLabel('e4', 900, 100),  // isolated
    ]);
    expect(result).toHaveLength(4);
    expect(hasNoOverlaps(result)).toBe(true);
    // Isolated labels should not be nudged
    const e1 = result.find(r => r.id === 'e1')!;
    const e4 = result.find(r => r.id === 'e4')!;
    expect(e1.dy).toBe(0);
    expect(e4.dy).toBe(0);
  });
});
