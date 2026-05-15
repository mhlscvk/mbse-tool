# ADR-004: Three-Layer Verification for Renderer Output

- Status: Accepted
- Date: 2026-05-15

## Context and Problem Statement

Every Phase 1+ renderer commit changes a transformer or a downstream
shaping step. Without a verification strategy that catches regressions
fast, the refactor risks re-introducing the very bugs (wrong trigger
labels, dropped pseudo-states) that motivated it.

There are at least three kinds of regression we care about:

1. **Internal model regressions.** The transformer produces an IR with the
   wrong shape — say, a `TransitionLabel.trigger` that contains the
   package-qualified name. Catchable from the IR alone; doesn't need to
   reach the renderer or the screen.
2. **Wire-format regressions.** The renderer produces a structurally
   wrong SModelRoot — e.g. a node missing an edge target, a label tied to
   the wrong parent. Catchable from the SModelRoot; doesn't need a
   pixel-accurate image.
3. **Visual / semantic regressions.** The on-screen result no longer
   resembles what the Pilot Implementation produces. Hard to catch
   programmatically because Pilot doesn't emit IR or SModelRoot — only
   PNG/SVG via PlantUML. A reviewer has to look.

A single test layer can only do one of these well. We need a layered
strategy where each layer catches its own class of regression with the
cheapest test it can support.

## Considered Options

1. **SVG snapshot only.** Render to SVG, diff bytes. Catches everything
   in theory but every floating-point difference is a false positive, and
   most failures are unactionable ("something moved 0.3 px"). Worst signal
   for debugging.

2. **Visual diff (jest-image-snapshot).** Render to PNG, compare with
   tolerance. Catches semantic shifts but tooling-heavy and still
   misses internal IR regressions that happen to layout identically.

3. **Three layers, each catching its own class.** IR snapshot
   (transformer correctness) → wire-format snapshot (renderer
   correctness) → manual reference (visual / semantic conformance).
   Each layer fails for a specific reason; the failing layer points the
   reviewer at the broken stage.

## Decision

**Option 3 — three layers, with the boundaries from the Phase 0 brief
adapted to the v3.1 ViewRenderer contract.**

### Layer 1 — IR snapshot (CI, automatic)

Each fixture has an `expected-ir.json`. The test parses the SysML,
registers the renderer, calls `transformAstToIR`, and asserts
`expect(ir).toEqual(fixture.expectedIR)`. JSON equality; no normalisation
needed because the IR is fully deterministic.

A diff here points the reviewer at the transformer.

### Layer 2 — SModelRoot snapshot (CI, automatic)

Each fixture has an `expected-smodel.json`. Same loop, but asserts on the
`toSModelRoot(ir)` output.

A diff here points the reviewer at the toSModelRoot stage — IR is fine,
the wire format produced from it is not.

**Adaptation from brief §7.** The brief named this layer "SVG snapshot"
with a `normalizeSVG` helper to absorb floating-point noise. The v3.1
`ViewRenderer` interface produces SModelRoot, not SVG (layout is still
client-side), so the snapshot target shifted accordingly. SModelRoot
has no float coordinates at this stage, so byte-level JSON comparison
works without normalisation. If a phase ever introduces server-side SVG
rendering, the normaliser can be added then.

### Layer 3 — Manual reference holder (not in CI)

Each fixture has a `reference/` directory with:

- `pilot-screenshot.png` — Pilot Implementation's render of the same
  model, captured manually.
- (optional) `syson-screenshot.png` — Eclipse SysON's render, for cross-
  reference.
- `notes.md` — manual review log: which audit items the current
  snapshots satisfy, who reviewed when, what's still open.

When a Phase N PR updates `expected-ir.json` or `expected-smodel.json`,
the reviewer compares the new render against the screenshots in
`reference/` and the audit checklist, then appends an entry to
`notes.md` recording the review.

CI does not look at `reference/`. The manual layer is a discipline, not
an automated gate.

## Consequences

**Positive.**

- A failure tells the reviewer which stage broke. "IR diff" means
  transformer; "SModelRoot diff" means rendering; "manual disagreement
  with `pilot-screenshot.png`" means semantic drift that the automated
  layers didn't catch (often a missing test fixture).
- The Phase 0 brief's "10 fixture per view" acceptance criterion becomes
  concrete — 10 fixtures' worth of paired `expected-ir.json` +
  `expected-smodel.json` files. Manual review is per-fixture and
  documented.
- Pilot's lack of an IR export becomes a non-blocker: we use Pilot as
  authoritative reference for the manual layer only.

**Negative.**

- Two snapshot files per fixture per phase is more bookkeeping than a
  single SVG. Mitigated by the fact that updates are usually correlated
  (transformer change → both files refresh); Vitest's update flag
  refreshes both in one run.
- Manual review requires reviewer discipline. We accept this: the
  refactor's whole motivation is that automated equality with the legacy
  pipeline isn't the goal — semantic conformance with the spec/Pilot is.

**Neutral.**

- The IR layer makes per-stage regression diagnosis cheap. A future
  optimisation (memoise toSModelRoot, swap layout engine, etc.) is
  easier to verify because each stage has its own fixture.

## Notes

- `tests/fixtures/state-machine/empty/` is the Phase 0 reference for the
  shape; it documents the fixture format and exercises the
  loader-registry-renderer loop end to end.
- `tests/fixtures/state-machine/sensor-systems/` is the Phase 1 target,
  scaffolded but empty.
