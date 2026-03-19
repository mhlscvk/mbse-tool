import type { SysMLModel, SysMLNode, SModelRoot, SNode, SEdge, SLabel, ViewType } from '@systemodel/shared-types';
import { applyViewFilter } from './view-filters.js';

const KEYWORD_VALUES = new Set([
  'part', 'attribute', 'port', 'action', 'state', 'item', 'in', 'out',
  'requirement', 'constraint', 'interface', 'enum', 'calc', 'allocation',
  'usecase', 'view', 'viewpoint', 'concern', 'rendering', 'perform', 'exhibit', 'ref',
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
  OccurrenceDefinition:        '«occurrence def»',
  OccurrenceUsage:             '«occurrence»',
  ForkNode:                    '«fork»',
  JoinNode:                    '«join»',
  DoneNode:                    '«done»',
  MergeNode:                   '«merge»',
  DecideNode:                  '«decide»',
  PerformActionUsage:          '«perform»',
  ExhibitStateUsage:           '«exhibit»',
  EntryActionUsage:            '«entry action»',
  DoActionUsage:               '«do action»',
  ExitActionUsage:             '«exit action»',
  TransitionUsage:             '«transition»',
  Alias:                       '«alias»',
  Comment:                     '«comment»',
};

const USAGE_KEYWORD_DISPLAY: Record<string, string> = {
  part: 'part', attribute: 'attribute', port: 'port', action: 'action', state: 'state', item: 'item',
  in: 'in', out: 'out',
  requirement: 'requirement', constraint: 'constraint', interface: 'interface',
  enum: 'enum', calc: 'calc', allocation: 'allocation',
  usecase: 'use case', view: 'view', viewpoint: 'viewpoint',
  concern: 'concern', rendering: 'rendering',
};

const IS_USAGE = new Set([
  'PartUsage', 'AttributeUsage', 'ConnectionUsage', 'PortUsage', 'ActionUsage', 'StateUsage', 'ItemUsage',
  'RequirementUsage', 'ConstraintUsage', 'InterfaceUsage', 'EnumUsage', 'CalcUsage',
  'AllocationUsage', 'UseCaseUsage', 'AnalysisCaseUsage', 'VerificationCaseUsage',
  'ConcernUsage', 'ViewUsage', 'ViewpointUsage', 'RenderingUsage', 'OccurrenceUsage', 'FlowUsage',
  'TransitionUsage',
  'PerformActionUsage', 'ExhibitStateUsage',
  'EntryActionUsage', 'DoActionUsage', 'ExitActionUsage',
]);

const CONTROL_KINDS = new Set(['ForkNode', 'JoinNode', 'MergeNode', 'DecideNode', 'StartNode', 'DoneNode', 'TerminateNode']);

/** Estimate pixel width for a text string at a given font size (monospace ~0.6em). */
function textWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.62 + 16;
}

function nodeToSNode(node: SysMLNode): SNode {
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
    // Action in/out/inout parameters get a special CSS class
    if (node.direction === 'in' || node.direction === 'out' || node.direction === 'inout') {
      const cssClass = node.direction === 'in' ? 'actionin' : node.direction === 'out' ? 'actionout' : 'actioninout';
      const width = Math.max(80, textWidth(nameText, 11) + 20);
      return {
        type: 'node', id: node.id,
        position: { x: 0, y: 0 },
        size: { width, height: 50 },
        children: [kindLabel, nameLabel],
        cssClasses: [cssClass],
        data: { qualifiedName: node.qualifiedName, range: node.range, direction: node.direction },
      };
    }
    // Usage nodes with state behaviors (entry/do/exit) get compartment labels
    const behaviorAttrs = (node.attributes ?? []).filter(a =>
      a.value === '__entry__' || a.value === '__do__' || a.value === '__exit__',
    );
    if (behaviorAttrs.length > 0) {
      const behaviorLabels = behaviorAttrs.map((attr, i) =>
        makeLabel(`${node.id}__usage__${i}`, attr.name),
      );
      const nameW = textWidth(nameText, 13);
      const kindW = textWidth(kindText, 10);
      const compartmentW = Math.max(...behaviorLabels.map(l => textWidth(l.text, 10))) + 8;
      const ROW_H = 18;
      const height = 60 + behaviorLabels.length * ROW_H + 4;
      const width = Math.max(120, nameW + 20, kindW + 20, compartmentW + 16);
      return {
        type: 'node', id: node.id,
        position: { x: 0, y: 0 },
        size: { width, height },
        children: [kindLabel, nameLabel, ...behaviorLabels],
        cssClasses: [isStdlib ? 'stdlib' : node.kind.toLowerCase()],
        data: { qualifiedName: node.qualifiedName, range: node.range, isRef: node.isRef },
      };
    }

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
      data: { qualifiedName: node.qualifiedName, range: node.range, isRef: node.isRef },
    };
  }

  // Definition nodes: build usage/attribute compartment labels
  const usageLabels: SLabel[] = (node.attributes ?? [])
    .filter(a => a.name !== '__doc__')
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
      return makeLabel(`${node.id}__usage__${i}`, text);
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
    data: { qualifiedName: node.qualifiedName, range: node.range, isRef: node.isRef },
  };
}

function connectionToSEdge(conn: { id: string; sourceId: string; targetId: string; kind: string; name?: string }): SEdge {
  const children: SLabel[] = conn.name
    ? [makeLabel(`${conn.id}__label`, conn.name)]
    : [];

  return {
    type: 'edge', id: conn.id,
    sourceId: conn.sourceId, targetId: conn.targetId,
    children, cssClasses: [conn.kind],
  };
}

export function transformToBDD(model: SysMLModel, viewType: ViewType = 'general'): SModelRoot {
  // Apply view-specific filtering first
  const filtered = applyViewFilter(model, viewType);

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
    if (c.kind === 'composition' && packageNodeIds.has(c.sourceId)) {
      packageChildIds.add(c.targetId);
    }
  }

  // Entry/do/exit graphical nodes are only shown in STV — hide in other views
  const BEHAVIOR_ACTION_KINDS = new Set(['EntryActionUsage', 'DoActionUsage', 'ExitActionUsage']);

  const hiddenNodeIds = new Set<string>();
  if (viewType !== 'state-transition') {
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

  const sNodes: SNode[] = filtered.nodes
    .filter(n => !hiddenNodeIds.has(n.id))
    .map(nodeToSNode);

  const sEdges: SEdge[] = filtered.connections
    .filter((conn) => {
      if (hiddenNodeIds.has(conn.sourceId) || hiddenNodeIds.has(conn.targetId)) return false;
      if (viewType === 'general' && conn.kind === 'typereference' && behavioralNodeIds.has(conn.sourceId)) return false;
      return true;
    })
    .map(connectionToSEdge);

  return {
    type: 'graph',
    id: `${viewType}__${model.uri}`,
    children: [...sNodes, ...sEdges],
  };
}
