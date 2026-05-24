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
import type { RendererFlag, SModelRoot, StateMachineIR, SysMLModel, ViewType } from '@systemodel/shared-types';
import { parseSysMLText } from '../../parser/sysml-text-parser.js';
import { viewRegistry, type ViewSpec } from '../view-registry.js';
import { mapToDiagramViewType } from '../view-type-mapper.js';
import { makeWedge } from '../pipeline.js';
import { RendererStats } from '../renderer-stats.js';
import type { FlagContext, FlagProvider } from '../feature-flags.js';
import { transformToBDD } from '../../transformer/bdd-transformer.js';
import { applyViewFilter } from '../../transformer/view-filters.js';
import { stateMachineRenderer } from './index.js';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = resolve(here, '../../../tests/fixtures/state-machine/sensor-systems');
const MODEL_PATH = resolve(FIXTURE_DIR, 'model.sysml');
const EXPECTED_SMODEL_PATH = resolve(FIXTURE_DIR, 'expected-smodel.json');
// Slice 2d.2: the wedge (production path) runs the state-transition view filter
// before the renderer, so its SModel is the *filtered* golden — distinct from
// the raw transformer/renderer golden the direct test asserts against.
const EXPECTED_SMODEL_FILTERED_PATH = resolve(FIXTURE_DIR, 'expected-smodel-filtered.json');
const EXPECTED_IR_FILTERED_PATH = resolve(FIXTURE_DIR, 'expected-ir-filtered.json');

const MULTI_ROOT_DIR = resolve(here, '../../../tests/fixtures/state-machine/multi-root-part-states');

const STV_SPEC: ViewSpec = { viewType: 'state-transition' as ViewType, showInherited: false };

function loadModel() {
  const sysml = readFileSync(MODEL_PATH, 'utf-8');
  return parseSysMLText('fixture://sensor-systems/model.sysml', sysml).model;
}

function loadExpectedSModel(): SModelRoot {
  return JSON.parse(readFileSync(EXPECTED_SMODEL_PATH, 'utf-8')) as SModelRoot;
}

function loadExpectedFilteredSModel(): SModelRoot {
  return JSON.parse(readFileSync(EXPECTED_SMODEL_FILTERED_PATH, 'utf-8')) as SModelRoot;
}

function loadExpectedFilteredIr(): StateMachineIR {
  return JSON.parse(readFileSync(EXPECTED_IR_FILTERED_PATH, 'utf-8')) as StateMachineIR;
}

// Mirror the wedge's filter step: applyViewFilter is non-mutating and returns
// only { nodes, connections }, so reconstruct a full model (carrying uri).
function filterForStv(model: SysMLModel): SysMLModel {
  const f = applyViewFilter(model, 'state-transition');
  return { uri: model.uri, nodes: f.nodes, connections: f.connections };
}

// astNodeId + generatedAt are source/clock-fragile (ADR-005 §6) — the same
// normalization transformer.test.ts applies before IR equality.
function normalize<T>(value: T): T {
  if (Array.isArray(value)) return value.map(normalize) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = k === 'astNodeId' || k === 'generatedAt' ? '<normalized>' : normalize(v);
    }
    return out as unknown as T;
  }
  return value;
}

function collectNodeIds(root: SModelRoot): string[] {
  const ids: string[] = [];
  const visit = (n: any) => {
    if (n && n.type === 'node') ids.push(n.id);
    for (const c of n?.children ?? []) visit(c);
  };
  visit(root);
  return ids;
}

// Flag-on wedge wired to the production registry/renderer with a legacy-call
// counter — the Slice 2d.2 tests reuse this instead of repeating makeWedge.
function flagOnWedge() {
  const stats = new RendererStats();
  let legacyCalls = 0;
  const flagsAlwaysOn: FlagProvider = { isEnabled: async () => true };
  const wedge = makeWedge({
    registry: viewRegistry,
    flags: flagsAlwaysOn,
    stats,
    runOldPipeline: (m, v, s) => { legacyCalls += 1; return transformToBDD(m, v, s); },
  });
  return { wedge, stats, legacyCalls: () => legacyCalls };
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
    // Slice 2d.2: the wedge filters before rendering, so it yields the filtered
    // golden (pseudo-initial__on dropped), not the raw transformer golden.
    expect(out.result).toEqual(loadExpectedFilteredSModel());
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

  // Slice 2d.3 (Bug-RENDER-02): the two container usages render as labelled
  // SNodes the frontend (DiagramViewer.tsx:2197) draws as title-bar containers.
  it('renders ModeAlpha and ModeBeta as container SNodes carrying their «state» + name labels', async () => {
    const renderer = await viewRegistry.get('state-machine');
    const ir = renderer!.transformAstToIR(loadMultiRootModel(), STV_SPEC);
    const root = renderer!.toSModelRoot(ir);

    for (const name of ['ModeAlpha', 'ModeBeta']) {
      const container = root.children.find(c => c.type === 'node' && c.id === `state__${name}`);
      expect(container, `container SNode for ${name}`).toBeDefined();
      const labelTexts = ((container as { children?: { text?: string }[] }).children ?? []).map(l => l.text);
      expect(labelTexts).toEqual(['«state»', name]);
      // A composition edge ties the container to each child, which is what the
      // frontend turns into nesting.
      const compToChildren = root.children.filter(
        c => c.type === 'edge' && c.cssClasses?.[0] === 'composition'
          && (c as { sourceId?: string }).sourceId === `state__${name}`,
      );
      expect(compToChildren.length).toBeGreaterThanOrEqual(2);
    }
  });
});

// ── View-filter integration (Slice 2d.2, DP1=b) ─────────────────────────────
// The wedge runs applyViewFilter on the new-renderer path before transforming.
// These prove the filter reaches the renderer (output level), that sensor-systems
// matches the filtered golden, and that multi-root is a genuine no-op.

describe('view-filter integration on the new-renderer path (Slice 2d.2)', () => {
  it('drops On\'s local initial pseudo from the wedge output, while the raw transformer keeps it', async () => {
    const renderer = await viewRegistry.get('state-machine');
    // Transformer in isolation (no filter) still builds On's local initial —
    // that is the transformer-isolation contract the raw golden pins.
    const rawIr = renderer!.transformAstToIR(loadModel(), STV_SPEC);
    expect(rawIr.nodes.map(n => n.id)).toContain('pseudo-initial__on');

    // The wedge filters first, so its render drops the sub-state initial but
    // keeps the top-level one.
    const { wedge, legacyCalls } = flagOnWedge();
    const out = await wedge(loadModel(), 'state-transition', false);
    expect(out.rendererUsed).toBe('new');
    expect(legacyCalls()).toBe(0);
    const ids = collectNodeIds(out.result);
    expect(ids).not.toContain('pseudo-initial__on');
    expect(ids).toContain('pseudo-initial__top');
  });

  it('produces a filtered IR that matches expected-ir-filtered.json (normalized)', async () => {
    const renderer = await viewRegistry.get('state-machine');
    const ir = renderer!.transformAstToIR(filterForStv(loadModel()), STV_SPEC);
    expect(normalize(ir)).toEqual(normalize(loadExpectedFilteredIr()));
  });

  it('multi-root: the filter is a no-op — the wedge render equals the raw render and the committed golden', async () => {
    const renderer = await viewRegistry.get('state-machine');
    const rawRender = renderer!.toSModelRoot(renderer!.transformAstToIR(loadMultiRootModel(), STV_SPEC));

    const { wedge, legacyCalls } = flagOnWedge();
    const out = await wedge(loadMultiRootModel(), 'state-transition', false);

    expect(out.rendererUsed).toBe('new');
    expect(legacyCalls()).toBe(0);
    expect(out.result).toEqual(rawRender);                     // filter changed nothing
    expect(out.result).toEqual(loadMultiRootExpectedSModel()); // still the committed golden
  });

  it('records the filtered render as new with zero fallback', async () => {
    const { wedge, stats } = flagOnWedge();
    await wedge(loadModel(), 'state-transition', false);
    // No 'old-fallback-from-new' — the filtered model renders cleanly.
    expect(stats.snapshot().byViewType['state-machine']).toEqual({ new: 1 });
  });
});
