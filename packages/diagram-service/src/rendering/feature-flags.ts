// FlagProvider — decides whether a renderer flag is on for a given context.
//
// Phase 0 ships with a single-layer env-var provider. The brief specifies a
// hierarchical model (per-user override → global env), but the WebSocket
// channel that calls the wedge does not yet carry user identity, so the
// per-user layer would never fire. Reading the DB on every render just to
// confirm "no override" is pointless work. Phase 1 (or whichever phase first
// authenticates the WebSocket) is the right time to add the DB-backed
// override layer; the brief's `FeatureFlagsService` is already in api-server
// waiting for that consumer.
//
// Tests inject mock providers to cover the per-user precedence cases.

import type { RendererFlag, DiagramViewType } from '@systemodel/shared-types';

export interface FlagContext {
  userId?: string;
  viewType: DiagramViewType;
}

export interface FlagProvider {
  isEnabled(flag: RendererFlag, context: FlagContext): Promise<boolean>;
}

// Reads `FF_STATE_MACHINE_NEW_RENDERER=true` (and equivalents). Anything
// other than the literal string "true" reads as false — keeps the contract
// boring and unambiguous.
export class EnvFlagProvider implements FlagProvider {
  async isEnabled(flag: RendererFlag, _context: FlagContext): Promise<boolean> {
    const envName = `FF_${flag.toUpperCase().replace(/-/g, '_')}`;
    return process.env[envName] === 'true';
  }
}

// Default singleton — wedge imports this. Tests may construct their own.
export const flagProvider: FlagProvider = new EnvFlagProvider();
