import type { ViewType, ViewConfig } from '@systemodel/shared-types';

const GENERAL: ViewConfig = {
  pinCssClasses: new Set(['actionin', 'actionout', 'actioninout']),
  pinParentKinds: new Set(['stateusage', 'exhibitstateusage', 'actionusage', 'performactionusage']),
  pinPlacement: { in: 'left', out: 'right', inout: 'nearest' },
  cloneDefParamsAsUsagePins: false,
  retargetFlowsToPins: false,
  hideDirectedFromDefCompartments: false,
  defKindsForCompartmentHiding: new Set(),
  behavioralNodeSpacing: 24,
  behavioralLayerSpacing: 32,
  compactPinContainers: false,
  suppressPinToPinFlowLabels: false,
};

const INTERCONNECTION: ViewConfig = {
  pinCssClasses: new Set(['portusage']),
  pinParentKinds: new Set(['partusage', 'partdefinition']),
  pinPlacement: { in: 'left', out: 'right', inout: 'nearest' },
  cloneDefParamsAsUsagePins: false,
  retargetFlowsToPins: false,
  hideDirectedFromDefCompartments: false,
  defKindsForCompartmentHiding: new Set(),
  behavioralNodeSpacing: 24,
  behavioralLayerSpacing: 32,
  compactPinContainers: false,
  suppressPinToPinFlowLabels: false,
};

const ACTION_FLOW: ViewConfig = {
  pinCssClasses: new Set(['actionin', 'actionout', 'actioninout', 'portusage']),
  pinParentKinds: new Set(['actionusage', 'performactionusage']),
  pinPlacement: { in: 'top', out: 'bottom', inout: 'nearest' },
  cloneDefParamsAsUsagePins: true,
  retargetFlowsToPins: true,
  hideDirectedFromDefCompartments: true,
  defKindsForCompartmentHiding: new Set(['ActionDefinition']),
  behavioralNodeSpacing: 40,
  behavioralLayerSpacing: 50,
  compactPinContainers: true,
  suppressPinToPinFlowLabels: true,
};

const STATE_TRANSITION: ViewConfig = {
  pinCssClasses: new Set(['actionin', 'actionout', 'actioninout', 'portusage']),
  pinParentKinds: new Set(['stateusage', 'exhibitstateusage']),
  pinPlacement: { in: 'left', out: 'right', inout: 'nearest' },
  cloneDefParamsAsUsagePins: true,
  retargetFlowsToPins: false,
  hideDirectedFromDefCompartments: true,
  defKindsForCompartmentHiding: new Set(['StateDefinition']),
  behavioralNodeSpacing: 24,
  behavioralLayerSpacing: 32,
  compactPinContainers: true,
  suppressPinToPinFlowLabels: false,
};

const NON_GRAPH_DEFAULT: ViewConfig = { ...GENERAL };

const VIEW_CONFIGS: Record<ViewType, ViewConfig> = {
  'general': GENERAL,
  'interconnection': INTERCONNECTION,
  'action-flow': ACTION_FLOW,
  'state-transition': STATE_TRANSITION,
  'sequence': NON_GRAPH_DEFAULT,
  'grid': NON_GRAPH_DEFAULT,
  'browser': NON_GRAPH_DEFAULT,
  'geometry': NON_GRAPH_DEFAULT,
};

export function getViewConfig(viewType: ViewType): ViewConfig {
  return VIEW_CONFIGS[viewType];
}
