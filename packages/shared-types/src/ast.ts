// SysML v2 AST node types produced by the language server
export type SysMLNodeKind =
  | 'PartDefinition'
  | 'AttributeDefinition'
  | 'ConnectionDefinition'
  | 'PortDefinition'
  | 'ActionDefinition'
  | 'StateDefinition'
  | 'PartUsage'
  | 'AttributeUsage'
  | 'ConnectionUsage'
  | 'PortUsage';

export interface SysMLNode {
  id: string;
  kind: SysMLNodeKind;
  name: string;
  qualifiedName?: string;
  children: SysMLNode[];
  attributes: SysMLAttribute[];
  connections: SysMLConnection[];
  range?: SourceRange;
}

export interface SysMLAttribute {
  name: string;
  type?: string;
  value?: string;
}

export interface SysMLConnection {
  id: string;
  sourceId: string;
  targetId: string;
  kind: 'association' | 'dependency' | 'composition' | 'flow';
  name?: string;
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
