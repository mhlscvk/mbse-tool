// Reusable SModelRoot factory for component tests (RTL harness, Slice 3b W4).
// Keep minimal — just enough for DiagramViewer to render node <g> elements.
import type { SModelRoot, SNode } from '@systemodel/shared-types';

export function mockNode(id: string): SNode {
  return {
    type: 'node',
    id,
    position: { x: 0, y: 0 },
    size: { width: 100, height: 40 },
    children: [{ type: 'label', id: `${id}__label`, text: id }],
    cssClasses: [],
  };
}

export function createMockModel(nodeIds: string[]): SModelRoot {
  return {
    type: 'graph',
    id: 'test-root',
    children: nodeIds.map((id) => mockNode(id)),
  };
}

// Slice 5 W4: cssClass-aware factory — lets tests build nodes with a specific
// cssClass (e.g. 'startnode' for a pseudo-initial) to verify DiagramViewer
// renders them. Kept separate from createMockModel so the bare-id callers
// (bug-render-01, data-node-id tests) are untouched.
export function createMockModelWithClasses(
  specs: Array<{ id: string; cssClasses?: string[] }>,
): SModelRoot {
  return {
    type: 'graph',
    id: 'test-root',
    children: specs.map((s) => ({
      type: 'node',
      id: s.id,
      position: { x: 0, y: 0 },
      size: { width: 100, height: 40 },
      children: [{ type: 'label', id: `${s.id}__label`, text: s.id }],
      cssClasses: s.cssClasses ?? [],
    })),
  };
}
