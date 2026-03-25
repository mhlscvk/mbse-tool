import type { ViewType } from './diagram.js';

/** Pin placement configuration per direction */
export interface PinPlacement {
  in: 'top' | 'bottom' | 'left' | 'right';
  out: 'top' | 'bottom' | 'left' | 'right';
  inout: 'top' | 'bottom' | 'left' | 'right' | 'nearest';
}

/** View-specific configuration — one object per ViewType */
export interface ViewConfig {
  // ── Pin behavior ──────────────────────────────────────────
  /** CSS classes treated as boundary pins (small squares) in nested mode */
  pinCssClasses: Set<string>;
  /** Parent CSS classes that get pin children */
  pinParentKinds: Set<string>;
  /** Where to place pins by direction */
  pinPlacement: PinPlacement;
  /** Clone directed items from definitions into usages as pins */
  cloneDefParamsAsUsagePins: boolean;
  /** Retarget flow edges to pin nodes */
  retargetFlowsToPins: boolean;

  // ── Compartments ──────────────────────────────────────────
  /** Skip directed items from definition compartments (they appear as pins) */
  hideDirectedFromDefCompartments: boolean;
  /** Definition kinds affected by compartment hiding */
  defKindsForCompartmentHiding: Set<string>;

  // ── Layout (ELK) ──────────────────────────────────────────
  /** Spacing between nodes in behavioural containers */
  behavioralNodeSpacing: number;
  /** Spacing between layers in behavioural containers */
  behavioralLayerSpacing: number;
  /** Reduce container size when all children are pins */
  compactPinContainers: boolean;

  // ── Flow labels ───────────────────────────────────────────
  /** Skip flow label when endpoints are pin-to-pin */
  suppressPinToPinFlowLabels: boolean;
}

const GENERAL: ViewConfig = {
  pinCssClasses: new Set(),
  pinParentKinds: new Set(),
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
  pinCssClasses: new Set(),
  pinParentKinds: new Set(),
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

// Non-graph views use general defaults (they have custom renderers)
const NON_GRAPH_DEFAULT: ViewConfig = { ...GENERAL };

export const VIEW_CONFIGS: Record<ViewType, ViewConfig> = {
  'general': GENERAL,
  'interconnection': INTERCONNECTION,
  'action-flow': ACTION_FLOW,
  'state-transition': STATE_TRANSITION,
  'sequence': NON_GRAPH_DEFAULT,
  'grid': NON_GRAPH_DEFAULT,
  'browser': NON_GRAPH_DEFAULT,
  'geometry': NON_GRAPH_DEFAULT,
};

/** Get the view config for a given view type */
export function getViewConfig(viewType: ViewType): ViewConfig {
  return VIEW_CONFIGS[viewType];
}
