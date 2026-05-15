# ADR-002: Lazy-Loading View Renderers via Dynamic Import

- Status: Accepted
- Date: 2026-05-15

## Context and Problem Statement

The Phase 0 brief (NFR-PH0-01) sets a tight initial-bundle budget — the
foundation may add at most 2 KB gzip on top of the captured baseline. But
Phase 1+ will land six view-specific renderers (state machine, BDD, IBD,
requirement, action, use-case), each with its own transformer logic and
potentially a layout adapter. If every renderer is eagerly imported by the
registry, the initial bundle keeps growing through every phase and the
strangler-fig migration regresses bundle size before it can ever ship code
savings (the legacy transformer is still resident too, by design).

We need a registration mechanism that:

1. Keeps the wedge call site uniform (`registry.get(viewType)`).
2. Lets each renderer ship in its own code-split chunk that loads only when
   a render request for that view actually arrives.
3. Does not require frontend or build-tool reconfiguration — Vite/Rollup
   default behaviour must do the splitting.
4. Caches loaded renderers so the dynamic import cost is amortised across
   the lifetime of the process (or, on the client, the lifetime of the SPA
   session).

## Considered Options

1. **Eager registration.** `viewRegistry.register('state-machine',
   stateMachineRenderer)` — the renderer module is statically imported at
   startup, so it's always in the initial bundle. Simple but blows the
   budget by the time three renderers exist.

2. **Lazy loader functions with dynamic import.** `viewRegistry.register(
   'state-machine', () => import('./state-machine/index.js').then(m =>
   m.stateMachineRenderer))`. The loader is a closure; the dynamic
   `import()` is what Vite/Rollup recognises as a code-split point.

3. **Service-worker module registration.** Each renderer registers itself
   from its own entry point. Resilient if renderers ship from different
   packages, but adds wiring complexity (each renderer needs an entry
   point that runs on boot).

## Decision

**Option 2 — lazy loader functions stored in the registry, dynamic-import
inside.**

```typescript
viewRegistry.register('state-machine', () =>
  import('./state-machine/index.js').then(m => m.stateMachineRenderer)
);
```

`ViewRegistry.get(viewType)` invokes the loader on first request, caches
the resolved renderer, and reuses it on subsequent calls. The loader
function is small (a few bytes) and stays in the initial bundle; the
renderer module itself becomes a separate chunk that Vite emits next to
the other lazy chunks under `dist/assets/`.

## Consequences

**Positive.**

- Initial bundle stays close to baseline. The Phase 0 bundle delta target
  (<2 KB gzip) is achievable even after several views are wired, because
  only the registry plumbing and the loader closures are in the initial
  bundle; renderer code is downloaded on first use.
- Code-split chunks are emitted automatically — verified by the existing
  Vite build, which already produces ~50 Monaco language chunks via the
  same mechanism.
- A renderer's first invocation pays one network round-trip on the client
  (or one disk read on the server) for the chunk. After that, the
  registry cache returns the same instance.
- Mixed-phase rollout is natural: Phase 1 registers state-machine; Phase
  2 registers BDD; the wedge code never changes shape.

**Negative.**

- The first call to a newly-enabled flag pays a one-time async cost. This
  is invisible to users (the wedge is already async) but worth noting for
  the renderer-stats interpretation — a sudden spike of `'new'` outcomes
  in the first minute after a flag flip is normal.
- Loader closures cannot be easily inspected for "what's registered" at
  static-analysis time. We accept this; `ViewRegistry.has()` provides the
  runtime answer and that's the only consumer.

**Neutral.**

- No new build-tool configuration. Vite + Rollup detect `import('...')`
  and emit chunks; the existing `manualChunks` config is untouched.
- Server-side (Node) and client-side (Vite) both honour dynamic import
  natively; the same registration code works in both environments.

## Notes

- `ViewRegistry.reset()` exists for tests, which build their own registry
  and avoid touching the production singleton.
- Phase 0 registers nothing; the registry is empty at startup. Phase 1's
  state-machine module will be the first registration.
