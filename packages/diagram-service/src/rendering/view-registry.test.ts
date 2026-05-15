import { describe, expect, it, vi } from 'vitest';
import type { StateMachineIR, SModelRoot } from '@systemodel/shared-types';
import { ViewRegistry, type ViewRenderer } from './view-registry.js';

function makeRenderer(): ViewRenderer<StateMachineIR> {
  return {
    viewType: 'state-machine',
    transformAstToIR: () => ({
      viewType: 'state-machine',
      metadata: { generatedAt: '1970-01-01T00:00:00.000Z', rendererVersion: 'test' },
      nodes: [],
      edges: [],
    }),
    toSModelRoot: (): SModelRoot => ({ type: 'graph', id: 'r', children: [] }),
  };
}

describe('ViewRegistry', () => {
  it('returns undefined for an unregistered view type', async () => {
    const r = new ViewRegistry();
    expect(await r.get('state-machine')).toBeUndefined();
    expect(r.has('state-machine')).toBe(false);
  });

  it('lazy-loads on first get and caches afterwards', async () => {
    const r = new ViewRegistry();
    const loader = vi.fn(async () => makeRenderer());
    r.register('state-machine', loader);

    expect(r.has('state-machine')).toBe(true);
    expect(loader).not.toHaveBeenCalled();

    const first = await r.get('state-machine');
    const second = await r.get('state-machine');

    expect(first).toBeDefined();
    expect(second).toBe(first);
    expect(loader).toHaveBeenCalledOnce();
  });

  it('reset clears both loaders and cached instances', async () => {
    const r = new ViewRegistry();
    r.register('state-machine', async () => makeRenderer());
    await r.get('state-machine');
    r.reset();
    expect(r.has('state-machine')).toBe(false);
    expect(await r.get('state-machine')).toBeUndefined();
  });
});
