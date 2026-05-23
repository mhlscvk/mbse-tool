// State-machine ViewRenderer barrel.
//
// The wedge resolves a DiagramViewType to a renderer by calling
// `viewRegistry.get('state-machine')`. The registry stores a lazy loader; this
// module is what that loader dynamic-imports — so all state-machine code
// (transformer + renderer + their dependencies) splits into its own chunk on
// the api-server build and stays out of the initial bundle.

import type { StateMachineIR } from '@systemodel/shared-types';
import type { ViewRenderer } from '../view-registry.js';
import { transformAstToStateMachineIR } from './transformer.js';
import { stateMachineToSModelRoot } from './renderer.js';

export const stateMachineRenderer: ViewRenderer<StateMachineIR> = {
  viewType: 'state-machine',
  transformAstToIR: transformAstToStateMachineIR,
  toSModelRoot: stateMachineToSModelRoot,
};
