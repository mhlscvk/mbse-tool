# ADR-001: Discriminated Union IR for Diagram Rendering

- Status: Accepted
- Date: 2026-05-15

## Context and Problem Statement

The diagram renderer refactor (`renderer_refactor_strategy_v2.md`) splits a
single generic transformer into per-view transformer + renderer pairs. Each
view (state machine, BDD, IBD, requirement, action, use-case) consumes a
materially different set of node and edge shapes:

- A state machine has pseudo-states (initial/final/choice/junction) with no
  name, and transitions whose label is a structured `{ trigger, guard, effect,
  modifier }`, not a string.
- A BDD has parts, attributes, and generalization arrows.
- An IBD has ports with directionality and item flows.

Phase 0 needs to introduce an Intermediate Representation (IR) between the
view-specific transformers and the renderers. The shape question: should the
IR be **one open type** carrying an opaque metadata bag, or **a discriminated
union** where each view variant is its own concrete shape?

The bugs that triggered this refactor (Bug-SM-01: trigger label rendered as a
qualified package name; missing pseudo-states; lost `accept ... via port`
clause) all stem from the legacy code treating view-specific concerns as
generic strings or generic key-value bags. We have a chance to make those
classes of bug unrepresentable.

## Considered Options

1. **Discriminated union.** `DiagramIR = StateMachineIR | BlockDefinitionIR |
   ...` each with its own node/edge types and a `viewType` tag. Per-view
   transformers and renderers operate on their concrete type; a `switch`
   on `viewType` narrows for shared call sites.

2. **Single open IR + metadata bag.** One `DiagramIR { nodes: IRNode[];
   edges: IREdge[]; meta: Record<string, unknown> }` where view-specific
   information lives in `node.meta.transitionTrigger`, etc.

3. **Inheritance hierarchy.** Abstract base `IRNode` extended by
   `StateMachineNode`, `BDDNode`, etc., consumed polymorphically.

## Decision

**Option 1 — Discriminated union, one IR variant per view.**

```typescript
export type DiagramIR =
  | StateMachineIR
  // | BlockDefinitionIR  (Phase 2)
  // | InternalBlockIR    (Phase 3)
  // ...

export type DiagramViewType = DiagramIR['viewType'];
```

Each variant is a closed shape: `StateMachineIR` has `StateMachineNode` and
`TransitionEdge`, and `TransitionEdge.label` is a `TransitionLabel` object,
never a free-form string.

The IR module lives in `packages/shared-types/src/diagram-ir/` so both
`diagram-service` (producer) and `web-client` (eventual consumer) see the
same types.

## Consequences

**Positive.**

- Bug-SM-01 is unrepresentable: `TransitionLabel.trigger` is `string`, but it
  is set by a single transformer pathway that extracts the unqualified name
  from the AST — there is no path from "package qualified name" to this
  field unless someone deliberately writes it.
- Exhaustiveness checking: a future shared helper that takes `DiagramIR` and
  does `switch (ir.viewType)` is checked by the TS compiler; adding a new
  view variant in Phase 2+ surfaces every site that needs to handle it.
- Per-view code is co-located with its types. `state-machine.ts` defines
  both the IR shape and (eventually) the renderer that consumes it.
- IR snapshot tests are concrete: `expected-ir.json` is a known shape, not a
  bag of `meta` keys whose schema drifts.

**Negative.**

- Code shared across views (e.g. layout adapters, semantic-ref helpers) needs
  to be generic over the union or accept a base subset (`{ nodes, edges,
  metadata }`). For now we keep shared code minimal; if pressure grows we
  can introduce a `BaseIR` interface that every variant extends without
  losing the discriminated tag.
- Adding a view variant requires editing the union in `diagram-ir/index.ts`.
  This is the friction we want — a new variant is an explicit architectural
  step, not a free-form `meta.somethingNew`.

**Neutral.**

- Bundle impact is minimal because IR types are erased at runtime; only the
  identifiers in concrete object literals remain.

## Notes

- Layout positions (`position?: IRPosition`) are deliberately optional and
  set by the layout step after transformer output, so the same IR can be
  carried before and after layout without two separate types.
- `IRSemanticRef.astNodeId` is the upstream `SysMLNode.id` from the parser
  (deterministic `${prefix}__${sanitizedName}`); this is verified stable
  across re-parses in precondition 6 of the Phase 0 brief.
