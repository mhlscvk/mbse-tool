# Diagram Renderer Architecture

This document describes the renderer architecture introduced by the Phase 0
refactor. It is the orientation reference for anyone (or any agent) opening
this codebase to add or modify diagram rendering behaviour.

The strategic context — why we are refactoring at all — lives in
`claude_md_files/renderer_refactor_strategy_v2.md`. This file documents
*what exists in code today*, not the migration plan.

## One-line summary

A view-specific render pipeline (`AST → IR → SModelRoot`) sits behind a
feature-flag-gated wedge so it can be added per view type without disturbing
the legacy `transformToBDD` pipeline. Until a view-specific renderer is
both registered and flag-enabled, every render still goes through the
legacy pipeline exactly as before.

## Request flow

```
                              ┌───────────────────────────────────────┐
WebSocket → websocket-server  │  pipeline.ts (renderDiagramWedge)     │
  parses or accepts AST ─────▶│  ─────────────────────────────────▶   │
                              │   1. mapToDiagramViewType(legacy)     │
                              │      ↓                                │
                              │   2. flagProvider.isEnabled(...)      │
                              │      ↓                                │
                              │   3. viewRegistry.get(diagramViewType)│
                              │      ↓                                │
                              │   4a. renderer.transformAstToIR(...)  │
                              │       renderer.toSModelRoot(ir)       │
                              │   4b. OR transformToBDD(...) fallback │
                              │      ↓                                │
                              │   5. rendererStats.record(viewType,…) │
                              └───────────────────────────────────────┘
                                          │
                                          ▼
                              DiagramMessage {
                                kind: 'model',
                                model: SModelRoot,
                                diagnostics,
                                viewType,
                                _meta: { rendererUsed }
                              }
                                          │
                                          ▼
                              web-client renders via DiagramViewer
                              (ELK layout still client-side)
```

In Phase 0, step 1 returns `null` for every legacy view (the mapper has
no entries yet), so step 4b always runs. The wedge's job is to be
invisible until Phase 1 introduces the first mapper entry and registers
the first renderer.

## Module layout

```
packages/shared-types/src/
├── diagram-ir/                Discriminated-union IR
│   ├── common.ts                IRMetadata, IRPosition, IRSemanticRef
│   ├── state-machine.ts         StateMachineIR + nodes/edges/labels
│   └── index.ts                 DiagramIR union, DiagramViewType
├── feature-flags.ts           RENDERER_FLAGS, FeatureFlags type
└── diagram.ts                 SModelRoot/SEdge/SNode + DiagramMessage
                               (now includes _meta.rendererUsed)

packages/diagram-service/src/rendering/
├── view-registry.ts           Lazy-loading registry of ViewRenderers
├── view-type-mapper.ts        legacy ViewType → DiagramViewType
├── feature-flags.ts           FlagProvider interface + EnvFlagProvider
├── pipeline.ts                The wedge (makeWedge + renderDiagramWedge)
├── renderer-stats.ts          In-memory counter for observability
├── no-op-renderer.ts          Test-only ViewRenderer scaffolding
└── fixture-loader.ts          Reads fixture/IR/SModelRoot triples

packages/diagram-service/src/websocket-server.ts
                               Calls renderDiagramWedge instead of
                               transformToBDD directly; attaches _meta
                               to outgoing model messages.

packages/diagram-service/tests/fixtures/state-machine/
├── empty/                     Infrastructure smoke fixture
└── sensor-systems/            Phase 1 target (scaffolding only)

packages/api-server/src/
├── services/feature-flags-service.ts
│                              FeatureFlagsService (Zod schemas, the
│                              null-as-delete merge logic). DB read/write
│                              boundary for User.featureFlags.
└── routes/
    ├── users.ts               GET/PATCH /me/feature-flags
    └── admin.ts               GET /renderer-stats (proxies internal)

packages/api-server/prisma/
└── migrations/20260515200000_add_user_feature_flags/
    └── migration.sql          ALTER TABLE users ADD COLUMN featureFlags JSONB
```

## Key types

**`DiagramIR`** (`shared-types/diagram-ir/index.ts`).
Discriminated union over per-view IR variants. Phase 0 has only
`StateMachineIR`; Phase 2+ extend the union.

**`ViewRenderer<IR>`** (`diagram-service/rendering/view-registry.ts`).
The contract every renderer implements:

```typescript
interface ViewRenderer<IR extends DiagramIR = DiagramIR> {
  readonly viewType: IR['viewType'];
  transformAstToIR(model: SysMLModel, viewSpec: ViewSpec): IR;
  toSModelRoot(ir: IR): SModelRoot;
}
```

Two methods, deliberately. No `layoutIR` because layout happens
client-side (`DiagramViewer.tsx` calls ELK on the browser side after
receiving the SModelRoot). No `renderToSVG` because the wire format is
SModelRoot. If server-side SVG becomes useful later, it's an additive
extension.

**`RendererOutcome`** (`shared-types/diagram.ts`).

```
'new' | 'old-default' | 'old-fallback-from-new' | 'old-fallback-not-registered'
```

This is the value of `_meta.rendererUsed` on every model message and the
key dimension in the renderer-stats counter.

**`FeatureFlags`** (`shared-types/feature-flags.ts`).
Just `Partial<Record<RendererFlag, boolean>>`. Zod schemas live in
`api-server/services/feature-flags-service.ts` so shared-types stays
dependency-free.

## How to add a new view in a future phase

1. Add the new IR variant under `shared-types/src/diagram-ir/`.
2. Add it to the `DiagramIR` union in `index.ts`.
3. Register the legacy → DiagramViewType mapping in
   `view-type-mapper.ts`.
4. Build the renderer implementation under
   `diagram-service/src/rendering/<view-name>/` exporting a
   `ViewRenderer<YourIR>`.
5. Register a lazy loader:

   ```typescript
   viewRegistry.register('your-view', () =>
     import('./your-view/index.js').then(m => m.yourRenderer)
   );
   ```

6. Add fixtures under
   `diagram-service/tests/fixtures/your-view/{name}/` with the
   four-file shape (model.sysml, expected-ir.json, expected-smodel.json,
   reference/).
7. Update `_meta.rendererUsed` typing if the union grows (it shouldn't —
   the four outcomes are renderer-agnostic).
8. Flip the global env flag (`FF_YOUR_VIEW_NEW_RENDERER=true`) when
   ready for default rollout.

## Operational notes

**Feature flags.** Env var names follow `FF_<UPPER_SNAKE_FLAG_NAME>`.
The literal string `"true"` enables; anything else is false. Per-user
overrides (Phase 1+) win when set.

**Observability.** `_meta.rendererUsed` rides every model message and
shows up in WebSocket frames in DevTools. The admin endpoint
(`GET /api/admin/renderer-stats`, JWT + admin) returns the in-memory
counter; `status: 'live'` means the proxy reached
`diagram-service/internal/renderer-stats`, `status: 'unavailable'` means
that service is down or token-misconfigured.

**Failure handling.** Every fallback path in the wedge is silent —
records the outcome, logs warn, returns the legacy pipeline's output.
A bad renderer never shows the user a broken diagram.

**Bundle behaviour.** Renderer modules under `diagram-service` run only
on the server, so they have no impact on the web-client bundle. The
client-side bundle delta from Phase 0 is bounded by the additions to
`shared-types` (IR type definitions, erased at runtime; `_meta` field
shape on `DiagramMessage`). See `docs/bundle-baseline.txt` for the
pre-phase measurement and `docs/phase-0-bundle-delta.txt` for the
post-phase delta.

## Reference documents

- `docs/adr/001-discriminated-union-ir.md` — why a union instead of an
  opaque metadata bag.
- `docs/adr/002-lazy-loading-renderers.md` — why dynamic-import loaders.
- `docs/adr/003-hierarchical-feature-flags.md` — env + per-user override,
  Zod validation, Phase 0 scope adjustment.
- `docs/adr/004-three-layer-verification.md` — IR snapshot + SModelRoot
  snapshot + manual reference.
- `docs/bundle-baseline.txt`, `docs/phase-0-bundle-delta.txt` — bundle
  measurements.
- `claude_md_files/renderer_refactor_strategy_v2.md` — overall multi-
  phase strategy.
- `claude_md_files/renderer_refactor_phase0_brief_v3_1.md` — Phase 0
  contract.
