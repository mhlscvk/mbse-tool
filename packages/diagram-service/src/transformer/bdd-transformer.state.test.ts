import { describe, it, expect } from 'vitest';
import { parseSysMLText } from '../parser/sysml-text-parser.js';
import { transformToBDD } from './bdd-transformer.js';
import type { SNode, SEdge } from '@systemodel/shared-types';

function pipeline(code: string) {
  const { model } = parseSysMLText('test://state', code);
  const diagram = transformToBDD(model);
  const nodes = diagram.children.filter((c): c is SNode => c.type === 'node');
  const edges = diagram.children.filter((c): c is SEdge => c.type === 'edge');
  return { nodes, edges, diagram };
}

function findNode(nodes: SNode[], name: string) {
  return nodes.find(n => n.children.some(c => c.id.endsWith('__label') && c.text.includes(name)));
}

function kindText(node: SNode) {
  return node.children.find(c => c.id.endsWith('__kind'))?.text ?? '';
}

function compartmentLabels(node: SNode) {
  return node.children.filter(c => c.id.includes('__usage__')).map(c => c.text);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  TRANSFORMER: STATE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Transformer: state definition nodes', () => {
  it('state def gets statedefinition cssClass', () => {
    const { nodes } = pipeline('state def VehicleStates { }');
    expect(nodes[0].cssClasses?.[0]).toBe('statedefinition');
  });

  it('state def shows «state def» keyword', () => {
    const { nodes } = pipeline('state def VehicleStates { }');
    expect(kindText(nodes[0])).toBe('«state def»');
  });

  it('state usage gets stateusage cssClass', () => {
    const { nodes } = pipeline('state def S { state parked; }');
    const usage = nodes.find(n => n.cssClasses?.[0] === 'stateusage');
    expect(usage).toBeDefined();
  });

  it('state usage shows «state» keyword', () => {
    const { nodes } = pipeline('state def S { state parked; }');
    const usage = nodes.find(n => n.cssClasses?.[0] === 'stateusage');
    expect(kindText(usage!)).toBe('«state»');
  });

  it('exhibit state usage gets exhibitstateusage cssClass', () => {
    const { nodes } = pipeline('part def V { exhibit vehicleStates; }');
    const exhibit = nodes.find(n => n.cssClasses?.[0] === 'exhibitstateusage');
    expect(exhibit).toBeDefined();
  });

  it('exhibit shows «exhibit» keyword', () => {
    const { nodes } = pipeline('part def V { exhibit vehicleStates; }');
    const exhibit = nodes.find(n => n.cssClasses?.[0] === 'exhibitstateusage');
    expect(kindText(exhibit!)).toBe('«exhibit»');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  TRANSFORMER: ENTRY/EXIT/DO IN COMPARTMENTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Transformer: state behaviors rendered as child nodes (not compartment labels)', () => {
  it('entry behavior renders as a separate child node, not a compartment label', () => {
    const { nodes } = pipeline(`
      state def S {
        entry startEngine;
      }
    `);
    const s = findNode(nodes, 'S');
    expect(s).toBeDefined();
    // No compartment labels for behaviors
    const labels = compartmentLabels(s!);
    expect(labels.length).toBe(0);
    // Entry behavior exists as a separate node
    const entryNode = nodes.find(n => n.cssClasses?.[0] === 'entryactionusage');
    expect(entryNode).toBeDefined();
  });

  it('exit behavior renders as a separate child node, not a compartment label', () => {
    const { nodes } = pipeline(`
      state def S {
        exit stopEngine;
      }
    `);
    const s = findNode(nodes, 'S');
    // No compartment labels for behaviors
    const labels = compartmentLabels(s!);
    expect(labels.length).toBe(0);
    // Exit behavior exists as a separate node
    const exitNode = nodes.find(n => n.cssClasses?.[0] === 'exitactionusage');
    expect(exitNode).toBeDefined();
  });

  it('do behavior renders as a separate child node, not a compartment label', () => {
    const { nodes } = pipeline(`
      state def S {
        do monitor;
      }
    `);
    const s = findNode(nodes, 'S');
    // No compartment labels for behaviors
    const labels = compartmentLabels(s!);
    expect(labels.length).toBe(0);
    // Do behavior exists as a separate node
    const doNode = nodes.find(n => n.cssClasses?.[0] === 'doactionusage');
    expect(doNode).toBeDefined();
  });

  it('all three behaviors render as separate child nodes, not compartment labels', () => {
    const { nodes } = pipeline(`
      state def S {
        entry init;
        do work;
        exit cleanup;
      }
    `);
    const s = findNode(nodes, 'S');
    // No compartment labels for behaviors
    const labels = compartmentLabels(s!);
    expect(labels.length).toBe(0);
    // Each behavior type exists as a separate node
    expect(nodes.some(n => n.cssClasses?.[0] === 'entryactionusage')).toBe(true);
    expect(nodes.some(n => n.cssClasses?.[0] === 'doactionusage')).toBe(true);
    expect(nodes.some(n => n.cssClasses?.[0] === 'exitactionusage')).toBe(true);
  });

  it('state def with child behaviors has no compartment height increase', () => {
    const noAttrs = pipeline('state def Empty { }');
    const withBehaviors = pipeline('state def S { entry init; exit cleanup; do work; }');
    const emptyNode = noAttrs.nodes[0];
    const fullNode = findNode(withBehaviors.nodes, 'S')!;
    // With graphical children, compartments are skipped so height stays base size
    expect(fullNode.size.height).toBeLessThanOrEqual(emptyNode.size.height + 10);
  });

  it('behavior child nodes do not contain "+" prefix or "__marker__" values', () => {
    const { nodes } = pipeline(`
      state def S {
        entry startEngine;
      }
    `);
    const s = findNode(nodes, 'S');
    const labels = compartmentLabels(s!);
    // No compartment labels at all
    expect(labels.length).toBe(0);
    // The entry node exists as a separate graphical node
    const entryNode = nodes.find(n => n.cssClasses?.[0] === 'entryactionusage');
    expect(entryNode).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  TRANSFORMER: STATE MACHINE EDGES
// ═══════════════════════════════════════════════════════════════════════════════

describe('Transformer: state machine edges', () => {
  it('transition edges get transition cssClass', () => {
    const { edges } = pipeline(`
      state def S {
        state a;
        state b;
        transition t1 first a then b;
      }
    `);
    expect(edges.some(e => e.cssClasses?.[0] === 'transition')).toBe(true);
  });

  it('transition edge label contains trigger name', () => {
    const { edges } = pipeline(`
      state def S {
        state a;
        state b;
        transition t1 first a accept startCmd then b;
      }
    `);
    const transition = edges.find(e => e.cssClasses?.[0] === 'transition');
    expect(transition).toBeDefined();
    const label = transition!.children[0];
    expect(label).toBeDefined();
    expect(label.text).toContain('startCmd');
  });

  it('composition edges connect state def to sub-states', () => {
    const { edges } = pipeline(`
      state def S {
        state a;
        state b;
      }
    `);
    const comps = edges.filter(e => e.cssClasses?.[0] === 'composition');
    expect(comps.length).toBeGreaterThanOrEqual(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  TRANSFORMER: FULL PIPELINE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Transformer: full state machine pipeline', () => {
  it('complete state machine produces correct diagram structure with child nodes instead of compartments', () => {
    const { nodes, edges } = pipeline(`
      state def VehicleStates {
        entry initialize;

        state parked;
        state moving;

        first parked;

        transition parkToMove
          first parked
          accept startCmd
          then moving;

        transition moveToPark
          first moving
          accept stopCmd
          then parked;
      }
    `);

    // State def node has NO compartment labels (children are rendered as separate nodes)
    const stateDef = findNode(nodes, 'VehicleStates');
    expect(stateDef).toBeDefined();
    expect(compartmentLabels(stateDef!).length).toBe(0);

    // Entry behavior exists as a separate graphical child node
    const entryNode = nodes.find(n => n.cssClasses?.[0] === 'entryactionusage');
    expect(entryNode).toBeDefined();

    // Sub-state nodes
    expect(findNode(nodes, 'parked')).toBeDefined();
    expect(findNode(nodes, 'moving')).toBeDefined();

    // Start node for initial state
    const startNode = nodes.find(n => n.cssClasses?.[0] === 'startnode');
    expect(startNode).toBeDefined();

    // Succession edge: start→parked only
    const successions = edges.filter(e => e.cssClasses?.[0] === 'succession');
    expect(successions.length).toBe(1);

    // Transition edges: parked→moving, moving→parked
    const transitions = edges.filter(e => e.cssClasses?.[0] === 'transition');
    expect(transitions.length).toBe(2);

    // Transition edges have trigger labels
    expect(transitions.some(s => s.children[0]?.text?.includes('startCmd'))).toBe(true);
    expect(transitions.some(s => s.children[0]?.text?.includes('stopCmd'))).toBe(true);
  });

  it('empty model produces no nodes or edges', () => {
    const { nodes, edges } = pipeline('');
    expect(nodes.length).toBe(0);
    expect(edges.length).toBe(0);
  });
});
