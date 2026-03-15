// Sprotty-compatible diagram model types
export interface SModelRoot {
  type: 'graph';
  id: string;
  children: (SNode | SEdge)[];
}

export interface SNode {
  type: 'node';
  id: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  children: SLabel[];
  cssClasses?: string[];
  data?: Record<string, unknown>;
}

export interface SEdge {
  type: 'edge';
  id: string;
  sourceId: string;
  targetId: string;
  children: SLabel[];
  routingPoints?: { x: number; y: number }[];
  cssClasses?: string[];
}

export interface SLabel {
  type: 'label';
  id: string;
  text: string;
  position?: { x: number; y: number };
}

export type DiagramMessage =
  | { kind: 'model'; model: SModelRoot }
  | { kind: 'error'; message: string }
  | { kind: 'clear' };
