// SysML v2 AST node types produced by the language server
export type SysMLNodeKind =
  | 'Package'
  // ── Core structural definitions ──
  | 'PartDefinition'
  | 'AttributeDefinition'
  | 'ConnectionDefinition'
  | 'PortDefinition'
  | 'ActionDefinition'
  | 'StateDefinition'
  | 'ItemDefinition'
  // ── Core structural usages ──
  | 'PartUsage'
  | 'AttributeUsage'
  | 'ConnectionUsage'
  | 'PortUsage'
  | 'ActionUsage'
  | 'StateUsage'
  | 'ItemUsage'
  // ── Extended definitions ──
  | 'RequirementDefinition'
  | 'ConstraintDefinition'
  | 'InterfaceDefinition'
  | 'EnumDefinition'
  | 'CalcDefinition'
  | 'AllocationDefinition'
  | 'UseCaseDefinition'
  | 'AnalysisCaseDefinition'
  | 'VerificationCaseDefinition'
  | 'ConcernDefinition'
  | 'ViewDefinition'
  | 'ViewpointDefinition'
  | 'RenderingDefinition'
  | 'MetadataDefinition'
  | 'OccurrenceDefinition'
  // ── Extended usages ──
  | 'RequirementUsage'
  | 'ConstraintUsage'
  | 'InterfaceUsage'
  | 'EnumUsage'
  | 'CalcUsage'
  | 'AllocationUsage'
  | 'UseCaseUsage'
  | 'AnalysisCaseUsage'
  | 'VerificationCaseUsage'
  | 'ConcernUsage'
  | 'ViewUsage'
  | 'ViewpointUsage'
  | 'RenderingUsage'
  | 'OccurrenceUsage'
  // ── Behavioral / control ──
  | 'PerformActionUsage'
  | 'ExhibitStateUsage'
  | 'TransitionUsage'
  | 'ForkNode'
  | 'JoinNode'
  | 'MergeNode'
  | 'DecideNode'
  | 'StartNode'
  | 'TerminateNode'
  // ── Namespace ──
  | 'Alias'
  | 'Comment';

export interface SysMLNode {
  id: string;
  kind: SysMLNodeKind;
  name: string;
  qualifiedName?: string;
  direction?: 'in' | 'out' | 'inout';
  isAbstract?: boolean;
  /** True for referential features (ref keyword) */
  isRef?: boolean;
  /** True for parallel state definitions/usages */
  isParallel?: boolean;
  /** Multiplicity text, e.g. "[4]", "[1..*]", "[0..1]" */
  multiplicity?: string;
  children: SysMLNode[];
  attributes: SysMLAttribute[];
  connections: SysMLConnection[];
  range?: SourceRange;
}

export interface SysMLAttribute {
  name: string;
  type?: string;
  value?: string;
}

export interface SysMLConnection {
  id: string;
  sourceId: string;
  targetId: string;
  kind: 'association' | 'dependency' | 'composition' | 'flow' | 'succession' | 'transition' | 'typereference'
      | 'subsetting' | 'redefinition' | 'referencesubsetting'
      | 'satisfy' | 'verify' | 'allocate' | 'bind' | 'annotate';
  name?: string;
}

export interface SourceRange {
  start: { line: number; character: number };
  end: { line: number; character: number };
}

export interface SysMLModel {
  uri: string;
  nodes: SysMLNode[];
  connections: SysMLConnection[];
}
