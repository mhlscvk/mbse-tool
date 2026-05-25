import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import DiagramViewer from './DiagramViewer';
import { createMockModel } from '../../test-utils/mock-model';

// Deterministic ELK: resolve layout with trivial positions (avoids real async/worker flakiness).
// data-node-id is emitted regardless of layout, so positions are irrelevant to these assertions.
vi.mock('elkjs/lib/elk.bundled.js', () => ({
  default: class {
    layout(graph: { children?: unknown[] }) {
      const place = (n: Record<string, unknown>): Record<string, unknown> => ({
        ...n, x: 0, y: 0,
        width: (n.width as number) ?? 100,
        height: (n.height as number) ?? 40,
        children: ((n.children as Record<string, unknown>[]) ?? []).map(place),
      });
      return Promise.resolve(place(graph as Record<string, unknown>));
    }
  },
}));

afterEach(cleanup);

function nodeIds(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[data-node-id]')].map((e) => e.getAttribute('data-node-id')!);
}

describe('DiagramViewer data-node-id (Slice 3a W1 — backfills accepted deviation)', () => {
  it('emits data-node-id on each node <g>, matching model.children node ids', () => {
    const model = createMockModel(['state__On', 'state__Off', 'behavior__On_entry_activation']);
    const { container } = render(<DiagramViewer model={model} />);
    const ids = new Set(nodeIds(container));
    expect(ids.has('state__On')).toBe(true);
    expect(ids.has('state__Off')).toBe(true);
    expect(ids.has('behavior__On_entry_activation')).toBe(true);
  });

  // Bug-RENDER-01 reconciliation probe (Slice 3b W1, AG-domain).
  // If keyed reconciliation is correct, a rerender with a different model leaves NO stale ids.
  // A failure here would mean the stale-node bug is a within-React keyed-reconciliation defect
  // (unit-reproducible). A pass means the bug is NOT unit-reproducible → supports orphan-SVG /
  // runtime-specific mechanism (b), and further challenges the CP-4 "reconciliation" label.
  it('on rerender with a different model, no stale node ids persist', () => {
    const { container, rerender } = render(<DiagramViewer model={createMockModel(['A1', 'A2', 'A3'])} />);
    rerender(<DiagramViewer model={createMockModel(['B1'])} />);
    const ids = nodeIds(container);
    expect(ids).not.toContain('A1');
    expect(ids).not.toContain('A2');
    expect(ids).not.toContain('A3');
    expect(ids).toContain('B1');
  });
});
