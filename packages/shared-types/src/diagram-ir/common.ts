// Diagram IR — common types shared by every view-specific IR variant.
// View-specific node/edge shapes live in sibling files (state-machine.ts, ...).

export interface IRMetadata {
  generatedAt: string;          // ISO datetime
  rendererVersion: string;
  modelChecksum?: string;       // sha256 of source SysML; optional cache key
  sourceFile?: string;          // source URI; the renderer uses it to build SModelRoot.id
}

export interface IRPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Pointer back to the AST node a given IR element was derived from.
// astNodeId is `SysMLNode.id` (deterministic `${prefix}__${sanitizedName}`
// from sysml-text-parser.ts:79); see Phase 0 brief, precondition 6.
export interface IRSemanticRef {
  astNodeId: string;
  sourceFile?: string;
  sourceLine?: number;          // 1-based; from SysMLNode.range.start.line
  qualifiedName?: string;       // e.g. "SensorSystem::On::Normal"
}
