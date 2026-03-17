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

// ─── Package pattern ────────────────────────────────────────────────────────

const PACKAGE_PATTERN = /\bpackage\s+(\w+)\s*\{/g;

// ─── Definition patterns ────────────────────────────────────────────────────

// group[1]=abstract?, group[2]=keyword, group[3]=name, group[4]=specializes target
const DEF_PATTERN = /\b(abstract\s+)?(part|attribute|connection|port|action|state|item)\s+def\s+(\w+)(?:\s+(?:specializes\s+|:>(?!>)\s*)([\w:]+))?\s*[{;]/g;
// group[1]=keyword, group[2]=name, group[3]=multiplicity (optional), group[4]=type
const USAGE_PATTERN = /\b(part|attribute|port|action|state|item)\s+(\w+)\s*(\[[\d..*]+\])?\s*:\s*([\w:]+)\s*[;{]/g;
// Untyped usages: e.g. `action generateTorque;` or `action generateTorque { ... }`
const UNTYPED_USAGE_PATTERN = /\b(part|attribute|port|action|state|item)\s+(\w+)\s*[;{]/g;
// in/out parameters: e.g. `in item data : Data;` or `inout item data : Pkg::Type;`
const IN_OUT_PATTERN = /\b(in|out|inout)\s+(item|action|part|attribute|port)\s+(\w+)\s*(?:\[[\d..*]+\])?\s*:\s*([\w:]+)\s*[;{]/g;
const IN_OUT_UNTYPED_PATTERN = /\b(in|out|inout)\s+(item|action|part|attribute|port)\s+(\w+)\s*[;{]/g;
const ATTRIBUTE_VALUE_PATTERN = /\battribute\s+(\w+)\s*(?::\s*([\w:]+))?\s*=\s*([^;]+);/g;
// Subsetting: part x :> y; or part x subsets y;
const SUBSETTING_PATTERN = /\b(part|attribute|port|action|state|item)\s+(?!def\b)(\w+)\s*(\[[\d..*]+\])?\s*(?::>(?!>)\s*|\bsubsets\s+)([\w:]+)\s*[;{]/g;
// Redefinition: part x :>> y; or part x redefines y;
const REDEFINITION_PATTERN = /\b(part|attribute|port|action|state|item)\s+(?!def\b)(\w+)\s*(\[[\d..*]+\])?\s*(?::>>\s*|\bredefines\s+)([\w:]+)\s*[;{]/g;
// Reference subsetting: part x ::> y; or part x references y;
const REFERENCE_SUBSETTING_PATTERN = /\b(part|attribute|port|action|state|item)\s+(?!def\b)(\w+)\s*(\[[\d..*]+\])?\s*(?:::>\s*|\breferences\s+)([\w:]+)\s*[;{]/g;
const CONNECT_PATTERN = /\bconnect\s+(\w+(?:\.\w+)*)\s+to\s+(\w+(?:\.\w+)*)\s*;/g;
const FLOW_PATTERN = /\bflow\s+(?:(\w+)\s+)?from\s+(\w+(?:\.\w+)*)\s+to\s+(\w+(?:\.\w+)*)\s*;/g;
// Extended definition patterns (single-word keywords)
const EXT_DEF_PATTERN = /\b(abstract\s+)?(requirement|constraint|interface|enum|calc|allocation|concern|view|viewpoint|rendering|metadata|occurrence)\s+def\s+(\w+)(?:\s+(?:specializes\s+|:>(?!>)\s*)([\w:]+))?\s*[{;]/g;
// Multi-word definition patterns
const USE_CASE_DEF_PATTERN = /\b(abstract\s+)?use\s+case\s+def\s+(\w+)(?:\s+(?:specializes\s+|:>(?!>)\s*)([\w:]+))?\s*[{;]/g;
const ANALYSIS_CASE_DEF_PATTERN = /\b(abstract\s+)?analysis\s+case\s+def\s+(\w+)(?:\s+(?:specializes\s+|:>(?!>)\s*)([\w:]+))?\s*[{;]/g;
const VERIFICATION_CASE_DEF_PATTERN = /\b(abstract\s+)?verification\s+case\s+def\s+(\w+)(?:\s+(?:specializes\s+|:>(?!>)\s*)([\w:]+))?\s*[{;]/g;
// Behavioral
const PERFORM_PATTERN = /\bperform\s+(?:action\s+)?(\w+)(?:\s*:\s*([\w:]+))?\s*[;{]/g;
const EXHIBIT_PATTERN = /\bexhibit\s+state\s+(\w+)(?:\s*:\s*([\w:]+))?\s*[;{]/g;
// Successions: "first X then Y;" standalone
const SUCCESSION_PATTERN = /\bfirst\s+(\w+)\s+then\s+(\w+)\s*;/g;
// Inline "then Y;" or "then fork Y;" after declarations
// Optionally skips a keyword (fork/join/merge/decide/action/state) before the target name
const INLINE_THEN_PATTERN = /\bthen\s+(?:(?:fork|join|merge|decide|action|state)\s+)?(\w+)\s*;/g;
// Conditional succession: "if guard then action;"
const IF_THEN_PATTERN = /\bif\s+(\w+)\s+then\s+(\w+)\s*;/g;
// Control nodes (including start and terminate)
const CONTROL_NODE_PATTERN = /\b(fork|join|merge|decide)\s+(\w+)\s*;/g;
// Relationships
const SATISFY_PATTERN = /\bsatisfy\s+(?:requirement\s+)?(\w+)\s+by\s+(\w+)\s*;/g;
const VERIFY_PATTERN = /\bverify\s+(?:requirement\s+)?(\w+)\s+by\s+(\w+)\s*;/g;
const ALLOCATE_PATTERN = /\ballocate\s+(\w+(?:\.\w+)*)\s+to\s+(\w+(?:\.\w+)*)\s*;/g;
const BIND_PATTERN = /\bbind\s+(\w+(?:\.\w+)*)\s*=\s*(\w+(?:\.\w+)*)\s*;/g;
// import PackageName::*;  or  import PackageName::TypeName;
const IMPORT_PATTERN = /\bimport\s+(\w+)::(\*|\w+)\s*;/g;

// Extended keyword → SysMLNodeKind mapping
const EXT_KIND_MAP: Record<string, SysMLNodeKind> = {
  requirement: 'RequirementDefinition', constraint: 'ConstraintDefinition',
  interface: 'InterfaceDefinition', enum: 'EnumDefinition', calc: 'CalcDefinition',
  allocation: 'AllocationDefinition', concern: 'ConcernDefinition',
  view: 'ViewDefinition', viewpoint: 'ViewpointDefinition', rendering: 'RenderingDefinition',
  metadata: 'MetadataDefinition', occurrence: 'OccurrenceDefinition',
};

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

  /** Resolve a type name that may be qualified (e.g. `Pkg::SubPkg::Name` → look up `Name`). */
  function resolveType(name: string): SysMLNode | undefined {
    // Try exact match first
    const exact = nodeIndex.get(name);
    if (exact) return exact;
    // For qualified names like `Pkg::SubPkg::TypeName`, try the last segment
    if (name.includes('::')) {
      const simple = name.split('::').pop()!;
      return nodeIndex.get(simple);
    }
    return undefined;
  }

  /** Get the simple (last segment) name from a potentially qualified name. */
  function simpleName(name: string): string {
    return name.includes('::') ? name.split('::').pop()! : name;
  }

  // ── 0c. Parse package declarations ─────────────────────────────────────
  // Each package becomes a node; elements inside get a composition edge to their package.

  interface PackageRange { id: string; name: string; start: number; end: number; }
  const packageRanges: PackageRange[] = [];

  PACKAGE_PATTERN.lastIndex = 0;
  let pkgMatch: RegExpExecArray | null;
  while ((pkgMatch = PACKAGE_PATTERN.exec(clean)) !== null) {
    const [, pkgName] = pkgMatch;
    const pkgId = makeId('pkg', pkgName);
    const blockEnd = findBlockEnd(clean, pkgMatch.index + pkgMatch[0].length - 1);
    const { line: pkgLine, column: pkgCol } = lineCol(source, pkgMatch.index);
    const { line: pkgEndLine, column: pkgEndCol } = lineCol(source, blockEnd);

    const pkgNode: SysMLNode = {
      id: pkgId,
      kind: 'Package',
      name: pkgName,
      children: [], attributes: [], connections: [],
      range: {
        start: { line: pkgLine - 1, character: pkgCol - 1 },
        end:   { line: pkgEndLine - 1, character: pkgEndCol - 1 },
      },
    };
    nodes.push(pkgNode);
    nodeIndex.set(`__pkg__${pkgName}`, pkgNode);
    packageRanges.push({ id: pkgId, name: pkgName, start: pkgMatch.index, end: blockEnd });
  }

  // Sort packages by start offset descending so inner packages match first
  packageRanges.sort((a, b) => b.start - a.start);

  // Create composition edges from outer packages to their direct child packages
  for (const inner of packageRanges) {
    // Find the smallest enclosing package (first one in the sorted list that contains inner but isn't inner)
    const outer = packageRanges.find(p =>
      p.id !== inner.id && inner.start > p.start && inner.end <= p.end
    );
    if (outer) {
      connections.push({
        id: makeId('pkg-member', `${outer.name}_${inner.name}`),
        sourceId: outer.id,
        targetId: inner.id,
        kind: 'composition',
        name: '',
      });
    }
  }

  /** Return the innermost package containing the given source offset, or undefined. */
  function findOwnerPackage(offset: number): PackageRange | undefined {
    return packageRanges.find(p => offset > p.start && offset < p.end);
  }

  // ── 1. Extract all *Definitions ────────────────────────────────────────

  DEF_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = DEF_PATTERN.exec(clean)) !== null) {
    const [, abstractKw, keyword, name, specializes] = match;
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
      isAbstract: !!abstractKw,
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

    // Package membership → composition edge from package to this definition
    const ownerPkg = findOwnerPackage(match.index);
    if (ownerPkg) {
      connections.push({
        id: makeId('pkg-member', `${ownerPkg.name}_${name}`),
        sourceId: ownerPkg.id,
        targetId: id,
        kind: 'composition',
        name: '',
      });
    }

    // Specialization → inheritance connection
    if (specializes) {
      const specSimple = simpleName(specializes);
      if (!resolveType(specializes)) {
        const specOffset = match.index + match[0].lastIndexOf(specializes);
        const { line, column } = lineCol(source, specOffset);
        const knownNames = [...nodeIndex.keys()].filter((k) => !k.startsWith('stdlib'));
        const suggestions = suggestSimilar(specSimple, knownNames);
        diagnostics.push({
          severity: 'warning',
          message: `Unknown type: '${specializes}' is not defined`,
          line, column, endLine: line, endColumn: column + specializes.length,
          fixes: suggestions.map((s) => ({ title: `Change to '${s}'`, newText: s })),
        });
      }
      connections.push({
        id: makeId('specializes', `${name}_${specSimple}`),
        sourceId: id,
        targetId: makeId('def', specSimple),
        kind: 'dependency',
        name: '«specializes»',
      });
    }
  }

  // Pre-built index of all definition positions for fast owner lookup
  interface DefPosition { name: string; start: number; end: number; }
  const defPositions: DefPosition[] = [];
  DEF_PATTERN.lastIndex = 0;
  while ((match = DEF_PATTERN.exec(clean)) !== null) {
    const end = findBlockEnd(clean, match.index + match[0].length - 1);
    defPositions.push({ name: match[3], start: match.index, end });
  }
  // Sort by start descending so inner defs match first
  defPositions.sort((a, b) => b.start - a.start);

  /** Find the innermost definition enclosing the given offset. */
  function findOwnerDef(offset: number): SysMLNode | undefined {
    const dp = defPositions.find(d => offset > d.start && offset < d.end);
    return dp ? nodeIndex.get(dp.name) : undefined;
  }

  // ── 1b. Nested definitions: add composition edges from enclosing def to inner def ──
  // This runs after defPositions + findOwnerDef are available.
  for (const dp of defPositions) {
    const innerNode = nodeIndex.get(dp.name);
    if (!innerNode) continue;
    const ownerDef = findOwnerDef(dp.start);
    if (ownerDef && ownerDef.name !== dp.name) {
      // Replace the package→def edge with def→def edge if def is nested inside another def
      const pkgEdgeIdx = connections.findIndex(
        c => c.targetId === innerNode.id && c.kind === 'composition' &&
             c.sourceId.startsWith('pkg__'),
      );
      if (pkgEdgeIdx >= 0) connections.splice(pkgEdgeIdx, 1);
      connections.push({
        id: makeId('def-member', `${ownerDef.name}_${dp.name}`),
        sourceId: ownerDef.id,
        targetId: innerNode.id,
        kind: 'composition',
        name: '',
      });
    }
  }

  // Pre-built index of usage positions for fast enclosing-usage lookup
  // Includes both typed and untyped usages so nested items can find their parent usage
  interface UsagePosition { name: string; start: number; end: number; }
  const usagePositions: UsagePosition[] = [];
  {
    // Typed usages
    const usageScanRe = new RegExp(USAGE_PATTERN.source, 'g');
    let um: RegExpExecArray | null;
    while ((um = usageScanRe.exec(clean)) !== null) {
      const end = findBlockEnd(clean, um.index + um[0].length - 1);
      usagePositions.push({ name: um[2], start: um.index, end });
    }
    // Untyped usages (e.g. `item SourceData { ... }`)
    const untypedScanRe = new RegExp(UNTYPED_USAGE_PATTERN.source, 'g');
    while ((um = untypedScanRe.exec(clean)) !== null) {
      // Skip if preceded by 'in', 'out', 'inout', or 'def'
      const pre = clean.slice(Math.max(0, um.index - 7), um.index);
      if (/\b(inout|in|out|def)\s+$/.test(pre)) continue;
      // Skip duplicates already captured by typed pattern
      const name = um[2];
      const start = um.index;
      if (usagePositions.some(up => up.start === start)) continue;
      const end = findBlockEnd(clean, um.index + um[0].length - 1);
      usagePositions.push({ name, start, end });
    }
    usagePositions.sort((a, b) => b.start - a.start);
  }

  /** Find the innermost usage enclosing the given offset (excluding self). */
  function findOwnerUsage(offset: number, selfIndex: number): { node: SysMLNode; start: number } | undefined {
    for (const up of usagePositions) {
      if (up.start === selfIndex) continue;
      if (offset > up.start && offset < up.end) {
        const parentUsage = nodeIndex.get(up.name) ??
          nodeIndex.get(`${findOwnerDef(up.start)?.name ?? ''}.${up.name}`);
        if (parentUsage) return { node: parentUsage, start: up.start };
      }
    }
    return undefined;
  }

  // ── 2. Extract usages — create usage nodes + owner→usage + usage→typeDef edges ──

  USAGE_PATTERN.lastIndex = 0;

  while ((match = USAGE_PATTERN.exec(clean)) !== null) {
    const [, keyword, usageName, multiplicity, typeName] = match;

    // Skip if preceded by 'in', 'out', or 'inout' — those are action parameters handled separately
    const pre = clean.slice(Math.max(0, match.index - 7), match.index);
    if (/\b(inout|in|out)\s+$/.test(pre)) continue;

    // Find the innermost enclosing definition or usage block that owns this usage
    const usagePos = match.index;
    let ownerNode: SysMLNode | undefined = findOwnerDef(usagePos);
    let ownerPos = ownerNode ? defPositions.find(d => d.name === ownerNode!.name)!.start : -1;

    // Check enclosing usages (usage-inside-usage composition)
    const enclosingUsage = findOwnerUsage(usagePos, match.index);
    if (enclosingUsage && enclosingUsage.start > ownerPos) {
      ownerPos = enclosingUsage.start;
      ownerNode = enclosingUsage.node;
    }

    // Determine the owner name for ID generation: definition, usage, package, or top-level
    const usagePkg = findOwnerPackage(usagePos);
    const ownerName = ownerNode ? ownerNode.name : usagePkg ? usagePkg.name : '_top';

    const typeSimple = simpleName(typeName);

    // Store in owner's attributes for compartment rendering (only for def owners)
    const displayName = multiplicity ? `${usageName}${multiplicity}` : usageName;
    if (ownerNode && ownerNode.kind.endsWith('Definition')) {
      ownerNode.attributes.push({ name: displayName, type: typeSimple, value: keyword });
    }

    // Build the usage SysMLNode
    const usageKind = `${keyword.charAt(0).toUpperCase()}${keyword.slice(1)}Usage` as SysMLNodeKind;
    const usageId = makeId('usage', `${ownerName}_${usageName}`);

    const { line: usageLine, column: usageCol } = lineCol(source, usagePos);
    const usageBlockEndIdx = findBlockEnd(clean, match.index + match[0].length - 1);
    const { line: usageEndLine, column: usageEndCol } = lineCol(source, usageBlockEndIdx);
    const usageNode: SysMLNode = {
      id: usageId,
      kind: usageKind,
      name: usageName,
      qualifiedName: typeSimple,   // reuse qualifiedName to carry the type name
      children: [],
      attributes: [],
      connections: [],
      range: {
        start: { line: usageLine - 1, character: usageCol - 1 },
        end:   { line: usageEndLine - 1, character: usageEndCol - 1 },
      },
    };

    nodes.push(usageNode);
    // Index by qualified name to avoid collisions across definitions;
    // also register unqualified name only if no prior usage claimed it
    nodeIndex.set(`${ownerName}.${usageName}`, usageNode);
    if (!nodeIndex.has(usageName)) nodeIndex.set(usageName, usageNode);

    // owner ──[composition]──► usage node (only if there's an actual owner)
    if (ownerNode || usagePkg) {
      const ownerId = ownerNode ? ownerNode.id : usagePkg!.id;
      connections.push({
        id: makeId('owns', `${ownerName}_${usageName}`),
        sourceId: ownerId,
        targetId: usageId,
        kind: 'composition',
        name: '',
      });
    }

    // usage node ──[typereference]──► type definition (if known)
    const typeNode = resolveType(typeName);
    if (!typeNode) {
      // Point the diagnostic at the type name token specifically
      const typeOffset = match.index + match[0].lastIndexOf(typeName);
      const { line, column } = lineCol(source, typeOffset);
      const knownNames = [...nodeIndex.keys()].filter((k) => !k.startsWith('stdlib'));
      const suggestions = suggestSimilar(simpleName(typeName), knownNames);
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

  // ── 2a. Extract untyped usages (e.g. `action foo;` inside a def) ─────────

  UNTYPED_USAGE_PATTERN.lastIndex = 0;

  while ((match = UNTYPED_USAGE_PATTERN.exec(clean)) !== null) {
    const [fullMatch, keyword, usageName] = match;

    // Skip if preceded by 'in', 'out', 'inout', or 'def' — those are handled by other patterns
    const pre = clean.slice(Math.max(0, match.index - 7), match.index);
    if (/\b(inout|in|out)\s+$/.test(pre)) continue;
    if (/\bdef\s+$/.test(pre)) continue;   // skip `part def Foo`

    // Skip if this name was already captured as a typed usage or definition
    const usagePos = match.index;

    // Check if this exact position was already matched by USAGE_PATTERN (typed usage with `:`)
    // by checking if there's a `:` after the name before the `;` or `{`
    const afterName = clean.slice(match.index + fullMatch.length - 1, match.index + fullMatch.length + 20);
    // Already handled by typed USAGE_PATTERN if original source has `: Type` form
    const origSlice = clean.slice(match.index, match.index + fullMatch.length + 30);
    if (/\b\w+\s*(?:\[[\d..*]+\])?\s*:\s*\w+/.test(origSlice.slice(keyword.length + 1))) continue;

    // Find enclosing definition or usage block
    let ownerNode: SysMLNode | undefined = findOwnerDef(usagePos);
    let ownerPos = ownerNode ? defPositions.find(d => d.name === ownerNode!.name)!.start : -1;

    // Also check enclosing usages
    const enclosingUsage2 = findOwnerUsage(usagePos, match.index);
    if (enclosingUsage2 && enclosingUsage2.start > ownerPos) {
      ownerPos = enclosingUsage2.start;
      ownerNode = enclosingUsage2.node;
    }

    const usagePkg = findOwnerPackage(usagePos);
    const ownerName = ownerNode ? ownerNode.name : usagePkg ? usagePkg.name : undefined;
    if (!ownerName) continue;

    // Skip if already registered (avoid duplicates with typed usages)
    if (nodeIndex.has(`${ownerName}.${usageName}`)) continue;

    if (ownerNode && ownerNode.kind.endsWith('Definition')) {
      ownerNode.attributes.push({ name: usageName, type: undefined, value: keyword });
    }

    const usageKind = `${keyword.charAt(0).toUpperCase()}${keyword.slice(1)}Usage` as SysMLNodeKind;
    const usageId = makeId('usage', `${ownerName}_${usageName}`);

    const { line: usageLine, column: usageCol } = lineCol(source, usagePos);
    const usageBlockEndIdx = findBlockEnd(clean, match.index + match[0].length - 1);
    const { line: usageEndLine, column: usageEndCol } = lineCol(source, usageBlockEndIdx);
    const usageNode: SysMLNode = {
      id: usageId,
      kind: usageKind,
      name: usageName,
      children: [], attributes: [], connections: [],
      range: {
        start: { line: usageLine - 1, character: usageCol - 1 },
        end:   { line: usageEndLine - 1, character: usageEndCol - 1 },
      },
    };

    nodes.push(usageNode);
    nodeIndex.set(`${ownerName}.${usageName}`, usageNode);
    if (!nodeIndex.has(usageName)) nodeIndex.set(usageName, usageNode);

    if (ownerNode || usagePkg) {
      const ownerId = ownerNode ? ownerNode.id : usagePkg!.id;
      connections.push({
        id: makeId('owns', `${ownerName}_${usageName}`),
        sourceId: ownerId,
        targetId: usageId,
        kind: 'composition',
        name: '',
      });
    }
  }

  // ── 2b. Extract attribute = value assignments ───────────────────────────

  ATTRIBUTE_VALUE_PATTERN.lastIndex = 0;

  while ((match = ATTRIBUTE_VALUE_PATTERN.exec(clean)) !== null) {
    const [, attrName, attrType, attrValue] = match;

    const attrPos = match.index;
    const ownerNode = findOwnerDef(attrPos);
    if (!ownerNode) continue;

    // Avoid duplicating entries already captured by USAGE_PATTERN
    if (!ownerNode.attributes.some((a) => a.name === attrName)) {
      ownerNode.attributes.push({ name: attrName, type: attrType, value: attrValue.trim() });
    }
  }

  // ── 2c. Extract in/out/inout parameters inside any definition or usage ──

  IN_OUT_PATTERN.lastIndex = 0;

  while ((match = IN_OUT_PATTERN.exec(clean)) !== null) {
    const [, direction, keyword, paramName, typeName] = match;

    const paramPos = match.index;
    // Find enclosing owner: definition or usage
    let ownerNode: SysMLNode | undefined = findOwnerDef(paramPos);
    let ownerPos = ownerNode ? defPositions.find(d => d.name === ownerNode!.name)?.start ?? -1 : -1;
    const enclosingUsage = findOwnerUsage(paramPos, match.index);
    if (enclosingUsage && enclosingUsage.start > ownerPos) {
      ownerNode = enclosingUsage.node;
    }
    if (!ownerNode) continue;

    const typeSimple = simpleName(typeName);

    // Add to owner's attribute compartment (for definitions)
    if (ownerNode.kind.endsWith('Definition')) {
      ownerNode.attributes.push({ name: paramName, type: typeSimple, value: direction });
    }

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
      qualifiedName: typeSimple,
      direction: direction as 'in' | 'out' | 'inout',
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

  // ── 2d. Extract untyped in/out parameters (e.g. `in item fuelCmd;`) ─────

  IN_OUT_UNTYPED_PATTERN.lastIndex = 0;

  while ((match = IN_OUT_UNTYPED_PATTERN.exec(clean)) !== null) {
    const [, direction, keyword, paramName] = match;

    // Skip if already captured by typed IN_OUT_PATTERN (check if `: Type` follows)
    const afterSlice = clean.slice(match.index, match.index + match[0].length + 30);
    if (/:\s*\w+/.test(afterSlice.slice(afterSlice.indexOf(paramName) + paramName.length))) continue;

    const paramPos = match.index;
    // Find enclosing owner: definition or usage
    let ownerNode: SysMLNode | undefined = findOwnerDef(paramPos);
    let ownerPos = ownerNode ? defPositions.find(d => d.name === ownerNode!.name)?.start ?? -1 : -1;
    const enclosingUsage2 = findOwnerUsage(paramPos, match.index);
    if (enclosingUsage2 && enclosingUsage2.start > ownerPos) {
      ownerNode = enclosingUsage2.node;
    }
    if (!ownerNode) continue;

    // Skip if already registered
    if (nodeIndex.has(`${ownerNode.name}.${paramName}`)) continue;

    if (ownerNode.kind.endsWith('Definition')) {
      ownerNode.attributes.push({ name: paramName, type: undefined, value: direction });
    }

    const paramKind = `${keyword.charAt(0).toUpperCase()}${keyword.slice(1)}Usage` as SysMLNodeKind;
    const paramId = makeId('param', `${ownerNode.name}_${direction}_${paramName}`);

    const { line: pLine, column: pCol } = lineCol(source, paramPos);
    const paramBlockEnd = findBlockEnd(clean, match.index + match[0].length - 1);
    const { line: pEndLine, column: pEndCol } = lineCol(source, paramBlockEnd);

    const paramNode: SysMLNode = {
      id: paramId,
      kind: paramKind,
      name: paramName,
      direction: direction as 'in' | 'out' | 'inout',
      children: [], attributes: [], connections: [],
      range: {
        start: { line: pLine - 1, character: pCol - 1 },
        end:   { line: pEndLine - 1, character: pEndCol - 1 },
      },
    };

    nodes.push(paramNode);
    nodeIndex.set(`${ownerNode.name}.${paramName}`, paramNode);

    connections.push({
      id: makeId('param-owns', `${ownerNode.name}_${direction}_${paramName}`),
      sourceId: ownerNode.id,
      targetId: paramId,
      kind: 'composition',
      name: '',
    });
  }

  // ── 2e. Extract subsetting usages (:> on usages) ──────────────────────────

  SUBSETTING_PATTERN.lastIndex = 0;
  while ((match = SUBSETTING_PATTERN.exec(clean)) !== null) {
    const [, keyword, usageName, mult, targetName] = match;
    const pre = clean.slice(Math.max(0, match.index - 7), match.index);
    if (/\b(inout|in|out)\s+$/.test(pre)) continue;
    const usagePos = match.index;
    let ownerNode: SysMLNode | undefined = findOwnerDef(usagePos);
    let ownerPos = ownerNode ? defPositions.find(d => d.name === ownerNode!.name)?.start ?? -1 : -1;
    const enclosingUsage = findOwnerUsage(usagePos, match.index);
    if (enclosingUsage && enclosingUsage.start > ownerPos) { ownerNode = enclosingUsage.node; }
    const usagePkg = findOwnerPackage(usagePos);
    const ownerName = ownerNode ? ownerNode.name : usagePkg ? usagePkg.name : '_top';
    if (nodeIndex.has(`${ownerName}.${usageName}`)) continue;
    const targetSimple = simpleName(targetName);
    const displayName = mult ? `${usageName}${mult}` : usageName;
    if (ownerNode && ownerNode.kind.endsWith('Definition')) {
      ownerNode.attributes.push({ name: displayName, type: targetSimple, value: `${keyword} :>` });
    }
    const usageKind = `${keyword.charAt(0).toUpperCase()}${keyword.slice(1)}Usage` as SysMLNodeKind;
    const usageId = makeId('usage', `${ownerName}_${usageName}`);
    const { line: uL, column: uC } = lineCol(source, usagePos);
    const uEnd = findBlockEnd(clean, match.index + match[0].length - 1);
    const { line: uEL, column: uEC } = lineCol(source, uEnd);
    const usageNode: SysMLNode = {
      id: usageId, kind: usageKind, name: usageName, qualifiedName: targetSimple,
      children: [], attributes: [], connections: [],
      range: { start: { line: uL - 1, character: uC - 1 }, end: { line: uEL - 1, character: uEC - 1 } },
    };
    nodes.push(usageNode);
    nodeIndex.set(`${ownerName}.${usageName}`, usageNode);
    if (!nodeIndex.has(usageName)) nodeIndex.set(usageName, usageNode);
    if (ownerNode || usagePkg) {
      connections.push({ id: makeId('owns', `${ownerName}_${usageName}`), sourceId: (ownerNode ?? usagePkg!).id, targetId: usageId, kind: 'composition', name: '' });
    }
    const targetNode = resolveType(targetName);
    if (targetNode) {
      connections.push({ id: makeId('subsets', `${usageName}_${targetSimple}`), sourceId: usageId, targetId: targetNode.id, kind: 'subsetting', name: '«subsets»' });
    }
  }

  // ── 2f. Extract redefinition usages (:>> on usages) ────────────────────────

  REDEFINITION_PATTERN.lastIndex = 0;
  while ((match = REDEFINITION_PATTERN.exec(clean)) !== null) {
    const [, keyword, usageName, mult, targetName] = match;
    const pre = clean.slice(Math.max(0, match.index - 7), match.index);
    if (/\b(inout|in|out)\s+$/.test(pre)) continue;
    const usagePos = match.index;
    let ownerNode: SysMLNode | undefined = findOwnerDef(usagePos);
    let ownerPos = ownerNode ? defPositions.find(d => d.name === ownerNode!.name)?.start ?? -1 : -1;
    const enclosingUsage = findOwnerUsage(usagePos, match.index);
    if (enclosingUsage && enclosingUsage.start > ownerPos) { ownerNode = enclosingUsage.node; }
    const usagePkg = findOwnerPackage(usagePos);
    const ownerName = ownerNode ? ownerNode.name : usagePkg ? usagePkg.name : '_top';
    if (nodeIndex.has(`${ownerName}.${usageName}`)) continue;
    const targetSimple = simpleName(targetName);
    const displayName = mult ? `${usageName}${mult}` : usageName;
    if (ownerNode && ownerNode.kind.endsWith('Definition')) {
      ownerNode.attributes.push({ name: displayName, type: targetSimple, value: `${keyword} :>>` });
    }
    const usageKind = `${keyword.charAt(0).toUpperCase()}${keyword.slice(1)}Usage` as SysMLNodeKind;
    const usageId = makeId('usage', `${ownerName}_${usageName}`);
    const { line: uL, column: uC } = lineCol(source, usagePos);
    const uEnd = findBlockEnd(clean, match.index + match[0].length - 1);
    const { line: uEL, column: uEC } = lineCol(source, uEnd);
    const usageNode: SysMLNode = {
      id: usageId, kind: usageKind, name: usageName, qualifiedName: targetSimple,
      children: [], attributes: [], connections: [],
      range: { start: { line: uL - 1, character: uC - 1 }, end: { line: uEL - 1, character: uEC - 1 } },
    };
    nodes.push(usageNode);
    nodeIndex.set(`${ownerName}.${usageName}`, usageNode);
    if (!nodeIndex.has(usageName)) nodeIndex.set(usageName, usageNode);
    if (ownerNode || usagePkg) {
      connections.push({ id: makeId('owns', `${ownerName}_${usageName}`), sourceId: (ownerNode ?? usagePkg!).id, targetId: usageId, kind: 'composition', name: '' });
    }
    const targetNode = resolveType(targetName);
    if (targetNode) {
      connections.push({ id: makeId('redefines', `${usageName}_${targetSimple}`), sourceId: usageId, targetId: targetNode.id, kind: 'redefinition', name: '«redefines»' });
    }
  }

  // ── 2g. Extract reference subsetting (::> on usages) ──────────────────────

  REFERENCE_SUBSETTING_PATTERN.lastIndex = 0;
  while ((match = REFERENCE_SUBSETTING_PATTERN.exec(clean)) !== null) {
    const [, keyword, usageName, mult, targetName] = match;
    const pre = clean.slice(Math.max(0, match.index - 7), match.index);
    if (/\b(inout|in|out)\s+$/.test(pre)) continue;
    const usagePos = match.index;
    let ownerNode: SysMLNode | undefined = findOwnerDef(usagePos);
    let ownerPos = ownerNode ? defPositions.find(d => d.name === ownerNode!.name)?.start ?? -1 : -1;
    const enclosingUsage = findOwnerUsage(usagePos, match.index);
    if (enclosingUsage && enclosingUsage.start > ownerPos) { ownerNode = enclosingUsage.node; }
    const usagePkg = findOwnerPackage(usagePos);
    const ownerName = ownerNode ? ownerNode.name : usagePkg ? usagePkg.name : '_top';
    if (nodeIndex.has(`${ownerName}.${usageName}`)) continue;
    const targetSimple = simpleName(targetName);
    const displayName = mult ? `${usageName}${mult}` : usageName;
    if (ownerNode && ownerNode.kind.endsWith('Definition')) {
      ownerNode.attributes.push({ name: displayName, type: targetSimple, value: `${keyword} ::>` });
    }
    const usageKind = `${keyword.charAt(0).toUpperCase()}${keyword.slice(1)}Usage` as SysMLNodeKind;
    const usageId = makeId('usage', `${ownerName}_${usageName}`);
    const { line: uL, column: uC } = lineCol(source, usagePos);
    const uEnd = findBlockEnd(clean, match.index + match[0].length - 1);
    const { line: uEL, column: uEC } = lineCol(source, uEnd);
    const usageNode: SysMLNode = {
      id: usageId, kind: usageKind, name: usageName, qualifiedName: targetSimple,
      children: [], attributes: [], connections: [],
      range: { start: { line: uL - 1, character: uC - 1 }, end: { line: uEL - 1, character: uEC - 1 } },
    };
    nodes.push(usageNode);
    nodeIndex.set(`${ownerName}.${usageName}`, usageNode);
    if (!nodeIndex.has(usageName)) nodeIndex.set(usageName, usageNode);
    if (ownerNode || usagePkg) {
      connections.push({ id: makeId('owns', `${ownerName}_${usageName}`), sourceId: (ownerNode ?? usagePkg!).id, targetId: usageId, kind: 'composition', name: '' });
    }
    const targetNode = resolveType(targetName);
    if (targetNode) {
      connections.push({ id: makeId('references', `${usageName}_${targetSimple}`), sourceId: usageId, targetId: targetNode.id, kind: 'referencesubsetting', name: '«references»' });
    }
  }

  // ── 2h. Extended definitions (requirement, constraint, enum, etc.) ─────────

  EXT_DEF_PATTERN.lastIndex = 0;
  while ((match = EXT_DEF_PATTERN.exec(clean)) !== null) {
    const [, abstractKw, keyword, name, specializes] = match;
    const kind = EXT_KIND_MAP[keyword];
    if (!kind) continue;
    const id = makeId('def', name);
    if (definedNames.has(name)) continue;
    definedNames.add(name);
    const { line: dL, column: dC } = lineCol(source, match.index);
    const blockEnd = findBlockEnd(clean, match.index + match[0].length - 1);
    const { line: dEL, column: dEC } = lineCol(source, blockEnd);
    const node: SysMLNode = {
      id, kind, name, qualifiedName: name, isAbstract: !!abstractKw,
      children: [], attributes: [], connections: [],
      range: { start: { line: dL - 1, character: dC - 1 }, end: { line: dEL - 1, character: dEC - 1 } },
    };
    nodes.push(node);
    nodeIndex.set(name, node);
    defPositions.push({ name, start: match.index, end: blockEnd });
    const ownerPkg = findOwnerPackage(match.index);
    if (ownerPkg) {
      connections.push({ id: makeId('pkg-member', `${ownerPkg.name}_${name}`), sourceId: ownerPkg.id, targetId: id, kind: 'composition', name: '' });
    }
    if (specializes) {
      const specSimple = simpleName(specializes);
      connections.push({ id: makeId('specializes', `${name}_${specSimple}`), sourceId: id, targetId: makeId('def', specSimple), kind: 'dependency', name: '«specializes»' });
    }
  }

  // Multi-word definitions: use case, analysis case, verification case
  const multiWordDefs: [RegExp, SysMLNodeKind][] = [
    [USE_CASE_DEF_PATTERN, 'UseCaseDefinition'],
    [ANALYSIS_CASE_DEF_PATTERN, 'AnalysisCaseDefinition'],
    [VERIFICATION_CASE_DEF_PATTERN, 'VerificationCaseDefinition'],
  ];
  for (const [pattern, kind] of multiWordDefs) {
    pattern.lastIndex = 0;
    while ((match = pattern.exec(clean)) !== null) {
      const [, abstractKw, name, specializes] = match;
      const id = makeId('def', name);
      if (definedNames.has(name)) continue;
      definedNames.add(name);
      const { line: dL, column: dC } = lineCol(source, match.index);
      const blockEnd = findBlockEnd(clean, match.index + match[0].length - 1);
      const { line: dEL, column: dEC } = lineCol(source, blockEnd);
      const node: SysMLNode = {
        id, kind, name, qualifiedName: name, isAbstract: !!abstractKw,
        children: [], attributes: [], connections: [],
        range: { start: { line: dL - 1, character: dC - 1 }, end: { line: dEL - 1, character: dEC - 1 } },
      };
      nodes.push(node);
      nodeIndex.set(name, node);
      defPositions.push({ name, start: match.index, end: blockEnd });
      const ownerPkg = findOwnerPackage(match.index);
      if (ownerPkg) {
        connections.push({ id: makeId('pkg-member', `${ownerPkg.name}_${name}`), sourceId: ownerPkg.id, targetId: id, kind: 'composition', name: '' });
      }
      if (specializes) {
        const specSimple = simpleName(specializes);
        connections.push({ id: makeId('specializes', `${name}_${specSimple}`), sourceId: id, targetId: makeId('def', specSimple), kind: 'dependency', name: '«specializes»' });
      }
    }
  }
  defPositions.sort((a, b) => b.start - a.start);

  // ── 2i. Behavioral: perform, exhibit, successions, control nodes ───────────

  PERFORM_PATTERN.lastIndex = 0;
  while ((match = PERFORM_PATTERN.exec(clean)) !== null) {
    const [, actionName, typeName] = match;
    const ownerNode = findOwnerDef(match.index);
    if (ownerNode && ownerNode.kind.endsWith('Definition')) {
      ownerNode.attributes.push({ name: actionName, type: typeName ? simpleName(typeName) : undefined, value: 'perform' });
    }
  }

  EXHIBIT_PATTERN.lastIndex = 0;
  while ((match = EXHIBIT_PATTERN.exec(clean)) !== null) {
    const [, stateName, typeName] = match;
    const ownerNode = findOwnerDef(match.index);
    if (ownerNode && ownerNode.kind.endsWith('Definition')) {
      ownerNode.attributes.push({ name: stateName, type: typeName ? simpleName(typeName) : undefined, value: 'exhibit' });
    }
  }

  // ── 2j. Control nodes: fork, join, merge, decide ────────────────────────────

  CONTROL_NODE_PATTERN.lastIndex = 0;
  while ((match = CONTROL_NODE_PATTERN.exec(clean)) !== null) {
    const [, nodeType, nodeName] = match;
    const kindMap: Record<string, SysMLNodeKind> = {
      fork: 'ForkNode', join: 'JoinNode', merge: 'MergeNode', decide: 'DecideNode',
    };
    const kind = kindMap[nodeType];
    if (!kind) continue;
    const id = makeId('control', nodeName);
    const usagePos = match.index;
    const { line: cL, column: cC } = lineCol(source, usagePos);
    const cEnd = findBlockEnd(clean, match.index + match[0].length - 1);
    const { line: cEL, column: cEC } = lineCol(source, cEnd);
    const controlNode: SysMLNode = {
      id, kind, name: nodeName,
      children: [], attributes: [], connections: [],
      range: { start: { line: cL - 1, character: cC - 1 }, end: { line: cEL - 1, character: cEC - 1 } },
    };
    nodes.push(controlNode);
    nodeIndex.set(nodeName, controlNode);
    // Add composition to enclosing owner
    const ownerNode = findOwnerDef(usagePos);
    const usagePkg = findOwnerPackage(usagePos);
    if (ownerNode) {
      connections.push({ id: makeId('owns', `${ownerNode.name}_${nodeName}`), sourceId: ownerNode.id, targetId: id, kind: 'composition', name: '' });
    } else if (usagePkg) {
      connections.push({ id: makeId('owns', `${usagePkg.name}_${nodeName}`), sourceId: usagePkg.id, targetId: id, kind: 'composition', name: '' });
    }
  }

  // ── 2k. Create start/terminate nodes when referenced ────────────────────────

  // Helper: ensure a special node exists (start, done, terminate)
  function ensureSpecialNode(name: string, ownerOffset: number): void {
    if (nodeIndex.has(name)) return;
    const kindMap: Record<string, SysMLNodeKind> = {
      start: 'ForkNode', done: 'JoinNode', terminate: 'DecideNode',
    };
    const kind = kindMap[name] ?? 'ForkNode';
    const id = makeId('control', name);
    const { line: sL, column: sC } = lineCol(source, ownerOffset);
    const specialNode: SysMLNode = {
      id, kind, name,
      children: [], attributes: [], connections: [],
      range: { start: { line: sL - 1, character: sC - 1 }, end: { line: sL - 1, character: sC - 1 } },
    };
    nodes.push(specialNode);
    nodeIndex.set(name, specialNode);
    const ownerNode = findOwnerDef(ownerOffset);
    const usagePkg = findOwnerPackage(ownerOffset);
    if (ownerNode) {
      connections.push({ id: makeId('owns', `${ownerNode.name}_${name}`), sourceId: ownerNode.id, targetId: id, kind: 'composition', name: '' });
    } else if (usagePkg) {
      connections.push({ id: makeId('owns', `${usagePkg.name}_${name}`), sourceId: usagePkg.id, targetId: id, kind: 'composition', name: '' });
    }
  }

  // ── 2l. Successions ───────────────────────────────────────────────────────

  // "first X then Y;" — standalone succession
  SUCCESSION_PATTERN.lastIndex = 0;
  while ((match = SUCCESSION_PATTERN.exec(clean)) !== null) {
    const [, fromName, toName] = match;
    if (fromName === 'start' || fromName === 'done' || fromName === 'terminate') ensureSpecialNode(fromName, match.index);
    if (toName === 'start' || toName === 'done' || toName === 'terminate') ensureSpecialNode(toName, match.index);
    const fromNode = nodeIndex.get(fromName);
    const toNode = nodeIndex.get(toName);
    if (fromNode && toNode) {
      connections.push({
        id: makeId('succession', `${fromName}_${toName}_${match.index}`),
        sourceId: fromNode.id, targetId: toNode.id,
        kind: 'flow', name: '',
      });
    }
  }

  // "first X;" alone (no then) — just ensure X exists as a node for subsequent then targets
  {
    const firstAloneRe = /\bfirst\s+(\w+)\s*;/g;
    firstAloneRe.lastIndex = 0;
    let fm: RegExpExecArray | null;
    while ((fm = firstAloneRe.exec(clean)) !== null) {
      const name = fm[1];
      if (name === 'start' || name === 'done' || name === 'terminate') ensureSpecialNode(name, fm.index);
    }
  }

  // Inline "then Y;" — find nearest preceding declaration as source
  // Build a position→name map from all declarations (actions, states, control nodes)
  const declPositions: { name: string; end: number }[] = [];
  {
    // Collect end positions of all action/state/control-node/fork/join/merge/decide declarations
    const declRe = /\b(?:action|state|fork|join|merge|decide)\s+(\w+)\s*[;{]/g;
    declRe.lastIndex = 0;
    let dm: RegExpExecArray | null;
    while ((dm = declRe.exec(clean)) !== null) {
      const pre = clean.slice(Math.max(0, dm.index - 5), dm.index);
      if (/\bdef\s+$/.test(pre)) continue; // skip "action def X"
      if (/\bperform\s+$/.test(pre) || /\bexhibit\s+$/.test(pre)) continue;
      const endPos = dm.index + dm[0].length;
      declPositions.push({ name: dm[1], end: endPos });
    }
    // Also "first start;" counts as a declaration of start
    const firstRe = /\bfirst\s+(\w+)\s*;/g;
    firstRe.lastIndex = 0;
    while ((dm = firstRe.exec(clean)) !== null) {
      declPositions.push({ name: dm[1], end: dm.index + dm[0].length });
    }
    declPositions.sort((a, b) => a.end - b.end);
  }

  // Track which "then" occurrences are already handled by SUCCESSION_PATTERN
  const handledThenPositions = new Set<number>();
  SUCCESSION_PATTERN.lastIndex = 0;
  while ((match = SUCCESSION_PATTERN.exec(clean)) !== null) {
    // The "then" keyword position inside "first X then Y;"
    const thenPos = match.index + match[0].indexOf('then');
    handledThenPositions.add(thenPos);
  }

  INLINE_THEN_PATTERN.lastIndex = 0;
  while ((match = INLINE_THEN_PATTERN.exec(clean)) !== null) {
    // Skip if this "then" is part of "first X then Y;" or "if G then A;"
    if (handledThenPositions.has(match.index)) continue;
    // Check if preceded by "if guard" — those are handled separately
    const preThen = clean.slice(Math.max(0, match.index - 30), match.index);
    if (/\bif\s+\w+\s+$/.test(preThen)) continue;
    // Skip "then" inside "first ... then ..."
    if (/\bfirst\s+\w+\s+$/.test(preThen)) continue;

    const toName = match[1];
    if (toName === 'start' || toName === 'done' || toName === 'terminate') ensureSpecialNode(toName, match.index);

    // Find the nearest preceding declaration
    const pos = match.index;
    let fromName: string | undefined;
    for (let i = declPositions.length - 1; i >= 0; i--) {
      if (declPositions[i].end <= pos) {
        fromName = declPositions[i].name;
        break;
      }
    }
    if (!fromName) continue;
    if (fromName === 'start' || fromName === 'done' || fromName === 'terminate') ensureSpecialNode(fromName, match.index);

    const fromNode = nodeIndex.get(fromName);
    const toNode = nodeIndex.get(toName);
    if (fromNode && toNode) {
      connections.push({
        id: makeId('then', `${fromName}_${toName}_${match.index}`),
        sourceId: fromNode.id, targetId: toNode.id,
        kind: 'flow', name: '',
      });
    }
  }

  // "if guard then action;" — conditional succession from nearest preceding decide/node
  IF_THEN_PATTERN.lastIndex = 0;
  while ((match = IF_THEN_PATTERN.exec(clean)) !== null) {
    const [, guard, toName] = match;
    const pos = match.index;
    // Find the nearest preceding declaration as the source
    let fromName: string | undefined;
    for (let i = declPositions.length - 1; i >= 0; i--) {
      if (declPositions[i].end <= pos) {
        fromName = declPositions[i].name;
        break;
      }
    }
    if (!fromName) continue;
    const fromNode = nodeIndex.get(fromName);
    const toNode = nodeIndex.get(toName);
    if (fromNode && toNode) {
      connections.push({
        id: makeId('guard', `${fromName}_${toName}_${match.index}`),
        sourceId: fromNode.id, targetId: toNode.id,
        kind: 'flow', name: `[${guard}]`,
      });
    }
  }

  // ── 2m. Relationships: satisfy, verify, allocate, bind ─────────────────────

  SATISFY_PATTERN.lastIndex = 0;
  while ((match = SATISFY_PATTERN.exec(clean)) !== null) {
    const [, reqName, partName] = match;
    const reqNode = nodeIndex.get(reqName);
    const partNode = nodeIndex.get(partName);
    if (reqNode && partNode) {
      connections.push({ id: makeId('satisfy', `${partName}_${reqName}_${match.index}`), sourceId: partNode.id, targetId: reqNode.id, kind: 'satisfy', name: '«satisfy»' });
    }
  }

  VERIFY_PATTERN.lastIndex = 0;
  while ((match = VERIFY_PATTERN.exec(clean)) !== null) {
    const [, reqName, partName] = match;
    const reqNode = nodeIndex.get(reqName);
    const partNode = nodeIndex.get(partName);
    if (reqNode && partNode) {
      connections.push({ id: makeId('verify', `${partName}_${reqName}_${match.index}`), sourceId: partNode.id, targetId: reqNode.id, kind: 'verify', name: '«verify»' });
    }
  }

  ALLOCATE_PATTERN.lastIndex = 0;
  while ((match = ALLOCATE_PATTERN.exec(clean)) !== null) {
    const [, from, to] = match;
    const fromNode = nodeIndex.get(from.split('.')[0]);
    const toNode = nodeIndex.get(to.split('.')[0]);
    if (fromNode && toNode) {
      connections.push({ id: makeId('allocate', `${from}_${to}_${match.index}`), sourceId: fromNode.id, targetId: toNode.id, kind: 'allocate', name: '«allocate»' });
    }
  }

  BIND_PATTERN.lastIndex = 0;
  while ((match = BIND_PATTERN.exec(clean)) !== null) {
    const [, left, right] = match;
    const leftNode = nodeIndex.get(left.split('.')[0]);
    const rightNode = nodeIndex.get(right.split('.')[0]);
    if (leftNode && rightNode) {
      connections.push({ id: makeId('bind', `${left}_${right}_${match.index}`), sourceId: leftNode.id, targetId: rightNode.id, kind: 'bind', name: '=' });
    }
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
