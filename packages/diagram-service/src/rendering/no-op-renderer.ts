// No-op StateMachine renderer — test scaffolding.
//
// Produces an empty IR + empty SModelRoot regardless of input. Used by:
//   - the bypass-matrix test, to register a "renderer that always succeeds"
//     and observe `rendererUsed === 'new'`
//   - throwing variants, to exercise the fallback branches
//
// Not registered in production. Phase 1 introduces the real renderer.

import type {
  StateMachineIR,
  SModelRoot,
  SysMLModel,
} from '@systemodel/shared-types';
import type { ViewRenderer, ViewSpec } from './view-registry.js';

export const noOpStateMachineRenderer: ViewRenderer<StateMachineIR> = {
  viewType: 'state-machine',

  transformAstToIR(_model: SysMLModel, _viewSpec: ViewSpec): StateMachineIR {
    return {
      viewType: 'state-machine',
      metadata: {
        generatedAt: new Date(0).toISOString(),
        rendererVersion: 'no-op-0',
      },
      nodes: [],
      edges: [],
    };
  },

  toSModelRoot(_ir: StateMachineIR): SModelRoot {
    return { type: 'graph', id: 'no-op', children: [] };
  },
};

// Factory for the test variants that need to throw at a specific stage.
export function makeThrowingRenderer(stage: 'transformAstToIR' | 'toSModelRoot'): ViewRenderer<StateMachineIR> {
  return {
    viewType: 'state-machine',
    transformAstToIR(_model, _viewSpec) {
      if (stage === 'transformAstToIR') throw new Error('test: transformAstToIR threw');
      return noOpStateMachineRenderer.transformAstToIR(_model, _viewSpec);
    },
    toSModelRoot(_ir) {
      if (stage === 'toSModelRoot') throw new Error('test: toSModelRoot threw');
      return noOpStateMachineRenderer.toSModelRoot(_ir);
    },
  };
}
