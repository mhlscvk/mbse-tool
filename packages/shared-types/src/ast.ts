// SysML v2 AST node types produced by the language server
export type SysMLNodeKind =
  | 'Package'
  | 'PartDefinition'
  | 'AttributeDefinition'
  | 'ConnectionDefinition'
  | 'PortDefinition'
  | 'ActionDefinition'
  | 'StateDefinition'
  | 'ItemDefinition'
  | 'PartUsage'
  | 'AttributeUsage'
  | 'ConnectionUsage'
  | 'PortUsage'
  | 'ActionUsage'
  | 'StateUsage'
  | 'ItemUsage';

export interface SysMLNode {
  id: string;
  kind: SysMLNodeKind;
  name: string;
  qualifiedName?: string;
  direction?: 'in' | 'out' | 'inout';
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
  kind: 'association' | 'dependency' | 'composition' | 'flow' | 'typereference';
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
