import { describe, it, expect } from 'vitest';
import { parseSysMLText } from './sysml-text-parser.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parse(code: string) {
  return parseSysMLText('test://state', code);
}
function nodeNames(code: string) {
  return parse(code).model.nodes.map(n => n.name);
}
function nodeKinds(code: string) {
  return parse(code).model.nodes.map(n => n.kind);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  1. STATE DEFINITIONS & USAGES
// ═══════════════════════════════════════════════════════════════════════════════

describe('State definitions', () => {
  it('parses state def with block body', () => {
    const { model } = parse('state def VehicleStates { }');
    expect(model.nodes[0].kind).toBe('StateDefinition');
    expect(model.nodes[0].name).toBe('VehicleStates');
  });

  it('parses state def with semicolon', () => {
    const { model } = parse('state def VehicleStates;');
    expect(model.nodes[0].kind).toBe('StateDefinition');
  });

  it('parses abstract state def', () => {
    const { model } = parse('abstract state def BaseStates { }');
    expect(model.nodes[0].isAbstract).toBe(true);
    expect(model.nodes[0].kind).toBe('StateDefinition');
  });

  it('parses state def with specialization', () => {
    const code = 'state def Base { } state def Extended :> Base { }';
    const { model } = parse(code);
    expect(model.nodes.length).toBe(2);
    const specEdge = model.connections.find(c => c.kind === 'dependency');
    expect(specEdge).toBeDefined();
    expect(specEdge!.name).toBe('«specializes»');
  });

  it('parses sub-states inside state def', () => {
    const code = `
      state def VehicleStates {
        state parked;
        state moving;
        state idle;
      }
    `;
    const { model } = parse(code);
    const stateDef = model.nodes.find(n => n.kind === 'StateDefinition');
    expect(stateDef).toBeDefined();
    // Sub-states should exist as nodes
    expect(model.nodes.some(n => n.name === 'parked')).toBe(true);
    expect(model.nodes.some(n => n.name === 'moving')).toBe(true);
    expect(model.nodes.some(n => n.name === 'idle')).toBe(true);
  });

  it('creates composition edges from state def to sub-states', () => {
    const code = `
      state def VehicleStates {
        state parked;
        state moving;
      }
    `;
    const { model } = parse(code);
    const stateDef = model.nodes.find(n => n.name === 'VehicleStates');
    const parked = model.nodes.find(n => n.name === 'parked');
    const moving = model.nodes.find(n => n.name === 'moving');
    expect(stateDef).toBeDefined();
    expect(parked).toBeDefined();
    expect(moving).toBeDefined();
    // Composition edges
    expect(model.connections.some(
      c => c.kind === 'composition' && c.sourceId === stateDef!.id && c.targetId === parked!.id
    )).toBe(true);
    expect(model.connections.some(
      c => c.kind === 'composition' && c.sourceId === stateDef!.id && c.targetId === moving!.id
    )).toBe(true);
  });
});

describe('State usages', () => {
  it('parses typed state usage', () => {
    const code = `
      state def VehicleStates { }
      part def Vehicle {
        state vs : VehicleStates;
      }
    `;
    const { model } = parse(code);
    const vs = model.nodes.find(n => n.name === 'vs');
    expect(vs).toBeDefined();
    expect(vs!.kind).toBe('StateUsage');
    expect(vs!.qualifiedName).toBe('VehicleStates');
  });

  it('creates type reference edge from state usage to definition', () => {
    const code = `
      state def VehicleStates { }
      part def Vehicle {
        state vs : VehicleStates;
      }
    `;
    const { model } = parse(code);
    const typeRef = model.connections.find(c => c.kind === 'typereference');
    expect(typeRef).toBeDefined();
  });

  it('parses untyped state usage', () => {
    const code = `state def S { state parked; }`;
    const { model } = parse(code);
    expect(model.nodes.some(n => n.name === 'parked' && n.kind === 'StateUsage')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  2. ENTRY / EXIT / DO BEHAVIORS
// ═══════════════════════════════════════════════════════════════════════════════

describe('State entry/exit/do behaviors', () => {
  it('parses entry with action name', () => {
    const code = `
      state def VehicleStates {
        entry initialize;
      }
    `;
    const { model } = parse(code);
    const stateDef = model.nodes.find(n => n.name === 'VehicleStates');
    expect(stateDef).toBeDefined();
    expect(stateDef!.attributes.some(a => a.name === 'entry action / initialize')).toBe(true);
  });

  it('parses exit with action name', () => {
    const code = `
      state def VehicleStates {
        exit cleanup;
      }
    `;
    const { model } = parse(code);
    const stateDef = model.nodes.find(n => n.name === 'VehicleStates');
    expect(stateDef!.attributes.some(a => a.name === 'exit action / cleanup')).toBe(true);
  });

  it('parses do with action name', () => {
    const code = `
      state def VehicleStates {
        do monitor;
      }
    `;
    const { model } = parse(code);
    const stateDef = model.nodes.find(n => n.name === 'VehicleStates');
    expect(stateDef!.attributes.some(a => a.name === 'do action / monitor')).toBe(true);
  });

  it('parses entry with block body', () => {
    const code = `
      state def VehicleStates {
        entry {
        }
      }
    `;
    const { model } = parse(code);
    const stateDef = model.nodes.find(n => n.name === 'VehicleStates');
    expect(stateDef!.attributes.some(a => a.name === 'entry action')).toBe(true);
  });

  it('parses multiple behaviors in same state', () => {
    const code = `
      state def Active {
        entry startEngine;
        do monitor;
        exit stopEngine;
      }
    `;
    const { model } = parse(code);
    const stateDef = model.nodes.find(n => n.name === 'Active');
    expect(stateDef!.attributes.length).toBe(3);
    expect(stateDef!.attributes.some(a => a.name === 'entry action / startEngine')).toBe(true);
    expect(stateDef!.attributes.some(a => a.name === 'do action / monitor')).toBe(true);
    expect(stateDef!.attributes.some(a => a.name === 'exit action / stopEngine')).toBe(true);
  });

  it('stores behavior attributes with special value markers', () => {
    const code = `
      state def S {
        entry init;
        exit cleanup;
        do work;
      }
    `;
    const { model } = parse(code);
    const s = model.nodes.find(n => n.name === 'S');
    expect(s!.attributes.find(a => a.name === 'entry action / init')!.value).toBe('__entry__');
    expect(s!.attributes.find(a => a.name === 'exit action / cleanup')!.value).toBe('__exit__');
    expect(s!.attributes.find(a => a.name === 'do action / work')!.value).toBe('__do__');
  });

  it('does not add behaviors outside state defs', () => {
    const code = `
      part def Vehicle {
        entry something;
      }
    `;
    const { model } = parse(code);
    const v = model.nodes.find(n => n.name === 'Vehicle');
    // "entry" shouldn't be parsed as a behavior in a non-state context
    expect(v!.attributes.filter(a => a.value === '__entry__').length).toBe(0);
  });

  it('parses entry action with action keyword prefix', () => {
    const code = `
      state def S {
        entry action doInit;
      }
    `;
    const { model } = parse(code);
    const s = model.nodes.find(n => n.name === 'S');
    expect(s!.attributes.some(a => a.name === 'entry action / doInit')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  3. FIRST AS INITIAL STATE (in state def context)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Initial state (first X; in state def)', () => {
  it('creates start → state succession for first X; in state def', () => {
    const code = `
      state def VehicleStates {
        state parked;
        state moving;
        first parked;
      }
    `;
    const { model } = parse(code);
    // Should create a start node (first X; uses StartNode, not entry action)
    expect(model.nodes.some(n => n.kind === 'StartNode')).toBe(true);
    // Should create start → parked succession
    const startNode = model.nodes.find(n => n.kind === 'StartNode');
    const parked = model.nodes.find(n => n.name === 'parked');
    expect(startNode).toBeDefined();
    expect(parked).toBeDefined();
    const succession = model.connections.find(
      c => c.kind === 'succession' && c.sourceId === startNode!.id && c.targetId === parked!.id
    );
    expect(succession).toBeDefined();
  });

  it('first X then Y; still works as succession in state def', () => {
    const code = `
      state def S {
        state a;
        state b;
        first a then b;
      }
    `;
    const { model } = parse(code);
    const a = model.nodes.find(n => n.name === 'a');
    const b = model.nodes.find(n => n.name === 'b');
    const succession = model.connections.find(
      c => c.kind === 'succession' && c.sourceId === a!.id && c.targetId === b!.id
    );
    expect(succession).toBeDefined();
  });

  it('first start; in action def still works (regression)', () => {
    const code = `
      action def A {
        action x;
        first start;
        then x;
      }
    `;
    const { model } = parse(code);
    const startNode = model.nodes.find(n => n.kind === 'StartNode');
    expect(startNode).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  4. TRANSITION USAGE PARSING
// ═══════════════════════════════════════════════════════════════════════════════

describe('Transition usage — named', () => {
  it('parses named transition with first and then', () => {
    const code = `
      state def S {
        state a;
        state b;
        transition t1 first a then b;
      }
    `;
    const { model } = parse(code);
    const a = model.nodes.find(n => n.name === 'a');
    const b = model.nodes.find(n => n.name === 'b');
    const transition = model.connections.find(
      c => c.kind === 'transition' && c.sourceId === a!.id && c.targetId === b!.id
    );
    expect(transition).toBeDefined();
  });

  it('parses named transition with accept trigger', () => {
    const code = `
      state def S {
        state parked;
        state moving;
        transition parkToMove first parked accept startDriving then moving;
      }
    `;
    const { model } = parse(code);
    const parked = model.nodes.find(n => n.name === 'parked');
    const moving = model.nodes.find(n => n.name === 'moving');
    const transition = model.connections.find(
      c => c.kind === 'transition' && c.sourceId === parked!.id && c.targetId === moving!.id
    );
    expect(transition).toBeDefined();
    expect(transition!.name).toContain('startDriving');
  });

  it('parses named transition with guard', () => {
    const code = `
      state def S {
        state a;
        state b;
        transition t1 first a if ready then b;
      }
    `;
    const { model } = parse(code);
    const transition = model.connections.find(c => c.name?.includes('[ready]'));
    expect(transition).toBeDefined();
  });

  it('parses named transition with trigger, guard, and effect', () => {
    const code = `
      state def S {
        state a;
        state b;
        transition t1 first a accept trigger1 if guard1 do effect1 then b;
      }
    `;
    const { model } = parse(code);
    const a = model.nodes.find(n => n.name === 'a');
    const b = model.nodes.find(n => n.name === 'b');
    const transition = model.connections.find(
      c => c.kind === 'transition' && c.sourceId === a!.id && c.targetId === b!.id
    );
    expect(transition).toBeDefined();
    expect(transition!.name).toContain('trigger1');
    expect(transition!.name).toContain('[guard1]');
    expect(transition!.name).toContain('/ effect1');
  });
});

describe('Transition usage — anonymous', () => {
  it('parses anonymous transition (no name)', () => {
    const code = `
      state def S {
        state a;
        state b;
        transition first a accept evt then b;
      }
    `;
    const { model } = parse(code);
    const a = model.nodes.find(n => n.name === 'a');
    const b = model.nodes.find(n => n.name === 'b');
    const transition = model.connections.find(
      c => c.kind === 'transition' && c.sourceId === a!.id && c.targetId === b!.id
    );
    expect(transition).toBeDefined();
    expect(transition!.name).toContain('evt');
  });
});

describe('Transition usage — block form', () => {
  it('parses transition with block body', () => {
    const code = `
      state def S {
        state a;
        state b;
        transition t1 {
          first a;
          accept trigger1;
          then b;
        }
      }
    `;
    const { model } = parse(code);
    const a = model.nodes.find(n => n.name === 'a');
    const b = model.nodes.find(n => n.name === 'b');
    const transition = model.connections.find(
      c => c.kind === 'transition' && c.sourceId === a!.id && c.targetId === b!.id
    );
    expect(transition).toBeDefined();
    expect(transition!.name).toContain('trigger1');
  });
});

describe('Transition — no double edges', () => {
  it('transition first/then does not create duplicate succession from SUCCESSION_PATTERN', () => {
    const code = `
      state def S {
        state a;
        state b;
        transition t1 first a then b;
      }
    `;
    const { model } = parse(code);
    const a = model.nodes.find(n => n.name === 'a');
    const b = model.nodes.find(n => n.name === 'b');
    // There should be exactly one transition from a to b, not two
    const transitions = model.connections.filter(
      c => c.kind === 'transition' && c.sourceId === a!.id && c.targetId === b!.id
    );
    expect(transitions.length).toBe(1);
  });

  it('transition if/then does not create duplicate guard from IF_THEN_PATTERN', () => {
    const code = `
      state def S {
        state a;
        state b;
        transition t1 first a if ready then b;
      }
    `;
    const { model } = parse(code);
    const guardEdges = model.connections.filter(c => c.name?.includes('[ready]'));
    expect(guardEdges.length).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  5. EXHIBIT STATE USAGE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Exhibit state usage', () => {
  it('creates ExhibitStateUsage node', () => {
    const code = `
      state def VehicleStates { }
      part def Vehicle {
        exhibit vehicleStates : VehicleStates;
      }
    `;
    const { model } = parse(code);
    const exhibit = model.nodes.find(n => n.name === 'vehicleStates');
    expect(exhibit).toBeDefined();
    expect(exhibit!.kind).toBe('ExhibitStateUsage');
  });

  it('creates composition edge from owner to exhibit', () => {
    const code = `
      part def Vehicle {
        exhibit vehicleStates;
      }
    `;
    const { model } = parse(code);
    const vehicle = model.nodes.find(n => n.name === 'Vehicle');
    const exhibit = model.nodes.find(n => n.name === 'vehicleStates');
    expect(model.connections.some(
      c => c.kind === 'composition' && c.sourceId === vehicle!.id && c.targetId === exhibit!.id
    )).toBe(true);
  });

  it('creates type reference from exhibit to state def', () => {
    const code = `
      state def VehicleStates { }
      part def Vehicle {
        exhibit vehicleStates : VehicleStates;
      }
    `;
    const { model } = parse(code);
    const typeRef = model.connections.find(
      c => c.kind === 'typereference' && c.targetId.includes('VehicleStates')
    );
    expect(typeRef).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  6. CONTROL NODES IN STATE DEFS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Control nodes inside state defs', () => {
  it('parses fork/join/merge/decide inside state def', () => {
    const code = `
      state def S {
        state a;
        state b;
        state c;
        fork f1;
        join j1;
        merge m1;
        decide d1;
      }
    `;
    const { model } = parse(code);
    expect(model.nodes.some(n => n.kind === 'ForkNode' && n.name === 'f1')).toBe(true);
    expect(model.nodes.some(n => n.kind === 'JoinNode' && n.name === 'j1')).toBe(true);
    expect(model.nodes.some(n => n.kind === 'MergeNode' && n.name === 'm1')).toBe(true);
    expect(model.nodes.some(n => n.kind === 'DecideNode' && n.name === 'd1')).toBe(true);
  });

  it('control nodes owned by state def via composition', () => {
    const code = `
      state def S {
        fork f1;
      }
    `;
    const { model } = parse(code);
    const stateDef = model.nodes.find(n => n.name === 'S');
    const fork = model.nodes.find(n => n.name === 'f1');
    expect(model.connections.some(
      c => c.kind === 'composition' && c.sourceId === stateDef!.id && c.targetId === fork!.id
    )).toBe(true);
  });

  it('successions work between control nodes and states', () => {
    const code = `
      state def S {
        state a;
        state b;
        state c;
        fork f1;
        first a then f1;
        first f1 then b;
        first f1 then c;
      }
    `;
    const { model } = parse(code);
    const successions = model.connections.filter(c => c.kind === 'succession');
    expect(successions.length).toBeGreaterThanOrEqual(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  7. COMPLETE STATE MACHINE SCENARIO
// ═══════════════════════════════════════════════════════════════════════════════

describe('Complete state machine', () => {
  it('parses a full vehicle state machine', () => {
    const code = `
      state def VehicleStates {
        entry initialize;

        state parked;
        state moving;
        state idle;

        first parked;

        transition parkToMove
          first parked
          accept startCmd
          then moving;

        transition moveToIdle
          first moving
          accept stopCmd
          then idle;

        transition idleToPark
          first idle
          accept parkCmd
          then parked;
      }
    `;
    const { model } = parse(code);

    // State def exists
    const stateDef = model.nodes.find(n => n.name === 'VehicleStates');
    expect(stateDef).toBeDefined();
    expect(stateDef!.kind).toBe('StateDefinition');

    // Entry behavior
    expect(stateDef!.attributes.some(a => a.name === 'entry action / initialize')).toBe(true);

    // Sub-states exist
    expect(model.nodes.some(n => n.name === 'parked')).toBe(true);
    expect(model.nodes.some(n => n.name === 'moving')).toBe(true);
    expect(model.nodes.some(n => n.name === 'idle')).toBe(true);

    // Initial state: start → parked
    const startNode = model.nodes.find(n => n.kind === 'StartNode');
    const parked = model.nodes.find(n => n.name === 'parked');
    expect(startNode).toBeDefined();
    expect(model.connections.some(
      c => c.kind === 'succession' && c.sourceId === startNode!.id && c.targetId === parked!.id
    )).toBe(true);

    // Transitions with triggers
    const moving = model.nodes.find(n => n.name === 'moving');
    const idle = model.nodes.find(n => n.name === 'idle');

    // parked → moving with startCmd trigger
    const parkToMove = model.connections.find(
      c => c.kind === 'transition' && c.sourceId === parked!.id && c.targetId === moving!.id
    );
    expect(parkToMove).toBeDefined();
    expect(parkToMove!.name).toContain('startCmd');

    // moving → idle with stopCmd trigger
    const moveToIdle = model.connections.find(
      c => c.kind === 'transition' && c.sourceId === moving!.id && c.targetId === idle!.id
    );
    expect(moveToIdle).toBeDefined();
    expect(moveToIdle!.name).toContain('stopCmd');

    // idle → parked with parkCmd trigger
    const idleToPark = model.connections.find(
      c => c.kind === 'transition' && c.sourceId === idle!.id && c.targetId === parked!.id
    );
    expect(idleToPark).toBeDefined();
    expect(idleToPark!.name).toContain('parkCmd');
  });

  it('regression: existing action flow parsing still works', () => {
    const code = `
      action def MyAction {
        first start;
        then fork fork1;
        then action1;
        then action2;
        action action1; then join1;
        action action2; then join1;
        join join1;
        then decide decision1;
          if guard2 then action3;
          if guard1 then action4;
        action action3; then merge1;
        action action4; then merge1;
        merge merge1; then terminate;
      }
    `;
    const { model } = parse(code);
    const successions = model.connections.filter(c => c.kind === 'succession');
    expect(successions.length).toBe(11);
    expect(successions.filter(f => f.name?.includes('[')).length).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  8. EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe('State parsing edge cases', () => {
  it('handles empty state def', () => {
    const { model } = parse('state def Empty { }');
    expect(model.nodes[0].kind).toBe('StateDefinition');
    expect(model.nodes[0].attributes.length).toBe(0);
  });

  it('handles state def with only behaviors, no sub-states', () => {
    const code = `
      state def S {
        entry init;
        exit cleanup;
      }
    `;
    const { model } = parse(code);
    const s = model.nodes.find(n => n.name === 'S');
    expect(s!.attributes.length).toBe(2);
  });

  it('transition without first or then does not crash', () => {
    const code = `
      state def S {
        transition t1;
      }
    `;
    const { model } = parse(code);
    expect(model).toBeDefined();
    // No transition edges should be created
    const transitions = model.connections.filter(c => c.kind === 'transition');
    expect(transitions.length).toBe(0);
  });

  it('transition with only first (no then) does not create edge', () => {
    const code = `
      state def S {
        state a;
        transition t1 first a;
      }
    `;
    const { model } = parse(code);
    // No transition edges expected (need both source and target)
    const transitions = model.connections.filter(c => c.kind === 'transition');
    expect(transitions.length).toBe(0);
  });

  it('multiple transitions between different states create correct edges', () => {
    const code = `
      state def S {
        state a;
        state b;
        state c;
        transition t1 first a accept evt1 then b;
        transition t2 first b accept evt2 then c;
      }
    `;
    const { model } = parse(code);
    const a = model.nodes.find(n => n.name === 'a');
    const b = model.nodes.find(n => n.name === 'b');
    const c = model.nodes.find(n => n.name === 'c');
    // a → b with evt1
    const s1 = model.connections.find(
      conn => conn.kind === 'transition' && conn.sourceId === a!.id && conn.targetId === b!.id
    );
    expect(s1).toBeDefined();
    expect(s1!.name).toContain('evt1');
    // b → c with evt2
    const s2 = model.connections.find(
      conn => conn.kind === 'transition' && conn.sourceId === b!.id && conn.targetId === c!.id
    );
    expect(s2).toBeDefined();
    expect(s2!.name).toContain('evt2');
  });

  it('parallel state def is parsed', () => {
    const code = `state def VehicleStates parallel { state a; state b; }`;
    const { model } = parse(code);
    const stateDef = model.nodes.find(n => n.name === 'VehicleStates');
    expect(stateDef).toBeDefined();
    expect(stateDef!.isParallel).toBe(true);
  });

  it('state inside package is properly owned', () => {
    const code = `
      package Pkg {
        state def S {
          state a;
        }
      }
    `;
    const { model } = parse(code);
    const pkg = model.nodes.find(n => n.kind === 'Package');
    const stateDef = model.nodes.find(n => n.name === 'S');
    expect(model.connections.some(
      c => c.kind === 'composition' && c.sourceId === pkg!.id && c.targetId === stateDef!.id
    )).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  9. SHORTHAND TRANSITIONS (spec 7.18.3 TargetTransitionUsage)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Shorthand transitions (accept...then without transition keyword)', () => {
  it('parses shorthand: state off; accept TurnOn then on;', () => {
    const code = `
      state def OnOff {
        entry; then off;
        state off;
        accept TurnOn then on;
        state on;
      }
    `;
    const { model } = parse(code);
    const off = model.nodes.find(n => n.name === 'off');
    const on = model.nodes.find(n => n.name === 'on');
    expect(off).toBeDefined();
    expect(on).toBeDefined();
    // off → on with TurnOn trigger
    const transition = model.connections.find(
      conn => conn.kind === 'transition' && conn.sourceId === off!.id && conn.targetId === on!.id
    );
    expect(transition).toBeDefined();
    expect(transition!.name).toContain('TurnOn');
  });

  it('parses shorthand with guard: accept TurnOn if isEnabled then on;', () => {
    const code = `
      state def S {
        state off;
        accept TurnOn if isEnabled then on;
        state on;
      }
    `;
    const { model } = parse(code);
    const transition = model.connections.find(
      conn => conn.kind === 'transition' && conn.name?.includes('TurnOn')
    );
    expect(transition).toBeDefined();
    expect(transition!.name).toContain('[isEnabled]');
  });

  it('parses shorthand with via port: accept TurnOn via commPort then on;', () => {
    const code = `
      state def S {
        state off;
        accept TurnOn via commPort then on;
        state on;
      }
    `;
    const { model } = parse(code);
    const transition = model.connections.find(
      conn => conn.kind === 'transition' && conn.name?.includes('TurnOn')
    );
    expect(transition).toBeDefined();
    expect(transition!.name).toContain('via commPort');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  10. ENTRY-THEN SUCCESSION (spec 7.18.2)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Entry-then succession', () => {
  it('entry; then off; creates entry action → off succession', () => {
    const code = `
      state def OnOff {
        entry; then off;
        state off;
        state on;
      }
    `;
    const { model } = parse(code);
    const startNode = model.nodes.find(n => n.kind === 'EntryActionUsage');
    const off = model.nodes.find(n => n.name === 'off');
    expect(startNode).toBeDefined();
    expect(off).toBeDefined();
    const succession = model.connections.find(
      conn => conn.kind === 'succession' && conn.sourceId === startNode!.id && conn.targetId === off!.id
    );
    expect(succession).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  11. ACCEPT VIA AND TIMED TRIGGERS IN FULL TRANSITIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Accept via port and timed triggers in transitions', () => {
  it('transition with accept via port includes port in label', () => {
    const code = `
      state def S {
        state off;
        state on;
        transition t1 first off accept TurnOn via commPort then on;
      }
    `;
    const { model } = parse(code);
    const transition = model.connections.find(
      conn => conn.kind === 'transition' && conn.name?.includes('TurnOn')
    );
    expect(transition).toBeDefined();
    expect(transition!.name).toContain('via commPort');
  });

  it('transition with accept after (timed trigger)', () => {
    const code = `
      state def S {
        state on;
        state off;
        transition t1 first on accept after 5 then off;
      }
    `;
    const { model } = parse(code);
    const transition = model.connections.find(
      conn => conn.kind === 'transition' && conn.name?.includes('after')
    );
    expect(transition).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  12. PARALLEL STATE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Parallel state', () => {
  it('parses state def with parallel keyword', () => {
    const { model } = parse('state def VehicleStates parallel { state a; state b; }');
    const sd = model.nodes.find(n => n.name === 'VehicleStates');
    expect(sd).toBeDefined();
    expect(sd!.kind).toBe('StateDefinition');
    expect(sd!.isParallel).toBe(true);
  });

  it('non-parallel state def has no isParallel', () => {
    const { model } = parse('state def S { state a; }');
    const sd = model.nodes.find(n => n.name === 'S');
    expect(sd!.isParallel).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  13. SPEC EXAMPLES (from SysML v2 formal/2025-09-03)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Spec examples', () => {
  it('OnOff1: basic transitions (spec 7.18.3)', () => {
    const code = `
      state def OnOff1 {
        entry; then off;
        state off;
        state on;
        transition off_on first off then on;
        transition on_off first on then off;
      }
    `;
    const { model } = parse(code);
    const off = model.nodes.find(n => n.name === 'off');
    const on = model.nodes.find(n => n.name === 'on');
    // entry → off (via start node)
    const startNode = model.nodes.find(n => n.kind === 'EntryActionUsage');
    expect(startNode).toBeDefined();
    expect(model.connections.some(
      conn => conn.kind === 'succession' && conn.sourceId === startNode!.id && conn.targetId === off!.id
    )).toBe(true);
    // off → on
    expect(model.connections.some(
      conn => conn.kind === 'transition' && conn.sourceId === off!.id && conn.targetId === on!.id
    )).toBe(true);
    // on → off
    expect(model.connections.some(
      conn => conn.kind === 'transition' && conn.sourceId === on!.id && conn.targetId === off!.id
    )).toBe(true);
  });

  it('OnOff5: shorthand transitions (spec 7.18.3)', () => {
    const code = `
      state def OnOff5 {
        entry; then off;
        state off;
        accept TurnOn then on;
        state on;
        accept TurnOff then off;
      }
    `;
    const { model } = parse(code);
    const off = model.nodes.find(n => n.name === 'off');
    const on = model.nodes.find(n => n.name === 'on');
    // off → on via TurnOn
    const offToOn = model.connections.find(
      conn => conn.kind === 'transition' && conn.sourceId === off!.id && conn.targetId === on!.id
    );
    expect(offToOn).toBeDefined();
    expect(offToOn!.name).toContain('TurnOn');
    // on → off via TurnOff
    const onToOff = model.connections.find(
      conn => conn.kind === 'transition' && conn.sourceId === on!.id && conn.targetId === off!.id
    );
    expect(onToOff).toBeDefined();
    expect(onToOff!.name).toContain('TurnOff');
  });

  it('Shorthand transitions: accept...then (example_2 reference)', () => {
    const code = `state def VehicleStates {
  entry; then off;

  state off;
  accept VehicleStartSignal
    then starting;

  state starting;
  accept VehicleOnSignal
    then on;

  state on;
  accept VehicleOffSignal
    then off;
}`;
    const { model } = parse(code);
    const transitions = model.connections.filter(c => c.kind === 'transition');
    const successions = model.connections.filter(c => c.kind === 'succession');
    // 3 shorthand transitions with correct source inference
    expect(transitions.length).toBe(3);
    const off = model.nodes.find(n => n.name === 'off');
    const starting = model.nodes.find(n => n.name === 'starting');
    const on = model.nodes.find(n => n.name === 'on');
    // off → starting via VehicleStartSignal
    expect(transitions.some(t =>
      t.sourceId === off!.id && t.targetId === starting!.id && t.name?.includes('VehicleStartSignal')
    )).toBe(true);
    // starting → on via VehicleOnSignal
    expect(transitions.some(t =>
      t.sourceId === starting!.id && t.targetId === on!.id && t.name?.includes('VehicleOnSignal')
    )).toBe(true);
    // on → off via VehicleOffSignal
    expect(transitions.some(t =>
      t.sourceId === on!.id && t.targetId === off!.id && t.name?.includes('VehicleOffSignal')
    )).toBe(true);
    // 1 succession: entry action → off (from entry; then off;)
    expect(successions.length).toBe(1);
    const startNode = model.nodes.find(n => n.kind === 'EntryActionUsage');
    expect(successions[0].sourceId).toBe(startNode!.id);
    expect(successions[0].targetId).toBe(off!.id);
  });

  it('VehicleStates parallel (spec 7.18.2)', () => {
    const code = `
      state def VehicleStates parallel {
        state OperationalStates;
        state HealthStates;
      }
    `;
    const { model } = parse(code);
    const sd = model.nodes.find(n => n.name === 'VehicleStates');
    expect(sd!.isParallel).toBe(true);
    expect(model.nodes.some(n => n.name === 'OperationalStates')).toBe(true);
    expect(model.nodes.some(n => n.name === 'HealthStates')).toBe(true);
  });
});
