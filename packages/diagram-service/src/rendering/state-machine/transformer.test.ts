// state-machine transformer — drives implementation against the
// sensor-systems fixture and expected-ir.json.
//
// `semanticRef.astNodeId` is normalized on both sides before equality
// (ADR-005 §Decisions deferred §6) — its values come from the parser
// (`transition__anon_${offset}` for anonymous transitions, etc.) and are
// source-text-fragile. The IR's own `id` field is the stable contract.
//
// `metadata.generatedAt` is wall-clock time of build and is also normalized.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import type { StateMachineIR, ViewType } from '@systemodel/shared-types';
import { parseSysMLText } from '../../parser/sysml-text-parser.js';
import type { ViewSpec } from '../view-registry.js';
import { transformAstToStateMachineIR } from './transformer.js';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = resolve(here, '../../../tests/fixtures/state-machine/sensor-systems');
const MODEL_PATH = resolve(FIXTURE_DIR, 'model.sysml');
const EXPECTED_IR_PATH = resolve(FIXTURE_DIR, 'expected-ir.json');

const STV_SPEC: ViewSpec = { viewType: 'state-transition' as ViewType, showInherited: false };

function loadFixture() {
  const sysml = readFileSync(MODEL_PATH, 'utf-8');
  const { model } = parseSysMLText('fixture://sensor-systems/model.sysml', sysml);
  const expectedIr: StateMachineIR = JSON.parse(readFileSync(EXPECTED_IR_PATH, 'utf-8'));
  return { model, expectedIr };
}

function normalize<T>(value: T): T {
  if (Array.isArray(value)) return value.map(normalize) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === 'astNodeId' || k === 'generatedAt') {
        out[k] = '<normalized>';
      } else {
        out[k] = normalize(v);
      }
    }
    return out as unknown as T;
  }
  return value;
}

describe('state-machine transformer × sensor-systems fixture', () => {
  it('produces a StateMachineIR with viewType "state-machine"', () => {
    const { model } = loadFixture();
    const ir = transformAstToStateMachineIR(model, STV_SPEC);
    expect(ir.viewType).toBe('state-machine');
    expect(ir.metadata.rendererVersion).toBeTruthy();
    expect(Array.isArray(ir.nodes)).toBe(true);
    expect(Array.isArray(ir.edges)).toBe(true);
  });

  it('emits the five declared states + three pseudo-states', () => {
    const { model } = loadFixture();
    const ir = transformAstToStateMachineIR(model, STV_SPEC);
    const stateNames = ir.nodes.filter(n => n.kind === 'state').map(n => n.name).sort();
    expect(stateNames).toEqual(['Degraded', 'Error', 'Normal', 'Off', 'On']);

    const pseudoKinds = ir.nodes
      .filter(n => n.kind === 'pseudo-initial' || n.kind === 'pseudo-final')
      .map(n => n.kind)
      .sort();
    // Two initial pseudo-states (one inside On, one at top level), one final.
    expect(pseudoKinds).toEqual(['pseudo-final', 'pseudo-initial', 'pseudo-initial']);
  });

  it('emits all 11 declared transitions', () => {
    const { model } = loadFixture();
    const ir = transformAstToStateMachineIR(model, STV_SPEC);
    expect(ir.edges).toHaveLength(11);
    expect(ir.edges.every(e => e.kind === 'transition')).toBe(true);
  });

  it('parses qualified trigger names down to the bare last segment', () => {
    const { model } = loadFixture();
    const ir = transformAstToStateMachineIR(model, STV_SPEC);
    const off = ir.nodes.find(n => n.name === 'Off')!;
    const on = ir.nodes.find(n => n.name === 'On')!;
    const offToOn = ir.edges.find(e => e.sourceId === off.id && e.targetId === on.id);
    expect(offToOn).toBeDefined();
    expect(offToOn!.label.trigger).toBe('PowerOn');
    expect(offToOn!.label.modifier).toBe('via sensor2Platform');
    // The qualified prefix must never appear.
    expect(offToOn!.label.trigger).not.toContain('::');
  });

  it('keeps the two parallel Error → Off transitions distinct', () => {
    const { model } = loadFixture();
    const ir = transformAstToStateMachineIR(model, STV_SPEC);
    const error = ir.nodes.find(n => n.name === 'Error')!;
    const off = ir.nodes.find(n => n.name === 'Off')!;
    const parallel = ir.edges.filter(e => e.sourceId === error.id && e.targetId === off.id);
    expect(parallel).toHaveLength(2);
    const triggers = parallel.map(e => e.label.trigger);
    // One unconditional (no trigger), one PowerOff-triggered — order-agnostic.
    expect(triggers).toContain(undefined);
    expect(triggers).toContain('PowerOff');
    // IDs must be distinct (per ADR-005 edge-collision rule).
    expect(parallel[0].id).not.toBe(parallel[1].id);
  });

  it('puts Normal, Degraded and the local pseudo-initial inside On', () => {
    const { model } = loadFixture();
    const ir = transformAstToStateMachineIR(model, STV_SPEC);
    const on = ir.nodes.find(n => n.name === 'On')!;
    expect(on.containedNodes).toBeDefined();
    const childNames = on.containedNodes!
      .map(id => ir.nodes.find(n => n.id === id))
      .filter((n): n is NonNullable<typeof n> => !!n)
      .map(n => n.name ?? n.kind);
    expect(childNames).toEqual(expect.arrayContaining(['Normal', 'Degraded', 'pseudo-initial']));
    // Initial → Normal and Normal ↔ Degraded transitions are contained by On.
    expect(on.containedEdges).toBeDefined();
    expect(on.containedEdges!.length).toBeGreaterThanOrEqual(3);
  });

  it('drops the empty exit compartment on Degraded (S1 default)', () => {
    const { model } = loadFixture();
    const ir = transformAstToStateMachineIR(model, STV_SPEC);
    const degraded = ir.nodes.find(n => n.name === 'Degraded')!;
    const kinds = (degraded.compartments ?? []).map(c => c.kind).sort();
    expect(kinds).toEqual(['do', 'entry']);
  });

  it('matches expected-ir.json structurally (normalized astNodeId + generatedAt)', () => {
    const { model, expectedIr } = loadFixture();
    const ir = transformAstToStateMachineIR(model, STV_SPEC);
    expect(normalize(ir)).toEqual(normalize(expectedIr));
  });
});

// ── Multi-root (Slice 2d.1) ──────────────────────────────────────────────────
// The crash fixture: two independent state machines modelled as `state` USAGES
// nested in a part hierarchy, with no StateDefinition at all. Drives the
// multi-seed root-finding that replaced the single find(isStateDef) seed.

const MULTI_ROOT_DIR = resolve(here, '../../../tests/fixtures/state-machine/multi-root-part-states');

function loadMultiRoot() {
  const sysml = readFileSync(resolve(MULTI_ROOT_DIR, 'model.sysml'), 'utf-8');
  const { model } = parseSysMLText('fixture://multi-root-part-states/model.sysml', sysml);
  const expectedIr: StateMachineIR = JSON.parse(
    readFileSync(resolve(MULTI_ROOT_DIR, 'expected-ir.json'), 'utf-8'),
  );
  return { model, expectedIr };
}

describe('state-machine transformer × multi-root-part-states fixture', () => {
  it('has zero StateDefinitions (the Slice 2d crash precondition)', () => {
    const { model } = loadMultiRoot();
    expect(model.nodes.some(n => n.kind === 'StateDefinition')).toBe(false);
    expect(model.nodes.some(n => n.kind === 'StateUsage')).toBe(true);
  });

  it('seeds both machines and emits the two container usages as their own state nodes', () => {
    const { model } = loadMultiRoot();
    const ir = transformAstToStateMachineIR(model, STV_SPEC);
    const stateNames = ir.nodes.filter(n => n.kind === 'state').map(n => n.name).sort();
    // Slice 2d.3 (Bug-RENDER-02): the two top-level `state` USAGES are concrete
    // states and are now drawn as labelled containers alongside their six
    // sub-states (pre-2d.3 they were silently dropped, leaving sub-states with
    // no visible owner).
    expect(stateNames).toEqual([
      'Active', 'Closed', 'Idle', 'ModeAlpha', 'ModeBeta', 'Open', 'Paused', 'Running',
    ]);
  });

  it('omits the enclosing part name from qualified names', () => {
    const { model } = loadMultiRoot();
    const ir = transformAstToStateMachineIR(model, STV_SPEC);
    const running = ir.nodes.find(n => n.name === 'Running')!;
    expect(running.semanticRef.qualifiedName).toBe('ModeAlpha::Active::Running');
    // `part unit` must never leak into a state's qualified name.
    expect(ir.nodes.every(n => !(n.semanticRef.qualifiedName ?? '').includes('unit'))).toBe(true);
  });

  it('keeps Active composite: entry/do/exit compartments + nested Running/Paused', () => {
    const { model } = loadMultiRoot();
    const ir = transformAstToStateMachineIR(model, STV_SPEC);
    const active = ir.nodes.find(n => n.name === 'Active')!;
    expect((active.compartments ?? []).map(c => c.kind)).toEqual(['entry', 'do', 'exit']);
    const childNames = (active.containedNodes ?? [])
      .map(id => ir.nodes.find(n => n.id === id)?.name);
    expect(childNames).toEqual(expect.arrayContaining(['Running', 'Paused']));
  });

  it('emits all six declared transitions', () => {
    const { model } = loadMultiRoot();
    const ir = transformAstToStateMachineIR(model, STV_SPEC);
    expect(ir.edges).toHaveLength(6);
    expect(ir.edges.every(e => e.kind === 'transition')).toBe(true);
  });

  it('matches expected-ir.json structurally (normalized astNodeId + generatedAt)', () => {
    const { model, expectedIr } = loadMultiRoot();
    const ir = transformAstToStateMachineIR(model, STV_SPEC);
    expect(normalize(ir)).toEqual(normalize(expectedIr));
  });
});

// ── Container labels (Slice 2d.3, Bug-RENDER-02) ─────────────────────────────
// A top-level `state` USAGE is now emitted as its own composite container node,
// so each independent machine carries a visible label.

describe('state-machine transformer — multi-root container labels (Slice 2d.3)', () => {
  it('emits ModeAlpha as a composite owning Idle and Active', () => {
    const { model } = loadMultiRoot();
    const ir = transformAstToStateMachineIR(model, STV_SPEC);
    const modeAlpha = ir.nodes.find(n => n.name === 'ModeAlpha');
    expect(modeAlpha).toBeDefined();
    expect(modeAlpha!.kind).toBe('state');
    expect(modeAlpha!.containedNodes).toEqual(
      expect.arrayContaining(['state__Idle', 'state__Active']),
    );
    // Idle↔Active transitions belong to ModeAlpha's scope (not to a child).
    expect(modeAlpha!.containedEdges).toEqual(
      expect.arrayContaining(['edge__idle_to_active', 'edge__active_to_idle']),
    );
  });

  it('emits ModeBeta as a composite owning Open and Closed', () => {
    const { model } = loadMultiRoot();
    const ir = transformAstToStateMachineIR(model, STV_SPEC);
    const modeBeta = ir.nodes.find(n => n.name === 'ModeBeta');
    expect(modeBeta).toBeDefined();
    expect(modeBeta!.kind).toBe('state');
    expect(modeBeta!.containedNodes).toEqual(
      expect.arrayContaining(['state__Open', 'state__Closed']),
    );
  });

  it("qualifies a container with its own name only (no part name leak)", () => {
    const { model } = loadMultiRoot();
    const ir = transformAstToStateMachineIR(model, STV_SPEC);
    const modeAlpha = ir.nodes.find(n => n.name === 'ModeAlpha')!;
    expect(modeAlpha.semanticRef.qualifiedName).toBe('ModeAlpha');
  });

  it('gives the container the same composite shape as a nested composite (visual consistency)', () => {
    const { model } = loadMultiRoot();
    const ir = transformAstToStateMachineIR(model, STV_SPEC);
    const modeAlpha = ir.nodes.find(n => n.name === 'ModeAlpha')!;
    const active = ir.nodes.find(n => n.name === 'Active')!;
    // Both are `state` nodes with containedNodes — the renderer draws both as
    // title-bar containers, so the outer machine and the inner composite read
    // in the same visual language.
    expect(modeAlpha.kind).toBe(active.kind);
    expect((modeAlpha.containedNodes ?? []).length).toBeGreaterThan(0);
    expect((active.containedNodes ?? []).length).toBeGreaterThan(0);
  });
});

describe('state-machine transformer — defensive edge cases (Slice 2d.1)', () => {
  it('returns a valid empty IR for a model with no state nodes (no crash)', () => {
    const { model } = parseSysMLText('fixture://empty', 'package Empty { part p; }');
    const ir = transformAstToStateMachineIR(model, STV_SPEC);
    expect(ir.viewType).toBe('state-machine');
    expect(ir.nodes).toEqual([]);
    expect(ir.edges).toEqual([]);
  });
});
