import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import DiagramViewer from './DiagramViewer';
import { createMockModel } from '../../test-utils/mock-model';

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
const ids = (c: HTMLElement) => [...c.querySelectorAll('[data-node-id]')].map((e) => e.getAttribute('data-node-id')!);

// Realistic Bug-RENDER-01 switch: collision state keys (Normal/Degraded in both models)
// + A-only entry-action nodes (the prod-observed stale ids).
const A = ['state__On', 'state__Normal', 'state__Degraded', 'behavior__On_entry_activation', 'behavior__Normal_entry_checkPowerSource'];
const B = ['state__Normal', 'state__Degraded', 'state__Off']; // Normal/Degraded collide; Off is B-only

describe('Bug-RENDER-01 reconciliation repro (Slice 3b W2)', () => {
  it('A settled then B: no stale A entry-action node persists', async () => {
    const { container, rerender } = render(<DiagramViewer model={createMockModel(A)} />);
    await act(async () => { await Promise.resolve(); });
    rerender(<DiagramViewer model={createMockModel(B)} />);
    await act(async () => { await Promise.resolve(); });
    const got = ids(container);
    // eslint-disable-next-line no-console
    console.log('[REPRO settled] POST ids:', got);
    expect(got).not.toContain('behavior__On_entry_activation');
    expect(got).not.toContain('behavior__Normal_entry_checkPowerSource');
  });

  it('rapid A then B (no flush between): no stale A entry-action node persists', async () => {
    const { container, rerender } = render(<DiagramViewer model={createMockModel(A)} />);
    rerender(<DiagramViewer model={createMockModel(B)} />);
    await act(async () => { await Promise.resolve(); });
    const got = ids(container);
    // eslint-disable-next-line no-console
    console.log('[REPRO rapid] POST ids:', got);
    expect(got).not.toContain('behavior__On_entry_activation');
    expect(got).not.toContain('behavior__Normal_entry_checkPowerSource');
  });
});
