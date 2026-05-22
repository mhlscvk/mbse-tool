// Parser × state-machine integration regression.
//
// Locks down the post-Slice-1-prep-B AST shape for the sensor-systems fixture
// (the working example Slice 2's state-machine renderer is being built
// against). Each assertion here corresponds to a parser fix landed in Slice 1
// prep or Slice 1 prep B; together they guarantee the transformer/renderer
// pipeline can keep using this fixture without parser drift silently
// re-introducing one of the bugs:
//
//   • Slice 1 prep  — Bug-SM-01: accept trigger regex preserves `::` segments
//   • Slice 1 prep B / M3-A — nested state usages own their children
//   • Slice 1 prep B / M4-A — first/then resolves qualified pseudo-state refs
//   • Slice 1 prep B / M5-A — `do` keyword no longer matches inside `done`
//   • Slice 1 prep B / M6-A — parallel transitions with distinct labels survive
//
// If the AST shape ever drifts, this test is the canary; debug from here.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { parseSysMLText } from '../../parser/sysml-text-parser.js';

const here = dirname(fileURLToPath(import.meta.url));
const MODEL_PATH = resolve(here, '../../../tests/fixtures/state-machine/sensor-systems/model.sysml');

function parseFixture() {
  const sysml = readFileSync(MODEL_PATH, 'utf-8');
  return parseSysMLText('fixture://sensor-systems/model.sysml', sysml).model;
}

describe('Parser × state-machine fixture (sensor-systems)', () => {
  describe('M3-A — nested state usages', () => {
    it('places Normal and Degraded under On, not under the surrounding def', () => {
      const model = parseFixture();
      const on = model.nodes.find(n => n.name === 'On' && n.kind === 'StateUsage');
      const normal = model.nodes.find(n => n.name === 'Normal' && n.kind === 'StateUsage');
      const degraded = model.nodes.find(n => n.name === 'Degraded' && n.kind === 'StateUsage');
      const def = model.nodes.find(n => n.name === 'SensorSystemStates' && n.kind === 'StateDefinition');
      expect(on).toBeDefined();
      expect(normal).toBeDefined();
      expect(degraded).toBeDefined();
      expect(def).toBeDefined();

      const normalOwner = model.connections.find(
        c => c.kind === 'composition' && c.targetId === normal!.id,
      );
      const degradedOwner = model.connections.find(
        c => c.kind === 'composition' && c.targetId === degraded!.id,
      );
      expect(normalOwner?.sourceId).toBe(on!.id);
      expect(degradedOwner?.sourceId).toBe(on!.id);
    });

    it('keeps Off and Error as direct children of the def (siblings of On)', () => {
      const model = parseFixture();
      const def = model.nodes.find(n => n.name === 'SensorSystemStates' && n.kind === 'StateDefinition');
      const off = model.nodes.find(n => n.name === 'Off' && n.kind === 'StateUsage');
      const error = model.nodes.find(n => n.name === 'Error' && n.kind === 'StateUsage');
      const offOwner = model.connections.find(c => c.kind === 'composition' && c.targetId === off!.id);
      const errorOwner = model.connections.find(c => c.kind === 'composition' && c.targetId === error!.id);
      expect(offOwner?.sourceId).toBe(def!.id);
      expect(errorOwner?.sourceId).toBe(def!.id);
    });

    it('owns entry/do/exit actions under the innermost enclosing state usage', () => {
      const model = parseFixture();
      const normal = model.nodes.find(n => n.name === 'Normal' && n.kind === 'StateUsage');
      const enterNormal = model.nodes.find(
        n => n.kind === 'EntryActionUsage' && n.name === 'entry action / checkPowerSource',
      );
      expect(enterNormal).toBeDefined();
      const owner = model.connections.find(
        c => c.kind === 'composition' && c.targetId === enterNormal!.id,
      );
      expect(owner?.sourceId).toBe(normal!.id);
    });
  });

  describe('M4-A — qualified pseudo-state references', () => {
    it('produces all 11 declared transitions', () => {
      const model = parseFixture();
      const transitions = model.connections.filter(c => c.kind === 'transition');
      expect(transitions.length).toBe(11);
    });

    it('resolves States::StateAction::start as the local start pseudo-state', () => {
      const model = parseFixture();
      // Two `start` references appear in the fixture, in different containers:
      //   • inside `state On { ... }`        → On-scoped initial → Normal
      //   • at top level inside the def      → top-scoped       → Off
      // ensureSpecialNode scopes each to its container, so both nodes exist.
      const startNodes = model.nodes.filter(n => n.kind === 'StartNode' && n.name === 'start');
      expect(startNodes.length).toBe(2);

      const normal = model.nodes.find(n => n.name === 'Normal' && n.kind === 'StateUsage')!;
      const off = model.nodes.find(n => n.name === 'Off' && n.kind === 'StateUsage')!;
      const startToNormal = model.connections.find(
        c => c.kind === 'transition' && c.targetId === normal.id && startNodes.some(s => s.id === c.sourceId),
      );
      const startToOff = model.connections.find(
        c => c.kind === 'transition' && c.targetId === off.id && startNodes.some(s => s.id === c.sourceId),
      );
      expect(startToNormal).toBeDefined();
      expect(startToOff).toBeDefined();
      // The two start nodes must be distinct — see ADR-005 §S2.
      expect(startToNormal!.sourceId).not.toBe(startToOff!.sourceId);
    });

    it('resolves States::StateAction::done as the done pseudo-state', () => {
      const model = parseFixture();
      const done = model.nodes.find(n => n.kind === 'DoneNode' && n.name === 'done');
      expect(done).toBeDefined();
      const error = model.nodes.find(n => n.name === 'Error' && n.kind === 'StateUsage')!;
      const on = model.nodes.find(n => n.name === 'On' && n.kind === 'StateUsage')!;

      const errorToDone = model.connections.find(
        c => c.kind === 'transition' && c.sourceId === error.id && c.targetId === done!.id,
      );
      const onToDone = model.connections.find(
        c => c.kind === 'transition' && c.sourceId === on.id && c.targetId === done!.id,
      );
      expect(errorToDone).toBeDefined();
      expect(onToDone).toBeDefined();
    });
  });

  describe('M5-A — do/done word boundary', () => {
    it('never emits a phantom `do action / ne` DoActionUsage from the word `done`', () => {
      const model = parseFixture();
      const phantom = model.nodes.find(
        n => n.kind === 'DoActionUsage' && (n.name?.includes('/ ne') || n.name === 'do action / ne'),
      );
      expect(phantom).toBeUndefined();
    });

    it('emits exactly the three DoActionUsage nodes declared in the fixture', () => {
      const model = parseFixture();
      const dos = model.nodes
        .filter(n => n.kind === 'DoActionUsage')
        .map(n => n.name)
        .sort();
      expect(dos).toEqual([
        'do action / controlHealth',
        'do action / operationActions',
        'do action / restrictedOperations',
      ]);
    });
  });

  describe('M6-A — parallel transitions', () => {
    it('keeps both Error → Off transitions (one unconditional, one PowerOff-triggered)', () => {
      const model = parseFixture();
      const error = model.nodes.find(n => n.name === 'Error' && n.kind === 'StateUsage')!;
      const off = model.nodes.find(n => n.name === 'Off' && n.kind === 'StateUsage')!;
      const errorToOff = model.connections.filter(
        c => c.kind === 'transition' && c.sourceId === error.id && c.targetId === off.id,
      );
      expect(errorToOff.length).toBe(2);
      expect(errorToOff.some(c => c.name === '')).toBe(true);
      expect(errorToOff.some(c => c.name === 'ItemDefs::PowerOff')).toBe(true);
    });
  });

  describe('Slice 1 prep (Bug-SM-01) — accept trigger labels', () => {
    it('preserves `::` segments in trigger names and `via` ports on labels', () => {
      const model = parseFixture();
      const normal = model.nodes.find(n => n.name === 'Normal' && n.kind === 'StateUsage')!;
      const degraded = model.nodes.find(n => n.name === 'Degraded' && n.kind === 'StateUsage')!;
      const t = model.connections.find(
        c => c.kind === 'transition' && c.sourceId === normal.id && c.targetId === degraded.id,
      );
      expect(t).toBeDefined();
      expect(t!.name).toContain('ItemDefs::BatteryPower');
      expect(t!.name).toContain('via sensor2Platform');
    });
  });
});
