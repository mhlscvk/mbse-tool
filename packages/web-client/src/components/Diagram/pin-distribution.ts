// Pin distribution along a parent boundary (Slice 6b W3' — K2.2 fix).
//
// ELK lays out boundary pins (ports / action params) as ordinary interior
// children with no anti-collision guarantee, so several pins of the same parent
// could land on the same coordinate and snap to the same boundary point
// (coincident ports → coincident edges). DiagramViewer groups pins by
// (parent, side) and runs their along-axis centre coordinates through this
// function to guarantee a minimum centre-to-centre gap.
//
// Properties (relied on for regression safety across all views):
//   • Order-preserving — the sorted order of inputs is preserved.
//   • Identity for already-spaced input — if every adjacent gap is already
//     >= minGap, the output equals the input (no layout shift, so non-colliding
//     views — state-machine / AFV / STV / general — are untouched).
//   • Identity for a single pin — returned unchanged.
//   • Re-centred — the distributed group keeps the original mean, so the fan
//     stays where ELK placed it rather than drifting off the boundary.

export function distributePinCoords(coords: number[], minGap: number): number[] {
  const n = coords.length;
  if (n <= 1) return coords.slice();

  // Resolve a minimum gap in ascending order (greedy forward push). This is the
  // identity when the input is already spaced by >= minGap.
  const order = coords.map((_, i) => i).sort((a, b) => coords[a] - coords[b]);
  const resolved = new Array<number>(n);
  let cur = -Infinity;
  for (const i of order) {
    const v = Math.max(coords[i], cur + minGap);
    resolved[i] = v;
    cur = v;
  }

  // Shift the whole group so its mean matches the original mean (keeps the fan
  // centred on the ELK-intended position; shift === 0 when nothing moved).
  const origMean = coords.reduce((s, c) => s + c, 0) / n;
  const resMean = resolved.reduce((s, c) => s + c, 0) / n;
  const shift = origMean - resMean;
  return resolved.map(v => v + shift);
}
