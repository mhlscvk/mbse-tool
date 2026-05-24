// Pipeline wedge — Phase 0 strangler-fig entry point.
//
// In Phase 0 the registry is empty, every flag is false, and every call
// reaches the legacy `transformToBDD` exactly as before — observably
// (`rendererUsed === 'old-default'`) and provably (1047 existing tests
// continue to pass).
//
// As Phase 1+ register renderers and dogfooders flip flags, calls divert
// to the new pipeline. If the new pipeline throws at any stage the wedge
// silently returns the old pipeline's output and records the fallback, so
// a user with a buggy flag never sees a broken diagram.

import type {
  DiagramViewType,
  RendererFlag,
  RendererOutcome,
  SModelRoot,
  SysMLModel,
  ViewType,
} from '@systemodel/shared-types';
import { transformToBDD } from '../transformer/bdd-transformer.js';
import { applyViewFilter } from '../transformer/view-filters.js';
import { viewRegistry, type ViewRegistry, type ViewSpec } from './view-registry.js';
import { flagProvider, type FlagProvider } from './feature-flags.js';
import { mapToDiagramViewType } from './view-type-mapper.js';
import { rendererStats, type RendererStats } from './renderer-stats.js';

export interface WedgeResult {
  result: SModelRoot;
  rendererUsed: RendererOutcome;
}

export interface WedgeContext {
  userId?: string;
}

// Constructor-style injection so the bypass-matrix test can swap the
// registry, flag provider, and stats sink without monkey-patching modules.
// Production code uses the exported `renderDiagramWedge` which closes over
// the default singletons.
export interface WedgeDeps {
  registry: ViewRegistry;
  flags: FlagProvider;
  stats: RendererStats;
  // Indirection on the legacy call too — lets the test prove the wedge
  // never calls the old pipeline on the happy path, and that fallbacks
  // genuinely re-invoke it.
  runOldPipeline: (model: SysMLModel, viewType: ViewType, showInherited: boolean) => SModelRoot;
}

export function makeWedge(deps: WedgeDeps) {
  return async function renderDiagram(
    model: SysMLModel,
    viewType: ViewType,
    showInherited: boolean,
    context: WedgeContext = {},
  ): Promise<WedgeResult> {
    const diagramViewType = mapToDiagramViewType(viewType);

    // Legacy view types with no IR equivalent (Phase 0: everything) go
    // straight through. We don't even consult the flag provider — there is
    // no renderer to enable. Recorded under the *raw legacy ViewType*
    // bucket (not 'unknown') so admin stats can see which legacy view
    // generates the most traffic and the next phase can prioritise the
    // renderer that earns the biggest payoff.
    if (!diagramViewType) {
      const result = deps.runOldPipeline(model, viewType, showInherited);
      deps.stats.record(viewType, 'old-default');
      return { result, rendererUsed: 'old-default' };
    }

    const flag = `${diagramViewType}-new-renderer` as RendererFlag;
    const enabled = await deps.flags.isEnabled(flag, {
      userId: context.userId,
      viewType: diagramViewType,
    });

    if (!enabled) {
      const result = deps.runOldPipeline(model, viewType, showInherited);
      deps.stats.record(diagramViewType, 'old-default');
      return { result, rendererUsed: 'old-default' };
    }

    const renderer = await deps.registry.get(diagramViewType);
    if (!renderer) {
      console.warn(
        '[Wedge] New renderer flag is on but no renderer is registered',
        { diagramViewType, userId: context.userId },
      );
      const result = deps.runOldPipeline(model, viewType, showInherited);
      deps.stats.record(diagramViewType, 'old-fallback-not-registered');
      return { result, rendererUsed: 'old-fallback-not-registered' };
    }

    try {
      // [Slice 2d.2] View-First: apply the view filter on the new-renderer path
      // (DP1=b). The legacy paths keep filtering internally via transformToBDD —
      // 59 tests depend on that, so it stays (asymmetry resolved at the output
      // level; the duplicate call-site is retired when legacy goes in Phase 2).
      // applyViewFilter is non-mutating and returns only { nodes, connections },
      // so reconstruct a full SysMLModel (it carries `uri`) before transforming.
      const filtered = applyViewFilter(model, viewType);
      const filteredModel: SysMLModel = { uri: model.uri, nodes: filtered.nodes, connections: filtered.connections };
      const ir = renderer.transformAstToIR(filteredModel, { viewType, showInherited } satisfies ViewSpec);
      const sModelRoot = renderer.toSModelRoot(ir);
      deps.stats.record(diagramViewType, 'new');
      return { result: sModelRoot, rendererUsed: 'new' };
    } catch (err) {
      // Silent fallback — observability is via the recorded outcome and
      // the warn log, not via the user seeing a broken diagram.
      console.warn(
        '[Wedge] New renderer threw, falling back to legacy pipeline',
        { diagramViewType, userId: context.userId, err: err instanceof Error ? err.message : String(err) },
      );
      const result = deps.runOldPipeline(model, viewType, showInherited);
      deps.stats.record(diagramViewType, 'old-fallback-from-new');
      return { result, rendererUsed: 'old-fallback-from-new' };
    }
  };
}

// Default wedge wired to the production singletons.
export const renderDiagramWedge = makeWedge({
  registry: viewRegistry,
  flags: flagProvider,
  stats: rendererStats,
  runOldPipeline: transformToBDD,
});
