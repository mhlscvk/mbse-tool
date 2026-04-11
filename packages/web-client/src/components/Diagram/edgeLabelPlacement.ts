/**
 * Edge Label Placement Engine
 *
 * Deterministic, candidate-based label placement that:
 * 1. Computes an anchor point and local direction per edge
 * 2. Generates candidate positions using perpendicular offsets
 * 3. Places labels greedily, picking the first non-colliding candidate
 * 4. Falls back to alternating lane offsets for dense clusters
 *
 * Pure function — no React or DOM dependencies.
 */

// ── Types ────────────────────────────────────────────────────────────

export interface EdgeLabelInput {
  id: string;          // edge id
  text: string;        // label text
  anchor: { x: number; y: number };   // midpoint on edge
  tangent: { x: number; y: number };  // unit tangent at anchor
  normal: { x: number; y: number };   // unit normal (perpendicular, left side)
}

export interface PlacedLabel {
  id: string;
  x: number;           // center X of label
  y: number;           // baseline Y of label text
  w: number;           // width of background rect
  h: number;           // height of background rect
}

export interface ObstacleRect {
  x: number; y: number; w: number; h: number;
}

// ── Constants ────────────────────────────────────────────────────────

const LABEL_H = 14;
const LABEL_PAD = 8;        // horizontal padding added to text width
const CHAR_W = 6.4;         // approximate width per character at fontSize=10
const COLLISION_PAD = 1;    // padding around labels for collision checks
const MAX_OFFSET = 80;      // maximum distance from edge anchor

/**
 * Generate candidate offsets: (normalDist, tangentDist) pairs.
 * Strategy: start right on the line (0 offset), then expand outward
 * in small steps with tangent shifts for dense clusters.
 */
function generateCandidates(): [number, number][] {
  const candidates: [number, number][] = [];
  // Offset labels enough to clear the edge line (1.5px stroke + 10px text height).
  // 12px perpendicular clears the line without a background rect.
  const normalSteps = [-12, 12, -20, 20, -30, 30, -40, 40, -52, 52];
  const tangentSteps = [0, 30, -30, 60, -60];

  for (const nDist of normalSteps) {
    for (const tDist of tangentSteps) {
      candidates.push([nDist, tDist]);
    }
  }
  return candidates;
}

const CANDIDATES = generateCandidates();

// ── Geometry helpers ─────────────────────────────────────────────────

function labelWidth(text: string): number {
  return text.length * CHAR_W + LABEL_PAD;
}

/** AABB for a placed label (top-left origin rect) */
function labelBBox(x: number, y: number, w: number, h: number) {
  return {
    left: x - w / 2 - COLLISION_PAD,
    right: x + w / 2 + COLLISION_PAD,
    top: y - h - COLLISION_PAD,        // rect sits above baseline y
    bottom: y + COLLISION_PAD,
  };
}

function bboxOverlaps(
  a: { left: number; right: number; top: number; bottom: number },
  b: { left: number; right: number; top: number; bottom: number },
): boolean {
  return a.right > b.left && b.right > a.left && a.bottom > b.top && b.bottom > a.top;
}

function obstacleBBox(o: ObstacleRect) {
  return { left: o.x, right: o.x + o.w, top: o.y, bottom: o.y + o.h };
}

// ── Main placement function ──────────────────────────────────────────

export function placeEdgeLabels(
  inputs: EdgeLabelInput[],
  obstacles: ObstacleRect[] = [],
): PlacedLabel[] {
  const placed: PlacedLabel[] = [];
  const placedBoxes: { left: number; right: number; top: number; bottom: number }[] = [];
  const obstacleBBoxes = obstacles.map(obstacleBBox);

  // Sort by Y then X for deterministic top-to-bottom, left-to-right ordering
  const sorted = [...inputs].sort((a, b) => a.anchor.y - b.anchor.y || a.anchor.x - b.anchor.x);

  for (const input of sorted) {
    const w = labelWidth(input.text);
    const h = LABEL_H;
    const { anchor, normal, tangent } = input;

    let bestX = anchor.x;
    let bestY = anchor.y - 4; // default: slightly above the anchor
    let foundFree = false;

    // Try each candidate offset position
    for (const [normalDist, tangentDist] of CANDIDATES) {
      const cx = anchor.x + normal.x * normalDist + tangent.x * tangentDist;
      const cy = anchor.y + normal.y * normalDist + tangent.y * tangentDist - 4;

      // Check: don't drift too far from the anchor
      const dist = Math.hypot(cx - anchor.x, cy - anchor.y);
      if (dist > MAX_OFFSET + 20) continue;

      const box = labelBBox(cx, cy, w, h);

      // Check against already-placed labels
      let collides = false;
      for (const pb of placedBoxes) {
        if (bboxOverlaps(box, pb)) { collides = true; break; }
      }
      if (collides) continue;

      // Check against node obstacles
      for (const ob of obstacleBBoxes) {
        if (bboxOverlaps(box, ob)) { collides = true; break; }
      }
      if (collides) continue;

      bestX = cx;
      bestY = cy;
      foundFree = true;
      break;
    }

    // If no candidate was free, use alternating lane pattern based on placement index
    if (!foundFree) {
      const laneIndex = placed.length;
      const laneSign = laneIndex % 2 === 0 ? -1 : 1;
      const laneDist = 12 + Math.floor(laneIndex / 2) * 16;
      bestX = anchor.x + normal.x * laneSign * laneDist + tangent.x * (laneIndex % 3) * 15;
      bestY = anchor.y + normal.y * laneSign * laneDist + tangent.y * (laneIndex % 3) * 15 - 4;
    }

    const result: PlacedLabel = { id: input.id, x: bestX, y: bestY, w, h };
    placed.push(result);
    placedBoxes.push(labelBBox(bestX, bestY, w, h));
  }

  return placed;
}

// ── Edge direction helpers (used by the caller) ──────────────────────

/** Compute tangent and normal vectors at a point on a polyline path */
export function pathDirectionAt(
  points: { x: number; y: number }[],
  t: number,
): { tangent: { x: number; y: number }; normal: { x: number; y: number } } {
  if (points.length < 2) return { tangent: { x: 1, y: 0 }, normal: { x: 0, y: -1 } };

  // Find the segment at fraction t of total length
  const cumLen = [0];
  for (let i = 1; i < points.length; i++) {
    cumLen.push(cumLen[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  }
  const totalLen = cumLen[cumLen.length - 1];
  if (totalLen === 0) return { tangent: { x: 1, y: 0 }, normal: { x: 0, y: -1 } };

  const targetLen = t * totalLen;
  let segIdx = 0;
  for (let i = 1; i < points.length; i++) {
    if (cumLen[i] >= targetLen) { segIdx = i - 1; break; }
    segIdx = i - 1;
  }

  const dx = points[segIdx + 1].x - points[segIdx].x;
  const dy = points[segIdx + 1].y - points[segIdx].y;
  const len = Math.hypot(dx, dy) || 1;
  const tx = dx / len;
  const ty = dy / len;
  // Normal is perpendicular (rotated -90°: right-hand side of direction)
  return { tangent: { x: tx, y: ty }, normal: { x: -ty, y: tx } };
}

/** Compute tangent and normal for a straight line between two points */
export function lineDirection(
  src: { x: number; y: number },
  tgt: { x: number; y: number },
): { tangent: { x: number; y: number }; normal: { x: number; y: number } } {
  const dx = tgt.x - src.x;
  const dy = tgt.y - src.y;
  const len = Math.hypot(dx, dy) || 1;
  const tx = dx / len;
  const ty = dy / len;
  return { tangent: { x: tx, y: ty }, normal: { x: -ty, y: tx } };
}

/** Compute tangent and normal for a quadratic bezier at parameter t */
export function bezierDirection(
  p0: { x: number; y: number },
  cp: { x: number; y: number },
  p2: { x: number; y: number },
  t: number,
): { tangent: { x: number; y: number }; normal: { x: number; y: number } } {
  // Derivative of quadratic bezier: B'(t) = 2(1-t)(cp-p0) + 2t(p2-cp)
  const u = 1 - t;
  const dx = 2 * u * (cp.x - p0.x) + 2 * t * (p2.x - cp.x);
  const dy = 2 * u * (cp.y - p0.y) + 2 * t * (p2.y - cp.y);
  const len = Math.hypot(dx, dy) || 1;
  const tx = dx / len;
  const ty = dy / len;
  return { tangent: { x: tx, y: ty }, normal: { x: -ty, y: tx } };
}
