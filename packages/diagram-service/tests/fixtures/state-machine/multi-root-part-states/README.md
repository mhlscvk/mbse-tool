# `multi-root-part-states` Fixture — Slice 2d.1 Hotfix

Anonymized regression fixture for the Slice 2d crash:

```
TypeError: Cannot set properties of undefined (setting 'compartments')
    at transformAstToStateMachineIR
```

## Why this fixture exists

The original `sensor-systems` fixture models its state machine as a
standalone `state def SensorSystemStates` (a `StateDefinition`). The
transformer seeded `emitContainer` only from `model.nodes.find(isStateDef)`,
so that fixture always passed.

Real-world SysML v2 models (MagicGrid style) instead nest a `state` **usage**
inside a `part` hierarchy, with **no `StateDefinition`**. With `StateDefinition = 0`
the seed never ran, the IR stayed empty, and the compartment / containment
passes dereferenced `undefined`. This fixture captures that pattern so it
can never regress.

## Structure (anonymized — no domain IP)

- `package SystemAlpha` → `part def UnitContext` → `part unit`
- Two **independent** state machines as `state` usages inside `unit`
  (the multi-root case):
  - `ModeAlpha` — composite: `Idle`, `Active` (with entry/do/exit actions
    and nested `Running` / `Paused` substates + 2 transitions) + 2 transitions
  - `ModeBeta` — flat: `Open`, `Closed` + 2 transitions

## AST stats (parser output, for reviewer reference)

- `StateDefinition: 0`, `StateUsage: 8`
  (ModeAlpha, ModeBeta, Idle, Active, Running, Paused, Open, Closed)
- `EntryActionUsage / DoActionUsage / ExitActionUsage: 1` each (on `Active`)
- transitions: 6 · compositions: 13 · **parse diagnostics: 0**
- After `applyViewFilter(model, 'state-transition')`: the `part def` and
  `part` are filtered out and `ModeAlpha` / `ModeBeta` are **reparented to
  the package** (2 `reparent__` edges) — i.e. they become the two top-level
  roots the transformer must seed from.

## Contents

- `model.sysml` — the fixture (this is the source of truth).
- `expected-ir.json` — generated from the transformer once multi-root
  seeding lands (Slice 2d.1 Step 3); `astNodeId` is excluded from snapshot
  equality (source-text-fragile, per ADR-005).
- `expected-smodel.json` — `toSModelRoot` output for the same IR.
