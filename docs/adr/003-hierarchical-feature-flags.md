# ADR-003: Hierarchical Feature Flags with Zod-Validated Storage

- Status: Accepted (with scope adjustment for Phase 0)
- Date: 2026-05-15

## Context and Problem Statement

The renderer refactor needs a feature-flag mechanism that supports two
distinct rollout patterns:

1. **Dogfooding.** A small set of users (initially: Platform Owner) needs
   to opt into a new renderer for a specific view, while everyone else
   continues to see the legacy pipeline. This requires per-user override.

2. **Global rollout.** When a renderer is ready for everyone, an
   environment-wide switch should enable it without touching every user
   row. This requires a global default.

The two layers must compose deterministically: per-user wins when set,
global env is the fallback. And the storage path needs validation strong
enough that an unknown flag key cannot corrupt the column — a stale flag
written by an old client should not silently survive in the database and
re-enable a removed feature.

## Considered Options

1. **Single layer, env var only.** Simple, fast, no DB. But every
   dogfooder controls everyone else's experience; no per-user opt-in.

2. **Single layer, DB only.** Per-user works, but global rollout means
   updating every user row. No graceful default for new users.

3. **Hierarchical: per-user (DB) → global (env).** Per-user override is
   stored in a `User.featureFlags Json?` column; global default is an
   `FF_*` env var. The check function consults per-user first, falls
   through to env. Strong (Zod) validation at the storage boundary.

## Decision

**Option 3 — hierarchical, per-user overrides global, with Zod-validated
storage.**

```typescript
async isEnabled(flag, context) {
  if (context.userId) {
    const userFlags = await flagsService.get(context.userId);  // Zod parses
    if (flag in userFlags && userFlags[flag] !== undefined) {
      return userFlags[flag]!;
    }
  }
  return process.env[`FF_${flagToEnvName(flag)}`] === 'true';
}
```

Storage validation lives in `FeatureFlagsService`:

- `FeatureFlagsSchema` (strict) — accepted shape on read.
- `FeatureFlagsPatchSchema` (strict, nullable) — accepted shape on write,
  where `null` means "delete this key".

### Scope adjustment for Phase 0

The WebSocket channel that calls the wedge does not yet carry an
authenticated user identity. With every `context.userId` undefined, the
per-user layer would always miss and the DB lookup would be pure overhead.

Phase 0 therefore ships **only the env-var layer** in `diagram-service`'s
`EnvFlagProvider`. The DB-backed service (`api-server`'s
`FeatureFlagsService`), Prisma migration, schema, and `/me/feature-flags`
endpoints are all in place — they just have no reader yet. Whichever
phase first authenticates the WebSocket (likely Phase 1, when dogfooding
demands it) will add a `HierarchicalFlagProvider` class that composes
both layers as designed here. The architecture is settled; the second
layer's implementation is deferred to its first consumer.

## Consequences

**Positive.**

- Dogfooding path is clear: write a flag row via `PATCH
  /api/users/me/feature-flags`, hit the diagram, observe `'new'` in
  `_meta.rendererUsed`. (Phase 1 enables it.)
- Global rollout is one env-var flip per service restart.
- Validation is at the DB boundary, not at the route — every code path
  that reads or writes flags goes through `FeatureFlagsService`, so a
  Phase N feature that toggles a flag from the API server's own code
  cannot bypass the schema check.
- Unknown keys are rejected immediately (`z.object(...).strict()`); a
  typo like `state_machine_new_renderer` returns 400 instead of writing a
  ghost row.

**Negative.**

- Two layers means two failure modes. Mitigated by: env layer is always
  available (no I/O); DB layer wraps its reads in try/catch and logs to
  warn — a parse failure cannot break rendering for that user, it
  silently falls through to env.
- Phase 0's env-only shipping means the bypass-matrix's per-user test
  cases use a mock `FlagProvider` rather than the real composition.
  Acceptable: the production code path will be exercised in Phase 1 when
  there's a real consumer.

**Neutral.**

- `null` semantics in PATCH (`{ flag: null }` = "clear this key") add a
  little surface area but the alternative (separate DELETE endpoint per
  flag, or full-replace PATCH) was uglier.

## Notes

- Env var name derivation: `kebab-case` → `UPPER_SNAKE` with `FF_` prefix.
  `state-machine-new-renderer` → `FF_STATE_MACHINE_NEW_RENDERER`. The env
  value must be the literal string `"true"` to enable; anything else is
  false. Boring and unambiguous.
- The hierarchy is intentionally simple — no startup, project, or role
  layer between per-user and global. If those become useful later, they
  slot in by extending `FlagContext` and the provider's lookup logic
  without changing call sites.
