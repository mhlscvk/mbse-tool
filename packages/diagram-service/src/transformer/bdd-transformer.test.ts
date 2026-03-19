import { describe, it, expect } from 'vitest';
import { parseSysMLText } from '../parser/sysml-text-parser.js';
import { transformToBDD } from './bdd-transformer.js';
import type { SNode, SEdge } from '@systemodel/shared-types';

function pipeline(code: string) {
  const { model } = parseSysMLText('test://test', code);
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

// ═══════════════════════════════════════════════════════════════════════════════

describe('Transformer: node shapes', () => {
  it('definitions get correct cssClass (lowercase kind)', () => {
    const { nodes } = pipeline('part def Vehicle { }');
    expect(nodes[0].cssClasses?.[0]).toBe('partdefinition');
  });

  it('usages get correct cssClass', () => {
    const { nodes } = pipeline('part def V { part e : E; } part def E;');
    const usage = nodes.find(n => n.cssClasses?.[0] === 'partusage');
    expect(usage).toBeDefined();
  });

  it('packages get package cssClass', () => {
    const { nodes } = pipeline('package Sys { }');
    expect(nodes[0].cssClasses?.[0]).toBe('package');
  });

  it('control nodes get correct cssClass', () => {
    const { nodes } = pipeline('action def A { fork f1; join j1; merge m1; decide d1; }');
    expect(nodes.some(n => n.cssClasses?.[0] === 'forknode')).toBe(true);
    expect(nodes.some(n => n.cssClasses?.[0] === 'joinnode')).toBe(true);
    expect(nodes.some(n => n.cssClasses?.[0] === 'mergenode')).toBe(true);
    expect(nodes.some(n => n.cssClasses?.[0] === 'decidenode')).toBe(true);
  });

  it('fork/join nodes have bar dimensions (wide, thin)', () => {
    const { nodes } = pipeline('action def A { fork f1; }');
    const fork = nodes.find(n => n.cssClasses?.[0] === 'forknode');
    expect(fork!.size.width).toBeGreaterThan(fork!.size.height);
    expect(fork!.size.height).toBeLessThanOrEqual(10);
  });

  it('merge/decide nodes have square-ish dimensions', () => {
    const { nodes } = pipeline('action def A { decide d1; }');
    const decide = nodes.find(n => n.cssClasses?.[0] === 'decidenode');
    expect(decide!.size.width).toBe(decide!.size.height);
  });
});

describe('Transformer: keyword display', () => {
  it('shows «part def» for part definitions', () => {
    const { nodes } = pipeline('part def Vehicle { }');
    expect(kindText(nodes[0])).toBe('«part def»');
  });

  it('shows «requirement def» for requirement definitions', () => {
    const { nodes } = pipeline('requirement def MassReq { }');
    expect(kindText(nodes[0])).toBe('«requirement def»');
  });

  it('shows «use case def» for use case definitions', () => {
    const { nodes } = pipeline('use case def Drive { }');
    expect(kindText(nodes[0])).toBe('«use case def»');
  });

  it('shows abstract inside guillemets per spec', () => {
    const { nodes } = pipeline('abstract part def Vehicle { }');
    expect(kindText(nodes[0])).toBe('«abstract part def»');
  });

  it('shows usage name : Type format', () => {
    const { nodes } = pipeline('part def V { part e : Engine; } part def Engine;');
    const usage = nodes.find(n => n.cssClasses?.[0] === 'partusage');
    const label = usage!.children.find(c => c.id.endsWith('__label'));
    expect(label!.text).toBe('e : Engine');
  });
});

describe('Transformer: compartments', () => {
  it('definition shows attributes in compartment', () => {
    const { nodes } = pipeline('part def Engine { attribute mass : Real; }');
    const eng = nodes.find(n => n.children.some(c => c.text === 'Engine'));
    const usageLabels = eng!.children.filter(c => c.id.includes('__usage__'));
    expect(usageLabels.length).toBe(1);
    expect(usageLabels[0].text).toContain('mass');
    expect(usageLabels[0].text).toContain('Real');
  });

  it('filters out __doc__ from compartments', () => {
    const { nodes } = pipeline('part def V { }');
    for (const n of nodes) {
      const labels = n.children.filter(c => c.id.includes('__usage__'));
      for (const l of labels) {
        expect(l.text).not.toContain('__doc__');
      }
    }
  });

  it('definition height grows with attributes', () => {
    const small = pipeline('part def A;');
    const big = pipeline('part def A { attribute x : Real; attribute y : Real; attribute z : Real; }');
    const smallNode = small.nodes[0];
    const bigNode = big.nodes[0];
    expect(bigNode.size.height).toBeGreaterThan(smallNode.size.height);
  });
});

describe('Transformer: edges', () => {
  it('composition edges get composition cssClass', () => {
    const { edges } = pipeline('part def V { part e : E; } part def E;');
    expect(edges.some(e => e.cssClasses?.[0] === 'composition')).toBe(true);
  });

  it('specialization edges get dependency cssClass', () => {
    const { edges } = pipeline('part def V { } part def C :> V { }');
    expect(edges.some(e => e.cssClasses?.[0] === 'dependency')).toBe(true);
  });

  it('type reference edges get typereference cssClass', () => {
    const { edges } = pipeline('part def V { part e : E; } part def E;');
    expect(edges.some(e => e.cssClasses?.[0] === 'typereference')).toBe(true);
  });

  it('succession edges get succession cssClass', () => {
    const { edges } = pipeline('action def A { action x; action y; first x then y; }');
    expect(edges.some(e => e.cssClasses?.[0] === 'succession')).toBe(true);
  });
});

describe('Transformer: empty/edge cases', () => {
  it('handles empty model', () => {
    const { nodes, edges } = pipeline('');
    expect(nodes.length).toBe(0);
    expect(edges.length).toBe(0);
  });

  it('handles model with only comments', () => {
    const { nodes } = pipeline('// nothing here');
    expect(nodes.length).toBe(0);
  });
});
