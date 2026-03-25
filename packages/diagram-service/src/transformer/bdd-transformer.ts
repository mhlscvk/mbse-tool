import type { SysMLModel, SysMLNode, SModelRoot, SNode, SEdge, SLabel, ViewType, ViewConfig } from '@systemodel/shared-types';
import { getViewConfig } from '@systemodel/shared-types/dist/view-config.js';
import { applyViewFilter } from './view-filters.js';

const KEYWORD_VALUES = new Set([
  'part', 'attribute', 'port', 'action', 'state', 'item', 'in', 'out',
  'requirement', 'constraint', 'interface', 'enum', 'calc', 'allocation',
  'usecase', 'case', 'view', 'viewpoint', 'concern', 'rendering', 'perform', 'exhibit', 'ref',
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
  PerformActionUsage:          '«perform»',
  ExhibitStateUsage:           '«exhibit»',
  SendActionUsage:             '«send»',
  AcceptActionUsage:           '«accept»',
  IfActionUsage:               '«if»',
  AssignmentActionUsage:       '«assign»',
  ForLoopActionUsage:          '«for loop»',
  WhileLoopActionUsage:        '«while loop»',
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

function nodeToSNode(node: SysMLNode, vcfg: ViewConfig, skipCompartments = false): SNode {
  const isStdlib = node.id.startsWith('stdlib__');
  const baseKindText = isStdlib
    ? `«${node.qualifiedName?.split('::')[0] ?? 'stdlib'}»`
    : (KIND_DISPLAY[node.kind] ?? `«${node.kind}»`);
  let kindText = baseKindText;
  if (node.isAbstract) kindText = kindText.replace('«', '«abstract ');
  if (node.isRef) kindText = kindText.replace('«', '«ref ');
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

    // Directed non-port usages (in/out/inout items, attributes, etc.):
    // - Inside an action usage → actionin/actionout/actioninout CSS (small square in AFV)
    // - Otherwise → regular nested node
    if (node.direction === 'in' || node.direction === 'out' || node.direction === 'inout') {
      const baseKw = KIND_DISPLAY[node.kind] ?? `«${node.kind}»`;
      const dirKindLabel = makeLabel(`${node.id}__kind`, baseKw.replace('«', `«${node.direction} `));

      if (node.ownerIsPortOrActionUsage) {
        // Owner is an action usage → small boundary square with directional arrow
        // Size is kept small (16×16) since viewer overrides to PORT_BORDER_SIZE in nested mode
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
    // Entry/do/exit behaviors are now rendered as graphical child nodes (not compartment labels)
    // Skip creating compartment labels for them — they'll appear as nested action nodes

    // Regular usage nodes: compact, no compartment
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
  // When configured, skip directed items from def compartments (they appear as pins on usages)
  const skipDirected = vcfg.hideDirectedFromDefCompartments && vcfg.defKindsForCompartmentHiding.has(node.kind);
  const DIRECTED_VALUES = new Set(['in', 'out', 'inout', 'in item', 'out item', 'in attribute', 'out attribute']);
  // For state definitions, skip child state/action usages from compartment — they render as graphical nodes
  const STATE_CHILD_VALUES = new Set(['state', 'action', 'state :>', 'state :>>', 'action :>', 'action :>>']);
  const isStateDef = node.kind === 'StateDefinition' || node.kind === 'StateUsage';
  // Skip own compartment labels when children are rendered as graphical nodes
  // But still include inherited labels (they don't have separate graphical nodes)
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
      // State behavior attributes (entry/exit/do) — display as-is
      if (val === '__entry__' || val === '__exit__' || val === '__do__') {
        return makeLabel(`${node.id}__usage__${i}`, attr.name);
      }
      // Check if value is a keyword or keyword+operator (e.g., "part :>", "part :>>", "part ::>")
      const baseKeyword = val.split(/\s+/)[0];
      const operator = val.includes(':>>') ? ' :>> ' : val.includes('::>') ? ' ::> ' : val.includes(':>') ? ' :> ' : '';
      if (val && !KEYWORD_VALUES.has(val) && !operator) {
        text = attr.type
          ? `+ ${attr.name} : ${attr.type} = ${val}`
          : `+ ${attr.name} = ${val}`;
      } else if (operator && KEYWORD_VALUES.has(baseKeyword)) {
        // Subsetting/redefinition/reference subsetting: show as "part name :> target"
        const kw = USAGE_KEYWORD_DISPLAY[baseKeyword] ?? baseKeyword;
        text = attr.type ? `${kw} ${attr.name}${operator}${attr.type}` : `${kw} ${attr.name}`;
      } else {
        const kw = val ? `${USAGE_KEYWORD_DISPLAY[val] ?? val} ` : '';
        text = attr.type ? `${kw}${attr.name} : ${attr.type}` : `${kw}${attr.name}`;
      }
      // Use __inherited__ label ID for inherited attributes so the renderer can style them differently
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

function connectionToSEdge(conn: { id: string; sourceId: string; targetId: string; kind: string; name?: string; range?: import('@systemodel/shared-types').SourceRange }): SEdge {
  const children: SLabel[] = conn.name
    ? [makeLabel(`${conn.id}__label`, conn.name)]
    : [];

  return {
    type: 'edge', id: conn.id,
    sourceId: conn.sourceId, targetId: conn.targetId,
    children, cssClasses: [conn.kind],
    ...(conn.range ? { data: { range: conn.range } } : {}),
  };
}

/**
 * Resolve inherited attributes for definitions that specialize other definitions.
 * Walks the specialization chain and copies parent attributes (marked as inherited)
 * into child definitions. Handles multi-level and diamond inheritance with dedup.
 */
function resolveInheritedAttributes(nodes: SysMLNode[], connections: { sourceId: string; targetId: string; kind: string; name?: string }[]): void {
  const nodeById = new Map(nodes.map(n => [n.id, n]));

  // Build parent map: childId → [parentIds] from specialization edges
  const parentMap = new Map<string, string[]>();
  for (const c of connections) {
    if (c.kind === 'dependency' && c.name === '«specializes»') {
      const parents = parentMap.get(c.sourceId) ?? [];
      parents.push(c.targetId);
      parentMap.set(c.sourceId, parents);
    }
  }

  // Memoize resolved inherited attributes per node id
  const cache = new Map<string, import('@systemodel/shared-types').SysMLAttribute[]>();

  function getInherited(nodeId: string, visited: Set<string>): import('@systemodel/shared-types').SysMLAttribute[] {
    if (cache.has(nodeId)) return cache.get(nodeId)!;
    if (visited.has(nodeId)) return []; // cycle protection
    visited.add(nodeId);

    const parentIds = parentMap.get(nodeId) ?? [];
    const inherited: import('@systemodel/shared-types').SysMLAttribute[] = [];
    const seen = new Set<string>(); // dedup by attribute name

    for (const pid of parentIds) {
      const parent = nodeById.get(pid);
      if (!parent) continue;

      // First collect grandparent inherited attrs
      for (const attr of getInherited(pid, visited)) {
        if (!seen.has(attr.name)) {
          seen.add(attr.name);
          inherited.push(attr);
        }
      }

      // Then parent's own attributes
      for (const attr of parent.attributes ?? []) {
        if (attr.name === '__doc__') continue;
        if (!seen.has(attr.name)) {
          seen.add(attr.name);
          inherited.push({ ...attr, inherited: true, inheritedFrom: parent.name });
        }
      }
    }

    cache.set(nodeId, inherited);
    return inherited;
  }

  // Inject inherited attributes into each definition node
  for (const node of nodes) {
    if (!node.kind.endsWith('Definition')) continue;
    const parentIds = parentMap.get(node.id);
    if (!parentIds || parentIds.length === 0) continue;

    const inherited = getInherited(node.id, new Set());
    // Filter out attributes already defined by this node (redefined)
    const ownNames = new Set((node.attributes ?? []).map(a => a.name));
    const toAdd = inherited.filter(a => !ownNames.has(a.name));
    if (toAdd.length > 0) {
      node.attributes = [...(node.attributes ?? []), ...toAdd];
    }
  }
}

/**
 * For AFV: clone directed (in/out/inout) item/attribute nodes from action definitions
 * into their action usages, so they render as boundary pins on the usage nodes.
 */
function resolveActionUsageParams(nodes: SysMLNode[], connections: { id: string; sourceId: string; targetId: string; kind: string; name?: string; sourcePort?: string; targetPort?: string }[]): void {
  const nodeById = new Map(nodes.map(n => [n.id, n]));

  // Build type map: usage → definition from typereference edges
  const typeOf = new Map<string, string>();
  for (const c of connections) {
    if (c.kind === 'typereference') typeOf.set(c.sourceId, c.targetId);
  }

  // Find all composition children of each node
  const childrenOf = new Map<string, string[]>();
  for (const c of connections) {
    if (c.kind === 'composition') {
      const kids = childrenOf.get(c.sourceId) ?? [];
      kids.push(c.targetId);
      childrenOf.set(c.sourceId, kids);
    }
  }

  // Find action usages that reference a definition
  const ACTION_USAGE_KINDS = new Set(['ActionUsage', 'PerformActionUsage']);
  const usageNodes = nodes.filter(n => ACTION_USAGE_KINDS.has(n.kind));

  // Map: usageId → Map<itemName, pinNodeId> for retargeting flow edges
  const pinIndex = new Map<string, Map<string, string>>();

  for (const usage of usageNodes) {
    const defId = typeOf.get(usage.id);
    if (!defId) continue;

    const usagePins = new Map<string, string>();
    pinIndex.set(usage.id, usagePins);

    // Check if usage already has its own directed param children
    const existingKids = childrenOf.get(usage.id) ?? [];
    const existingParamNames = new Set<string>();
    for (const id of existingKids) {
      const n = nodeById.get(id);
      if (n?.direction) {
        existingParamNames.add(n.name);
        usagePins.set(n.name, n.id);
      }
    }

    // Get definition's directed children (in/out/inout items/attributes)
    const defKids = childrenOf.get(defId) ?? [];
    for (const kidId of defKids) {
      const kid = nodeById.get(kidId);
      if (!kid || !kid.direction) continue;
      if (existingParamNames.has(kid.name)) continue;

      // Clone the param node as a child of the action usage
      const cloneId = `${usage.id}__param__${kid.direction}_${kid.name}`;
      const clonedNode: SysMLNode = {
        ...kid,
        id: cloneId,
        ownerIsPortOrActionUsage: true,
        // keep original range so clicking pin navigates to the item definition
      };
      nodes.push(clonedNode);
      connections.push({
        id: `${cloneId}__comp`,
        sourceId: usage.id,
        targetId: cloneId,
        kind: 'composition',
      });
      usagePins.set(kid.name, cloneId);
    }
  }

  // Retarget flow/successionflow edges to pin nodes
  for (const conn of connections) {
    if (conn.kind !== 'flow' && conn.kind !== 'successionflow') continue;
    if (conn.sourcePort) {
      const pins = pinIndex.get(conn.sourceId);
      const pinId = pins?.get(conn.sourcePort);
      if (pinId) conn.sourceId = pinId;
    }
    if (conn.targetPort) {
      const pins = pinIndex.get(conn.targetId);
      const pinId = pins?.get(conn.targetPort);
      if (pinId) conn.targetId = pinId;
    }
  }
}

export function transformToBDD(model: SysMLModel, viewType: ViewType = 'general', showInherited = false): SModelRoot {
  const vcfg = getViewConfig(viewType);

  // Apply view-specific filtering first
  const filtered = applyViewFilter(model, viewType);

  // Optionally resolve inherited attributes before transformation
  if (showInherited) {
    resolveInheritedAttributes(filtered.nodes, filtered.connections);
  }

  // Clone directed items from definitions into usages as boundary pins (when configured)
  if (vcfg.cloneDefParamsAsUsagePins) {
    resolveActionUsageParams(filtered.nodes, filtered.connections);
  }

  // ── Action-flow cleanup (General View only) ───────────────────────────
  // When a diagram contains succession edges (action flows), definition
  // nodes that only serve as types (no succession/flow/transition edges)
  // clutter the layout.  Hide them — their type info is already shown in
  // the usage label ("name : Type").
  // For non-general views, the view filter already handles this.

  const hasSuccession = filtered.connections.some(c => c.kind === 'succession');

  // Collect node IDs that participate in behavioral edges
  const behavioralNodeIds = new Set<string>();
  for (const c of filtered.connections) {
    if (c.kind === 'succession' || c.kind === 'flow' || c.kind === 'transition') {
      behavioralNodeIds.add(c.sourceId);
      behavioralNodeIds.add(c.targetId);
    }
  }

  // Identify definition nodes to hide (general view only — other views handle their own filtering)
  const DEFINITION_KINDS = new Set([
    'ActionDefinition', 'StateDefinition', 'ItemDefinition',
    'PartDefinition', 'AttributeDefinition', 'PortDefinition',
    'ConnectionDefinition',
  ]);
  // Nodes owned by a package should never be auto-hidden — the user placed them there explicitly
  const packageChildIds = new Set<string>();
  const packageNodeIds = new Set(filtered.nodes.filter(n => n.kind === 'Package').map(n => n.id));
  for (const c of filtered.connections) {
    if ((c.kind === 'composition' || c.kind === 'noncomposite') && packageNodeIds.has(c.sourceId)) {
      packageChildIds.add(c.targetId);
    }
  }

  // Entry/do/exit graphical nodes: show in GV (nested) and STV, hide in IV and AFV
  const BEHAVIOR_ACTION_KINDS = new Set(['EntryActionUsage', 'DoActionUsage', 'ExitActionUsage']);

  const hiddenNodeIds = new Set<string>();
  if (viewType === 'interconnection' || viewType === 'action-flow') {
    for (const node of filtered.nodes) {
      if (BEHAVIOR_ACTION_KINDS.has(node.kind)) hiddenNodeIds.add(node.id);
    }
  }
  if (viewType === 'general' && hasSuccession) {
    for (const node of filtered.nodes) {
      if (DEFINITION_KINDS.has(node.kind)
          && !behavioralNodeIds.has(node.id)
          && !packageChildIds.has(node.id)
          && (node.attributes?.length ?? 0) === 0) {
        hiddenNodeIds.add(node.id);
      }
    }
  }

  // Determine which nodes have visible graphical children (skip compartment labels for those)
  const visibleIds = new Set(filtered.nodes.filter(n => !hiddenNodeIds.has(n.id)).map(n => n.id));
  const nodesWithChildren = new Set<string>();
  for (const conn of filtered.connections) {
    if ((conn.kind === 'composition' || conn.kind === 'noncomposite') && visibleIds.has(conn.targetId)) {
      nodesWithChildren.add(conn.sourceId);
    }
  }

  const sNodes: SNode[] = filtered.nodes
    .filter(n => !hiddenNodeIds.has(n.id))
    .map(n => nodeToSNode(n, vcfg, nodesWithChildren.has(n.id)));

  const sEdges: SEdge[] = filtered.connections
    .filter((conn) => {
      if (hiddenNodeIds.has(conn.sourceId) || hiddenNodeIds.has(conn.targetId)) return false;
      // Type-reference edges only shown in General View — other views use them
      // internally (e.g. AFV pin cloning) but don't render them
      if (viewType !== 'general' && conn.kind === 'typereference') return false;
      return true;
    })
    .map(connectionToSEdge);

  return {
    type: 'graph',
    id: `${viewType}__${model.uri}`,
    children: [...sNodes, ...sEdges],
  };
}
