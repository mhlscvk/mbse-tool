# Diagram Render Backlog

Tracking known frontend rendering bugs that aren't conformance issues with
the SysML v2 transformer pipeline (those live in
`state_machine_conformance_audit.md`). Items here are React/Sprotty state-
management or interaction concerns — fixed in the web-client, not the
diagram-service.

## Bug-RENDER-01 — Stale render artifacts on model switch

**Observed:** 2026-05-22, switching from `TestStates.sysml` to
`SensorSystem.sysml` in the same browser session left a few edges/labels
from the previous model visible on top of the new one. Hard refresh
clears it.

**Hypothesis:** the diagram-client React state retains the prior
`SModelRoot`; when the next `sendText` response arrives, the new model
merges into the existing component state instead of replacing it
cleanly, so leftover edge/label children survive until the component
unmounts.

**Triage:** Medium. Annoyance only; no data loss; reproducible workaround
is a hard refresh.

**Plan:** Defer to Phase 1.1 or sooner if a user reports it. Not part of
the state-machine conformance audit (different category — render
lifecycle bug, not transformer correctness).
