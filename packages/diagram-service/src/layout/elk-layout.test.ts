import { describe, it, expect } from 'vitest';
import { applyLayout } from './elk-layout.js';
import type { SModelRoot, SNode, SEdge } from '@systemodel/shared-types';

function makeNode(id: string): SNode {
  return { type: 'node', id, cssClasses: ['actionusage'], position: { x: 0, y: 0 }, size: { width: 160, height: 60 }, children: [] };
}

function makeEdge(id: string, sourceId: string, targetId: string, kind = 'succession'): SEdge {
  return { type: 'edge', id, sourceId, targetId, cssClasses: [kind], children: [], routingPoints: [] };
}

function makeModel(nodes: SNode[], edges: SEdge[]): SModelRoot {
  return { type: 'root', id: 'root', children: [...nodes, ...edges] };
}

describe('elk-layout: succession-driven ordering', () => {
  it('linear chain renders in topological order (A → B → C)', async () => {
    const model = makeModel(
      [makeNode('A'), makeNode('B'), makeNode('C')],
      [makeEdge('e1', 'A', 'B'), makeEdge('e2', 'B', 'C')],
    );
    const result = await applyLayout(model);
    const nodes = result.children.filter(c => c.type === 'node') as SNode[];
    const posA = nodes.find(n => n.id === 'A')!.position!;
    const posB = nodes.find(n => n.id === 'B')!.position!;
    const posC = nodes.find(n => n.id === 'C')!.position!;

    // With DOWN direction, A should be above B, B above C
    expect(posA.y).toBeLessThan(posB.y);
    expect(posB.y).toBeLessThan(posC.y);
  });

  it('branching: A → B and A → C places B and C below A', async () => {
    const model = makeModel(
      [makeNode('A'), makeNode('B'), makeNode('C')],
      [makeEdge('e1', 'A', 'B'), makeEdge('e2', 'A', 'C')],
    );
    const result = await applyLayout(model);
    const nodes = result.children.filter(c => c.type === 'node') as SNode[];
    const posA = nodes.find(n => n.id === 'A')!.position!;
    const posB = nodes.find(n => n.id === 'B')!.position!;
    const posC = nodes.find(n => n.id === 'C')!.position!;

    expect(posA.y).toBeLessThan(posB.y);
    expect(posA.y).toBeLessThan(posC.y);
  });

  it('merging: B → D and C → D places D below both', async () => {
    const model = makeModel(
      [makeNode('B'), makeNode('C'), makeNode('D')],
      [makeEdge('e1', 'B', 'D'), makeEdge('e2', 'C', 'D')],
    );
    const result = await applyLayout(model);
    const nodes = result.children.filter(c => c.type === 'node') as SNode[];
    const posB = nodes.find(n => n.id === 'B')!.position!;
    const posC = nodes.find(n => n.id === 'C')!.position!;
    const posD = nodes.find(n => n.id === 'D')!.position!;

    expect(posB.y).toBeLessThan(posD.y);
    expect(posC.y).toBeLessThan(posD.y);
  });

  it('no overlap between nodes', async () => {
    const model = makeModel(
      [makeNode('A'), makeNode('B'), makeNode('C'), makeNode('D')],
      [makeEdge('e1', 'A', 'B'), makeEdge('e2', 'B', 'C'), makeEdge('e3', 'C', 'D')],
    );
    const result = await applyLayout(model);
    const nodes = result.children.filter(c => c.type === 'node') as SNode[];

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i] as SNode;
        const b = nodes[j] as SNode;
        const ax = a.position!.x, ay = a.position!.y;
        const bx = b.position!.x, by = b.position!.y;
        const aw = a.size?.width ?? 160, ah = a.size?.height ?? 60;
        const bw = b.size?.width ?? 160, bh = b.size?.height ?? 60;
        // Check no overlap (bounding boxes don't intersect)
        const noOverlap = ax + aw <= bx || bx + bw <= ax || ay + ah <= by || by + bh <= ay;
        expect(noOverlap, `nodes ${a.id} and ${b.id} overlap`).toBe(true);
      }
    }
  });

  it('layout is stable across rerenders', async () => {
    const model = makeModel(
      [makeNode('A'), makeNode('B'), makeNode('C')],
      [makeEdge('e1', 'A', 'B'), makeEdge('e2', 'B', 'C')],
    );
    const r1 = await applyLayout(model);
    const r2 = await applyLayout(model);
    const nodes1 = r1.children.filter(c => c.type === 'node') as SNode[];
    const nodes2 = r2.children.filter(c => c.type === 'node') as SNode[];

    for (const n1 of nodes1) {
      const n2 = nodes2.find(n => n.id === n1.id)!;
      expect(n1.position!.x).toBe(n2.position!.x);
      expect(n1.position!.y).toBe(n2.position!.y);
    }
  });

  it('disconnected nodes are placed separately', async () => {
    const model = makeModel(
      [makeNode('A'), makeNode('B'), makeNode('X')],
      [makeEdge('e1', 'A', 'B')],
    );
    const result = await applyLayout(model);
    const nodes = result.children.filter(c => c.type === 'node') as SNode[];
    const posA = nodes.find(n => n.id === 'A')!.position!;
    const posB = nodes.find(n => n.id === 'B')!.position!;
    const posX = nodes.find(n => n.id === 'X')!.position!;

    // A → B flow order maintained
    expect(posA.y).toBeLessThan(posB.y);
    // X is placed somewhere without overlapping
    const noOverlapWithA = posX.x + 160 <= posA.x || posA.x + 160 <= posX.x || posX.y + 60 <= posA.y || posA.y + 60 <= posX.y;
    const noOverlapWithB = posX.x + 160 <= posB.x || posB.x + 160 <= posX.x || posX.y + 60 <= posB.y || posB.y + 60 <= posX.y;
    expect(noOverlapWithA || noOverlapWithB).toBe(true);
  });

  it('succession edges produce routing points', async () => {
    const model = makeModel(
      [makeNode('A'), makeNode('B')],
      [makeEdge('e1', 'A', 'B')],
    );
    const result = await applyLayout(model);
    const edge = result.children.find(c => c.type === 'edge' && c.id === 'e1') as SEdge;
    expect(edge.routingPoints!.length).toBeGreaterThanOrEqual(2);
  });
});
