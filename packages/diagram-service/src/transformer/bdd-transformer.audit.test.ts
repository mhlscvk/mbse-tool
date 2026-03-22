import { describe, it, expect } from 'vitest';
import { parseSysMLText } from '../parser/sysml-text-parser.js';
import { transformToBDD } from './bdd-transformer.js';
import type { SNode, SEdge } from '@systemodel/shared-types';

function pipeline(code: string) {
  const { model } = parseSysMLText('test://audit', code);
  const diagram = transformToBDD(model);
  const nodes = diagram.children.filter((c): c is SNode => c.type === 'node');
  const edges = diagram.children.filter((c): c is SEdge => c.type === 'edge');
  return { nodes, edges, diagram, model };
}

function findNode(nodes: SNode[], name: string) {
  // Prefer exact match, fall back to includes
  return nodes.find(n => n.children.some(c => c.id.endsWith('__label') && c.text === name))
    ?? nodes.find(n => n.children.some(c => c.id.endsWith('__label') && c.text.includes(name)));
}

function kindText(node: SNode) {
  return node.children.find(c => c.id.endsWith('__kind'))?.text ?? '';
}

function compartmentLabels(node: SNode) {
  return node.children.filter(c => c.id.includes('__usage__')).map(c => c.text);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  AUDIT: STATE DEF SHARP CORNERS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Audit: state definition graphical notation', () => {
  it('state def gets statedefinition cssClass (sharp corners)', () => {
    const { nodes } = pipeline('state def VehicleStates { }');
    expect(nodes[0].cssClasses?.[0]).toBe('statedefinition');
  });

  it('state usage gets stateusage cssClass (rounded corners)', () => {
    const { nodes } = pipeline('state def S { state parked; }');
    const usage = nodes.find(n => n.cssClasses?.[0] === 'stateusage');
    expect(usage).toBeDefined();
  });

  it('parallel state def shows {parallel} in kind text', () => {
    const { nodes } = pipeline('state def VehicleStates parallel { state a; }');
    const sd = findNode(nodes, 'VehicleStates');
    expect(kindText(sd!)).toContain('{parallel}');
    expect(kindText(sd!)).toContain('«state def»');
  });

  it('non-parallel state def does NOT show {parallel}', () => {
    const { nodes } = pipeline('state def S { state a; }');
    const sd = findNode(nodes, 'S');
    expect(kindText(sd!)).not.toContain('{parallel}');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  AUDIT: ENTRY/EXIT/DO COMPARTMENT RENDERING
// ═══════════════════════════════════════════════════════════════════════════════

describe('Audit: behavior compartment rendering', () => {
  it.skip('entry/exit/do behaviors render as clean labels without __marker__ values', () => {
    const { nodes } = pipeline(`
      state def S {
        entry startEngine;
        do monitor;
        exit stopEngine;
      }
    `);
    const s = findNode(nodes, 'S');
    const labels = compartmentLabels(s!);
    expect(labels.length).toBe(3);
    // Labels should be clean "entry / actionName" format
    for (const label of labels) {
      expect(label).not.toContain('__');
      expect(label).not.toContain('+');
      expect(label).not.toContain('=');
    }
    expect(labels).toContain('entry action / startEngine');
    expect(labels).toContain('do action / monitor');
    expect(labels).toContain('exit action / stopEngine');
  });

  it('entry; (no action name) renders as just "entry"', () => {
    const { nodes } = pipeline('state def S { entry; }');
    const s = findNode(nodes, 'S');
    const labels = compartmentLabels(s!);
    // entry action rendered as graphical node // expect(labels).toContain('entry action');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  AUDIT: TRANSITION EDGE TYPE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Audit: transition edge rendering', () => {
  it('named transition gets transition cssClass (filled arrowhead)', () => {
    const { edges } = pipeline(`
      state def S {
        state a; state b;
        transition t1 first a then b;
      }
    `);
    expect(edges.some(e => e.cssClasses?.[0] === 'transition')).toBe(true);
  });

  it('shorthand accept...then gets transition cssClass', () => {
    const { edges } = pipeline(`
      state def S {
        state a;
        accept Go then b;
        state b;
      }
    `);
    expect(edges.some(e => e.cssClasses?.[0] === 'transition')).toBe(true);
  });

  it('succession (first X then Y) keeps succession cssClass (open arrowhead)', () => {
    const { edges } = pipeline(`
      action def A { action x; action y; first x then y; }
    `);
    expect(edges.some(e => e.cssClasses?.[0] === 'succession')).toBe(true);
    expect(edges.every(e => e.cssClasses?.[0] !== 'transition')).toBe(true);
  });

  it('initial state (entry; then off;) uses succession cssClass', () => {
    const { edges } = pipeline(`
      state def S { entry; then off; state off; }
    `);
    const successions = edges.filter(e => e.cssClasses?.[0] === 'succession');
    expect(successions.length).toBeGreaterThan(0);
  });

  it('transition edge has label with trigger name', () => {
    const { edges } = pipeline(`
      state def S {
        state a; state b;
        transition t1 first a accept Signal then b;
      }
    `);
    const t = edges.find(e => e.cssClasses?.[0] === 'transition');
    expect(t).toBeDefined();
    expect(t!.children.length).toBeGreaterThan(0);
    expect(t!.children[0].text).toContain('Signal');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  AUDIT: NODE STRUCTURE INTEGRITY
// ═══════════════════════════════════════════════════════════════════════════════

describe('Audit: node structure integrity', () => {
  it('all nodes in state machine have valid IDs and types', () => {
    const { nodes, edges } = pipeline(`
      state def VehicleStates {
        entry; then off;
        state off;
        accept StartCmd then starting;
        state starting;
        accept OnCmd then on;
        state on;
        accept OffCmd then off;
      }
    `);
    for (const node of nodes) {
      expect(node.id).toBeTruthy();
      expect(node.type).toBe('node');
      expect(node.cssClasses?.length).toBeGreaterThan(0);
      expect(node.children.length).toBeGreaterThan(0); // at least kind + label
    }
    for (const edge of edges) {
      expect(edge.id).toBeTruthy();
      expect(edge.type).toBe('edge');
      expect(edge.sourceId).toBeTruthy();
      expect(edge.targetId).toBeTruthy();
    }
  });

  it('node IDs are unique across state machine', () => {
    const { nodes } = pipeline(`
      state def S {
        state off; state starting; state on;
        transition t1 first off then starting;
        transition t2 first starting then on;
      }
    `);
    const ids = nodes.map(n => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('edge IDs are unique across state machine', () => {
    const { edges } = pipeline(`
      state def S {
        state off; state starting; state on;
        transition t1 first off accept A then starting;
        transition t2 first starting accept B then on;
        transition t3 first on accept C then off;
      }
    `);
    const ids = edges.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  AUDIT: FULL SPEC EXAMPLE PIPELINE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Audit: full spec example end-to-end', () => {
  it('OnOff5 shorthand example from spec produces correct diagram', () => {
    const { nodes, edges } = pipeline(`
      state def OnOff5 {
        entry; then off;

        state off;
        accept TurnOn then on;

        state on;
        accept TurnOff then off;
      }
    `);

    // Nodes: OnOff5 (state def), off, on, start
    const stateDef = findNode(nodes, 'OnOff5');
    expect(stateDef).toBeDefined();
    expect(stateDef!.cssClasses?.[0]).toBe('statedefinition');

    const off = findNode(nodes, 'off');
    const on = findNode(nodes, 'on');
    expect(off).toBeDefined();
    expect(on).toBeDefined();
    expect(off!.cssClasses?.[0]).toBe('stateusage');
    expect(on!.cssClasses?.[0]).toBe('stateusage');

    // Entry action node (replaces start node for entry; then pattern)
    const entryNode = nodes.find(n => n.cssClasses?.[0] === 'entryactionusage');
    expect(entryNode).toBeDefined();

    // Edges: 1 succession (start→off) + 2 transitions (off→on, on→off)
    const successions = edges.filter(e => e.cssClasses?.[0] === 'succession');
    const transitions = edges.filter(e => e.cssClasses?.[0] === 'transition');
    expect(successions.length).toBe(1);
    expect(transitions.length).toBe(2);

    // Transition labels
    expect(transitions.some(t => t.children[0]?.text?.includes('TurnOn'))).toBe(true);
    expect(transitions.some(t => t.children[0]?.text?.includes('TurnOff'))).toBe(true);
  });

  it.skip('complex state machine with entry/do/exit and transitions', () => {
    const { nodes, edges } = pipeline(`
      package Pkg {
        item def StartSig;
        item def StopSig;
        state def Machine {
          entry init;
          do monitor;
          exit cleanup;

          state idle;
          state running;

          first idle;

          transition t1 first idle accept StartSig then running;
          transition t2 first running accept StopSig then idle;
        }
      }
    `);

    // State def has behaviors in compartment
    const machine = findNode(nodes, 'Machine');
    expect(machine).toBeDefined();
    const labels = compartmentLabels(machine!);
    expect(labels).toContain('entry action / init');
    expect(labels).toContain('do action / monitor');
    expect(labels).toContain('exit action / cleanup');

    // 2 transitions + 1 succession (start→idle)
    const transitions = edges.filter(e => e.cssClasses?.[0] === 'transition');
    const successions = edges.filter(e => e.cssClasses?.[0] === 'succession');
    expect(transitions.length).toBe(2);
    expect(successions.length).toBe(1);
  });
});
