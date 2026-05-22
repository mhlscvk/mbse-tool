// state-machine renderer — drives the IR → SModelRoot implementation
// against the sensor-systems fixture. The whole pipeline runs end-to-end:
//   parser → transformer → renderer
// so any regression in any stage shows up here.
//
// KARAR-1 v1.2 invariant: SysML v2 syntax is preserved verbatim, so no
// SLabel produced by this renderer is allowed to carry `data.i18nKey`.
// The labelText() helper in DiagramViewer.tsx falls back to `label.text`
// for every SLabel here.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import type { SModelRoot, ViewType } from '@systemodel/shared-types';
import { parseSysMLText } from '../../parser/sysml-text-parser.js';
import type { ViewSpec } from '../view-registry.js';
import { transformAstToStateMachineIR } from './transformer.js';
import { stateMachineToSModelRoot } from './renderer.js';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = resolve(here, '../../../tests/fixtures/state-machine/sensor-systems');
const MODEL_PATH = resolve(FIXTURE_DIR, 'model.sysml');
const EXPECTED_PATH = resolve(FIXTURE_DIR, 'expected-smodel.json');

const STV_SPEC: ViewSpec = { viewType: 'state-transition' as ViewType, showInherited: false };

function build(): SModelRoot {
  const sysml = readFileSync(MODEL_PATH, 'utf-8');
  const { model } = parseSysMLText('fixture://sensor-systems/model.sysml', sysml);
  const ir = transformAstToStateMachineIR(model, STV_SPEC);
  return stateMachineToSModelRoot(ir);
}

function loadExpected(): SModelRoot {
  return JSON.parse(readFileSync(EXPECTED_PATH, 'utf-8')) as SModelRoot;
}

function walkLabels(root: SModelRoot, visit: (label: { type: 'label'; data?: Record<string, unknown>; text: string; id: string }) => void): void {
  for (const child of root.children) {
    for (const label of child.children) {
      visit(label);
    }
  }
}

describe('state-machine renderer × sensor-systems fixture', () => {
  it('produces the expected SModelRoot top-level shape', () => {
    const sm = build();
    expect(sm.type).toBe('graph');
    expect(sm.id).toBe('state-machine__fixture://sensor-systems/model.sysml');
    // 5 states + 3 pseudo-states + 8 behavior SNodes = 16 SNodes.
    // 11 transitions + 11 composition edges = 22 SEdges.
    const nodes = sm.children.filter(c => c.type === 'node');
    const edges = sm.children.filter(c => c.type === 'edge');
    expect(nodes).toHaveLength(16);
    expect(edges).toHaveLength(22);
  });

  it('emits pseudo-states with the legacy startnode/donenode CSS classes', () => {
    const sm = build();
    const startNodes = sm.children.filter(c => c.type === 'node' && c.cssClasses?.includes('startnode'));
    const doneNodes = sm.children.filter(c => c.type === 'node' && c.cssClasses?.includes('donenode'));
    expect(startNodes).toHaveLength(2);
    expect(doneNodes).toHaveLength(1);
    // Pseudo-state SNodes are 24×24 (legacy isCircular size).
    for (const n of [...startNodes, ...doneNodes]) {
      if (n.type !== 'node') continue;
      expect(n.size.width).toBe(24);
      expect(n.size.height).toBe(24);
    }
  });

  it('renders compartments as separate behavior SNodes with their legacy CSS classes', () => {
    const sm = build();
    const entries = sm.children.filter(c => c.type === 'node' && c.cssClasses?.includes('entryactionusage'));
    const dos = sm.children.filter(c => c.type === 'node' && c.cssClasses?.includes('doactionusage'));
    const exits = sm.children.filter(c => c.type === 'node' && c.cssClasses?.includes('exitactionusage'));
    // Three entries (On, Normal, Degraded), three dos, two exits (Degraded's
    // empty exit was dropped per ADR-005 §S1).
    expect(entries).toHaveLength(3);
    expect(dos).toHaveLength(3);
    expect(exits).toHaveLength(2);
  });

  it('emits composition edges so the frontend can nest visually', () => {
    const sm = build();
    const compositions = sm.children.filter(c => c.type === 'edge' && c.cssClasses?.includes('composition'));
    expect(compositions).toHaveLength(11);
    // Composition edges carry no label (no SLabel children).
    for (const c of compositions) {
      if (c.type !== 'edge') continue;
      expect(c.children).toEqual([]);
    }
  });

  it('combines TransitionLabel into "trigger via X" for the SEdge label', () => {
    const sm = build();
    const offToOn = sm.children.find(c => c.type === 'edge' && c.id === 'edge__off_to_on');
    expect(offToOn).toBeDefined();
    if (offToOn?.type !== 'edge') throw new Error();
    expect(offToOn.children).toHaveLength(1);
    expect(offToOn.children[0].text).toBe('PowerOn via sensor2Platform');
    expect(offToOn.children[0].id).toBe('edge__off_to_on__label');
  });

  it('keeps both parallel Error → Off transitions visible with distinct ids', () => {
    const sm = build();
    const parallel = sm.children.filter(c => c.type === 'edge' && c.sourceId === 'state__Error' && c.targetId === 'state__Off');
    expect(parallel).toHaveLength(2);
    const noTriggerEdge = parallel.find(e => e.type === 'edge' && e.children.length === 0);
    const triggerEdge = parallel.find(e => e.type === 'edge' && e.children.length === 1);
    expect(noTriggerEdge).toBeDefined();
    expect(triggerEdge).toBeDefined();
    if (triggerEdge?.type !== 'edge') throw new Error();
    expect(triggerEdge.children[0].text).toBe('PowerOff');
  });

  it('never sets data.i18nKey on any SLabel (KARAR-1 v1.2 invariant)', () => {
    const sm = build();
    let labelCount = 0;
    walkLabels(sm, (lab) => {
      labelCount++;
      expect(lab.data?.i18nKey).toBeUndefined();
      // Belt and suspenders — the data bag itself shouldn't exist on these
      // labels, since we have nothing to put there.
      expect(lab.data).toBeUndefined();
    });
    // Sanity: the fixture is non-trivial.
    expect(labelCount).toBeGreaterThan(20);
  });

  it('matches expected-smodel.json byte-for-byte', () => {
    const actual = build();
    const expected = loadExpected();
    expect(actual).toEqual(expected);
  });
});
