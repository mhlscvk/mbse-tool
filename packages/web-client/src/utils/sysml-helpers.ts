import type { SNode } from '@systemodel/shared-types';

/** SysML keyword pattern for element definitions/usages */
const SYSML_DEF_PATTERN = /\b(?:part|attribute|port|action|state|item|connection|interface|use\s*case|analysis\s*case|verification\s*case|allocation|requirement|concern|stakeholder|view|viewpoint|package)\s+(?:def\s+)?(\w+)/;

/**
 * Parse SysML content to map element names to their line ranges (1-based).
 */
export function parseSysmlElementRanges(text: string): Map<string, { startLine: number; endLine: number }> {
  const lines = text.split('\n');
  const result = new Map<string, { startLine: number; endLine: number }>();

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(SYSML_DEF_PATTERN);
    if (!match) continue;
    const name = match[1];
    let braceDepth = 0;
    let foundOpen = false;
    let endLine = i;
    for (let j = i; j < lines.length; j++) {
      for (const ch of lines[j]) {
        if (ch === '{') { braceDepth++; foundOpen = true; }
        if (ch === '}') braceDepth--;
      }
      if (foundOpen && braceDepth <= 0) { endLine = j; break; }
      if (j === lines.length - 1) endLine = j;
    }
    result.set(name, { startLine: i + 1, endLine: endLine + 1 });
  }
  return result;
}

/**
 * Find the SysML element name at a given line (1-based), searching upward.
 */
export function getElementNameAtLine(text: string, lineNumber: number): string | null {
  const lines = text.split('\n');
  for (let line = lineNumber - 1; line >= 0; line--) {
    const match = lines[line]?.match(SYSML_DEF_PATTERN);
    if (match) return match[1];
  }
  return null;
}

/**
 * Find a diagram node by its label text.
 */
export function findNodeByName(nodes: SNode[], elementName: string): SNode | undefined {
  return nodes.find(n => {
    const label = n.children.find(c => c.id.endsWith('__label'));
    return label?.text === elementName;
  });
}

/**
 * Get the source range from a diagram node's data.
 */
export function getNodeSourceRange(node: SNode): { start: { line: number; character: number }; end: { line: number; character: number } } | undefined {
  return node.data?.range as ReturnType<typeof getNodeSourceRange>;
}
