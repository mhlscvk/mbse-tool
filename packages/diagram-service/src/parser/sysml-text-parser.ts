import type { SysMLModel, SysMLNode, SysMLConnection, SysMLNodeKind } from '@systemodel/shared-types';

// ─── Helpers ───────────────────────────────────────────────────────────────

function stripComments(src: string): string {
  // Strip /* ... */ block comments
  src = src.replace(/\/\*[\s\S]*?\*\//g, ' ');
  // Strip // line comments
  src = src.replace(/\/\/[^\n]*/g, '');
  return src;
}

function makeId(prefix: string, name: string): string {
  return `${prefix}__${name.replace(/[^a-zA-Z0-9_]/g, '_')}`;
}

// ─── Definition patterns ────────────────────────────────────────────────────

const DEF_PATTERN = /\b(part|attribute|connection|port|action|state)\s+def\s+(\w+)(?:\s+specializes\s+(\w+))?\s*\{/g;
const USAGE_PATTERN = /\b(part|attribute|port|action|state)\s+(\w+)\s*(?:\[[\d..*]+\])?\s*:\s*(\w+)\s*[;{]/g;
const CONNECT_PATTERN = /\bconnect\s+(\w+(?:\.\w+)*)\s+to\s+(\w+(?:\.\w+)*)\s*;/g;
const FLOW_PATTERN = /\bflow\s+(?:(\w+)\s+)?from\s+(\w+(?:\.\w+)*)\s+to\s+(\w+(?:\.\w+)*)\s*;/g;

// ─── Main parser ─────────────────────────────────────────────────────────────

export function parseSysMLText(uri: string, source: string): SysMLModel {
  const clean = stripComments(source);

  const nodes: SysMLNode[] = [];
  const connections: SysMLConnection[] = [];
  const nodeIndex = new Map<string, SysMLNode>();

  // ── 1. Extract all *Definitions ────────────────────────────────────────

  DEF_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = DEF_PATTERN.exec(clean)) !== null) {
    const [, keyword, name, specializes] = match;
    const kind = `${keyword.charAt(0).toUpperCase()}${keyword.slice(1)}Definition` as SysMLNodeKind;
    const id = makeId('def', name);

    const node: SysMLNode = {
      id,
      kind,
      name,
      qualifiedName: name,
      children: [],
      attributes: [],
      connections: [],
    };

    nodes.push(node);
    nodeIndex.set(name, node);

    // Specialization → inheritance connection
    if (specializes) {
      connections.push({
        id: makeId('specializes', `${name}_${specializes}`),
        sourceId: id,
        targetId: makeId('def', specializes),
        kind: 'dependency',
        name: '«specializes»',
      });
    }
  }

  // ── 2. Extract usages and their type references ─────────────────────────

  USAGE_PATTERN.lastIndex = 0;

  while ((match = USAGE_PATTERN.exec(clean)) !== null) {
    const [, , usageName, typeName] = match;

    // Only create a connection if the type is a known definition
    const typeNode = nodeIndex.get(typeName);
    if (!typeNode) continue;

    // Find which definition this usage lives inside
    // Simple heuristic: find the nearest preceding def block
    const usagePos = match.index;
    let ownerNode: SysMLNode | undefined;
    let ownerPos = -1;

    DEF_PATTERN.lastIndex = 0;
    while ((match = DEF_PATTERN.exec(clean)) !== null) {
      if (match.index < usagePos && match.index > ownerPos) {
        ownerPos = match.index;
        const [, , ownerName] = match;
        ownerNode = nodeIndex.get(ownerName);
      }
    }

    if (!ownerNode) continue;

    connections.push({
      id: makeId('usage', `${ownerNode.name}_${usageName}_${typeName}`),
      sourceId: ownerNode.id,
      targetId: typeNode.id,
      kind: 'composition',
      name: usageName,
    });
  }

  // ── 3. Extract explicit connect statements ──────────────────────────────

  CONNECT_PATTERN.lastIndex = 0;

  while ((match = CONNECT_PATTERN.exec(clean)) !== null) {
    const [, from, to] = match;
    const fromRoot = from.split('.')[0];
    const toRoot = to.split('.')[0];

    const sourceNode = nodeIndex.get(fromRoot);
    const targetNode = nodeIndex.get(toRoot);
    if (!sourceNode || !targetNode) continue;

    connections.push({
      id: makeId('connect', `${fromRoot}_${toRoot}_${match.index}`),
      sourceId: sourceNode.id,
      targetId: targetNode.id,
      kind: 'association',
      name: `${from} → ${to}`,
    });
  }

  // ── 4. Extract flow statements ──────────────────────────────────────────

  FLOW_PATTERN.lastIndex = 0;

  while ((match = FLOW_PATTERN.exec(clean)) !== null) {
    const [, , from, to] = match;
    const fromRoot = from.split('.')[0];
    const toRoot = to.split('.')[0];

    const sourceNode = nodeIndex.get(fromRoot);
    const targetNode = nodeIndex.get(toRoot);
    if (!sourceNode || !targetNode) continue;

    connections.push({
      id: makeId('flow', `${fromRoot}_${toRoot}_${match.index}`),
      sourceId: sourceNode.id,
      targetId: targetNode.id,
      kind: 'flow',
      name: '«flow»',
    });
  }

  // Deduplicate connections (same source+target)
  const seen = new Set<string>();
  const uniqueConnections = connections.filter((c) => {
    const key = `${c.sourceId}→${c.targetId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { uri, nodes, connections: uniqueConnections };
}
