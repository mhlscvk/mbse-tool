import * as ELKModule from 'elkjs';
import type { SModelRoot, SNode, SEdge } from '@systemodel/shared-types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ELKConstructor = (ELKModule as any).default ?? ELKModule;
const elk = new ELKConstructor();

interface ElkNode {
  id: string;
  width: number;
  height: number;
  x?: number;
  y?: number;
}

interface ElkEdge {
  id: string;
  sources: string[];
  targets: string[];
  layoutOptions?: Record<string, string>;
  sections?: { startPoint: { x: number; y: number }; endPoint: { x: number; y: number }; bendPoints?: { x: number; y: number }[] }[];
}

interface ElkGraph {
  id: string;
  layoutOptions: Record<string, string>;
  children: ElkNode[];
  edges: ElkEdge[];
}

export async function applyLayout(model: SModelRoot): Promise<SModelRoot> {
  const nodes = model.children.filter((c): c is SNode => c.type === 'node');
  const edges = model.children.filter((c): c is SEdge => c.type === 'edge');

  const elkGraph: ElkGraph = {
    id: model.id,
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.spacing.nodeNode': '40',
      'elk.layered.spacing.nodeNodeBetweenLayers': '60',
    },
    children: nodes.map((n) => ({
      id: n.id,
      width: n.size?.width ?? 160,
      height: n.size?.height ?? 60,
    })),
    edges: (() => {
      const nodeIds = new Set(nodes.map((n) => n.id));
      return edges
        .filter((e) => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId))
        .map((e) => {
          // Give succession/flow/transition edges higher priority so they
          // drive the layered layout direction even when composition edges
          // pull nodes elsewhere.
          const cssClass = e.cssClasses?.[0] ?? '';
          const isBehavioral = cssClass === 'succession' || cssClass === 'flow' || cssClass === 'transition';
          return {
            id: e.id,
            sources: [e.sourceId],
            targets: [e.targetId],
            ...(isBehavioral ? { layoutOptions: { 'elk.layered.priority.direction': '10' } } : {}),
          };
        });
    })(),
  };

  const layouted = await elk.layout(elkGraph) as ElkGraph;

  const positionedNodes = nodes.map((node) => {
    const elkNode = layouted.children.find((c) => c.id === node.id);
    return {
      ...node,
      position: { x: elkNode?.x ?? 0, y: elkNode?.y ?? 0 },
    };
  });

  const routedEdges = edges.map((edge) => {
    const elkEdge = layouted.edges?.find((e) => e.id === edge.id);
    const section = elkEdge?.sections?.[0];
    const routingPoints = section
      ? [section.startPoint, ...(section.bendPoints ?? []), section.endPoint]
      : [];
    return { ...edge, routingPoints };
  });

  return {
    ...model,
    children: [...positionedNodes, ...routedEdges],
  };
}
