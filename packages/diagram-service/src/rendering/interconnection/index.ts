// Interconnection ViewRenderer barrel.
//
// The wedge resolves a DiagramViewType to a renderer by calling
// `viewRegistry.get('interconnection')`. The registry stores a lazy loader;
// this module is what that loader dynamic-imports — so all interconnection code
// (transformer + renderer + display tables) splits into its own chunk and stays
// out of the initial bundle, mirroring the state-machine barrel.

import type { InterconnectionIR } from '@systemodel/shared-types';
import type { ViewRenderer } from '../view-registry.js';
import { transformAstToInterconnectionIR } from './transformer.js';
import { interconnectionToSModelRoot } from './renderer.js';

export const interconnectionRenderer: ViewRenderer<InterconnectionIR> = {
  viewType: 'interconnection',
  transformAstToIR: transformAstToInterconnectionIR,
  toSModelRoot: interconnectionToSModelRoot,
};
