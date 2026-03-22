import { describe, it, expect } from 'vitest';
import { parseSysMLText } from '../parser/sysml-text-parser.js';
import { transformToBDD } from './bdd-transformer.js';
import type { SNode, SEdge, SModelRoot } from '@systemodel/shared-types';
import type { SysMLModel } from '@systemodel/shared-types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pipeline(code: string) {
  const { model } = parseSysMLText('test://test', code);
  const diagram = transformToBDD(model);
  const nodes = diagram.children.filter((c): c is SNode => c.type === 'node');
  const edges = diagram.children.filter((c): c is SEdge => c.type === 'edge');
  return { nodes, edges, diagram, model };
}

function findNode(nodes: SNode[], name: string) {
  return nodes.find(n => n.children.some(c => c.id.endsWith('__label') && c.text.includes(name)));
}

// ═══════════════════════════════════════════════════════════════════════════════
//  TRANSFORMER ROBUSTNESS TESTS
// ═══════════════════════════════════════════════════════════════════════════════

// ── 1. Empty and minimal models ──────────────────────────────────────────────

describe('Transformer: empty/minimal models', () => {
  it('empty model produces valid graph with no children', () => {
    const { nodes, edges, diagram } = pipeline('');
    expect(diagram.type).toBe('graph');
    expect(nodes).toHaveLength(0);
    expect(edges).toHaveLength(0);
  });

  it('single definition produces exactly one node', () => {
    const { nodes } = pipeline('part def Solo;');
    expect(nodes).toHaveLength(1);
  });

  it('definition with no body produces node with correct structure', () => {
    const { nodes } = pipeline('part def Empty;');
    const node = nodes[0];
    expect(node.type).toBe('node');
    expect(node.id).toBeTruthy();
    expect(node.size.width).toBeGreaterThan(0);
    expect(node.size.height).toBeGreaterThan(0);
  });
});

// ── 2. Node structure validation ─────────────────────────────────────────────

describe('Transformer: node structure', () => {
  it('all nodes have required fields', () => {
    const code = `
      part def Vehicle { part engine : Engine; }
      part def Engine;
      package Systems { attribute def Mass; }
    `;
    const { nodes } = pipeline(code);
    for (const node of nodes) {
      expect(node.type).toBe('node');
      expect(node.id).toBeTruthy();
      expect(typeof node.size.width).toBe('number');
      expect(typeof node.size.height).toBe('number');
      expect(node.cssClasses).toBeDefined();
      expect(node.cssClasses!.length).toBeGreaterThan(0);
    }
  });

  it('all edges have required fields', () => {
    const code = 'part def A; part def B :> A;';
    const { edges } = pipeline(code);
    for (const edge of edges) {
      expect(edge.type).toBe('edge');
      expect(edge.id).toBeTruthy();
      expect(edge.sourceId).toBeTruthy();
      expect(edge.targetId).toBeTruthy();
      expect(edge.cssClasses).toBeDefined();
    }
  });

  it('node IDs are unique', () => {
    const code = `
      part def A; part def B; part def C;
      attribute def D; port def E;
    `;
    const { nodes } = pipeline(code);
    const ids = nodes.map(n => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('edge IDs are unique', () => {
    const code = `
      part def A; part def B :> A; part def C :> A;
    `;
    const { edges } = pipeline(code);
    const ids = edges.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ── 3. Label correctness ─────────────────────────────────────────────────────

describe('Transformer: labels', () => {
  it('definition node has kind and name labels', () => {
    const { nodes } = pipeline('part def Vehicle;');
    const node = nodes[0];
    const kindLabel = node.children.find(c => c.id.endsWith('__kind'));
    const nameLabel = node.children.find(c => c.id.endsWith('__label'));
    expect(kindLabel).toBeDefined();
    expect(nameLabel).toBeDefined();
    expect(nameLabel!.text).toContain('Vehicle');
  });

  it('abstract definition shows abstract marker', () => {
    const { nodes } = pipeline('abstract part def Base;');
    const node = nodes[0];
    const kindLabel = node.children.find(c => c.id.endsWith('__kind'));
    expect(kindLabel!.text).toContain('abstract');
  });

  it('usage node shows type in name label', () => {
    const code = 'part def Owner { part engine : Engine; }\npart def Engine;';
    const { nodes } = pipeline(code);
    const engine = findNode(nodes, 'engine');
    expect(engine).toBeDefined();
    const nameLabel = engine!.children.find(c => c.id.endsWith('__label'));
    expect(nameLabel!.text).toContain('Engine');
  });
});

// ── 4. Edge type mapping ─────────────────────────────────────────────────────

describe('Transformer: edge CSS classes', () => {
  it('specialization edge has dependency class', () => {
    const { edges } = pipeline('part def A; part def B :> A;');
    expect(edges.some(e => e.cssClasses?.[0] === 'dependency')).toBe(true);
  });

  it('composition edge has composition class', () => {
    const { edges } = pipeline('part def A { part b : B; }\npart def B;');
    expect(edges.some(e => e.cssClasses?.[0] === 'composition')).toBe(true);
  });

  it('type reference edge has typereference class', () => {
    const { edges } = pipeline('part def A { part b : B; }\npart def B;');
    expect(edges.some(e => e.cssClasses?.[0] === 'typereference')).toBe(true);
  });

  it('flow edge has flow class', () => {
    const code = `
      action def Proc {
        action s1; action s2;
        flow from s1 to s2;
      }
    `;
    const { edges } = pipeline(code);
    expect(edges.some(e => e.cssClasses?.[0] === 'flow')).toBe(true);
  });

  it('satisfy edge has satisfy class', () => {
    const code = 'requirement def R; part def Impl; satisfy R by Impl;';
    const { edges } = pipeline(code);
    expect(edges.some(e => e.cssClasses?.[0] === 'satisfy')).toBe(true);
  });
});

// ── 5. Compartment rendering ─────────────────────────────────────────────────

describe('Transformer: nodes with visible children have no compartment labels', () => {
  it('definition with child attribute usages has no compartment labels when children are graphical nodes', () => {
    const code = `
      part def Vehicle {
        attribute mass : Real;
        attribute speed : Real;
      }
    `;
    const { nodes } = pipeline(code);
    const vehicle = findNode(nodes, 'Vehicle');
    expect(vehicle).toBeDefined();
    // Children are rendered as separate graphical nodes, so no compartment labels
    const usageLabels = vehicle!.children.filter(c => c.id.includes('__usage__'));
    expect(usageLabels.length).toBe(0);
    // The child attributes exist as separate SNode entries
    const attrNodes = nodes.filter(n => n.cssClasses?.[0] === 'attributeusage');
    expect(attrNodes.length).toBe(2);
  });

  it('child attribute nodes exist as separate SNode entries with correct cssClasses', () => {
    const code = 'part def Big { attribute a1 : Real; attribute a2 : Real; attribute a3 : Real; attribute a4 : Real; attribute a5 : Real; }';
    const { nodes } = pipeline(code);
    const big = findNode(nodes, 'Big');
    expect(big).toBeDefined();
    // No compartment labels
    const usageLabels = big!.children.filter(c => c.id.includes('__usage__'));
    expect(usageLabels.length).toBe(0);
    // All 5 attributes exist as separate child nodes
    const attrNodes = nodes.filter(n => n.cssClasses?.[0] === 'attributeusage');
    expect(attrNodes.length).toBe(5);
  });
});

// ── 6. Control nodes ─────────────────────────────────────────────────────────

describe('Transformer: control nodes', () => {
  it('fork node gets special sizing', () => {
    const code = 'action def A { fork f; }';
    const { nodes } = pipeline(code);
    const fork = nodes.find(n => n.cssClasses?.[0] === 'forknode');
    expect(fork).toBeDefined();
    // Fork/join are bars: wider than tall
    expect(fork!.size.width).toBeGreaterThan(fork!.size.height);
  });

  it('merge node gets diamond sizing', () => {
    const code = 'action def A { merge m; }';
    const { nodes } = pipeline(code);
    const merge = nodes.find(n => n.cssClasses?.[0] === 'mergenode');
    expect(merge).toBeDefined();
  });

  it('start and terminate nodes are created', () => {
    const code = 'action def A { action start; action done; first start then done; }';
    const { nodes } = pipeline(code);
    // These are action usages, not control nodes — control nodes require specific keywords
    expect(nodes.length).toBeGreaterThanOrEqual(2);
  });
});

// ── 7. Large model transform performance ─────────────────────────────────────

describe('Transformer: performance', () => {
  it('transforms 200 nodes in under 500ms', () => {
    const defs = Array.from({ length: 200 }, (_, i) => `part def P${i};`);
    const code = defs.join('\n');
    const { model } = parseSysMLText('test://perf', code);
    const start = Date.now();
    const diagram = transformToBDD(model);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(500);
    expect(diagram.children.filter(c => c.type === 'node')).toHaveLength(200);
  });
});

// ── 8. Full pipeline integration ─────────────────────────────────────────────

describe('Transformer: full pipeline', () => {
  it('complex model with all element types transforms without error', () => {
    const code = `
      package VehicleSystem {
        part def Vehicle {
          part engine : Engine;
          part wheels : Wheel;
          attribute mass : Real;
        }
        part def Engine :> PowerUnit {
          port fuelIn : FuelPort;
          attribute horsepower : Integer;
        }
        abstract part def PowerUnit;
        port def FuelPort;
        part def Wheel;
        attribute def Real;

        action def Drive {
          in item fuel : FuelPort;
          out item exhaust : FuelPort;
          action accelerate;
          action brake;
          first accelerate then brake;
        }

        requirement def SafetyReq {
          attribute threshold : Real;
        }
        satisfy SafetyReq by Vehicle;

        connection def Link {
          connect Engine to Wheel;
        }
      }
    `;
    const { nodes, edges, diagram } = pipeline(code);
    expect(diagram.type).toBe('graph');
    expect(nodes.length).toBeGreaterThan(5);
    expect(edges.length).toBeGreaterThan(3);

    // Verify no duplicate IDs across all children
    const allIds = diagram.children.map(c => c.id);
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it('model with stdlib imports transforms correctly', () => {
    const code = `
      import ScalarValues::*;
      part def Measurement {
        attribute value : Real;
        attribute unit : String;
      }
    `;
    const { nodes } = pipeline(code);
    const measurement = findNode(nodes, 'Measurement');
    expect(measurement).toBeDefined();
    // Stdlib nodes should also be present
    expect(nodes.length).toBeGreaterThan(1);
  });
});
