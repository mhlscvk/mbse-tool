// Phase 0 infrastructure smoke test — proves the fixture/registry/IR snapshot
// loop works end to end before Phase 1 introduces a real renderer.
//
// What it does:
//   1. Loads the `empty` fixture from disk.
//   2. Registers the no-op renderer under 'state-machine'.
//   3. Parses model.sysml → SysMLModel.
//   4. Runs transformAstToIR and toSModelRoot through the production
//      registry's lazy-load path.
//   5. Asserts both outputs byte-equal the on-disk fixtures.
//
// If any of those steps is misconfigured, this test fails with a clear
// pointer to the broken stage. It does not exercise correctness of any
// real renderer — that's `sensor-systems/`'s job once Phase 1 fills it in.

import { describe, expect, it, beforeEach } from 'vitest';
import { parseSysMLText } from '../parser/sysml-text-parser.js';
import { ViewRegistry } from './view-registry.js';
import { noOpStateMachineRenderer } from './no-op-renderer.js';
import { loadStateMachineFixture } from './fixture-loader.js';

describe('Phase 0 infrastructure smoke', () => {
  let registry: ViewRegistry;

  beforeEach(() => {
    registry = new ViewRegistry();
  });

  it('roundtrips the empty fixture through registry + no-op renderer', async () => {
    const fixture = loadStateMachineFixture('empty');

    // Lazy-load via the registry, not by importing the renderer directly —
    // this is the path real Phase 1 code will take.
    registry.register('state-machine', async () => noOpStateMachineRenderer);
    const renderer = await registry.get('state-machine');
    expect(renderer).toBeDefined();

    const { model } = parseSysMLText('fixture://empty/model.sysml', fixture.sysml);
    const ir = renderer!.transformAstToIR(model, { viewType: 'state-transition', showInherited: false });
    const sModel = renderer!.toSModelRoot(ir);

    expect(ir).toEqual(fixture.expectedIR);
    expect(sModel).toEqual(fixture.expectedSModel);
  });
});
