// Interconnection renderer — InterconnectionIR → SModelRoot (Slice 6a porto).
//
// This is a faithful, byte-identical port of the legacy `nodeToSNode` /
// `connectionToSEdge` from bdd-transformer.ts, specialised to the IV path:
//   • the third nodeToSNode arg `skipCompartments` is now `node.hasVisibleChildren`
//     (the transformer precomputed it from composition/noncomposite edges)
//   • the `vcfg`-driven `skipDirected` is hardcoded false — the IV ViewConfig
//     has hideDirectedFromDefCompartments=false (view-config.ts:61), so the
//     directed-compartment-hiding filter never triggers for IV
//   • `isStateDef` stays in the code for fidelity but is always false for IV
//     kinds (no StateDefinition/StateUsage survives the IV filter)
//
// The helper tables (KIND_DISPLAY, USAGE_KEYWORD_DISPLAY, KEYWORD_VALUES,
// IS_USAGE, CONTROL_KINDS) and textWidth/makeLabel are copied verbatim from the
// legacy transformer. Duplication is intentional under the strangler-fig plan:
// the IV module owns its rendering so bdd-transformer.ts can be deleted once
// every view is ported (brief §1). The differential oracle (end-to-end.test.ts)
// asserts this port stays byte-identical to the legacy output.
//
// Slice 6a is a pure refactor — NO visual change. Calibration (conjugated-port
// markers, edge styles, port layout) is Slice 6b and edits THIS file's IR→SModel
// mapping, never the transformer or IR schema.

import type {
  InterconnectionIR,
  InterconnectionNode,
  InterconnectionEdge,
  SModelRoot,
  SNode,
  SEdge,
  SLabel,
} from '@systemodel/shared-types';

// ── Display tables (verbatim from bdd-transformer.ts) ───────────────────────

const KEYWORD_VALUES = new Set([
  'part', 'attribute', 'port', 'action', 'state', 'item', 'in', 'out',
  'requirement', 'constraint', 'interface', 'enum', 'calc', 'allocation',
  'usecase', 'case', 'view', 'viewpoint', 'concern', 'rendering', 'perform', 'exhibit', 'ref',
  'individual', 'snapshot', 'timeslice', 'occurrence',
  'ref part', 'ref attribute', 'ref port', 'ref action', 'ref state', 'ref item',
]);

function makeLabel(id: string, text: string): SLabel {
  return { type: 'label', id, text };
}

const KIND_DISPLAY: Record<string, string> = {
  Package:              '«package»',
  PartDefinition:       '«part def»',
  AttributeDefinition:  '«attribute def»',
  ConnectionDefinition: '«connection def»',
  PortDefinition:       '«port def»',
  ActionDefinition:     '«action def»',
  StateDefinition:      '«state def»',
  ItemDefinition:       '«item def»',
  PartUsage:            '«part»',
  AttributeUsage:       '«attribute»',
  ConnectionUsage:      '«connection»',
  PortUsage:            '«port»',
  ActionUsage:          '«action»',
  StateUsage:           '«state»',
  ItemUsage:            '«item»',
  RequirementDefinition:       '«requirement def»',
  RequirementUsage:            '«requirement»',
  ConstraintDefinition:        '«constraint def»',
  ConstraintUsage:             '«constraint»',
  InterfaceDefinition:         '«interface def»',
  InterfaceUsage:              '«interface»',
  EnumDefinition:              '«enum def»',
  EnumUsage:                   '«enum»',
  CalcDefinition:              '«calc def»',
  CalcUsage:                   '«calc»',
  AllocationDefinition:        '«allocation def»',
  AllocationUsage:             '«allocation»',
  UseCaseDefinition:           '«use case def»',
  UseCaseUsage:                '«use case»',
  AnalysisCaseDefinition:      '«analysis def»',
  AnalysisCaseUsage:           '«analysis»',
  VerificationCaseDefinition:  '«verification def»',
  VerificationCaseUsage:       '«verification»',
  ConcernDefinition:           '«concern def»',
  ConcernUsage:                '«concern»',
  ViewDefinition:              '«view def»',
  ViewUsage:                   '«view»',
  ViewpointDefinition:         '«viewpoint def»',
  ViewpointUsage:              '«viewpoint»',
  RenderingDefinition:         '«rendering def»',
  RenderingUsage:              '«rendering»',
  MetadataDefinition:          '«metadata def»',
  FlowDefinition:              '«flow def»',
  FlowUsage:                   '«flow»',
  SuccessionFlowUsage:         '«succession flow»',
  CaseDefinition:              '«case def»',
  CaseUsage:                   '«case»',
  MetadataUsage:               '«metadata»',
  ConnectorAsUsage:            '«connector»',
  BindingConnectorAsUsage:     '«binding»',
  SuccessionAsUsage:           '«succession»',
  ConjugatedPortDefinition:    '«conjugated port def»',
  OccurrenceDefinition:        '«occurrence def»',
  OccurrenceUsage:             '«occurrence»',
  ForkNode:                    '«fork»',
  JoinNode:                    '«join»',
  DoneNode:                    '«done»',
  MergeNode:                   '«merge»',
  DecisionNode:                '«decide»',
  PerformActionUsage:          '«perform» ⊞',
  ExhibitStateUsage:           '«exhibit»',
  SendActionUsage:             '«send»',
  AcceptActionUsage:           '«accept»',
  IfActionUsage:               '«if»',
  AssignmentActionUsage:       '«assign»',
  ForLoopActionUsage:          '«for loop» ↻',
  WhileLoopActionUsage:        '«while loop» ↻',
  IncludeUseCaseUsage:         '«include»',
  AssertConstraintUsage:       '«assert»',
  SatisfyRequirementUsage:     '«satisfy»',
  EventOccurrenceUsage:        '«event»',
  EntryActionUsage:            '«entry action»',
  DoActionUsage:               '«do action»',
  ExitActionUsage:             '«exit action»',
  TransitionUsage:             '«transition»',
  ObjectiveMembership:         '«objective»',
  SubjectMembership:           '«subject»',
  ActorMembership:             '«actor»',
  StakeholderMembership:       '«stakeholder»',
  RequirementConstraintMembership: '«requirement constraint»',
  FramedConcernMembership:     '«framed concern»',
  RequirementVerificationMembership: '«requirement verification»',
  TransitionFeatureMembership: '«transition feature»',
  StateSubactionMembership:    '«state subaction»',
  ViewRenderingMembership:     '«render»',
  VariantMembership:           '«variant»',
  Expose:                      '«expose»',
  MembershipExpose:            '«expose»',
  NamespaceExpose:             '«expose»',
  ReferenceUsage:              '«ref»',
  TriggerInvocationExpression: '«trigger»',
  Alias:                       '«alias»',
  Comment:                     '«comment»',
};

const USAGE_KEYWORD_DISPLAY: Record<string, string> = {
  part: 'part', attribute: 'attribute', port: 'port', action: 'action', state: 'state', item: 'item',
  in: 'in', out: 'out',
  requirement: 'requirement', constraint: 'constraint', interface: 'interface',
  enum: 'enum', calc: 'calc', allocation: 'allocation',
  usecase: 'use case', case: 'case', view: 'view', viewpoint: 'viewpoint',
  concern: 'concern', rendering: 'rendering',
};

const IS_USAGE = new Set([
  'PartUsage', 'AttributeUsage', 'ConnectionUsage', 'PortUsage', 'ActionUsage', 'StateUsage', 'ItemUsage',
  'RequirementUsage', 'ConstraintUsage', 'InterfaceUsage', 'EnumUsage', 'CalcUsage',
  'AllocationUsage', 'CaseUsage', 'UseCaseUsage', 'AnalysisCaseUsage', 'VerificationCaseUsage',
  'ConcernUsage', 'ViewUsage', 'ViewpointUsage', 'RenderingUsage', 'OccurrenceUsage', 'FlowUsage',
  'MetadataUsage', 'SuccessionFlowUsage',
  'ConnectorAsUsage', 'BindingConnectorAsUsage', 'SuccessionAsUsage',
  'ObjectiveMembership', 'SubjectMembership', 'ActorMembership', 'StakeholderMembership',
  'ViewRenderingMembership', 'MembershipExpose', 'NamespaceExpose', 'ReferenceUsage',
  'TransitionUsage',
  'PerformActionUsage', 'ExhibitStateUsage',
  'SendActionUsage', 'AcceptActionUsage', 'IfActionUsage', 'AssignmentActionUsage',
  'ForLoopActionUsage', 'WhileLoopActionUsage', 'IncludeUseCaseUsage',
  'AssertConstraintUsage', 'SatisfyRequirementUsage', 'EventOccurrenceUsage',
  'EntryActionUsage', 'DoActionUsage', 'ExitActionUsage',
]);

const CONTROL_KINDS = new Set(['ForkNode', 'JoinNode', 'MergeNode', 'DecisionNode', 'StartNode', 'DoneNode', 'TerminateNode']);

/** Estimate pixel width for a text string at a given font size (monospace ~0.6em). */
function textWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.62 + 16;
}

// ── Node rendering (port of nodeToSNode) ────────────────────────────────────

function nodeToSNode(node: InterconnectionNode): SNode {
  const skipCompartments = node.hasVisibleChildren;
  const isStdlib = node.isStdlib;
  const baseKindText = isStdlib
    ? `«${node.qualifiedName?.split('::')[0] ?? 'stdlib'}»`
    : (KIND_DISPLAY[node.kind] ?? `«${node.kind}»`);
  let kindText = baseKindText;
  if (node.isAbstract) kindText = kindText.replace('«', '«abstract ');
  if (node.isRef) kindText = kindText.replace('«', '«ref ');
  if (node.isIndividual) kindText = kindText.replace('«', '«individual ');
  if (node.portionKind === 'snapshot') kindText = '«snapshot»';
  if (node.portionKind === 'timeslice') kindText = '«timeslice»';
  if (node.isParallel) kindText += ' {parallel}';
  const kindLabel = makeLabel(`${node.id}__kind`, kindText);

  // Usage nodes: show "name[mult] : Type" in the name label
  const multSuffix = node.multiplicity ?? '';
  const nameText = IS_USAGE.has(node.kind) && node.qualifiedName
    ? `${node.name}${multSuffix} : ${node.qualifiedName}`
    : node.name;
  const nameLabel = makeLabel(`${node.id}__label`, nameText);

  // Package nodes: tab-rectangle container
  if (node.kind === 'Package') {
    const width = Math.max(180, textWidth(node.name, 13) + 30);
    return {
      type: 'node', id: node.id,
      position: { x: 0, y: 0 },
      size: { width, height: 60 },
      children: [kindLabel, nameLabel],
      cssClasses: ['package'],
      data: { range: node.range },
    };
  }

  // Comment/doc nodes: folded-corner note shape
  if (node.kind === 'Comment') {
    const isDocNode = node.id.startsWith('doc__');
    const docKindLabel = isDocNode ? makeLabel(`${node.id}__kind`, '«doc»') : kindLabel;
    const bodyText = node.attributes?.[0]?.value ?? '';
    const bodyLabel = makeLabel(`${node.id}__usage__0`, bodyText);
    const bodyW = Math.max(120, textWidth(bodyText, 10) / 2 + 20);
    const lines = Math.ceil(bodyText.length / Math.max(18, Math.floor((bodyW - 16) / 6.5)));
    const height = 50 + lines * 14;
    return {
      type: 'node', id: node.id,
      position: { x: 0, y: 0 },
      size: { width: bodyW, height },
      children: [docKindLabel, nameLabel, bodyLabel],
      cssClasses: ['comment'],
      data: { range: node.range },
    };
  }

  // Control nodes: fork/join (thin bar), merge/decide (diamond),
  // start (filled circle), done (bull's-eye), terminate (X circle)
  if (CONTROL_KINDS.has(node.kind)) {
    const isForkJoin = node.kind === 'ForkNode' || node.kind === 'JoinNode';
    const isCircular = node.kind === 'StartNode' || node.kind === 'DoneNode' || node.kind === 'TerminateNode';
    const width = isCircular ? 24 : isForkJoin ? 80 : 40;
    const height = isCircular ? 24 : isForkJoin ? 8 : 40;
    return {
      type: 'node', id: node.id,
      position: { x: 0, y: 0 },
      size: { width, height },
      children: [kindLabel, nameLabel],
      cssClasses: [node.kind.toLowerCase()],
      data: { range: node.range },
    };
  }

  if (IS_USAGE.has(node.kind)) {
    // Port usages: always portusage CSS — rendered as small squares on part boundaries (IV + AFV)
    if (node.kind === 'PortUsage') {
      const dirPrefix = node.direction ? `«${node.direction} ` : '«';
      const portKindLabel = makeLabel(`${node.id}__kind`, (KIND_DISPLAY[node.kind] ?? '«port»').replace('«', dirPrefix));
      const width = Math.max(80, Math.max(textWidth(nameText, 11), textWidth(portKindLabel.text, 10)) + 20);
      return {
        type: 'node', id: node.id,
        position: { x: 0, y: 0 },
        size: { width, height: 50 },
        children: [portKindLabel, nameLabel],
        cssClasses: ['portusage'],
        data: { qualifiedName: node.qualifiedName, range: node.range, direction: node.direction, isRef: node.isRef, isParallel: node.isParallel },
      };
    }

    // Directed non-port usages (in/out/inout items, attributes, etc.)
    if (node.direction === 'in' || node.direction === 'out' || node.direction === 'inout') {
      const baseKw = KIND_DISPLAY[node.kind] ?? `«${node.kind}»`;
      const dirKindLabel = makeLabel(`${node.id}__kind`, baseKw.replace('«', `«${node.direction} `));

      if (node.ownerIsPortOrActionUsage) {
        // Owner is an action usage → small boundary square with directional arrow
        const cssClass = node.direction === 'in' ? 'actionin' : node.direction === 'out' ? 'actionout' : 'actioninout';
        return {
          type: 'node', id: node.id,
          position: { x: 0, y: 0 },
          size: { width: 16, height: 16 },
          children: [dirKindLabel, nameLabel],
          cssClasses: [cssClass],
          data: { qualifiedName: node.qualifiedName, range: node.range, direction: node.direction, isRef: node.isRef, isParallel: node.isParallel },
        };
      }

      // Owner is a definition, package, or other → regular nested node
      const width = Math.max(120, Math.max(textWidth(nameText, 13), textWidth(dirKindLabel.text, 10)) + 20);
      return {
        type: 'node', id: node.id,
        position: { x: 0, y: 0 },
        size: { width, height: 50 },
        children: [dirKindLabel, nameLabel],
        cssClasses: [isStdlib ? 'stdlib' : node.kind.toLowerCase()],
        data: { qualifiedName: node.qualifiedName, range: node.range, direction: node.direction, isRef: node.isRef, isParallel: node.isParallel },
      };
    }
    // Entry/do/exit behaviors render as graphical child nodes (filtered out of IV)

    // Regular usage nodes: compact, but show inherited attributes when present
    const inheritedAttrs = (node.attributes ?? []).filter(a => a.inherited);
    if (inheritedAttrs.length > 0) {
      const inheritedLabels: SLabel[] = inheritedAttrs.map((attr, i) => {
        const kw = attr.value ? `${USAGE_KEYWORD_DISPLAY[attr.value] ?? attr.value} ` : '';
        const text = attr.type ? `^ ${kw}${attr.name} : ${attr.type}` : `^ ${kw}${attr.name}`;
        return makeLabel(`${node.id}__inherited__${i}`, text);
      });
      const nameW = textWidth(nameText, 13);
      const kindW = textWidth(kindText, 10);
      const inheritedW = Math.max(...inheritedLabels.map(l => textWidth(l.text, 10))) + 8;
      const width = Math.max(120, nameW + 20, kindW + 20, inheritedW + 16);
      const HEADER_H = 50;
      const ROW_H = 18;
      const height = HEADER_H + 6 + inheritedLabels.length * ROW_H + 4;
      return {
        type: 'node', id: node.id,
        position: { x: 0, y: 0 },
        size: { width, height },
        children: [kindLabel, nameLabel, ...inheritedLabels],
        cssClasses: [isStdlib ? 'stdlib' : node.kind.toLowerCase()],
        data: { qualifiedName: node.qualifiedName, range: node.range, isRef: node.isRef, isParallel: node.isParallel },
      };
    }
    const nameW = textWidth(nameText, 13);
    const kindW = textWidth(kindText, 10);
    const width = Math.max(120, Math.max(nameW, kindW) + 20);
    return {
      type: 'node', id: node.id,
      position: { x: 0, y: 0 },
      size: { width, height: 50 },
      children: [kindLabel, nameLabel],
      cssClasses: [isStdlib ? 'stdlib' : node.kind.toLowerCase()],
      data: { qualifiedName: node.qualifiedName, range: node.range, isRef: node.isRef, isParallel: node.isParallel },
    };
  }

  // Definition nodes: build usage/attribute compartment labels
  // For IV the ViewConfig has hideDirectedFromDefCompartments=false, so
  // skipDirected is always false (the directed-compartment-hiding only fires in
  // AFV/STV); kept for byte-identical fidelity with the legacy branch.
  const skipDirected = false;
  const DIRECTED_VALUES = new Set(['in', 'out', 'inout', 'in item', 'out item', 'in attribute', 'out attribute']);
  // For state definitions, skip child state/action usages — IV has neither, so
  // isStateDef is always false here, but the check mirrors the legacy code.
  const STATE_CHILD_VALUES = new Set(['state', 'action', 'state :>', 'state :>>', 'action :>', 'action :>>']);
  const isStateDef = node.kind === 'StateDefinition' || node.kind === 'StateUsage';
  // Skip own compartment labels when children are rendered as graphical nodes,
  // but still include inherited labels (they have no separate graphical nodes)
  if (skipCompartments) {
    const inheritedLabels: SLabel[] = (node.attributes ?? [])
      .filter(a => a.inherited)
      .map((attr, i) => {
        const kw = attr.value ? `${USAGE_KEYWORD_DISPLAY[attr.value] ?? attr.value} ` : '';
        const text = attr.type ? `^ ${kw}${attr.name} : ${attr.type}` : `^ ${kw}${attr.name}`;
        return makeLabel(`${node.id}__inherited__${i}`, text);
      });
    const nameW = textWidth(node.name, 13);
    const kindW = textWidth(kindText, 10);
    const inheritedW = inheritedLabels.length > 0 ? Math.max(...inheritedLabels.map(l => textWidth(l.text, 10))) + 8 : 0;
    const width = Math.max(140, nameW + 20, kindW + 20, inheritedW + 16);
    const HEADER_H = 60;
    const ROW_H = 18;
    const height = inheritedLabels.length > 0 ? HEADER_H + 6 + inheritedLabels.length * ROW_H + 4 : HEADER_H;
    return {
      type: 'node', id: node.id,
      position: { x: 0, y: 0 },
      size: { width, height },
      children: [kindLabel, nameLabel, ...inheritedLabels],
      cssClasses: [isStdlib ? 'stdlib' : node.kind.toLowerCase()],
      data: { qualifiedName: node.qualifiedName, range: node.range, isRef: node.isRef, isParallel: node.isParallel },
    };
  }

  const usageLabels: SLabel[] = (node.attributes ?? [])
    .filter(a => a.name !== '__doc__')
    .filter(a => !(skipDirected && a.value && DIRECTED_VALUES.has(a.value)))
    .filter(a => !(isStateDef && a.value && STATE_CHILD_VALUES.has(a.value)))
    .map((attr, i) => {
      let text: string;
      const val = attr.value ?? '';
      if (val === '__entry__' || val === '__exit__' || val === '__do__') {
        return makeLabel(`${node.id}__usage__${i}`, attr.name);
      }
      const baseKeyword = val.split(/\s+/)[0];
      const operator = val.includes(':>>') ? ' :>> ' : val.includes('::>') ? ' ::> ' : val.includes(':>') ? ' :> ' : '';
      if (val && !KEYWORD_VALUES.has(val) && !operator) {
        text = attr.type
          ? `+ ${attr.name} : ${attr.type} = ${val}`
          : `+ ${attr.name} = ${val}`;
      } else if (operator && KEYWORD_VALUES.has(baseKeyword)) {
        const kw = USAGE_KEYWORD_DISPLAY[baseKeyword] ?? baseKeyword;
        text = attr.type ? `${kw} ${attr.name}${operator}${attr.type}` : `${kw} ${attr.name}`;
      } else {
        const kw = val ? `${USAGE_KEYWORD_DISPLAY[val] ?? val} ` : '';
        text = attr.type ? `${kw}${attr.name} : ${attr.type}` : `${kw}${attr.name}`;
      }
      const labelId = attr.inherited
        ? `${node.id}__inherited__${i}`
        : `${node.id}__usage__${i}`;
      if (attr.isDerived) text = `/ ${text}`;
      if (attr.inherited) text = `^ ${text}`;
      return makeLabel(labelId, text);
    });

  const BASE_HEIGHT = 60;
  const USAGE_ROW_HEIGHT = 18;
  const height = BASE_HEIGHT + (usageLabels.length > 0 ? 8 + usageLabels.length * USAGE_ROW_HEIGHT : 0);
  const nameW = textWidth(node.name, 13);
  const kindW = textWidth(kindText, 10);
  const compartmentW = usageLabels.length > 0
    ? Math.max(...usageLabels.map(l => textWidth(l.text, 10))) + 8
    : 0;
  const width = Math.max(140, nameW + 20, kindW + 20, compartmentW + 16);

  return {
    type: 'node', id: node.id,
    position: { x: 0, y: 0 },
    size: { width, height },
    children: [kindLabel, nameLabel, ...usageLabels],
    cssClasses: [isStdlib ? 'stdlib' : node.kind.toLowerCase()],
    data: { qualifiedName: node.qualifiedName, range: node.range, isRef: node.isRef, isParallel: node.isParallel },
  };
}

// ── Edge rendering (port of connectionToSEdge) ──────────────────────────────

function connectionToSEdge(conn: InterconnectionEdge): SEdge {
  let labelText = conn.name ?? '';
  if (!labelText && (conn.kind === 'flow' || conn.kind === 'successionflow') && (conn.sourcePort || conn.targetPort)) {
    const isRetargeted = conn.sourceId.includes('__param__') || conn.targetId.includes('__param__');
    if (!isRetargeted) {
      const parts: string[] = [];
      if (conn.sourcePort) parts.push(conn.sourcePort);
      if (conn.targetPort && conn.targetPort !== conn.sourcePort) parts.push(conn.targetPort);
      labelText = parts.join(' → ');
    }
  }
  const children: SLabel[] = labelText
    ? [makeLabel(`${conn.id}__label`, labelText)]
    : [];

  return {
    type: 'edge', id: conn.id,
    sourceId: conn.sourceId, targetId: conn.targetId,
    children, cssClasses: [conn.kind],
    ...(conn.range ? { data: { range: conn.range } } : {}),
  };
}

// ── Root ────────────────────────────────────────────────────────────────────

export function interconnectionToSModelRoot(ir: InterconnectionIR): SModelRoot {
  const sNodes: SNode[] = ir.nodes.map(nodeToSNode);
  const sEdges: SEdge[] = ir.edges.map(connectionToSEdge);
  // Legacy id is `${viewType}__${model.uri}` (bdd-transformer.ts:706). The IR
  // tag is 'interconnection' and metadata.sourceFile is model.uri, so this
  // reproduces `interconnection__<uri>` byte-identically.
  return {
    type: 'graph',
    id: `${ir.viewType}__${ir.metadata.sourceFile ?? ''}`,
    children: [...sNodes, ...sEdges],
  };
}
