import type { SysMLModel, SysMLNode, SModelRoot, SNode, SEdge, SLabel } from '@systemodel/shared-types';

const KEYWORD_VALUES = new Set(['part','attribute','port','action','state','item','in','out']);

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
};

const USAGE_KEYWORD_DISPLAY: Record<string, string> = {
  part: 'part', attribute: 'attribute', port: 'port', action: 'action', state: 'state', item: 'item',
  in: 'in', out: 'out',
};

const IS_USAGE = new Set([
  'PartUsage', 'AttributeUsage', 'ConnectionUsage', 'PortUsage', 'ActionUsage', 'StateUsage', 'ItemUsage',
]);

/** Estimate pixel width for a text string at a given font size (monospace ~0.6em). */
function textWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.62 + 16;
}

function nodeToSNode(node: SysMLNode): SNode {
  const isStdlib = node.id.startsWith('stdlib__');
  const kindText = isStdlib
    ? `«${node.qualifiedName?.split('::')[0] ?? 'stdlib'}»`
    : (KIND_DISPLAY[node.kind] ?? `«${node.kind}»`);
  const kindLabel = makeLabel(`${node.id}__kind`, kindText);

  // Usage nodes: show "name : Type" in the name label
  const nameText = IS_USAGE.has(node.kind) && node.qualifiedName
    ? `${node.name} : ${node.qualifiedName}`
    : node.name;
  const nameLabel = makeLabel(`${node.id}__label`, nameText);

  // Package nodes: tab-rectangle container
  if (node.kind === 'Package') {
    const width = Math.max(180, textWidth(node.name, 13) + 30);
    return {
      type: 'node',
      id: node.id,
      position: { x: 0, y: 0 },
      size: { width, height: 60 },
      children: [kindLabel, nameLabel],
      cssClasses: ['package'],
      data: { range: node.range },
    };
  }

  if (IS_USAGE.has(node.kind)) {
    // Action in/out/inout parameters get a special CSS class
    if (node.direction === 'in' || node.direction === 'out' || node.direction === 'inout') {
      const cssClass = node.direction === 'in' ? 'actionin' : node.direction === 'out' ? 'actionout' : 'actioninout';
      const width = Math.max(80, textWidth(nameText, 11) + 20);
      return {
        type: 'node',
        id: node.id,
        position: { x: 0, y: 0 },
        size: { width, height: 50 },
        children: [kindLabel, nameLabel],
        cssClasses: [cssClass],
        data: { qualifiedName: node.qualifiedName, range: node.range, direction: node.direction },
      };
    }
    // Regular usage nodes: compact, no compartment
    const nameW = textWidth(nameText, 13);
    const kindW = textWidth(kindText, 10);
    const width = Math.max(120, Math.max(nameW, kindW) + 20);
    return {
      type: 'node',
      id: node.id,
      position: { x: 0, y: 0 },
      size: { width, height: 50 },
      children: [kindLabel, nameLabel],
      cssClasses: [isStdlib ? 'stdlib' : node.kind.toLowerCase()],
      data: { qualifiedName: node.qualifiedName, range: node.range },
    };
  }

  // Definition nodes: build usage/attribute compartment labels
  const usageLabels: SLabel[] = node.attributes.map((attr, i) => {
    let text: string;
    if (attr.value && !KEYWORD_VALUES.has(attr.value)) {
      text = attr.type
        ? `+ ${attr.name} : ${attr.type} = ${attr.value}`
        : `+ ${attr.name} = ${attr.value}`;
    } else {
      const kw = attr.value ? `${USAGE_KEYWORD_DISPLAY[attr.value] ?? attr.value} ` : '';
      text = attr.type ? `${kw}${attr.name} : ${attr.type}` : `${kw}${attr.name}`;
    }
    return makeLabel(`${node.id}__usage__${i}`, text);
  });

  const BASE_HEIGHT = 60;
  const USAGE_ROW_HEIGHT = 18;
  const height = BASE_HEIGHT + (usageLabels.length > 0 ? 8 + usageLabels.length * USAGE_ROW_HEIGHT : 0);
  // Width: fit the widest of name, kind label, and all compartment entries
  const nameW = textWidth(node.name, 13);
  const kindW = textWidth(kindText, 10);
  const compartmentW = usageLabels.length > 0
    ? Math.max(...usageLabels.map(l => textWidth(l.text, 10))) + 8
    : 0;
  const width = Math.max(140, nameW + 20, kindW + 20, compartmentW + 16);

  return {
    type: 'node',
    id: node.id,
    position: { x: 0, y: 0 },
    size: { width, height },
    children: [kindLabel, nameLabel, ...usageLabels],
    cssClasses: [isStdlib ? 'stdlib' : node.kind.toLowerCase()],
    data: { qualifiedName: node.qualifiedName, range: node.range },
  };
}

function connectionToSEdge(conn: { id: string; sourceId: string; targetId: string; kind: string; name?: string }): SEdge {
  const children: SLabel[] = conn.name
    ? [makeLabel(`${conn.id}__label`, conn.name)]
    : [];

  return {
    type: 'edge',
    id: conn.id,
    sourceId: conn.sourceId,
    targetId: conn.targetId,
    children,
    cssClasses: [conn.kind],
  };
}

export function transformToBDD(model: SysMLModel): SModelRoot {
  const sNodes: SNode[] = model.nodes.map(nodeToSNode);
  const sEdges: SEdge[] = model.connections.map(connectionToSEdge);

  return {
    type: 'graph',
    id: `general__${model.uri}`,
    children: [...sNodes, ...sEdges],
  };
}
