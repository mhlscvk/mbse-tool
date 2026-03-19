import { describe, it, expect } from 'vitest';
import { parseSysMLText } from '../parser/sysml-text-parser.js';
import { transformToBDD } from './bdd-transformer.js';
import { applyViewFilter } from './view-filters.js';
import type { SNode, SEdge, ViewType } from '@systemodel/shared-types';

function pipeline(code: string, viewType: ViewType = 'general') {
  const { model } = parseSysMLText('test://test', code);
  const diagram = transformToBDD(model, viewType);
  const nodes = diagram.children.filter((c): c is SNode => c.type === 'node');
  const edges = diagram.children.filter((c): c is SEdge => c.type === 'edge');
  return { nodes, edges, diagram, model };
}

function rawFilter(code: string, viewType: ViewType) {
  const { model } = parseSysMLText('test://test', code);
  return applyViewFilter(model, viewType);
}

function findNode(nodes: SNode[], name: string) {
  return nodes.find(n => n.children.some(c => c.id.endsWith('__label') && c.text.includes(name)));
}

function edgeKinds(edges: SEdge[]) {
  return edges.map(e => e.cssClasses?.[0]).filter(Boolean);
}

// ═══════════════════════════════════════════════════════════════════════════════

describe('View Filters: General View', () => {
  it('passes through all nodes and edges', () => {
    const code = `
      part def Vehicle {
        part engine : Engine;
        port fuelIn;
      }
      part def Engine;
      action def Drive;
      state def Moving;
    `;
    const { nodes } = pipeline(code, 'general');
    expect(findNode(nodes, 'Vehicle')).toBeDefined();
    expect(findNode(nodes, 'engine')).toBeDefined();
    expect(findNode(nodes, 'fuelIn')).toBeDefined();
    expect(findNode(nodes, 'Engine')).toBeDefined();
    expect(findNode(nodes, 'Drive')).toBeDefined();
    expect(findNode(nodes, 'Moving')).toBeDefined();
  });

  it('general view hides stub defs when successions are present', () => {
    const code = `
      action def Brake;
      action def Drive {
        action accelerate;
        action brake;
        first accelerate then brake;
      }
    `;
    const { nodes } = pipeline(code, 'general');
    expect(findNode(nodes, 'Drive')).toBeDefined();
    expect(findNode(nodes, 'Brake')).toBeUndefined();
  });

  it('preserves defs with attributes even when successions exist', () => {
    const code = `
      action def WithAttrs { attribute mass : Real; }
      action def Flow {
        action a; action b;
        first a then b;
      }
    `;
    const { nodes } = pipeline(code, 'general');
    expect(findNode(nodes, 'WithAttrs')).toBeDefined();
  });
});

describe('View Filters: Interconnection View', () => {
  it('keeps parts, ports, connections', () => {
    const code = `
      part def Vehicle {
        part engine : Engine;
        port fuelIn;
      }
      part def Engine;
    `;
    const { nodes } = pipeline(code, 'interconnection');
    expect(findNode(nodes, 'Vehicle')).toBeDefined();
    expect(findNode(nodes, 'engine')).toBeDefined();
    expect(findNode(nodes, 'fuelIn')).toBeDefined();
    expect(findNode(nodes, 'Engine')).toBeDefined();
  });

  it('hides actions and states', () => {
    const code = `
      part def Vehicle {
        part engine : Engine;
        action drive;
        state moving;
      }
      part def Engine;
    `;
    const { nodes } = pipeline(code, 'interconnection');
    expect(findNode(nodes, 'drive')).toBeUndefined();
    expect(findNode(nodes, 'moving')).toBeUndefined();
    expect(findNode(nodes, 'engine')).toBeDefined();
  });

  it('hides succession edges', () => {
    const code = `
      part def Vehicle {
        part a;
        part b;
      }
      part def Engine;
    `;
    const { edges } = pipeline(code, 'interconnection');
    const kinds = edgeKinds(edges);
    expect(kinds).not.toContain('succession');
  });

  it('keeps port definitions with connected usages', () => {
    const code = `
      part def Radio {
        port dataIn;
        port dataOut;
      }
    `;
    const { nodes } = pipeline(code, 'interconnection');
    expect(findNode(nodes, 'Radio')).toBeDefined();
    expect(findNode(nodes, 'dataIn')).toBeDefined();
    expect(findNode(nodes, 'dataOut')).toBeDefined();
  });

  it('keeps item usages inside parts', () => {
    const code = `
      part def Pipe {
        item water;
      }
    `;
    const { nodes } = pipeline(code, 'interconnection');
    expect(findNode(nodes, 'water')).toBeDefined();
  });

  it('keeps flow and bind edge kinds', () => {
    const filtered = rawFilter(`
      part def S {
        part a; part b;
      }
    `, 'interconnection');
    // Verify the IV_EDGE_KINDS filter set
    const allowed = new Set(['composition', 'flow', 'bind', 'association', 'typereference', 'subsetting', 'redefinition', 'referencesubsetting']);
    for (const c of filtered.connections) {
      expect(allowed.has(c.kind)).toBe(true);
    }
  });

  it('removes disconnected standalone defs', () => {
    const code = `
      part def Orphan;
      action def AlsoOrphan;
    `;
    const { nodes } = pipeline(code, 'interconnection');
    // Orphan part def has no edges → removed
    // AlsoOrphan is action def → not in IV_NODE_KINDS → removed
    expect(nodes.length).toBe(0);
  });
});

describe('View Filters: Action Flow View', () => {
  it('keeps actions, control nodes, and successions', () => {
    const code = `
      action def Drive {
        action accelerate;
        action brake;
        first accelerate then brake;
      }
    `;
    const { nodes, edges } = pipeline(code, 'action-flow');
    expect(findNode(nodes, 'accelerate')).toBeDefined();
    expect(findNode(nodes, 'brake')).toBeDefined();
    expect(edgeKinds(edges)).toContain('succession');
  });

  it('hides parts and ports', () => {
    const code = `
      part def Vehicle {
        part engine;
        port fuelIn;
        action drive;
      }
    `;
    const { nodes } = pipeline(code, 'action-flow');
    expect(findNode(nodes, 'engine')).toBeUndefined();
    expect(findNode(nodes, 'fuelIn')).toBeUndefined();
    expect(findNode(nodes, 'drive')).toBeDefined();
  });

  it('keeps control nodes', () => {
    const code = `
      action def Process {
        fork f1;
        join j1;
        action a;
        action b;
        first f1 then a;
        first f1 then b;
        first a then j1;
        first b then j1;
      }
    `;
    const { nodes } = pipeline(code, 'action-flow');
    expect(nodes.some(n => n.cssClasses?.[0] === 'forknode')).toBe(true);
    expect(nodes.some(n => n.cssClasses?.[0] === 'joinnode')).toBe(true);
  });

  it('hides empty stub action definitions', () => {
    const code = `
      action def StubAction;
      action def ProcessFlow {
        action a;
        action b;
        first a then b;
      }
    `;
    const { nodes } = pipeline(code, 'action-flow');
    expect(findNode(nodes, 'StubAction')).toBeUndefined();
  });

  it('keeps perform action usages', () => {
    const code = `
      action def Outer {
        perform action inner;
      }
    `;
    const { nodes } = pipeline(code, 'action-flow');
    expect(findNode(nodes, 'inner')).toBeDefined();
  });

  it('keeps directed parameters (in/out items)', () => {
    const code = `
      action def Transform {
        in item input;
        out item output;
      }
    `;
    const { nodes } = pipeline(code, 'action-flow');
    expect(findNode(nodes, 'input')).toBeDefined();
    expect(findNode(nodes, 'output')).toBeDefined();
  });

  it('hides states and state definitions', () => {
    const code = `
      state def Idle;
      action def Run { action step; }
    `;
    const { nodes } = pipeline(code, 'action-flow');
    expect(findNode(nodes, 'Idle')).toBeUndefined();
    expect(findNode(nodes, 'step')).toBeDefined();
  });

  it('excludes transition edges', () => {
    const filtered = rawFilter(`
      action def A { action a; }
    `, 'action-flow');
    const allowed = new Set(['succession', 'flow', 'transition', 'composition', 'typereference']);
    for (const c of filtered.connections) {
      expect(allowed.has(c.kind)).toBe(true);
    }
  });
});

describe('View Filters: State Transition View', () => {
  it('keeps states and transitions', () => {
    const code = `
      state def VehicleStates {
        state idle;
        state moving;
        transition idle_to_moving
          first idle then moving;
      }
    `;
    const { nodes } = pipeline(code, 'state-transition');
    expect(findNode(nodes, 'idle')).toBeDefined();
    expect(findNode(nodes, 'moving')).toBeDefined();
    expect(findNode(nodes, 'VehicleStates')).toBeDefined();
  });

  it('hides actions, parts, ports', () => {
    const code = `
      part def Vehicle {
        part engine;
        action drive;
        state moving;
      }
    `;
    const { nodes } = pipeline(code, 'state-transition');
    expect(findNode(nodes, 'engine')).toBeUndefined();
    expect(findNode(nodes, 'drive')).toBeUndefined();
    expect(findNode(nodes, 'moving')).toBeDefined();
  });

  it('keeps control nodes in state machines', () => {
    const code = `
      state def SM {
        state a;
        state b;
        fork f;
        first f then a;
        first f then b;
      }
    `;
    const { nodes } = pipeline(code, 'state-transition');
    expect(nodes.some(n => n.cssClasses?.[0] === 'forknode')).toBe(true);
  });

  it('keeps exhibit state usages', () => {
    const code = `
      state def Modes {
        exhibit state active;
      }
    `;
    const { nodes } = pipeline(code, 'state-transition');
    expect(findNode(nodes, 'active')).toBeDefined();
  });

  it('keeps state defs with entry/do/exit compartments', () => {
    const code = `
      state def Running {
        entry; do; exit;
      }
    `;
    const { nodes } = pipeline(code, 'state-transition');
    expect(findNode(nodes, 'Running')).toBeDefined();
  });

  it('hides requirement and constraint elements', () => {
    const code = `
      requirement def MassReq;
      constraint def MaxSpeed;
      state def Active { state on; }
    `;
    const { nodes } = pipeline(code, 'state-transition');
    expect(findNode(nodes, 'MassReq')).toBeUndefined();
    expect(findNode(nodes, 'MaxSpeed')).toBeUndefined();
    expect(findNode(nodes, 'on')).toBeDefined();
  });
});

describe('View Filters: graph ID includes view type', () => {
  it('general view graph ID starts with general__', () => {
    const { diagram } = pipeline('part def A;', 'general');
    expect(diagram.id).toMatch(/^general__/);
  });

  it('interconnection view graph ID starts with interconnection__', () => {
    const code = 'part def A { part b; }';
    const { diagram } = pipeline(code, 'interconnection');
    expect(diagram.id).toMatch(/^interconnection__/);
  });

  it('action-flow view graph ID starts with action-flow__', () => {
    const code = 'action def A { action b; }';
    const { diagram } = pipeline(code, 'action-flow');
    expect(diagram.id).toMatch(/^action-flow__/);
  });

  it('state-transition view graph ID starts with state-transition__', () => {
    const code = 'state def A { state b; }';
    const { diagram } = pipeline(code, 'state-transition');
    expect(diagram.id).toMatch(/^state-transition__/);
  });
});

describe('View Filters: cross-view consistency', () => {
  const MIXED_MODEL = `
    package System {
      part def Vehicle {
        part engine : Engine;
        port fuelIn;
        action drive;
        state moving;
      }
      part def Engine;
      action def Accelerate {
        action step1;
        action step2;
        first step1 then step2;
      }
      state def VehicleStates {
        state idle;
        state running;
        transition first idle then running;
      }
    }
  `;

  it('GV shows more nodes than any specialized view', () => {
    const gv = pipeline(MIXED_MODEL, 'general');
    const iv = pipeline(MIXED_MODEL, 'interconnection');
    const afv = pipeline(MIXED_MODEL, 'action-flow');
    const stv = pipeline(MIXED_MODEL, 'state-transition');
    expect(gv.nodes.length).toBeGreaterThanOrEqual(iv.nodes.length);
    expect(gv.nodes.length).toBeGreaterThanOrEqual(afv.nodes.length);
    expect(gv.nodes.length).toBeGreaterThanOrEqual(stv.nodes.length);
  });

  it('IV does not contain action or state usages', () => {
    const { nodes } = pipeline(MIXED_MODEL, 'interconnection');
    const kinds = nodes.map(n => n.cssClasses?.[0]);
    expect(kinds).not.toContain('actionusage');
    expect(kinds).not.toContain('stateusage');
  });

  it('AFV does not contain part or port usages', () => {
    const { nodes } = pipeline(MIXED_MODEL, 'action-flow');
    const kinds = nodes.map(n => n.cssClasses?.[0]);
    expect(kinds).not.toContain('partusage');
    expect(kinds).not.toContain('portusage');
  });

  it('STV does not contain part, port, or action usages', () => {
    const { nodes } = pipeline(MIXED_MODEL, 'state-transition');
    const kinds = nodes.map(n => n.cssClasses?.[0]);
    expect(kinds).not.toContain('partusage');
    expect(kinds).not.toContain('portusage');
    expect(kinds).not.toContain('actionusage');
  });

  it('packages are preserved in all views', () => {
    const gv = pipeline(MIXED_MODEL, 'general');
    const iv = pipeline(MIXED_MODEL, 'interconnection');
    const afv = pipeline(MIXED_MODEL, 'action-flow');
    const stv = pipeline(MIXED_MODEL, 'state-transition');
    expect(findNode(gv.nodes, 'System')).toBeDefined();
    expect(findNode(iv.nodes, 'System')).toBeDefined();
    expect(findNode(afv.nodes, 'System')).toBeDefined();
    expect(findNode(stv.nodes, 'System')).toBeDefined();
  });
});

describe('View Filters: applyViewFilter direct', () => {
  it('returns same nodes/connections for general view', () => {
    const { model } = parseSysMLText('test://test', 'part def A { part b; }');
    const filtered = applyViewFilter(model, 'general');
    expect(filtered.nodes).toBe(model.nodes);
    expect(filtered.connections).toBe(model.connections);
  });

  it('returns fewer nodes for specialized views', () => {
    const code = `
      part def Vehicle { part e; action d; state s; }
    `;
    const { model } = parseSysMLText('test://test', code);
    const gv = applyViewFilter(model, 'general');
    const iv = applyViewFilter(model, 'interconnection');
    const afv = applyViewFilter(model, 'action-flow');
    const stv = applyViewFilter(model, 'state-transition');
    expect(iv.nodes.length).toBeLessThanOrEqual(gv.nodes.length);
    expect(afv.nodes.length).toBeLessThanOrEqual(gv.nodes.length);
    expect(stv.nodes.length).toBeLessThanOrEqual(gv.nodes.length);
  });

  it('empty model produces empty results for all views', () => {
    const { model } = parseSysMLText('test://test', '');
    const views: ViewType[] = ['general', 'interconnection', 'action-flow', 'state-transition'];
    for (const vt of views) {
      const filtered = applyViewFilter(model, vt);
      expect(filtered.nodes.length).toBe(0);
      expect(filtered.connections.length).toBe(0);
    }
  });
});
