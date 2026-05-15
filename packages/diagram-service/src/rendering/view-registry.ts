// View Registry — Phase 0 foundation.
//
// Lazy-loading registry of per-view renderers. A renderer is registered as a
// loader function that dynamic-imports the actual implementation; this lets
// Vite/Rollup code-split each view's renderer into its own chunk so the
// initial bundle stays small as Phase 1+ phases add view-specific code.
//
// In Phase 0 the registry is empty at runtime; the wedge (Slice 3) calls
// `get(viewType)` and falls back to the legacy pipeline whenever it returns
// undefined. Phase 1 registers the state-machine renderer.

import type {
  DiagramIR,
  DiagramViewType,
  SysMLModel,
  SModelRoot,
  ViewType as LegacyViewType,
} from '@systemodel/shared-types';

export interface ViewSpec {
  viewType: LegacyViewType;        // request-level view filter from the WS payload
  showInherited: boolean;
}

// A renderer produces an SModelRoot (unpositioned — layout happens client-side
// in DiagramViewer.tsx). The IR is the inspectable midpoint between
// transformer and renderer; both halves can be snapshot-tested separately.
//
// Phase 0 does not expose layoutIR/renderToSVG. Server-side SVG rendering may
// arrive in a later phase; we add those methods then rather than reserving an
// interface slot for an unused concern now.
export interface ViewRenderer<IR extends DiagramIR = DiagramIR> {
  readonly viewType: IR['viewType'];
  transformAstToIR(model: SysMLModel, viewSpec: ViewSpec): IR;
  toSModelRoot(ir: IR): SModelRoot;
}

export type RendererLoader = () => Promise<ViewRenderer>;

export class ViewRegistry {
  private loaders = new Map<DiagramViewType, RendererLoader>();
  private cached = new Map<DiagramViewType, ViewRenderer>();

  register(viewType: DiagramViewType, loader: RendererLoader): void {
    this.loaders.set(viewType, loader);
  }

  async get(viewType: DiagramViewType): Promise<ViewRenderer | undefined> {
    const hit = this.cached.get(viewType);
    if (hit) return hit;

    const loader = this.loaders.get(viewType);
    if (!loader) return undefined;

    const renderer = await loader();
    this.cached.set(viewType, renderer);
    return renderer;
  }

  has(viewType: DiagramViewType): boolean {
    return this.loaders.has(viewType);
  }

  // Visible for tests — clear cached instances and registered loaders.
  reset(): void {
    this.loaders.clear();
    this.cached.clear();
  }
}

export const viewRegistry = new ViewRegistry();
