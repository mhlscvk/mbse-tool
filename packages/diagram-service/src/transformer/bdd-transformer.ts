import type { SysMLModel, SysMLNode, SModelRoot, SNode, SEdge, SLabel } from '@systemodel/shared-types';

function makeLabel(id: string, text: string): SLabel {
  return { type: 'label', id, text };
}

function nodeToSNode(node: SysMLNode): SNode {
  const label = makeLabel(`${node.id}__label`, node.name);
  const kindLabel = makeLabel(`${node.id}__kind`, `«${node.kind}»`);

  return {
    type: 'node',
    id: node.id,
    position: { x: 0, y: 0 }, // ELK will override these
    size: { width: 160, height: 60 },
    children: [kindLabel, label],
    cssClasses: [node.kind.toLowerCase()],
    data: { qualifiedName: node.qualifiedName },
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
