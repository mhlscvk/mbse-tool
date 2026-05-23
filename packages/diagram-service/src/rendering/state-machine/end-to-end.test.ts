// State-machine end-to-end integration — the full Slice 2c wiring under one
// roof. Other test files exercise pieces (parser AST shape, transformer IR
// shape, renderer SModelRoot shape, the wedge bypass matrix with synthetic
// renderers). This file proves the production parts compose: the same
// view-type-mapper, viewRegistry, and wedge code that the WebSocket server
// uses turn `viewType: 'state-transition'` plus the sensor-systems fixture
// into the expected SModelRoot.
//
// Mockless on purpose. The only thing not real is the flag provider — we
// inject an "always on" / "always off" stub via `makeWedge(deps)` because the
// production `EnvFlagProvider` reads a process env var that we'd otherwise
// have to mutate (which leaks across tests). Everything else — parser,
// registry, transformer, renderer, mapper, stats — is the production
// implementation.

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import type { RendererFlag, SModelRoot, ViewType } from '@systemodel/shared-types';
import { parseSysMLText } from '../../parser/sysml-text-parser.js';
import { viewRegistry, type ViewSpec } from '../view-registry.js';
import { mapToDiagramViewType } from '../view-type-mapper.js';
import { makeWedge } from '../pipeline.js';
import { RendererStats } from '../renderer-stats.js';
import type { FlagContext, FlagProvider } from '../feature-flags.js';
import { transformToBDD } from '../../transformer/bdd-transformer.js';
import { stateMachineRenderer } from './index.js';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = resolve(here, '../../../tests/fixtures/state-machine/sensor-systems');
const MODEL_PATH = resolve(FIXTURE_DIR, 'model.sysml');
const EXPECTED_SMODEL_PATH = resolve(FIXTURE_DIR, 'expected-smodel.json');

const MULTI_ROOT_DIR = resolve(here, '../../../tests/fixtures/state-machine/multi-root-part-states');

const STV_SPEC: ViewSpec = { viewType: 'state-transition' as ViewType, showInherited: false };

function loadModel() {
  const sysml = readFileSync(MODEL_PATH, 'utf-8');
  return parseSysMLText('fixture://sensor-systems/model.sysml', sysml).model;
}

function loadExpectedSModel(): SModelRoot {
  return JSON.parse(readFileSync(EXPECTED_SMODEL_PATH, 'utf-8')) as SModelRoot;
}

function loadMultiRootModel() {
  const sysml = readFileSync(resolve(MULTI_ROOT_DIR, 'model.sysml'), 'utf-8');
  return parseSysMLText('fixture://multi-root-part-states/model.sysml', sysml).model;
}

function loadMultiRootExpectedSModel(): SModelRoot {
  return JSON.parse(readFileSync(resolve(MULTI_ROOT_DIR, 'expected-smodel.json'), 'utf-8')) as SModelRoot;
}

// Mirrors what packages/diagram-service/src/index.ts does at bootstrap.
// Tests don't import index.ts directly because it would start an HTTP server
// as a side effect.
beforeAll(() => {
  if (!viewRegistry.has('state-machine')) {
    viewRegistry.register('state-machine', () => Promise.resolve(stateMachineRenderer));
  }
});

describe('state-machine end-to-end (Slice 2c wiring)', () => {
  it('view-type-mapper translates state-transition → state-machine', () => {
    expect(mapToDiagramViewType('state-transition' as ViewType)).toBe('state-machine');
  });

  it('viewRegistry resolves state-machine to the production renderer', async () => {
    const renderer = await viewRegistry.get('state-machine');
    expect(renderer).toBeDefined();
    expect(renderer?.viewType).toBe('state-machine');
    expect(renderer).toBe(stateMachineRenderer);
  });

  it('registry → transformer → renderer produces the expected SModelRoot for sensor-systems', async () => {
    const renderer = await viewRegistry.get('state-machine');
    expect(renderer).toBeDefined();

    const ir = renderer!.transformAstToIR(loadModel(), STV_SPEC);
    const sModelRoot = renderer!.toSModelRoot(ir);

    expect(sModelRoot).toEqual(loadExpectedSModel());
  });

  it('wedge with flag=true routes state-transition through the new renderer (rendererUsed=new) and never calls the legacy pipeline', async () => {
    const stats = new RendererStats();
    let legacyCalls = 0;
    const flagsAlwaysOn: FlagProvider = {
      isEnabled: async (_flag: RendererFlag, _ctx: FlagContext) => true,
    };

    const wedge = makeWedge({
      registry: viewRegistry,
      flags: flagsAlwaysOn,
      stats,
      runOldPipeline: (model, viewType, showInherited) => {
        legacyCalls += 1;
        return transformToBDD(model, viewType, showInherited);
      },
    });

    const out = await wedge(loadModel(), 'state-transition', false);

    expect(out.rendererUsed).toBe('new');
    expect(legacyCalls).toBe(0);
    expect(out.result).toEqual(loadExpectedSModel());
    expect(stats.snapshot().byViewType['state-machine']).toEqual({ new: 1 });
  });

  it('wedge with flag=false skips the new renderer and falls back to the legacy pipeline (rendererUsed=old-default)', async () => {
    const stats = new RendererStats();
    let legacyCalls = 0;
    const flagsAlwaysOff: FlagProvider = {
      isEnabled: async (_flag: RendererFlag, _ctx: FlagContext) => false,
    };

    const wedge = makeWedge({
      registry: viewRegistry,
      flags: flagsAlwaysOff,
      stats,
      runOldPipeline: (model, viewType, showInherited) => {
        legacyCalls += 1;
        return transformToBDD(model, viewType, showInherited);
      },
    });

    const out = await wedge(loadModel(), 'state-transition', false);

    expect(out.rendererUsed).toBe('old-default');
    expect(legacyCalls).toBe(1);
    expect(stats.snapshot().byViewType['state-machine']).toEqual({ 'old-default': 1 });
  });

  // ── Multi-root (Slice 2d.1) — the regression that crashed Slice 2d ──────────
  // A real-world model: two `state` machines nested in a part, no StateDefinition.

  it('registry → transformer → renderer produces the expected SModelRoot for the multi-root fixture', async () => {
    const renderer = await viewRegistry.get('state-machine');
    expect(renderer).toBeDefined();

    const ir = renderer!.transformAstToIR(loadMultiRootModel(), STV_SPEC);
    const sModelRoot = renderer!.toSModelRoot(ir);

    expect(sModelRoot).toEqual(loadMultiRootExpectedSModel());
  });

  it('wedge with flag=true renders the multi-root fixture through the new renderer (rendererUsed=new, no fallback)', async () => {
    const stats = new RendererStats();
    let legacyCalls = 0;
    const flagsAlwaysOn: FlagProvider = {
      isEnabled: async (_flag: RendererFlag, _ctx: FlagContext) => true,
    };

    const wedge = makeWedge({
      registry: viewRegistry,
      flags: flagsAlwaysOn,
      stats,
      runOldPipeline: (model, viewType, showInherited) => {
        legacyCalls += 1;
        return transformToBDD(model, viewType, showInherited);
      },
    });

    const out = await wedge(loadMultiRootModel(), 'state-transition', false);

    // The crash path: pre-Slice-2d.1 this threw and recorded
    // 'old-fallback-from-new'. It must now render natively with no fallback.
    expect(out.rendererUsed).toBe('new');
    expect(legacyCalls).toBe(0);
    expect(out.result).toEqual(loadMultiRootExpectedSModel());
    expect(stats.snapshot().byViewType['state-machine']).toEqual({ new: 1 });
  });
});
