# ADR-005: State Machine Renderer Design (Phase 1)

- Status: Accepted
- Date: 2026-05-21

## Context and Problem Statement

Phase 1 of the renderer refactor implements the first real `ViewRenderer`
using the foundation from Phase 0 (discriminated-union IR, view registry,
hierarchical feature flags, wedge). The target is the state-machine view,
chosen because the conformance audit
(`claude_md_files/state_machine_conformance_audit.md`) catalogues 10
spec-conformance bugs against the legacy `transformToBDD` pipeline.

Three architectural questions surfaced during the brief revision (v1 → v1.1)
that the strategy and Phase 0 ADRs do not answer, plus a fourth that
emerged from the pre-implementation walkthrough:

1. **Where does translation of structural labels happen** (entry/do/exit,
   via, [guard], / effect)? In the renderer (server-side) or in the
   frontend? The strategy says "renderer calls `tr()`" — but the renderer
   runs in `diagram-service`, which has no i18n integration today and no
   user-locale propagation over the WebSocket protocol.
2. **How is the new pipeline rolled out** — flag-default-true on landing,
   or flag-default-false with a per-user dogfooding toggle?
3. **What scope of audit bugs does Phase 1 commit to** — P0 only (the
   minimum), or P0+P1+P2 (the full set)?
4. **Where does Bug-SM-01 actually need to be fixed?** The audit
   hypothesised the transformer was using qualified names; the
   pre-implementation grep showed the parser regex (`\w+`) truncates
   `ItemDefs::PowerOn` to `ItemDefs` and drops the trigger name entirely.
   The fix sits in the parser, not the transformer.

Each of these has a default chosen by the architect; this ADR records the
choices and the alternatives so future phases can revisit them with
context.

## Considered Options and Decisions

### Decision 1 — Translation policy: SysML v2 syntax preserved verbatim

> **Amended 2026-05-22.** v1.1 originally chose "IR carries i18n keys,
> frontend translates" (Option B below). v1.2 supersedes that choice:
> SysML v2 syntax is a language standard, not UI copy. The labelText
> helper and the SLabel `data.i18nKey` field added in Slice 1 prep stay
> in place — they are now reserved for **future UI labels around the
> diagram**, not for syntax elements like `entry /` or `via`.

**Options considered:**

- **A — Server-side mini i18n.** Add a tiny en/tr table to diagram-service,
  pass `locale` in the WebSocket request, look up structural strings in the
  renderer. Renderer emits `text: "Giriş /"` or `text: "entry /"` based on
  locale.
- **B — IR symbolic, client translates.** SLabel carries
  `data.i18nKey: 'state_machine.compartment_entry'`. DiagramViewer
  resolves at render time via the existing react-i18next setup.
- **C — SysML v2 syntax preserved verbatim.** Renderer emits the
  language's keywords (`entry /`, `via`, `[guard]`, `/ effect`) directly
  as `SLabel.text`. The frontend never translates them. Only the UI
  chrome around the diagram (Settings labels, tooltips, error toasts)
  flows through `react-i18next`.

**Chosen: C.** SysML v2 is an international language standard, like
TypeScript or SQL. Engineers read its specification in English, and the
user-defined identifiers inside a model are also English. Translating
the syntax tokens but not the names would produce mixed output
(`Giriş / startEngine`) that is harder to read than uniformly English
syntax. This also matches how every comparable tool ships the language
(Eclipse Papyrus, Cameo, the OMG Pilot Implementation): syntax stays in
English.

**Rationale.**

- One canonical SLabel.text per syntax token. No locale fork in
  snapshot fixtures.
- Snapshot equality is straightforward — `expected-smodel.json` and
  `expected-ir.json` carry the literal strings without an indirection
  layer.
- No server-side i18n infrastructure. No locale propagation across the
  WebSocket protocol.
- Forward-compatible: when Phase 2 adds BDD / IBD / requirement
  renderers, their syntax tokens (`block`, `part`, `requirement`,
  binding connectors, …) follow the same rule. Only UI chrome around
  the diagram is ever translated.

**Fallback semantics.** SLabel.text always carries the canonical SysML
v2 string. `data.i18nKey`, when present, is a hint for *future UI
labels* (e.g. a generated "Click to edit" tooltip overlay) that the
frontend `labelText(label)` helper would resolve via `tr()`. For every
state-machine SLabel in Phase 1, `data.i18nKey` is `undefined` and the
helper short-circuits to `text` — the renderer pipeline is byte-identical
to a renderer that doesn't know about i18n.

**Generalised rule for later phases.** SysML v2 keywords, structural
punctuation, and user-defined identifiers are **never** translated.
Only the chrome the platform itself layers on top of a diagram (panel
titles, button labels, validation messages) goes through i18n.

### Decision 2 — Rollout: Dogfooding flag, default false on landing

**Options considered:**

- **A — Flag default true on merge.** New renderer becomes the default
  immediately; users see it as soon as deploy lands. Faster, but every
  edge case lands on users.
- **B — Flag default false + per-user opt-in.** Platform Owner flips a
  per-user flag on their own account first, exercises real models in
  production, opts in beta users, finally flips the global default once
  stable.

**Chosen: B.** Flag default false; per-user toggle from a Settings UI;
global default true is a separate later decision.

**Rationale.** This is the strangler-fig pattern the strategy commits to.
Phase 0 built the hierarchical-flag infrastructure precisely to support
this rollout shape. The fallback path (wedge silently falls back to
legacy if the new renderer throws) means users never see breakage,
only either old or new output.

**Cost.** A 2–3-hour Settings UI piece (FR-PH1-05) lands in Phase 1 to
give the dogfooder a button. Phase 0 deferred this because there was
nothing to flip; Phase 1 makes it useful.

### Decision 3 — Scope: All 10 audit bugs in Phase 1

**Options considered:**

- **A — P0 only (6 bugs).** Minimum spec-conformance. Smaller PR, faster
  to land.
- **B — P0+P1+P2 (10 bugs).** Full audit clearance in one phase. Larger
  PR, more confidence in the new path.

**Chosen: B**, with one escape: **SM-05** (nested action representation,
P2) may be deferred to Phase 1.1 if it proves materially harder than the
audit's "Option A — sub-actions hidden" sketch suggests. The deferral
must be explicit (audit doc updated; reason documented in this ADR's
notes section).

**Rationale.** P1 bugs (SM-06, SM-07, SM-10) are visual-completeness
issues on the same code paths as P0; fixing them at the same time costs
little and avoids a near-immediate Phase 1.1. P2 (SM-05) is genuinely
separable.

### Decision 4 — Bug-SM-01 fix: Parser regex, not transformer

**Options considered:**

- **A — Parser regex widen + transformer splits qualified name.**
  Change one regex in `sysml-text-parser.ts` (`\w+` → `[\w:]+` for the
  accept-trigger group). AST preserves the qualified name in
  `SysMLConnection.name`. The state-machine transformer extracts the
  last `::`-segment when building `TransitionLabel.trigger`.
- **B — Structured AST fields.** Add `triggerRef`, `viaPortRef`,
  `guardExpr`, `effectName` to `SysMLConnection`. Parser populates;
  transformer consumes. Cleaner, but a shared-types schema change and a
  parser refactor.

**Chosen: A.** One regex change, geriye uyumlu (AST shape unchanged,
only `name` field contents widen), one regression test added
(`state.test.ts`).

**Rationale.** Option B is the right long-term answer if other view
types (action-flow, sequence) need similar parsing precision — but
Phase 1 is the wrong sprint to take on a parser refactor. Option A
ships the fix without touching anything outside the parser. Risk
analysis confirmed: the pre-existing tests pass unchanged (391 → 391
before the regression test was added; 392 after).

**When to revisit.** If Phase 2+ surfaces other AST-level parsing
limitations (e.g. action-flow's `send X via Y to Z` needs structured
fields), then Option B becomes the migration target. Until then,
the `split('::').pop()` in the state-machine transformer is the
single source of trigger-name extraction.

### Decision 5 — View-filter integration on the new-renderer path (Slice 2d.2, D-FILTER-01)

**Status:** Accepted, 2026-05-24.

**Context.** Before Slice 2d.2 the wedge handed the *raw* model to the new
renderer, while the legacy `transformToBDD` pipeline called `applyViewFilter`
internally. Filter responsibility was split and the new path did no view
scoping — an asymmetry against the View-First principle (one filter point per
render).

**Options considered:**

- **A — Single call-site.** Move `applyViewFilter` into the wedge *and* remove
  it from `bdd-transformer.ts:616`. Rejected: 59 tests (the
  `view-filters.test.ts` `pipeline()` helper plus several
  `bdd-transformer.*.test.ts` suites and `end-to-end.test.ts`) call
  `transformToBDD` directly and depend on its internal filtering. Deleting line
  616 is a wide-blast-radius refactor and contradicts the standing
  "transformToBDD code must not change" constraint.
- **B — New-path-only filter.** Add `applyViewFilter` before the wedge calls
  `transformAstToIR`; leave `bdd-transformer.ts:616` untouched.
- **C — Idempotent guard.** Filter in the wedge for both paths and make the
  legacy call a no-op on already-filtered input. Rejected: needs filter-state
  bookkeeping or logic duplication; complexity outweighs the benefit.

**Chosen: B (new-path-only filter).** Zero blast radius. The asymmetry is
resolved at the *output* level — both paths now emit a filtered model — while
the duplicate call-site remains as documented technical debt, retired
naturally when the legacy pipeline is removed in Phase 2.

**Visual impact.** On the sensor-systems fixture the filter drops
`pseudo-initial__on` and two edges (`comp__on_to_pseudo_initial`,
`edge__on_initial_to_normal`) at the IR level. The current new renderer does
not yet draw a sub-state initial dot (only the top-level `pseudo-initial__top`
is rendered), so removing it from the IR is a **visual no-op** — confirmed by a
Platform-Owner side-by-side of production (PRE) vs a local patched stack (POST).
Drawing the sub-state initial dot is a separate future slice.

**Multi-root impact.** On `multi-root-part-states` (no entry actions, no
pseudo-states) the filter is a provable no-op; its golden stays byte-identical.

#### Revision — D-FILTER-01 revoked (Phase 2 Slice 5, 2026-05-26)

**Status:** Revoked, 2026-05-26 — supersedes the entry-hide above.

**Decision.** The pseudo-initial (start circle) and the entry action are distinct
SysML concepts and must be shown separately. The Slice 2d.2 entry-hide + start→entry
edge remap are removed.

**Rationale.**
- *Standard conformance.* SysML v2 renders the initial transition and the entry
  action with separate symbols.
- *Semantic clarity.* Initial = "which sub-state the container starts in"; entry
  action = "what runs when the sub-state is entered" — two distinct questions.
- *Consistency.* Sub-states without an entry action already show the start circle;
  adding an entry action should not erase it.

**Evidence (AG repro-script, real prod model `cmolrsqrq002oglb7a41d5fz5`).** The
"sub-state initial not drawn / separate future slice" note above was imprecise: the
renderer *does* emit a startnode SNode; the view-filter's parent-entry-hide was
removing it. Layer-by-layer on the real model: raw IR 2 pseudo-initials → post-filter
0 → SModel 0.

**Affected code (Slice 5).** `view-filters.ts` — the entry-hide block and the
start→entry edge remap are removed; reparent and orphan-prune are untouched. The
start node now keeps its outgoing transition edge, so it has a content neighbour and
survives orphan-prune.

**Test updates.** `end-to-end.test.ts` now asserts the entry-action sub-state's
`pseudo-initial__on` is *kept* in the wedge output (flipped from the 2d.2 "drops"
assertion); the filtered goldens were regenerated (a stale duplicate
`behavior__On_entry_activation` from the old remap was cleaned up). `web-client`
`pseudo-initial.test.tsx` proves DiagramViewer renders a startnode node in the DOM.

**Snapshot strategy (split, not regen).** The filtered output differs from the
raw transformer output, and the existing goldens are the *transformer-isolation*
contract — asserted against the raw model by `transformer.test.ts` and the
direct `end-to-end.test.ts` case. Regenerating the shared goldens would have
broken those raw tests, so the goldens are split by pipeline level instead:

```
expected-ir.json          / expected-smodel.json           raw transformer golden (unchanged)
expected-ir-filtered.json / expected-smodel-filtered.json  filtered wedge golden (Slice 2d.2, new)
```

The flag=true wedge test asserts the filtered SModel; the direct and
transformer tests keep asserting the raw goldens. Each test-pyramid level owns
its own golden, so the transformer unit test never gains a filter dependency.

**When to revisit.** When the legacy `transformToBDD` pipeline is retired
(Phase 2), fold the filter into a single call-site and reconsider whether the
raw goldens are still needed once the transformer-isolation tests move to the
filtered model.

## Consequences

**Positive.**

- The IR remains locale-independent and structurally minimal. Snapshot
  fixtures are reusable across locales and across rendering backends
  (current ELK-on-client, future server-side layout).
- Rollout is reversible. If a bug lands, the dogfooder flips their flag
  off and is back on the legacy path within seconds; no deploy needed.
- The 10-bug scope plus parser fix gives Phase 1 a clear "done" line:
  audit checklist all-green plus the regression test.
- Parser fix is one line of code; future audit doc entries map directly
  to commit hashes.

**Negative.**

- DiagramViewer now has a branch in label rendering (`labelText`
  helper). For Phase 1 it touches two JSX outputs (own + inherited
  compartment rows). Future phases that add state-machine-style
  structural labels in other views will need to thread the same hook
  through additional render paths.
- Bug-SM-01's fix sits in `sysml-text-parser.ts`, not in the
  state-machine renderer's code path. The audit doc tracks this — the
  "Çözüldü" entry for SM-01 must reference both the parser commit and
  the transformer commit.
- The Settings UI feature-flag toggle is wired only for the
  state-machine flag in Phase 1. Phase 2 will need to generalise the
  Settings page section to a list as more flags appear.

**Neutral.**

- The hierarchical-flag provider's per-user layer remains stubbed
  because the WebSocket channel still has no auth context. Phase 1
  ships the toggle UI (writes to `User.featureFlags` via the existing
  `PATCH /me/feature-flags`); per-user resolution at render time gets
  unblocked the day WebSocket auth lands (carried by whichever later
  phase needs it).

## Notes

- Open questions S1–S4 from the brief use defaults captured in Phase 1
  scope: empty exit actions skipped (S1: no compartment), pseudo-state
  encoded as a distinct SNode `cssClass` (S2: chosen during renderer
  implementation), nested actions hidden behind parent name (S3:
  Option A), Settings toggle 2-state (S4: on/off, null on delete).
  Any of these flipping mid-phase should be amended here.
- ADR-005 supersedes the relevant clause of the strategy v2 doc that
  named server-side `tr()`. The strategy will be updated to point at
  this ADR on the next strategy revision.
- The `sensor-systems` fixture is the regression source. Each of the
  10 audit bugs must have a test (per-bug unit test or asserting on
  the fixture's IR/SModelRoot) that documents the bug ID and the
  before/after expectation.

### IR ID convention

A reusable pattern for every per-view IR (state-machine in Phase 1, BDD
in Phase 2, etc.). IR-level IDs are distinct from AST-level IDs; the
AST id lives in `semanticRef.astNodeId` and is the parser's
`${prefix}__${sanitizedName}`. IR ids are designed to be human-readable
and stable across re-parses of the same model:

```
state__<name>                    Bodyless or simple state usage
                                 e.g. state__Off, state__Normal

pseudo-initial__<container>      Initial pseudo-state in a given container
                                 e.g. pseudo-initial__top, pseudo-initial__on

pseudo-final__<container>        Final pseudo-state
                                 e.g. pseudo-final__top

pseudo-choice__<container>__<n>  Choice pseudo-state (multiple per container)
pseudo-junction__<container>__<n>  Junction pseudo-state

edge__<source_id>_to_<target_id>     Transition edge
                                 e.g. edge__off_to_on
```

**Collision rule.** If two states in different containers share a name
(`state__Foo` declared in both On and Error), append the container suffix:
`state__Foo__on`, `state__Foo__error`. The transformer detects collision
at IR-build time and applies the suffix uniformly to all colliding
instances (not just the second one).

**Edge collision rule.** If two transitions share both endpoints
(e.g. `Error → Off` exists twice in the model — once triggered, once
not), append a discriminator: `edge__error_to_off_notrigger`,
`edge__error_to_off_poweroff`. The discriminator is derived from the
transition's trigger name or `_anonN` if no trigger.

**Phase 2+.** When BDD/IBD/requirement renderers land, they reuse the
same prefix-double-underscore-name pattern (`block__<name>`,
`port__<name>`, etc.) so a single mental model carries across views.

### Edge order in IR

Snapshot fixtures (`expected-ir.json`) compare `edges` array by JSON
equality, so order matters. The transformer must emit edges in AST
source order (the order their `transition` keyword appears in the
parsed source file), with deterministic tie-break inside each line:
source-id alphabetical then target-id alphabetical when two transitions
share a source line.

This gives reviewers a stable, scannable list (read top-to-bottom of
the model and the IR side-by-side) and avoids semantic-vs-source-order
disagreements like the one surfaced in S5.

### Decisions deferred to implementation

The conformance audit's "Şüpheli Noktalar — Pilot Implementation
Doğrulaması Gerekli" section lists five open interpretation points where
the SysML v2 spec is ambiguous against UML conventions. None block
Phase 1 implementation but each will surface a small design choice in
the transformer or renderer code; the choice should be made there with
a one-line comment in the code referring back to this section. If a
choice turns out to be wrong against the Pilot Implementation
reference, update both the code and this ADR.

1. **`via <port>` label format.** Single line (`PowerOn via sensor2Platform`)
   versus two lines, italic versus plain. Phase 1 default: single line,
   non-italic, raw SLabel.text (no i18n on `via` as it is SysML v2
   syntax, not UI copy).
2. **Composite action display inside a compartment.** Name-only versus
   expanded contents versus link to a separate action diagram. Phase 1
   uses S3-default Option A (name only) per the brief. If Pilot turns
   out to expand the contents inline, revisit.
3. **Empty `exit action ;`.** Compartment hidden versus shown empty.
   Phase 1 uses S1-default (hidden). Worth a visual cross-check against
   Pilot before flipping the global default.
4. **Stereotype prefix on compartment labels.** `«entry»` versus `entry /`
   versus `entry:`. Phase 1 uses `entry /` (UML-default slash notation,
   matches the legacy renderer's existing convention).
5. **Pseudo-state geometric position.** ELK-decided versus heuristic
   (top-center for initial, bottom-center for final). Phase 1 lets ELK
   decide; if layout consistently puts the initial dot in an awkward
   place, add a layered-priority hint at renderer level.
6. **AST node ID stability for `semanticRef.astNodeId`.** The parser's
   anonymous transitions are keyed by source offset
   (`transition__anon_${offset}`), which makes the ID source-text-fragile
   — adding a comment near the top of a model shifts every transition ID
   below it. The IR carries `semanticRef.astNodeId` for traceability
   back to the AST node (debugger jump-to-source, hover tooltips), but
   that field MUST NOT participate in snapshot equality in transformer
   tests. Phase 1 default: snapshot helpers normalize or exclude
   `astNodeId` (e.g. custom matcher, or `'<any>'` placeholder in
   `expected-ir.json` if the value is structurally meaningful, plain
   omission if it is purely a back-reference). The IR's own `id` field
   (`state__Off`, `edge__error_to_off_poweroff`) remains the stable
   contract that tests assert against. If parser IDs later gain a
   stable scheme for anonymous transitions (e.g. hash of src+tgt+label),
   this deferral closes naturally.
