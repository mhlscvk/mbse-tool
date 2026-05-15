// FeatureFlagsService — the single point of access to User.featureFlags.
//
// Why a service: the column is a Json? blob, so type safety must be enforced
// at the read/write boundary rather than relying on Prisma. Every call site
// goes through this service so an unknown flag key cannot enter the DB and
// stale keys cannot leak out.
//
// PATCH semantics (Phase 0 brief §S3):
//   - `{ key: true | false }` → set/replace that key
//   - `{ key: null }`         → clear that key (falls back to env at read time)
//   - key absent              → unchanged
//
// Read semantics: returns `boolean | undefined` per flag; consumers fall back
// to the env-var layer when a flag is undefined.

import { Prisma, type PrismaClient } from '@prisma/client';
import { z, ZodError } from 'zod';
import { RENDERER_FLAGS, type FeatureFlags, type RendererFlag } from '@systemodel/shared-types';

// Stored shape: every renderer flag, each value is `true | false` if set.
export const FeatureFlagsSchema = z
  .object(
    Object.fromEntries(
      RENDERER_FLAGS.map((f) => [f, z.boolean().optional()]),
    ),
  )
  .strict();

// Patch shape: same as stored, but each value may also be `null` to clear.
// Strict mode here too — typos like `state_machine_new_renderer` get rejected
// at the boundary instead of silently corrupting the column.
export const FeatureFlagsPatchSchema = z
  .object(
    Object.fromEntries(
      RENDERER_FLAGS.map((f) => [f, z.boolean().nullable().optional()]),
    ),
  )
  .strict();

export type FeatureFlagsPatch = z.infer<typeof FeatureFlagsPatchSchema>;

export class FeatureFlagsService {
  constructor(private prisma: PrismaClient) {}

  // Validate a Prisma JSON blob coming out of the DB. If validation fails
  // we treat the row as if it had no flags and surface the error to the
  // caller via the thrown ZodError — callers (HierarchicalFlagProvider in
  // Slice 3) catch and downgrade to the env layer.
  async get(userId: string): Promise<FeatureFlags> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { featureFlags: true },
    });
    if (!user?.featureFlags) return {};

    const parsed = FeatureFlagsSchema.parse(user.featureFlags);
    // Strip undefined-valued keys for a clean shape.
    const out: FeatureFlags = {};
    for (const k of RENDERER_FLAGS) {
      const v = parsed[k];
      if (typeof v === 'boolean') out[k] = v;
    }
    return out;
  }

  // Merge a patch into the stored flags, handling the null-as-delete signal.
  // Returns the full merged set so the caller can echo it in the PATCH
  // response (saves a roundtrip).
  async set(userId: string, patch: FeatureFlagsPatch): Promise<FeatureFlags> {
    const validated = FeatureFlagsPatchSchema.parse(patch);

    const current = await this.get(userId);
    const merged: FeatureFlags = { ...current };
    for (const k of RENDERER_FLAGS) {
      if (!(k in validated)) continue;
      const v = validated[k];
      if (v === null) {
        delete merged[k];
      } else if (typeof v === 'boolean') {
        merged[k] = v;
      }
      // v === undefined: caller sent the key explicitly as undefined; treat
      // as "not present", do nothing.
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { featureFlags: merged as unknown as Prisma.InputJsonValue },
    });

    return merged;
  }
}

// Re-export ZodError so route handlers can pattern-match without importing
// zod themselves.
export { ZodError };

// Type guard used by routes turning a ZodError into a 400 body.
export function isFeatureFlagKey(s: string): s is RendererFlag {
  return (RENDERER_FLAGS as readonly string[]).includes(s);
}
