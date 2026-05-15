// Renderer feature-flag identifiers, shared between diagram-service (consumer)
// and api-server (storage). Type-only — no Zod here so this module stays a
// dependency-free leaf. The Zod schema lives in api-server alongside the
// FeatureFlagsService that reads/writes the User.featureFlags column.

export const RENDERER_FLAGS = [
  'state-machine-new-renderer',
  'block-definition-new-renderer',
  'internal-block-new-renderer',
  'requirement-new-renderer',
  'action-new-renderer',
  'use-case-new-renderer',
] as const;

export type RendererFlag = typeof RENDERER_FLAGS[number];

// Stored shape. null vs undefined matters:
//   true  → flag explicitly on (overrides env var)
//   false → flag explicitly off (overrides env var)
//   null  → present in patch only; means "clear this key, fall back to env"
//   key absent → no override, fall back to env
//
// Stored values in DB are only true/false; null is a transient PATCH signal
// that FeatureFlagsService.set turns into a key deletion. Reads therefore see
// boolean | undefined per key.
export type FeatureFlags = Partial<Record<RendererFlag, boolean>>;
