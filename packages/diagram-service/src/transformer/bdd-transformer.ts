import type { SysMLModel, SysMLNode, SModelRoot, SNode, SEdge, SLabel } from '@systemodel/shared-types';

function makeLabel(id: string, text: string): SLabel {
  return { type: 'label', id, text };
}

const KIND_DISPLAY: Record<string, string> = {
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

  if (IS_USAGE.has(node.kind)) {
    // Action in/out parameters get a special CSS class for border rendering
    if (node.direction === 'in' || node.direction === 'out') {
      const cssClass = node.direction === 'in' ? 'actionin' : 'actionout';
      const width = Math.max(80, Math.min(180, nameText.length * 7 + 24));
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
    const width = Math.max(140, Math.min(240, nameText.length * 7 + 24));
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
    if (attr.value && !['part','attribute','port','action','state'].includes(attr.value)) {
      text = attr.type
        ? `+ ${attr.name} : ${attr.type} = ${attr.value}`
        : `+ ${attr.name} = ${attr.value}`;
    } else {
      const kw = attr.value ? `${USAGE_KEYWORD_DISPLAY[attr.value] ?? attr.value} ` : '';
      text = attr.type ? `+ ${kw}${attr.name} : ${attr.type}` : `+ ${kw}${attr.name}`;
    }
    return makeLabel(`${node.id}__usage__${i}`, text);
  });

  const BASE_HEIGHT = 60;
  const USAGE_ROW_HEIGHT = 18;
  const height = BASE_HEIGHT + (usageLabels.length > 0 ? 8 + usageLabels.length * USAGE_ROW_HEIGHT : 0);
  const maxTextLen = Math.max(node.name.length, ...node.attributes.map((a) => (a.name + (a.type ?? '')).length + 6));
  const width = Math.max(160, Math.min(280, maxTextLen * 7 + 20));

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
    id: `bdd__${model.uri}`,
    children: [...sNodes, ...sEdges],
  };
}
