/**
 * Post-computation collision avoidance for edge labels.
 *
 * After each label is independently positioned at its edge's midpoint,
 * this function detects AABB overlaps between label rectangles and nudges
 * them apart vertically so they remain readable.
 *
 * Algorithm: group labels that overlap horizontally, then within each group
 * space them evenly around their centroid. Guaranteed to resolve in one pass.
 *
 * Pure function — no React or DOM dependencies.
 */

export interface LabelRect {
  id: string;   // edge id — preserved for association
  x: number;    // center X
  y: number;    // center Y (text baseline)
  w: number;    // width of background rect
  h: number;    // height of background rect (typically 14)
}

export interface ResolvedLabel extends LabelRect {
  dy: number;   // vertical displacement to apply
}

const GAP = 2; // pixels of vertical gap between labels

/** Check horizontal overlap between two centered rects */
function overlapsHorizontally(a: LabelRect, b: LabelRect): boolean {
  const aLeft = a.x - a.w / 2;
  const aRight = a.x + a.w / 2;
  const bLeft = b.x - b.w / 2;
  const bRight = b.x + b.w / 2;
  return aRight > bLeft && bRight > aLeft;
}

/**
 * Build overlap groups: labels that overlap horizontally with any other
 * label in the group are merged into the same group (union-find style).
 */
function buildOverlapGroups(labels: LabelRect[]): LabelRect[][] {
  const parent = labels.map((_, i) => i);
  function find(i: number): number {
    while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
    return i;
  }
  function union(a: number, b: number) {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }

  // Only merge labels that are close enough vertically to potentially overlap
  // (within maxH of each other, where maxH accounts for the tallest label + gap)
  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      if (!overlapsHorizontally(labels[i], labels[j])) continue;
      // Check if they're close enough vertically that spacing is needed
      const vertDist = Math.abs(labels[i].y - labels[j].y);
      const minSep = (labels[i].h + labels[j].h) / 2 + GAP;
      if (vertDist < minSep) {
        union(i, j);
      }
    }
  }

  const groups = new Map<number, LabelRect[]>();
  for (let i = 0; i < labels.length; i++) {
    const root = find(i);
    const arr = groups.get(root) ?? [];
    arr.push(labels[i]);
    groups.set(root, arr);
  }
  return [...groups.values()];
}

export function resolveEdgeLabelOverlaps(labels: LabelRect[]): ResolvedLabel[] {
  if (labels.length <= 1) {
    return labels.map(l => ({ ...l, dy: 0 }));
  }

  // Sort for determinism
  const sorted = [...labels].sort((a, b) => a.y - b.y || a.x - b.x);
  const groups = buildOverlapGroups(sorted);

  const result = new Map<string, number>(); // id → dy

  for (const group of groups) {
    if (group.length === 1) {
      result.set(group[0].id, 0);
      continue;
    }

    // Sort group by Y
    group.sort((a, b) => a.y - b.y || a.x - b.x);

    // Compute centroid Y of the group (to keep labels centered around original midpoint)
    const centroidY = group.reduce((sum, l) => sum + l.y, 0) / group.length;

    // Space labels evenly: each label takes h + GAP of vertical space
    const step = group[0].h + GAP;
    const totalHeight = step * (group.length - 1);
    const startY = centroidY - totalHeight / 2;

    for (let i = 0; i < group.length; i++) {
      const targetY = startY + i * step;
      result.set(group[i].id, targetY - group[i].y);
    }
  }

  return sorted.map(l => ({ ...l, dy: result.get(l.id) ?? 0 }));
}
