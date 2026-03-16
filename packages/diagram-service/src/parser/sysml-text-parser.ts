import type { SysMLModel, SysMLNode, SysMLConnection, SysMLNodeKind, DiagramDiagnostic } from '@systemodel/shared-types';

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

function lineCol(source: string, index: number): { line: number; column: number } {
  const before = source.slice(0, index);
  const line = (before.match(/\n/g) ?? []).length + 1;
  const column = index - before.lastIndexOf('\n');
  return { line, column };
}

/** Levenshtein edit distance between two strings (case-insensitive). */
function editDistance(a: string, b: string): number {
  const A = a.toLowerCase(), B = b.toLowerCase();
  const dp: number[][] = Array.from({ length: A.length + 1 }, (_, i) =>
    Array.from({ length: B.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= A.length; i++)
    for (let j = 1; j <= B.length; j++)
      dp[i][j] = A[i - 1] === B[j - 1] ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[A.length][B.length];
}

/** Return up to `max` candidates closest to `name`, within a distance threshold. */
function suggestSimilar(name: string, candidates: string[], max = 3): string[] {
  const threshold = Math.max(2, Math.floor(name.length / 2));
  return candidates
    .filter((c) => c !== name)
    .map((c) => ({ c, d: editDistance(name, c) }))
    .filter(({ d }) => d <= threshold)
    .sort((a, b) => a.d - b.d)
    .slice(0, max)
    .map(({ c }) => c);
}

/** Returns the index just past the end of a `{ ... }` block or `;` statement.
 *  `headerEnd` should point at the `{` or `;` character that closes the header. */
function findBlockEnd(src: string, headerEnd: number): number {
  const ch = src[headerEnd];
  if (ch === ';') return headerEnd + 1;
  if (ch !== '{') return headerEnd + 1;
  let depth = 1;
  let i = headerEnd + 1;
  while (i < src.length && depth > 0) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') depth--;
    i++;
  }
  return i;
}

// ─── Standard library packages ───────────────────────────────────────────────
// Types defined in each SysML v2 standard library package.
// These are registered as virtual nodes when the package is imported.

type StdlibEntry = { kind: SysMLNodeKind; specializes?: string };

const STDLIB_PACKAGES: Record<string, Record<string, StdlibEntry>> = {
  ScalarValues: {
    ScalarValue:    { kind: 'AttributeDefinition' },
    NumericalValue: { kind: 'AttributeDefinition', specializes: 'ScalarValue' },
    Complex:        { kind: 'AttributeDefinition', specializes: 'NumericalValue' },
    Real:           { kind: 'AttributeDefinition', specializes: 'NumericalValue' },
    Rational:       { kind: 'AttributeDefinition', specializes: 'Real' },
    Float:          { kind: 'AttributeDefinition', specializes: 'Real' },
    Integer:        { kind: 'AttributeDefinition', specializes: 'Rational' },
    Natural:        { kind: 'AttributeDefinition', specializes: 'Integer' },
    Boolean:        { kind: 'AttributeDefinition', specializes: 'ScalarValue' },
    String:         { kind: 'AttributeDefinition', specializes: 'ScalarValue' },
  },
  ISQBase: {
    // ISQ base quantities
    LengthValue:           { kind: 'AttributeDefinition', specializes: 'Real' },
    MassValue:             { kind: 'AttributeDefinition', specializes: 'Real' },
    TimeValue:             { kind: 'AttributeDefinition', specializes: 'Real' },
    ElectricCurrentValue:  { kind: 'AttributeDefinition', specializes: 'Real' },
    TemperatureValue:      { kind: 'AttributeDefinition', specializes: 'Real' },
    AmountOfSubstanceValue:{ kind: 'AttributeDefinition', specializes: 'Real' },
    LuminousIntensityValue:{ kind: 'AttributeDefinition', specializes: 'Real' },
  },
  ISQ: {
    // Common derived quantities (subset)
    AreaValue:             { kind: 'AttributeDefinition', specializes: 'Real' },
    VolumeValue:           { kind: 'AttributeDefinition', specializes: 'Real' },
    VelocityValue:         { kind: 'AttributeDefinition', specializes: 'Real' },
    AccelerationValue:     { kind: 'AttributeDefinition', specializes: 'Real' },
    ForceValue:            { kind: 'AttributeDefinition', specializes: 'Real' },
    EnergyValue:           { kind: 'AttributeDefinition', specializes: 'Real' },
    PowerValue:            { kind: 'AttributeDefinition', specializes: 'Real' },
    PressureValue:         { kind: 'AttributeDefinition', specializes: 'Real' },
    FrequencyValue:        { kind: 'AttributeDefinition', specializes: 'Real' },
    VoltageValue:          { kind: 'AttributeDefinition', specializes: 'Real' },
    CurrentValue:          { kind: 'AttributeDefinition', specializes: 'Real' },
    ResistanceValue:       { kind: 'AttributeDefinition', specializes: 'Real' },
    MomentumValue:         { kind: 'AttributeDefinition', specializes: 'Real' },
    TorqueValue:           { kind: 'AttributeDefinition', specializes: 'Real' },
    DensityValue:          { kind: 'AttributeDefinition', specializes: 'Real' },
  },
  SI: {
    // SI units (as attribute defs carrying a value + unit)
    mm: { kind: 'AttributeDefinition', specializes: 'LengthValue' },
    cm: { kind: 'AttributeDefinition', specializes: 'LengthValue' },
    m:  { kind: 'AttributeDefinition', specializes: 'LengthValue' },
    km: { kind: 'AttributeDefinition', specializes: 'LengthValue' },
    g:  { kind: 'AttributeDefinition', specializes: 'MassValue' },
    kg: { kind: 'AttributeDefinition', specializes: 'MassValue' },
    s:  { kind: 'AttributeDefinition', specializes: 'TimeValue' },
    ms: { kind: 'AttributeDefinition', specializes: 'TimeValue' },
    N:  { kind: 'AttributeDefinition', specializes: 'ForceValue' },
    Pa: { kind: 'AttributeDefinition', specializes: 'PressureValue' },
    J:  { kind: 'AttributeDefinition', specializes: 'EnergyValue' },
    W:  { kind: 'AttributeDefinition', specializes: 'PowerValue' },
    Hz: { kind: 'AttributeDefinition', specializes: 'FrequencyValue' },
    V:  { kind: 'AttributeDefinition', specializes: 'VoltageValue' },
    A:  { kind: 'AttributeDefinition', specializes: 'CurrentValue' },
    Ohm:{ kind: 'AttributeDefinition', specializes: 'ResistanceValue' },
    K:  { kind: 'AttributeDefinition', specializes: 'TemperatureValue' },
    degC: { kind: 'AttributeDefinition', specializes: 'TemperatureValue' },
  },
  Quantities: {
    // Shorthand — re-exports ISQ quantities under simpler names
    Length:      { kind: 'AttributeDefinition', specializes: 'Real' },
    Mass:        { kind: 'AttributeDefinition', specializes: 'Real' },
    Time:        { kind: 'AttributeDefinition', specializes: 'Real' },
    Temperature: { kind: 'AttributeDefinition', specializes: 'Real' },
    Force:       { kind: 'AttributeDefinition', specializes: 'Real' },
    Energy:      { kind: 'AttributeDefinition', specializes: 'Real' },
    Power:       { kind: 'AttributeDefinition', specializes: 'Real' },
    Velocity:    { kind: 'AttributeDefinition', specializes: 'Real' },
    Pressure:    { kind: 'AttributeDefinition', specializes: 'Real' },
    Voltage:     { kind: 'AttributeDefinition', specializes: 'Real' },
  },
  // Always-available primitives (implicitly imported like ScalarValues in real SysML v2)
  _builtin: {
    Boolean: { kind: 'AttributeDefinition' },
    Integer: { kind: 'AttributeDefinition' },
    Real:    { kind: 'AttributeDefinition' },
    String:  { kind: 'AttributeDefinition' },
    Natural: { kind: 'AttributeDefinition' },
    Float:   { kind: 'AttributeDefinition' },
  },
};

// ─── Definition patterns ────────────────────────────────────────────────────

const DEF_PATTERN = /\b(part|attribute|connection|port|action|state|item)\s+def\s+(\w+)(?:\s+specializes\s+(\w+))?\s*[{;]/g;
const USAGE_PATTERN = /\b(part|attribute|port|action|state|item)\s+(\w+)\s*(?:\[[\d..*]+\])?\s*:\s*(\w+)\s*[;{]/g;
// in/out parameters inside action definitions: e.g. `in item data : Data;`
const IN_OUT_PATTERN = /\b(in|out)\s+(item|action|part|attribute|port)\s+(\w+)\s*(?:\[[\d..*]+\])?\s*:\s*(\w+)\s*[;{]/g;
const ATTRIBUTE_VALUE_PATTERN = /\battribute\s+(\w+)\s*(?::\s*(\w+))?\s*=\s*([^;]+);/g;
const CONNECT_PATTERN = /\bconnect\s+(\w+(?:\.\w+)*)\s+to\s+(\w+(?:\.\w+)*)\s*;/g;
const FLOW_PATTERN = /\bflow\s+(?:(\w+)\s+)?from\s+(\w+(?:\.\w+)*)\s+to\s+(\w+(?:\.\w+)*)\s*;/g;
// import PackageName::*;  or  import PackageName::TypeName;
const IMPORT_PATTERN = /\bimport\s+(\w+)::(\*|\w+)\s*;/g;

// ─── Main parser ─────────────────────────────────────────────────────────────

export function parseSysMLText(uri: string, source: string): { model: SysMLModel; diagnostics: DiagramDiagnostic[] } {
  const clean = stripComments(source);

  const nodes: SysMLNode[] = [];
  const connections: SysMLConnection[] = [];
  const nodeIndex = new Map<string, SysMLNode>();
  const diagnostics: DiagramDiagnostic[] = [];
  const definedNames = new Set<string>();
  // Track which stdlib packages are imported (for diagnostics info)
  const importedPackages = new Set<string>();

  // ── 0. Always register built-in primitives ───────────────────────────────
  function registerPackage(pkgName: string): void {
    const pkg = STDLIB_PACKAGES[pkgName];
    if (!pkg || importedPackages.has(pkgName)) return;
    importedPackages.add(pkgName);
    for (const [typeName, entry] of Object.entries(pkg)) {
      if (!nodeIndex.has(typeName)) {
        nodeIndex.set(typeName, {
          id: makeId('stdlib', `${pkgName}_${typeName}`),
          kind: entry.kind,
          name: typeName,
          qualifiedName: `${pkgName}::${typeName}`,
          children: [], attributes: [], connections: [],
        });
      }
    }
  }

  registerPackage('_builtin');

  // ── 0b. Parse import statements ──────────────────────────────────────────
  IMPORT_PATTERN.lastIndex = 0;
  let importMatch: RegExpExecArray | null;
  while ((importMatch = IMPORT_PATTERN.exec(clean)) !== null) {
    const [, pkgName, member] = importMatch;
    const pkg = STDLIB_PACKAGES[pkgName];
    if (!pkg) {
      // Point at the package name token, not the whole import statement
      const pkgOffset = importMatch.index + importMatch[0].indexOf(pkgName);
      const { line, column } = lineCol(source, pkgOffset);
      const suggestions = suggestSimilar(pkgName, Object.keys(STDLIB_PACKAGES).filter(k => k !== '_builtin'));
      diagnostics.push({
        severity: 'info',
        message: `Package '${pkgName}' is not a recognized standard library package`,
        line, column, endLine: line, endColumn: column + pkgName.length,
        fixes: suggestions.map((s) => ({ title: `Change to '${s}'`, newText: s })),
      });
      continue;
    }
    if (member === '*') {
      registerPackage(pkgName);
    } else if (pkg[member]) {
      // import specific type
      if (!nodeIndex.has(member)) {
        const entry = pkg[member];
        nodeIndex.set(member, {
          id: makeId('stdlib', `${pkgName}_${member}`),
          kind: entry.kind,
          name: member,
          qualifiedName: `${pkgName}::${member}`,
          children: [], attributes: [], connections: [],
        });
      }
    } else {
      const memberOffset = importMatch.index + importMatch[0].indexOf(member);
      const { line, column } = lineCol(source, memberOffset);
      const suggestions = suggestSimilar(member, Object.keys(pkg));
      diagnostics.push({
        severity: 'warning',
        message: `'${member}' is not exported by package '${pkgName}'`,
        line, column, endLine: line, endColumn: column + member.length,
        fixes: suggestions.map((s) => ({ title: `Change to '${s}'`, newText: s })),
      });
    }
  }

  // ── 1. Extract all *Definitions ────────────────────────────────────────

  DEF_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = DEF_PATTERN.exec(clean)) !== null) {
    const [, keyword, name, specializes] = match;
    const kind = `${keyword.charAt(0).toUpperCase()}${keyword.slice(1)}Definition` as SysMLNodeKind;
    const id = makeId('def', name);

    const { line: defLine, column: defCol } = lineCol(source, match.index);
    const blockEndIdx = findBlockEnd(clean, match.index + match[0].length - 1);
    const { line: defEndLine, column: defEndCol } = lineCol(source, blockEndIdx);
    const node: SysMLNode = {
      id,
      kind,
      name,
      qualifiedName: name,
      children: [],
      attributes: [],
      connections: [],
      range: {
        start: { line: defLine - 1, character: defCol - 1 },
        end:   { line: defEndLine - 1, character: defEndCol - 1 },
      },
    };

    // Duplicate definition check — point at the name token
    if (definedNames.has(name)) {
      const nameOffset = match.index + match[0].indexOf(name);
      const { line, column } = lineCol(source, nameOffset);
      diagnostics.push({
        severity: 'warning',
        message: `Duplicate definition: '${name}' is already defined`,
        line, column, endLine: line, endColumn: column + name.length,
      });
    }
    definedNames.add(name);

    nodes.push(node);
    nodeIndex.set(name, node);

    // Specialization → inheritance connection
    if (specializes) {
      if (!nodeIndex.has(specializes)) {
        const specOffset = match.index + match[0].lastIndexOf(specializes);
        const { line, column } = lineCol(source, specOffset);
        const knownNames = [...nodeIndex.keys()].filter((k) => !k.startsWith('stdlib'));
        const suggestions = suggestSimilar(specializes, knownNames);
        diagnostics.push({
          severity: 'warning',
          message: `Unknown type: '${specializes}' is not defined`,
          line, column, endLine: line, endColumn: column + specializes.length,
          fixes: suggestions.map((s) => ({ title: `Change to '${s}'`, newText: s })),
        });
      }
      connections.push({
        id: makeId('specializes', `${name}_${specializes}`),
        sourceId: id,
        targetId: makeId('def', specializes),
        kind: 'dependency',
        name: '«specializes»',
      });
    }
  }

  // ── 2. Extract usages — create usage nodes + owner→usage + usage→typeDef edges ──

  USAGE_PATTERN.lastIndex = 0;

  while ((match = USAGE_PATTERN.exec(clean)) !== null) {
    const [, keyword, usageName, typeName] = match;

    // Skip if preceded by 'in' or 'out' — those are action parameters handled separately
    const pre = clean.slice(Math.max(0, match.index - 5), match.index);
    if (/\b(in|out)\s+$/.test(pre)) continue;

    // Find the nearest preceding definition block
    const usagePos = match.index;
    let ownerNode: SysMLNode | undefined;
    let ownerPos = -1;

    DEF_PATTERN.lastIndex = 0;
    let defMatch: RegExpExecArray | null;
    while ((defMatch = DEF_PATTERN.exec(clean)) !== null) {
      if (defMatch.index < usagePos && defMatch.index > ownerPos) {
        ownerPos = defMatch.index;
        ownerNode = nodeIndex.get(defMatch[2]);
      }
    }

    if (!ownerNode) continue;

    // Store in owner's attributes for compartment rendering
    ownerNode.attributes.push({ name: usageName, type: typeName, value: keyword });

    // Build the usage SysMLNode
    const usageKind = `${keyword.charAt(0).toUpperCase()}${keyword.slice(1)}Usage` as SysMLNodeKind;
    const usageId = makeId('usage', `${ownerNode.name}_${usageName}`);

    const { line: usageLine, column: usageCol } = lineCol(source, usagePos);
    const usageBlockEndIdx = findBlockEnd(clean, match.index + match[0].length - 1);
    const { line: usageEndLine, column: usageEndCol } = lineCol(source, usageBlockEndIdx);
    const usageNode: SysMLNode = {
      id: usageId,
      kind: usageKind,
      name: usageName,
      qualifiedName: typeName,   // reuse qualifiedName to carry the type name
      children: [],
      attributes: [],
      connections: [],
      range: {
        start: { line: usageLine - 1, character: usageCol - 1 },
        end:   { line: usageEndLine - 1, character: usageEndCol - 1 },
      },
    };

    nodes.push(usageNode);
    // Index by usageName so connect/flow can reference it
    nodeIndex.set(usageName, usageNode);

    // owner ──[composition]──► usage node
    connections.push({
      id: makeId('owns', `${ownerNode.name}_${usageName}`),
      sourceId: ownerNode.id,
      targetId: usageId,
      kind: 'composition',
      name: '',
    });

    // usage node ──[typereference]──► type definition (if known)
    const typeNode = nodeIndex.get(typeName);
    if (!typeNode) {
      // Point the diagnostic at the type name token specifically
      const typeOffset = match.index + match[0].lastIndexOf(typeName);
      const { line, column } = lineCol(source, typeOffset);
      const knownNames = [...nodeIndex.keys()].filter((k) => !k.startsWith('stdlib'));
      const suggestions = suggestSimilar(typeName, knownNames);
      diagnostics.push({
        severity: 'warning',
        message: `Unknown type: '${typeName}' is not defined`,
        line, column, endLine: line, endColumn: column + typeName.length,
        fixes: suggestions.map((s) => ({ title: `Change to '${s}'`, newText: s })),
      });
    }
    if (typeNode) {
      connections.push({
        id: makeId('typeref', `${usageName}_${typeName}`),
        sourceId: usageId,
        targetId: typeNode.id,
        kind: 'typereference',
        name: '',
      });
    }
  }

  // ── 2b. Extract attribute = value assignments ───────────────────────────

  ATTRIBUTE_VALUE_PATTERN.lastIndex = 0;

  while ((match = ATTRIBUTE_VALUE_PATTERN.exec(clean)) !== null) {
    const [, attrName, attrType, attrValue] = match;

    const attrPos = match.index;
    let ownerNode: SysMLNode | undefined;
    let ownerPos = -1;

    DEF_PATTERN.lastIndex = 0;
    let defMatch2: RegExpExecArray | null;
    while ((defMatch2 = DEF_PATTERN.exec(clean)) !== null) {
      if (defMatch2.index < attrPos && defMatch2.index > ownerPos) {
        ownerPos = defMatch2.index;
        ownerNode = nodeIndex.get(defMatch2[2]);
      }
    }

    if (!ownerNode) continue;

    // Avoid duplicating entries already captured by USAGE_PATTERN
    if (!ownerNode.attributes.some((a) => a.name === attrName)) {
      ownerNode.attributes.push({ name: attrName, type: attrType, value: attrValue.trim() });
    }
  }

  // ── 2c. Extract in/out parameters inside action definitions ─────────────

  IN_OUT_PATTERN.lastIndex = 0;

  while ((match = IN_OUT_PATTERN.exec(clean)) !== null) {
    const [, direction, keyword, paramName, typeName] = match;

    // Find the nearest preceding action definition
    const paramPos = match.index;
    let ownerNode: SysMLNode | undefined;
    let ownerPos = -1;

    DEF_PATTERN.lastIndex = 0;
    let defMatchP: RegExpExecArray | null;
    while ((defMatchP = DEF_PATTERN.exec(clean)) !== null) {
      if (defMatchP.index < paramPos && defMatchP.index > ownerPos) {
        ownerPos = defMatchP.index;
        ownerNode = nodeIndex.get(defMatchP[2]);
      }
    }

    if (!ownerNode || ownerNode.kind !== 'ActionDefinition') continue;

    // Add to owner's attribute compartment
    ownerNode.attributes.push({ name: paramName, type: typeName, value: direction });

    // Create a usage node for the parameter
    const paramKind = `${keyword.charAt(0).toUpperCase()}${keyword.slice(1)}Usage` as SysMLNodeKind;
    const paramId = makeId('param', `${ownerNode.name}_${direction}_${paramName}`);

    const { line: pLine, column: pCol } = lineCol(source, paramPos);
    const paramBlockEnd = findBlockEnd(clean, match.index + match[0].length - 1);
    const { line: pEndLine, column: pEndCol } = lineCol(source, paramBlockEnd);

    const paramNode: SysMLNode = {
      id: paramId,
      kind: paramKind,
      name: paramName,
      qualifiedName: typeName,
      direction: direction as 'in' | 'out',
      children: [],
      attributes: [],
      connections: [],
      range: {
        start: { line: pLine - 1, character: pCol - 1 },
        end:   { line: pEndLine - 1, character: pEndCol - 1 },
      },
    };

    nodes.push(paramNode);
    nodeIndex.set(`${ownerNode.name}.${paramName}`, paramNode);

    // owner ──[composition]──► param node
    connections.push({
      id: makeId('param-owns', `${ownerNode.name}_${direction}_${paramName}`),
      sourceId: ownerNode.id,
      targetId: paramId,
      kind: 'composition',
      name: '',
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

  // Add any stdlib/virtual nodes that are actually referenced by a connection
  // so they appear in the visualization as imported package types.
  const referencedIds = new Set<string>();
  for (const conn of uniqueConnections) {
    referencedIds.add(conn.sourceId);
    referencedIds.add(conn.targetId);
  }
  const userNodeIds = new Set(nodes.map((n) => n.id));
  for (const node of nodeIndex.values()) {
    if (node.id.startsWith('stdlib__') && referencedIds.has(node.id) && !userNodeIds.has(node.id)) {
      nodes.push(node);
    }
  }

  return { model: { uri, nodes, connections: uniqueConnections }, diagnostics };
}
