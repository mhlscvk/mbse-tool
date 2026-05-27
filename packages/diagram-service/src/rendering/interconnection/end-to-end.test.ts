// Interconnection porto end-to-end (Slice 6a) — proves the new pipeline
// (filter → transformer → renderer) is byte-identical to the legacy
// `transformToBDD(model, 'interconnection')` it replaces, and that the
// production wiring (view-type-mapper + viewRegistry + wedge) routes the
// interconnection view through it.
//
// Test strategy (Discovery §3.A, hybrid):
//   • differential oracle — legacy transformToBDD IS the golden; the wedge
//     filters identically and IV's filter has no remap (unlike STV), so the new
//     output must match transformToBDD byte-for-byte.
//   • committed goldens — expected-smodel.json per fixture, generated from the
//     legacy output, lock the SModel for review and as the Slice 6b baseline.
//   • broad coverage — the same equality over a handful of real repo examples.
//   • showInherited no-op guard (CP-1.5) — the IV filter strips the
//     dependency/typereference edges resolveInheritedAttributes consumes, so
//     showInherited true vs false is byte-identical; this guards that invariant.

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import type { FlagProvider } from '../feature-flags.js';
import type { SModelRoot, SysMLModel, ViewType } from '@systemodel/shared-types';
import { parseSysMLText } from '../../parser/sysml-text-parser.js';
import { viewRegistry } from '../view-registry.js';
import { mapToDiagramViewType } from '../view-type-mapper.js';
import { makeWedge } from '../pipeline.js';
import { RendererStats } from '../renderer-stats.js';
import { transformToBDD } from '../../transformer/bdd-transformer.js';
import { applyViewFilter } from '../../transformer/view-filters.js';
import { interconnectionRenderer } from './index.js';
import { transformAstToInterconnectionIR } from './transformer.js';
import { interconnectionToSModelRoot } from './renderer.js';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = resolve(here, '../../../tests/fixtures/interconnection');
const EXAMPLES_ROOT = resolve(here, '../../../../api-server/prisma/examples');

const FIXTURES = ['basic', 'multi-port', 'conjugated', 'inheritance'] as const;

function loadModel(name: string): SysMLModel {
  const sysml = readFileSync(resolve(FIXTURE_ROOT, name, 'model.sysml'), 'utf-8');
  return parseSysMLText(`fixture://${name}/model.sysml`, sysml).model;
}

function loadGolden(name: string): SModelRoot {
  return JSON.parse(readFileSync(resolve(FIXTURE_ROOT, name, 'expected-smodel.json'), 'utf-8')) as SModelRoot;
}

// Mirror the production wedge: applyViewFilter (non-mutating, returns
// { nodes, connections }) → reconstruct the model → transformer → renderer.
function newPipeline(model: SysMLModel, showInherited = false): SModelRoot {
  const f = applyViewFilter(model, 'interconnection');
  const fm: SysMLModel = { uri: model.uri, nodes: f.nodes, connections: f.connections };
  const ir = transformAstToInterconnectionIR(fm, { viewType: 'interconnection' as ViewType, showInherited });
  return interconnectionToSModelRoot(ir);
}

beforeAll(() => {
  // Mirror src/index.ts bootstrap without starting the HTTP server.
  if (!viewRegistry.has('interconnection')) {
    viewRegistry.register('interconnection', () => Promise.resolve(interconnectionRenderer));
  }
});

describe('interconnection porto — differential oracle (Slice 6a)', () => {
  it.each(FIXTURES)('%s: new pipeline is byte-identical to legacy transformToBDD', (name) => {
    const model = loadModel(name);
    expect(newPipeline(model)).toEqual(transformToBDD(model, 'interconnection'));
  });

  it.each(FIXTURES)('%s: new pipeline matches the committed golden', (name) => {
    expect(newPipeline(loadModel(name))).toEqual(loadGolden(name));
  });
});

describe('interconnection porto — showInherited no-op guard (CP-1.5)', () => {
  it('inheritance fixture: showInherited true vs false is byte-identical', () => {
    const model = loadModel('inheritance');
    // Legacy invariant (the IV filter strips the inheritance edges).
    expect(transformToBDD(model, 'interconnection', true))
      .toEqual(transformToBDD(model, 'interconnection', false));
    // New pipeline holds the same invariant…
    expect(newPipeline(model, true)).toEqual(newPipeline(model, false));
    // …and still equals legacy with the flag on.
    expect(newPipeline(model, true)).toEqual(transformToBDD(model, 'interconnection', true));
  });
});

describe('interconnection porto — broad differential over repo examples', () => {
  const exampleFiles = [
    'Definitions and Usages/Items_and_Ports.sysml',
    'Definitions and Usages/Part_and_Attribute_Definitions.sysml',
    'Definitions and Usages/Redefinition_and_Subsetting.sysml',
  ];
  it.each(exampleFiles)('%s: new === legacy for interconnection view', (rel) => {
    const sysml = readFileSync(resolve(EXAMPLES_ROOT, rel), 'utf-8');
    const model = parseSysMLText(`example://${rel}`, sysml).model;
    expect(newPipeline(model)).toEqual(transformToBDD(model, 'interconnection'));
  });
});

describe('interconnection porto — production wiring', () => {
  it('view-type-mapper maps interconnection → interconnection', () => {
    expect(mapToDiagramViewType('interconnection' as ViewType)).toBe('interconnection');
  });

  it('viewRegistry resolves interconnection to the production renderer', async () => {
    const r = await viewRegistry.get('interconnection');
    expect(r).toBeDefined();
    expect(r?.viewType).toBe('interconnection');
    expect(r).toBe(interconnectionRenderer);
  });

  it('wedge flag=on routes through the new renderer (rendererUsed=new), never calls legacy, equals legacy output', async () => {
    const model = loadModel('conjugated');
    const stats = new RendererStats();
    let legacyCalls = 0;
    const flagsOn: FlagProvider = { isEnabled: async () => true };
    const wedge = makeWedge({
      registry: viewRegistry,
      flags: flagsOn,
      stats,
      runOldPipeline: (m, v, s) => { legacyCalls += 1; return transformToBDD(m, v, s); },
    });

    const out = await wedge(model, 'interconnection', false);

    expect(out.rendererUsed).toBe('new');
    expect(legacyCalls).toBe(0);
    expect(out.result).toEqual(transformToBDD(model, 'interconnection', false));
    expect(stats.snapshot().byViewType['interconnection']).toEqual({ new: 1 });
  });

  it('wedge flag=off falls back to the legacy pipeline (rendererUsed=old-default)', async () => {
    const model = loadModel('basic');
    const stats = new RendererStats();
    const flagsOff: FlagProvider = { isEnabled: async () => false };
    const wedge = makeWedge({
      registry: viewRegistry,
      flags: flagsOff,
      stats,
      runOldPipeline: (m, v, s) => transformToBDD(m, v, s),
    });

    const out = await wedge(model, 'interconnection', false);

    expect(out.rendererUsed).toBe('old-default');
    expect(out.result).toEqual(transformToBDD(model, 'interconnection', false));
    expect(stats.snapshot().byViewType['interconnection']).toEqual({ 'old-default': 1 });
  });
});
