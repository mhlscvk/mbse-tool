# `sensor-systems` Fixture — Phase 1 Pipeline Correctness

**Status:** scaffolding only. Real content lands with Phase 1.

This is the first fixture that will exercise the actual state-machine
renderer (not the no-op). It mirrors the `SensorSystem` example from the
audit document (`state_machine_conformance_audit.md`), the model that
surfaced the original bugs — wrong trigger labels, dropped `via port`
clauses, missing pseudo-states — that motivated the whole refactor.

## Contents (to be populated in Phase 1)

- `model.sysml` — the SysML v2 SensorSystem model verbatim. Will be
  copied from the audit source.
- `expected-ir.json` — the IR the new state-machine renderer should
  produce. Generated once the renderer exists, hand-reviewed against the
  audit checklist, then frozen as a snapshot.
- `expected-smodel.json` — the SModelRoot the renderer produces from that
  IR (toSModelRoot stage output, byte-stable).
- `reference/pilot-screenshot.png` — Pilot Implementation render of the
  same model, taken manually. Not compared in CI; the reviewer reads
  this alongside `notes.md` when accepting a snapshot update.
- `reference/notes.md` — manual review notes: which audit items the
  current snapshot satisfies, which are still open, who reviewed when.

## Phase 1 acceptance hook

A Phase 1 PR is mergeable once `expected-ir.json` and `expected-smodel.json`
both match a freshly-generated rendering and `notes.md` records a manual
review against the audit checklist.
