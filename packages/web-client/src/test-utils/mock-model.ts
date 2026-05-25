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
    children: nodeIds.map(mockNode),
  };
}
