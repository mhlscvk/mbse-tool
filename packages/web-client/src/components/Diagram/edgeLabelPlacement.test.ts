import { describe, it, expect } from 'vitest';
import {
  placeEdgeLabels,
  pathDirectionAt,
  lineDirection,
  bezierDirection,
  type EdgeLabelInput,
  type ObstacleRect,
  type PlacedLabel,
} from './edgeLabelPlacement.js';

// ── Helpers ──────────────────────────────────────────────────────────

const LABEL_H = 14;
const COLLISION_PAD = 1; // must match edgeLabelPlacement.ts

function makeLabelBBox(p: PlacedLabel) {
  return {
    left: p.x - p.w / 2 - COLLISION_PAD,
    right: p.x + p.w / 2 + COLLISION_PAD,
    top: p.y - p.h - COLLISION_PAD,
    bottom: p.y + COLLISION_PAD,
  };
}

function bboxOverlaps(
  a: ReturnType<typeof makeLabelBBox>,
  b: ReturnType<typeof makeLabelBBox>,
): boolean {
  return a.right > b.left && b.right > a.left && a.bottom > b.top && b.bottom > a.top;
}

/** Check that no pair of placed labels overlaps */
function noPlacedOverlaps(labels: PlacedLabel[]): boolean {
  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      if (bboxOverlaps(makeLabelBBox(labels[i]), makeLabelBBox(labels[j]))) return false;
    }
  }
  return true;
}

/** Check that no label overlaps any obstacle */
function noObstacleOverlaps(labels: PlacedLabel[], obstacles: ObstacleRect[]): boolean {
  for (const l of labels) {
    const lb = makeLabelBBox(l);
    for (const o of obstacles) {
      const ob = { left: o.x, right: o.x + o.w, top: o.y, bottom: o.y + o.h };
      if (bboxOverlaps(lb, ob)) return false;
    }
  }
  return true;
}

function makeInput(id: string, ax: number, ay: number, text = 'label'): EdgeLabelInput {
  // Default: horizontal edge going right, normal points up
  return {
    id, text,
    anchor: { x: ax, y: ay },
    tangent: { x: 1, y: 0 },
    normal: { x: 0, y: -1 },
  };
}

function makeVerticalInput(id: string, ax: number, ay: number, text = 'label'): EdgeLabelInput {
  // Vertical edge going down, normal points left
  return {
    id, text,
    anchor: { x: ax, y: ay },
    tangent: { x: 0, y: 1 },
    normal: { x: -1, y: 0 },
  };
}

// ── placeEdgeLabels tests ────────────────────────────────────────────

describe('placeEdgeLabels', () => {
  it('returns empty array for empty input', () => {
    expect(placeEdgeLabels([])).toEqual([]);
  });

  it('places a single label without collision', () => {
    const result = placeEdgeLabels([makeInput('e1', 200, 200)]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('e1');
    // Should be near the anchor
    expect(Math.abs(result[0].x - 200)).toBeLessThan(50);
    expect(Math.abs(result[0].y - 200)).toBeLessThan(50);
  });

  it('places two labels at same anchor without overlap', () => {
    const result = placeEdgeLabels([
      makeInput('e1', 300, 300),
      makeInput('e2', 300, 300),
    ]);
    expect(result).toHaveLength(2);
    expect(noPlacedOverlaps(result)).toBe(true);
  });

  it('places three labels at same anchor without overlap', () => {
    const result = placeEdgeLabels([
      makeInput('e1', 400, 400),
      makeInput('e2', 400, 400),
      makeInput('e3', 400, 400),
    ]);
    expect(result).toHaveLength(3);
    expect(noPlacedOverlaps(result)).toBe(true);
  });

  it('places labels at different anchors without unnecessary displacement', () => {
    const result = placeEdgeLabels([
      makeInput('e1', 100, 100),
      makeInput('e2', 500, 500),
    ]);
    expect(result).toHaveLength(2);
    // Each should be close to its own anchor
    const e1 = result.find(r => r.id === 'e1')!;
    const e2 = result.find(r => r.id === 'e2')!;
    expect(Math.abs(e1.x - 100)).toBeLessThan(50);
    expect(Math.abs(e2.x - 500)).toBeLessThan(50);
  });

  it('handles a dense cluster of 6 labels', () => {
    const inputs: EdgeLabelInput[] = [];
    for (let i = 0; i < 6; i++) {
      inputs.push(makeInput(`e${i}`, 300, 300 + i * 3));
    }
    const result = placeEdgeLabels(inputs);
    expect(result).toHaveLength(6);
    expect(noPlacedOverlaps(result)).toBe(true);
  });

  it('avoids node obstacles', () => {
    const obstacles: ObstacleRect[] = [
      { x: 180, y: 170, w: 40, h: 40 }, // obstacle right at anchor
    ];
    const result = placeEdgeLabels([makeInput('e1', 200, 200)], obstacles);
    expect(result).toHaveLength(1);
    expect(noObstacleOverlaps(result, obstacles)).toBe(true);
  });

  it('avoids obstacles while resolving mutual overlaps', () => {
    const obstacles: ObstacleRect[] = [
      { x: 280, y: 270, w: 40, h: 40 },
    ];
    const result = placeEdgeLabels([
      makeInput('e1', 300, 300),
      makeInput('e2', 300, 305),
    ], obstacles);
    expect(result).toHaveLength(2);
    expect(noPlacedOverlaps(result)).toBe(true);
    expect(noObstacleOverlaps(result, obstacles)).toBe(true);
  });

  it('handles long label text', () => {
    const longText = 'Events {currentSpeed} >= minSpeed';
    const result = placeEdgeLabels([
      makeInput('e1', 500, 300, longText),
      makeInput('e2', 500, 305, longText),
    ]);
    expect(result).toHaveLength(2);
    expect(noPlacedOverlaps(result)).toBe(true);
  });

  it('produces deterministic output on repeated calls', () => {
    const inputs = [
      makeInput('e1', 200, 200),
      makeInput('e2', 200, 205),
      makeInput('e3', 200, 200),
    ];
    const r1 = placeEdgeLabels(inputs);
    const r2 = placeEdgeLabels(inputs);
    expect(r1).toEqual(r2);
  });

  it('preserves all edge IDs in output', () => {
    const inputs = [
      makeInput('alpha', 100, 100),
      makeInput('beta', 100, 100),
      makeInput('gamma', 100, 100),
    ];
    const result = placeEdgeLabels(inputs);
    const ids = new Set(result.map(r => r.id));
    expect(ids).toEqual(new Set(['alpha', 'beta', 'gamma']));
  });

  it('keeps labels within reasonable distance of their anchor', () => {
    const result = placeEdgeLabels([
      makeInput('e1', 300, 300),
      makeInput('e2', 300, 300),
      makeInput('e3', 300, 300),
      makeInput('e4', 300, 300),
    ]);
    for (const p of result) {
      const dist = Math.hypot(p.x - 300, p.y - 300);
      expect(dist).toBeLessThan(100); // max offset + tolerance
    }
  });

  it('handles mixed: some overlapping, some isolated', () => {
    const result = placeEdgeLabels([
      makeInput('e1', 100, 100),
      makeInput('e2', 500, 500),
      makeInput('e3', 500, 503),
      makeInput('e4', 900, 100),
    ]);
    expect(result).toHaveLength(4);
    expect(noPlacedOverlaps(result)).toBe(true);
  });

  it('handles vertical edges correctly', () => {
    const result = placeEdgeLabels([
      makeVerticalInput('e1', 300, 300),
      makeVerticalInput('e2', 300, 305),
    ]);
    expect(result).toHaveLength(2);
    expect(noPlacedOverlaps(result)).toBe(true);
  });

  it('handles parallel horizontal edges (state machine transitions)', () => {
    // Simulates multiple transitions between states at similar positions
    const result = placeEdgeLabels([
      makeInput('t1', 500, 350, 'Events {currentSpeed}'),
      makeInput('t2', 520, 355, 'Events {currentSpeed}'),
      makeInput('t3', 480, 345, 'Events {currentSpeed}'),
      makeInput('t4', 510, 360, 'Events {currentSpeed}'),
    ]);
    expect(result).toHaveLength(4);
    expect(noPlacedOverlaps(result)).toBe(true);
  });
});

// ── Direction helper tests ───────────────────────────────────────────

describe('lineDirection', () => {
  it('computes horizontal line direction', () => {
    const dir = lineDirection({ x: 0, y: 0 }, { x: 100, y: 0 });
    expect(dir.tangent.x).toBeCloseTo(1);
    expect(dir.tangent.y).toBeCloseTo(0);
    expect(dir.normal.x).toBeCloseTo(0);
    expect(dir.normal.y).toBeCloseTo(1);
  });

  it('computes vertical line direction', () => {
    const dir = lineDirection({ x: 0, y: 0 }, { x: 0, y: 100 });
    expect(dir.tangent.x).toBeCloseTo(0);
    expect(dir.tangent.y).toBeCloseTo(1);
    expect(dir.normal.x).toBeCloseTo(-1);
    expect(dir.normal.y).toBeCloseTo(0);
  });

  it('computes diagonal line direction', () => {
    const dir = lineDirection({ x: 0, y: 0 }, { x: 100, y: 100 });
    const s = 1 / Math.sqrt(2);
    expect(dir.tangent.x).toBeCloseTo(s);
    expect(dir.tangent.y).toBeCloseTo(s);
    // Normal is perpendicular
    const dot = dir.tangent.x * dir.normal.x + dir.tangent.y * dir.normal.y;
    expect(dot).toBeCloseTo(0);
  });
});

describe('pathDirectionAt', () => {
  it('returns direction of first segment at t=0', () => {
    const points = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
    const dir = pathDirectionAt(points, 0);
    expect(dir.tangent.x).toBeCloseTo(1);
    expect(dir.tangent.y).toBeCloseTo(0);
  });

  it('returns direction of segment containing midpoint', () => {
    // Two equal-length segments: horizontal then vertical
    const points = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
    const dir = pathDirectionAt(points, 0.75);
    // At 75%, we're in the second (vertical) segment
    expect(dir.tangent.x).toBeCloseTo(0);
    expect(dir.tangent.y).toBeCloseTo(1);
  });

  it('handles single-point path gracefully', () => {
    const dir = pathDirectionAt([{ x: 50, y: 50 }], 0.5);
    expect(dir.tangent).toBeDefined();
    expect(dir.normal).toBeDefined();
  });
});

describe('bezierDirection', () => {
  it('computes tangent at midpoint of horizontal bezier', () => {
    const p0 = { x: 0, y: 0 };
    const cp = { x: 50, y: -50 }; // control point above
    const p2 = { x: 100, y: 0 };
    const dir = bezierDirection(p0, cp, p2, 0.5);
    // At t=0.5, tangent should be horizontal (symmetric curve)
    expect(dir.tangent.x).toBeCloseTo(1);
    expect(Math.abs(dir.tangent.y)).toBeLessThan(0.01);
  });

  it('normal is perpendicular to tangent', () => {
    const dir = bezierDirection(
      { x: 0, y: 0 },
      { x: 50, y: -30 },
      { x: 100, y: 20 },
      0.5,
    );
    const dot = dir.tangent.x * dir.normal.x + dir.tangent.y * dir.normal.y;
    expect(dot).toBeCloseTo(0);
  });
});
