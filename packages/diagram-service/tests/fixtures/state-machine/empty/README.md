# `empty` Fixture — Infrastructure Smoke Test

**Purpose:** Verify that the Phase 0 infrastructure works end to end — the
fixture loader can read files, the IR snapshot framework can compare a JSON
blob, and the no-op renderer can be wired through the registry. This fixture
does **not** test correctness of any actual state-machine rendering; that is
`sensor-systems/`'s job in Phase 1.

## Contents

- `model.sysml` — the minimal SysML v2 input the parser will accept. A
  bare `package Empty {}` declaration: parses cleanly, produces a model with
  zero nodes, and naturally exercises the "view filter yields nothing"
  branch of every transformer/renderer pair.

- `expected-ir.json` — the IR shape the no-op state-machine renderer
  produces for any input. Constant; useful as a sanity check that
  serialisation, snapshot diffing, and the `viewType: 'state-machine'`
  discriminant are wired correctly.

- `expected-smodel.json` — the SModelRoot the no-op renderer's
  `toSModelRoot()` returns. Adapted from brief §7's `expected.svg`: the
  v3.1 `ViewRenderer` interface produces SModelRoot (the wire format), not
  SVG, because layout still happens client-side. Snapshot comparison is
  byte-level on the JSON; no `normalizeSVG` needed because SModelRoot has
  no floating-point coordinates at this stage.

## What this fixture proves

When `pipeline.test.ts`'s smoke case passes:

1. The fixture loader can find and read files relative to the test cwd.
2. The no-op renderer can be registered as a `state-machine` view.
3. `transformAstToIR(emptyModel, ...)` returns the shape in `expected-ir.json`.
4. `toSModelRoot(emptyIR)` returns the shape in `expected-smodel.json`.
5. JSON snapshot equality works end to end.

## What this fixture does NOT prove

- Parser correctness for any non-trivial input — `package Empty {}` is the
  smallest acceptable program.
- That the real Phase 1 renderer produces sensible IR for actual state
  machines — that comes from `sensor-systems/` once it is populated.
- That `_meta.rendererUsed` propagates correctly — covered by
  `pipeline.test.ts`'s bypass matrix.
