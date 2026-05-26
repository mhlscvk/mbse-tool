import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import DiagramViewer from './DiagramViewer';
import { createMockModelWithClasses } from '../../test-utils/mock-model';

// Synchronous ELK stub (same pattern as bug-render-01.test.tsx) — lays everything
// out at origin so the render is deterministic.
vi.mock('elkjs/lib/elk.bundled.js', () => ({
  default: class {
    layout(g: Record<string, unknown>) {
      const p = (n: Record<string, unknown>): Record<string, unknown> => ({
        ...n, x: 0, y: 0, width: (n.width as number) ?? 100, height: (n.height as number) ?? 40,
        children: ((n.children as Record<string, unknown>[]) ?? []).map(p),
      });
      return Promise.resolve(p(g));
    }
  },
}));

afterEach(cleanup);
const nodeIds = (c: HTMLElement) => [...c.querySelectorAll('[data-node-id]')].map((e) => e.getAttribute('data-node-id')!);

// Slice 5 (D-FILTER-01 revoked): a sub-state's pseudo-initial renders as a
// 'startnode' control node. Backend now keeps these (view-filters no longer hides
// entry-action sub-state starts); these tests close the frontend honest-gap (#4) —
// proving DiagramViewer actually draws a startnode-cssClass node in the DOM.
describe('Slice 5 — pseudo-initial (startnode) renders in DiagramViewer', () => {
  it('renders a startnode-cssClass node with its data-node-id, alongside the state', async () => {
    const model = createMockModelWithClasses([
      { id: 'state__On', cssClasses: ['stateusage'] },
      { id: 'pseudo-initial__on', cssClasses: ['startnode'] },
    ]);
    const { container } = render(<DiagramViewer model={model} />);
    await act(async () => { await Promise.resolve(); });
    const ids = nodeIds(container);
    expect(ids).toContain('pseudo-initial__on');
    expect(ids).toContain('state__On');
  });

  it('renders every entry-action sub-state pseudo-initial (2 sub-states)', async () => {
    const model = createMockModelWithClasses([
      { id: 'state__Normal', cssClasses: ['stateusage'] },
      { id: 'pseudo-initial__normal', cssClasses: ['startnode'] },
      { id: 'pseudo-initial__on', cssClasses: ['startnode'] },
    ]);
    const { container } = render(<DiagramViewer model={model} />);
    await act(async () => { await Promise.resolve(); });
    const ids = nodeIds(container);
    expect(ids.filter((id) => id.startsWith('pseudo-initial'))).toHaveLength(2);
  });

  it('renders a lone startnode node (frontend does not orphan-prune — that is the backend filter)', async () => {
    const model = createMockModelWithClasses([{ id: 'pseudo-initial__top', cssClasses: ['startnode'] }]);
    const { container } = render(<DiagramViewer model={model} />);
    await act(async () => { await Promise.resolve(); });
    expect(nodeIds(container)).toContain('pseudo-initial__top');
  });
});
