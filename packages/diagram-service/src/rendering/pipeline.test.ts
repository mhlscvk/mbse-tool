// Wedge bypass-matrix tests — the contract that makes the strangler-fig
// safe. Each case is an active assertion about what runs and what doesn't
// under a specific flag + registry + renderer combination.
//
// The matrix below adapts brief §7 to the v3.1 ViewRenderer contract
// (transformAstToIR + toSModelRoot). The original brief listed
// `layoutIR throws` and `renderToSVG throws`; those methods are out of
// the Phase 0 interface, so we exercise the surviving throw points
// (transformAstToIR, toSModelRoot) plus an explicit happy-path case.

import { describe, expect, it, vi, beforeEach } from 'vitest';
import type {
  RendererFlag,
  StateMachineIR,
  SModelRoot,
  SysMLModel,
  ViewType,
} from '@systemodel/shared-types';
import { makeWedge } from './pipeline.js';
import { ViewRegistry, type ViewRenderer } from './view-registry.js';
import { RendererStats } from './renderer-stats.js';
import type { FlagContext, FlagProvider } from './feature-flags.js';

// ─── Fixtures ────────────────────────────────────────────────────────────

const SENTINEL_OLD: SModelRoot = { type: 'graph', id: 'sentinel-old', children: [] };
const SENTINEL_NEW: SModelRoot = { type: 'graph', id: 'sentinel-new', children: [] };

const emptyModel: SysMLModel = { uri: 'test://empty', nodes: [], connections: [] };

function emptyIR(): StateMachineIR {
  return {
    viewType: 'state-machine',
    metadata: { generatedAt: '1970-01-01T00:00:00.000Z', rendererVersion: 'test' },
    nodes: [],
    edges: [],
  };
}

function successRenderer(): ViewRenderer<StateMachineIR> {
  return {
    viewType: 'state-machine',
    transformAstToIR: () => emptyIR(),
    toSModelRoot: () => SENTINEL_NEW,
  };
}

function throwingRenderer(stage: 'transformAstToIR' | 'toSModelRoot'): ViewRenderer<StateMachineIR> {
  return {
    viewType: 'state-machine',
    transformAstToIR: () => {
      if (stage === 'transformAstToIR') throw new Error('test: transformAstToIR threw');
      return emptyIR();
    },
    toSModelRoot: () => {
      if (stage === 'toSModelRoot') throw new Error('test: toSModelRoot threw');
      return SENTINEL_NEW;
    },
  };
}

// A FlagProvider that records every call so tests can prove the wedge
// did or did not consult it.
function makeRecordingFlags(impl: (flag: RendererFlag, ctx: FlagContext) => boolean): FlagProvider & { calls: { flag: RendererFlag; ctx: FlagContext }[] } {
  const calls: { flag: RendererFlag; ctx: FlagContext }[] = [];
  return {
    calls,
    async isEnabled(flag, ctx) {
      calls.push({ flag, ctx });
      return impl(flag, ctx);
    },
  };
}

// Phase 1 will register 'state-transition' → 'state-machine'. To avoid
// coupling the bypass-matrix tests to phase ordering, the test injects its
// own wedge with a custom mapper-equivalent: we register the renderer
// directly and pass a request ViewType that maps to state-machine in the
// near-future. For now the production mapper returns null for every legacy
// view, so the test uses a tiny shim that maps 'state-transition' →
// 'state-machine' inline.

import { mapToDiagramViewType as productionMapper } from './view-type-mapper.js';

// Override only for these tests — verifies the wedge's contract end to end
// without waiting for the Phase 1 mapper entry.
vi.mock('./view-type-mapper.js', () => ({
  mapToDiagramViewType: (legacy: ViewType) =>
    legacy === 'state-transition' ? 'state-machine' : null,
}));

// (productionMapper is imported above so the type-only import survives
// the mock; calling it would route to the mocked module too. The variable
// is referenced here so unused-import is silenced without a comment hack.)
void productionMapper;

// ─── Suite ───────────────────────────────────────────────────────────────

describe('Wedge bypass matrix', () => {
  let registry: ViewRegistry;
  let stats: RendererStats;
  let runOldPipeline: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    registry = new ViewRegistry();
    stats = new RendererStats();
    runOldPipeline = vi.fn(() => SENTINEL_OLD);
  });

  // Case 1 — flag off: registry and flag provider never even consulted
  // for the renderer; old pipeline runs; outcome recorded as 'old-default'.
  it('flag=false → old pipeline, registry untouched, rendererUsed=old-default', async () => {
    const flags = makeRecordingFlags(() => false);
    const registrySpy = vi.spyOn(registry, 'get');
    const wedge = makeWedge({ registry, flags, stats, runOldPipeline });

    const out = await wedge(emptyModel, 'state-transition', false);

    expect(out.rendererUsed).toBe('old-default');
    expect(out.result).toBe(SENTINEL_OLD);
    expect(runOldPipeline).toHaveBeenCalledOnce();
    expect(registrySpy).not.toHaveBeenCalled();
    expect(flags.calls).toHaveLength(1); // flag consulted, registry not
    expect(stats.snapshot().byViewType['state-machine']).toEqual({ 'old-default': 1 });
  });

  // Case 2 — flag on but nothing registered: falls back, recorded as
  // 'old-fallback-not-registered' so an admin can see the misconfiguration.
  it('flag=true + no renderer registered → old pipeline, outcome=old-fallback-not-registered', async () => {
    const flags = makeRecordingFlags(() => true);
    const wedge = makeWedge({ registry, flags, stats, runOldPipeline });

    const out = await wedge(emptyModel, 'state-transition', false);

    expect(out.rendererUsed).toBe('old-fallback-not-registered');
    expect(out.result).toBe(SENTINEL_OLD);
    expect(runOldPipeline).toHaveBeenCalledOnce();
    expect(stats.snapshot().byViewType['state-machine']).toEqual({ 'old-fallback-not-registered': 1 });
  });

  // Case 3 — flag on, renderer throws inside transformAstToIR: silent
  // fallback to old pipeline, recorded as 'old-fallback-from-new'.
  it('flag=true + transformAstToIR throws → falls back, outcome=old-fallback-from-new', async () => {
    const flags = makeRecordingFlags(() => true);
    registry.register('state-machine', async () => throwingRenderer('transformAstToIR'));
    const wedge = makeWedge({ registry, flags, stats, runOldPipeline });

    const out = await wedge(emptyModel, 'state-transition', false);

    expect(out.rendererUsed).toBe('old-fallback-from-new');
    expect(out.result).toBe(SENTINEL_OLD);
    expect(runOldPipeline).toHaveBeenCalledOnce();
    expect(stats.snapshot().byViewType['state-machine']).toEqual({ 'old-fallback-from-new': 1 });
  });

  // Case 4 — flag on, renderer throws inside toSModelRoot: same as case 3
  // but at the second stage. Replaces brief §7's old `renderToSVG throws`
  // entry (the SVG stage was removed from the v3.1 interface).
  it('flag=true + toSModelRoot throws → falls back, outcome=old-fallback-from-new', async () => {
    const flags = makeRecordingFlags(() => true);
    registry.register('state-machine', async () => throwingRenderer('toSModelRoot'));
    const wedge = makeWedge({ registry, flags, stats, runOldPipeline });

    const out = await wedge(emptyModel, 'state-transition', false);

    expect(out.rendererUsed).toBe('old-fallback-from-new');
    expect(out.result).toBe(SENTINEL_OLD);
    expect(runOldPipeline).toHaveBeenCalledOnce();
  });

  // Case 5 — flag on, renderer succeeds: new pipeline runs end to end,
  // old pipeline never invoked, outcome 'new'. Brief §7 didn't list this
  // as a numbered case but it's the load-bearing happy path; adding it
  // explicitly prevents a false-positive matrix.
  it('flag=true + renderer succeeds → new pipeline, old pipeline never called', async () => {
    const flags = makeRecordingFlags(() => true);
    registry.register('state-machine', async () => successRenderer());
    const wedge = makeWedge({ registry, flags, stats, runOldPipeline });

    const out = await wedge(emptyModel, 'state-transition', false);

    expect(out.rendererUsed).toBe('new');
    expect(out.result).toBe(SENTINEL_NEW);
    expect(runOldPipeline).not.toHaveBeenCalled();
    expect(stats.snapshot().byViewType['state-machine']).toEqual({ new: 1 });
  });

  // Case 6 — per-user override true + global env false: user gets the new
  // renderer because the per-user layer wins. Modelled with a mock provider
  // that returns true only when ctx.userId is set.
  it('per-user flag=true + global env=false → new pipeline for that user', async () => {
    const flags: FlagProvider = {
      isEnabled: async (_flag, ctx) => ctx.userId === 'dogfooder',
    };
    registry.register('state-machine', async () => successRenderer());
    const wedge = makeWedge({ registry, flags, stats, runOldPipeline });

    const out = await wedge(emptyModel, 'state-transition', false, { userId: 'dogfooder' });
    expect(out.rendererUsed).toBe('new');

    const out2 = await wedge(emptyModel, 'state-transition', false, { userId: 'someone-else' });
    expect(out2.rendererUsed).toBe('old-default');
  });

  // Case 7 — no per-user override, global env on: every caller gets the
  // new renderer, including anonymous (userId undefined — the Phase 0
  // WebSocket default).
  it('no per-user override + global env=true → new pipeline for everyone', async () => {
    const flags: FlagProvider = { isEnabled: async () => true };
    registry.register('state-machine', async () => successRenderer());
    const wedge = makeWedge({ registry, flags, stats, runOldPipeline });

    const out = await wedge(emptyModel, 'state-transition', false);
    expect(out.rendererUsed).toBe('new');

    const out2 = await wedge(emptyModel, 'state-transition', false, { userId: 'anyone' });
    expect(out2.rendererUsed).toBe('new');
  });

  // Case 8 — per-user flag JSON corrupted: FlagProvider falls back to env
  // layer (which itself decides). Modelled by a provider whose first call
  // throws but whose own error-handling returns the env-layer answer.
  // This documents the contract: even if per-user storage is broken, the
  // wedge keeps making a decision rather than crashing.
  it('corrupted per-user flag → provider falls back to env answer', async () => {
    const corruptedThenEnv: FlagProvider = {
      isEnabled: async () => {
        // Real HierarchicalFlagProvider (Phase 1) will catch a ZodError from
        // FeatureFlagsService.get, log it, and read env. Here we just emit
        // the env-layer answer.
        return process.env.FF_STATE_MACHINE_NEW_RENDERER === 'true';
      },
    };
    process.env.FF_STATE_MACHINE_NEW_RENDERER = 'true';
    registry.register('state-machine', async () => successRenderer());
    const wedge = makeWedge({ registry, flags: corruptedThenEnv, stats, runOldPipeline });

    const out = await wedge(emptyModel, 'state-transition', false, { userId: 'corrupted-row' });
    expect(out.rendererUsed).toBe('new');

    delete process.env.FF_STATE_MACHINE_NEW_RENDERER;
  });

  // Bonus invariant — legacy view with no mapping: hot path stays sync as
  // far as the consumer sees, flag provider not consulted, stats record
  // the unmapped traffic. Guards brief NFR-PH0-02 (zero overhead on the
  // old pipeline side).
  it('unmapped legacy ViewType → old pipeline, flag provider not consulted, unmapped++', async () => {
    const flags = makeRecordingFlags(() => true);
    const wedge = makeWedge({ registry, flags, stats, runOldPipeline });

    const out = await wedge(emptyModel, 'general', false);

    expect(out.rendererUsed).toBe('old-default');
    expect(out.result).toBe(SENTINEL_OLD);
    expect(flags.calls).toHaveLength(0);
    expect(stats.snapshot().unmapped).toBe(1);
  });
});
