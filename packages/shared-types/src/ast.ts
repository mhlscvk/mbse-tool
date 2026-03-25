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
  | 'FlowDefinition'
  | 'OccurrenceDefinition'
  // ── Extended usages ──
  | 'RequirementUsage'
  | 'ConstraintUsage'
  | 'InterfaceUsage'
  | 'EnumUsage'
  | 'CalcUsage'
  | 'AllocationUsage'
  | 'CaseDefinition'
  | 'CaseUsage'
  | 'UseCaseUsage'
  | 'AnalysisCaseUsage'
  | 'VerificationCaseUsage'
  | 'ConcernUsage'
  | 'ViewUsage'
  | 'ViewpointUsage'
  | 'RenderingUsage'
  | 'FlowUsage'
  | 'MetadataUsage'
  | 'OccurrenceUsage'
  | 'SuccessionFlowUsage'
  // ── Connector/port specializations ──
  | 'ConnectorAsUsage'
  | 'BindingConnectorAsUsage'
  | 'SuccessionAsUsage'
  | 'ConjugatedPortDefinition'
  // ── Behavioral / action subtypes ──
  | 'PerformActionUsage'
  | 'ExhibitStateUsage'
  | 'SendActionUsage'
  | 'AcceptActionUsage'
  | 'IfActionUsage'
  | 'AssignmentActionUsage'
  | 'ForLoopActionUsage'
  | 'WhileLoopActionUsage'
  | 'IncludeUseCaseUsage'
  | 'AssertConstraintUsage'
  | 'SatisfyRequirementUsage'
  | 'EventOccurrenceUsage'
  | 'EntryActionUsage'
  | 'DoActionUsage'
  | 'ExitActionUsage'
  | 'TransitionUsage'
  | 'ForkNode'
  | 'JoinNode'
  | 'MergeNode'
  | 'DecisionNode'
  | 'StartNode'
  | 'DoneNode'
  | 'TerminateNode'
  // ── Membership / internal types ──
  | 'ObjectiveMembership'
  | 'SubjectMembership'
  | 'ActorMembership'
  | 'StakeholderMembership'
  | 'RequirementConstraintMembership'
  | 'FramedConcernMembership'
  | 'RequirementVerificationMembership'
  | 'TransitionFeatureMembership'
  | 'StateSubactionMembership'
  | 'ViewRenderingMembership'
  | 'VariantMembership'
  | 'Expose'
  | 'MembershipExpose'
  | 'NamespaceExpose'
  | 'ReferenceUsage'
  | 'TriggerInvocationExpression'
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
  /** True for derived features (derived keyword) */
  isDerived?: boolean;
  /** True for parallel state definitions/usages */
  isParallel?: boolean;
  /** True when this directed param is owned by a port or action usage */
  ownerIsPortOrActionUsage?: boolean;
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
  /** True for derived features (derived keyword) */
  isDerived?: boolean;
  /** True for attributes inherited from a parent definition via specialization */
  inherited?: boolean;
  /** Name of the definition this attribute was inherited from */
  inheritedFrom?: string;
}

export interface SysMLConnection {
  id: string;
  sourceId: string;
  targetId: string;
  kind: 'association' | 'dependency' | 'composition' | 'noncomposite' | 'flow' | 'succession' | 'transition' | 'typereference'
      | 'subsetting' | 'redefinition' | 'referencesubsetting' | 'crossing'
      | 'satisfy' | 'verify' | 'allocate' | 'bind' | 'annotate'
      | 'successionflow' | 'message' | 'conjugation';
  name?: string;
  /** Item/port name on the source end (e.g., "engineTorque" from "action.engineTorque") */
  sourcePort?: string;
  /** Item/port name on the target end (e.g., "engineTorque" from "action.engineTorque") */
  targetPort?: string;
  /** Source range for navigating to the statement in the editor */
  range?: SourceRange;
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
