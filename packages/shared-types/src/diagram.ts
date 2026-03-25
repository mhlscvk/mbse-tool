// SysML v2 Standard View Types (Section 9.2.20)
export type ViewType = 'general' | 'interconnection' | 'action-flow' | 'state-transition'
  | 'sequence' | 'grid' | 'browser' | 'geometry';

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
  data?: Record<string, unknown>;
}

export interface SLabel {
  type: 'label';
  id: string;
  text: string;
  position?: { x: number; y: number };
}

export interface DiagnosticFix {
  title: string;
  newText: string;
}

export interface DiagramDiagnostic {
  severity: 'error' | 'warning' | 'info';
  message: string;
  line: number;       // 1-based
  column: number;     // 1-based
  endLine?: number;
  endColumn?: number;
  fixes?: DiagnosticFix[];
}

export type DiagramMessage =
  | { kind: 'model'; model: SModelRoot; diagnostics: DiagramDiagnostic[]; viewType?: ViewType }
  | { kind: 'error'; message: string }
  | { kind: 'clear' };
