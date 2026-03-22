import type { SysMLModel, SysMLNode, SysMLConnection, SysMLNodeKind, DiagramDiagnostic } from '@systemodel/shared-types';

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Extract `comment` declarations before stripping. Returns the extracted comments and the source
 *  with comment declaration bodies replaced by spaces (so offsets stay aligned). */
interface ExtractedComment {
  name?: string;
  about?: string;
  body: string;
  index: number;
  isDoc?: boolean; // `doc` keyword — owned by parent element
}

function extractCommentDecls(src: string): { cleaned: string; comments: ExtractedComment[] } {
  const comments: ExtractedComment[] = [];
  let result = src;

  // First, build a set of ranges covered by /* */ blocks so we can skip them
  const blockRanges: { start: number; end: number }[] = [];
  const blockRe = /\/\*[\s\S]*?\*\//g;
  let bm: RegExpExecArray | null;
  while ((bm = blockRe.exec(src)) !== null) {
    blockRanges.push({ start: bm.index, end: bm.index + bm[0].length });
  }
  function isInsideBlock(pos: number): boolean {
    return blockRanges.some(r => pos >= r.start && pos < r.end);
  }

  // Find `comment` and `doc` keywords NOT inside a /* */ block, followed by optional preamble, then /* body */
  const commentKwRe = /\b(comment|doc)\b/g;
  let kwMatch: RegExpExecArray | null;
  while ((kwMatch = commentKwRe.exec(src)) !== null) {
    if (isInsideBlock(kwMatch.index)) continue;

    const keyword = kwMatch[1]; // "comment" or "doc"
    const kwLen = keyword.length;
    const afterKw = src.slice(kwMatch.index + kwLen);
    const bodyMatch = afterKw.match(/^([^;{]*?)\/\*([\s\S]*?)\*\//);
    if (!bodyMatch) continue;

    const preamble = bodyMatch[1].trim();
    const body = bodyMatch[2].trim();
    const fullLen = kwLen + bodyMatch[0].length;

    let name: string | undefined;
    let about: string | undefined;

    if (keyword === 'comment') {
      const aboutMatch = preamble.match(/\babout\s+(\w+)/);
      if (aboutMatch) {
        about = aboutMatch[1];
        const beforeAbout = preamble.slice(0, preamble.indexOf('about')).trim();
        if (beforeAbout && /^\w+$/.test(beforeAbout)) name = beforeAbout;
      } else if (preamble && /^\w+$/.test(preamble)) {
        name = preamble;
      }
    } else {
      // doc [Name] /* body */
      if (preamble && /^\w+$/.test(preamble)) name = preamble;
    }

    comments.push({ name, about, body, index: kwMatch.index, isDoc: keyword === 'doc' });

    const spaces = src.slice(kwMatch.index, kwMatch.index + fullLen).replace(/[^\n]/g, ' ');
    result = result.slice(0, kwMatch.index) + spaces + result.slice(kwMatch.index + fullLen);
  }
  return { cleaned: result, comments };
}

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

/** Replace single-quoted names (e.g. `'My Part'`) with length-preserving \w+ placeholders
 *  so all existing regexes match without changes. Returns a map to restore original names. */
function normalizeQuotedNames(src: string): { text: string; nameMap: Map<string, string> } {
  const nameMap = new Map<string, string>();
  let counter = 0;
  const text = src.replace(/'([^']*)'/g, (fullMatch, innerName) => {
    const key = `_Q${counter++}_`;
    // Ensure placeholder is exactly fullMatch.length to preserve offsets
    const padded = key.length >= fullMatch.length
      ? key.slice(0, fullMatch.length)
      : key.padEnd(fullMatch.length, '_');
    nameMap.set(padded, innerName);
    return padded;
  });
  return { text, nameMap };
}

/** Restore a placeholder back to the original quoted name, or return as-is. */
function dequote(name: string, nameMap: Map<string, string>): string {
  return nameMap.get(name) ?? name;
}

function lineCol(source: string, index: number): { line: number; column: number } {
  const clamped = Math.max(0, Math.min(index, source.length));
  const before = source.slice(0, clamped);
  const line = (before.match(/\n/g) ?? []).length + 1;
  const column = clamped - before.lastIndexOf('\n');
  return { line, column };
}

/** Levenshtein edit distance between two strings (case-insensitive). */
function editDistance(a: string, b: string): number {
  const A = a.toLowerCase(), B = b.toLowerCase();
  // Cap string lengths to avoid excessive memory allocation
  if (A.length > 100 || B.length > 100) return Math.abs(A.length - B.length);
  // Use O(min(m,n)) space — only two rows instead of full matrix
  const short = A.length <= B.length ? A : B;
  const long = A.length <= B.length ? B : A;
  let prev = Array.from({ length: short.length + 1 }, (_, j) => j);
  let curr = new Array<number>(short.length + 1);
  for (let i = 1; i <= long.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= short.length; j++) {
      curr[j] = long[i - 1] === short[j - 1] ? prev[j - 1]
        : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[short.length];
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
const DEF_PATTERN = /\b(abstract\s+)?(part|attribute|connection|port|action|state|item)\s+def\s+(\w+)(?:\s+(?:specializes\s+|:>(?!>)\s*)([\w:]+))?\s*(?:parallel\s+)?[{;]/g;
// group[1]=ref?, group[2]=keyword, group[3]=name, group[4]=multiplicity (optional, before or after type), group[5]=type
// Core + extended usage keywords (all single-word keywords that can appear as usages)
const USAGE_KW = 'part|attribute|port|action|state|item|requirement|constraint|interface|enum|calc|allocation|connection|flow|concern|view|viewpoint|rendering|metadata|occurrence';
const USAGE_PATTERN = new RegExp(`\\b(derived\\s+)?(ref\\s+)?(${USAGE_KW})\\s+(\\w+)\\s*(\\[[\\d..*]+\\])?\\s*:\\s*([\\w:]+)\\s*(\\[[\\d..*]+\\])?\\s*(?:parallel\\s+)?[;{]`, 'g');
// Untyped usages: e.g. `action generateTorque;` or `action generateTorque { ... }`
const UNTYPED_USAGE_PATTERN = new RegExp(`\\b(derived\\s+)?(ref\\s+)?(${USAGE_KW})\\s+(?!def\\b)(\\w+)\\s*(?:parallel\\s+)?[;{]`, 'g');
// in/out parameters: e.g. `in item data : Data;` or `inout item data : Pkg::Type;`
const IN_OUT_PATTERN = new RegExp(`\\b(in|out|inout)\\s+(${USAGE_KW})\\s+(\\w+)\\s*(?:\\[[\\d..*]+\\])?\\s*:\\s*([\\w:]+)\\s*[;{]`, 'g');
const IN_OUT_UNTYPED_PATTERN = new RegExp(`\\b(in|out|inout)\\s+(${USAGE_KW})\\s+(\\w+)\\s*[;{]`, 'g');
const ATTRIBUTE_VALUE_PATTERN = /\battribute\s+(\w+)\s*(?::\s*([\w:]+))?\s*=\s*([^;]+);/g;
// Subsetting: part x :> y; or part x subsets y; or part x : Type :> y; or part x : Type subsets y;
const SUBSETTING_PATTERN = new RegExp(`\\b(${USAGE_KW})\\s+(?!def\\b)(\\w+)\\s*(\\[[\\d..*]+\\])?\\s*(?::\\s*([\\w:]+)\\s*)?(?::>(?!>)\\s*|\\bsubsets\\s+)([\\w:.]+)\\s*(\\[[\\d..*]+\\])?\\s*[;{]`, 'g');
// Redefinition: part x :>> y; or part x redefines y; or part x : Type :>> y; or part x : Type redefines y;
const REDEFINITION_PATTERN = new RegExp(`\\b(${USAGE_KW})\\s+(?!def\\b)(\\w+)\\s*(\\[[\\d..*]+\\])?\\s*(?::\\s*([\\w:]+)\\s*)?(?::>>\\s*|\\bredefines\\s+)([\\w:.]+)\\s*(\\[[\\d..*]+\\])?\\s*[;{]`, 'g');
// Reference subsetting: part x ::> y; or part x references y;
const REFERENCE_SUBSETTING_PATTERN = new RegExp(`\\b(${USAGE_KW})\\s+(?!def\\b)(\\w+)\\s*(\\[[\\d..*]+\\])?\\s*(?::\\s*([\\w:]+)\\s*)?(?:::>\\s*|\\breferences\\s+)([\\w:.]+)\\s*(\\[[\\d..*]+\\])?\\s*[;{]`, 'g');
// Unnamed redefinition: part redefines x; or part redefines x[4];
const UNNAMED_REDEFINE_PATTERN = new RegExp(`\\b(${USAGE_KW})\\s+(?:redefines\\s+|:>>\\s*)([\\w:.]+)\\s*(\\[[\\d..*]+\\])?\\s*[;{]`, 'g');
// Crossing: part x => y; or part x crosses y; or part x : Type => y;
const CROSSING_PATTERN = new RegExp(`\\b(${USAGE_KW})\\s+(?!def\\b)(\\w+)\\s*(\\[[\\d..*]+\\])?\\s*(?::\\s*([\\w:]+)\\s*)?(?:=>\\s*|\\bcrosses\\s+)([\\w:.]+)\\s*(\\[[\\d..*]+\\])?\\s*[;{]`, 'g');
// Conjugated port usage: port p : ~PortDef;
const CONJUGATED_PORT_PATTERN = /\bport\s+(\w+)\s*:\s*~([\w:]+)\s*[;{]/g;
const CONNECT_PATTERN = /\bconnect\s+(\w+(?:\.\w+)*)\s+to\s+(\w+(?:\.\w+)*)\s*;/g;
// Flow: flow [name] [of Payload] from X.out to Y.in;  OR  flow X.out to Y.in;
const FLOW_PATTERN = /\bflow\s+(?:(\w+)\s+)?(?:(?:of\s+([\w:]+)\s+)?from\s+)?(\w+(?:\.\w+)*)\s+to\s+(\w+(?:\.\w+)*)\s*;/g;
// Succession flow: succession flow [name] [of Payload] from X to Y;
const SUCCESSION_FLOW_PATTERN = /\bsuccession\s+flow\s+(?:(\w+)\s+)?(?:(?:of\s+([\w:]+)\s+)?from\s+)?(\w+(?:\.\w+)*)\s+to\s+(\w+(?:\.\w+)*)\s*;/g;
// Message: message [name] [of Payload] from X to Y;
const MESSAGE_PATTERN = /\bmessage\s+(?:(\w+)\s+)?(?:of\s+([\w:]+)\s+)?from\s+(\w+(?:\.\w+)*)\s+to\s+(\w+(?:\.\w+)*)\s*;/g;
// Extended definition patterns (single-word keywords)
const EXT_DEF_PATTERN = /\b(abstract\s+)?(requirement|constraint|interface|enum|calc|allocation|flow|concern|view|viewpoint|rendering|metadata|occurrence)\s+def\s+(\w+)(?:\s+(?:specializes\s+|:>(?!>)\s*)([\w:]+))?\s*[{;]/g;
// Multi-word definition patterns
const USE_CASE_DEF_PATTERN = /\b(abstract\s+)?use\s+case\s+def\s+(\w+)(?:\s+(?:specializes\s+|:>(?!>)\s*)([\w:]+))?\s*[{;]/g;
const ANALYSIS_CASE_DEF_PATTERN = /\b(abstract\s+)?analysis\s+case\s+def\s+(\w+)(?:\s+(?:specializes\s+|:>(?!>)\s*)([\w:]+))?\s*[{;]/g;
const VERIFICATION_CASE_DEF_PATTERN = /\b(abstract\s+)?verification\s+case\s+def\s+(\w+)(?:\s+(?:specializes\s+|:>(?!>)\s*)([\w:]+))?\s*[{;]/g;
// Multi-word usage patterns (use case, analysis case, verification case)
const USE_CASE_USAGE_PATTERN = /\buse\s+case\s+(\w+)\s*(?:\[[\d..*]+\])?\s*:\s*([\w:]+)\s*(?:\[[\d..*]+\])?\s*[{;]/g;
const USE_CASE_UNTYPED_PATTERN = /\buse\s+case\s+(?!def\b)(\w+)\s*[{;]/g;
const ANALYSIS_CASE_USAGE_PATTERN = /\banalysis\s+case\s+(\w+)\s*(?:\[[\d..*]+\])?\s*:\s*([\w:]+)\s*(?:\[[\d..*]+\])?\s*[{;]/g;
const ANALYSIS_CASE_UNTYPED_PATTERN = /\banalysis\s+case\s+(?!def\b)(\w+)\s*[{;]/g;
const VERIFICATION_CASE_USAGE_PATTERN = /\bverification\s+case\s+(\w+)\s*(?:\[[\d..*]+\])?\s*:\s*([\w:]+)\s*(?:\[[\d..*]+\])?\s*[{;]/g;
const VERIFICATION_CASE_UNTYPED_PATTERN = /\bverification\s+case\s+(?!def\b)(\w+)\s*[{;]/g;
// Behavioral
const PERFORM_PATTERN = /\bperform\s+(?:action\s+)?(\w+)(?:\s*:\s*([\w:]+))?\s*[;{]/g;
const EXHIBIT_PATTERN = /\bexhibit\s+(?:state\s+)?(\w+)(?:\s*:\s*([\w:]+))?\s*[;{]/g;
// Transition usage — matches both named and anonymous forms:
//   transition transName first source accept trigger if guard then target;
//   transition first source accept trigger then target;
//   transition transName { first source; accept trigger; then target; }
const TRANSITION_NAMED_PATTERN = /\btransition\s+(?!first\b|accept\b|if\b|then\b)(\w+)/g;
const TRANSITION_ANON_PATTERN = /\btransition\s+(?=first\b|accept\b)/g;
// Shorthand transition (TargetTransitionUsage): source inferred from previous state
// Two-step approach: first find "accept ... then target;" span, then parse components inside
const SHORTHAND_ACCEPT_THEN_PATTERN = /\baccept\s+([\s\S]+?)\bthen\s+(\w+)\s*;/g;
// Successions: "first X then Y;" standalone
const SUCCESSION_PATTERN = /\bfirst\s+(\w+)\s+then\s+(\w+)\s*;/g;
// Inline "then Y;" or "then fork Y;" after declarations
// Optionally skips a keyword (fork/join/merge/decide/action/state) before the target name
const INLINE_THEN_PATTERN = /\bthen\s+(?:(?:fork|join|merge|decide|action|state)\s+)?(\w+)\s*;/g;
// Conditional succession: "if guard then action;" or "if guard then action; else action2;"
const IF_THEN_ELSE_PATTERN = /\bif\s+([\w.]+)\s+then\s+(\w+)\s*;\s*else\s+(\w+)\s*;/g;
const IF_THEN_PATTERN = /\bif\s+([\w.]+)\s+then\s+(\w+)\s*;/g;
// Control nodes (including start and terminate)
const CONTROL_NODE_PATTERN = /\b(fork|join|merge|decide)\s+(\w+)\s*;/g;
// Relationships
const SATISFY_PATTERN = /\bsatisfy\s+(?:requirement\s+)?(\w+)\s+by\s+(\w+)\s*;/g;
const VERIFY_PATTERN = /\bverify\s+(?:requirement\s+)?(\w+)\s+by\s+(\w+)\s*;/g;
const ALLOCATE_PATTERN = /\ballocate\s+(\w+(?:\.\w+)*)\s+to\s+(\w+(?:\.\w+)*)\s*;/g;
const BIND_PATTERN = /\bbind\s+(\w+(?:\.\w+)*)\s*=\s*(\w+(?:\.\w+)*)\s*;/g;
// import PackageName::*;  or  import PackageName::TypeName;
// Supports: public/private/protected visibility, multi-level qualified names, recursive ::**
const IMPORT_PATTERN = /\b(?:(?:public|private|protected)\s+)?import\s+([\w:]+?)::(\*{1,2}|\w+)\s*;/g;
// alias Car for Automobile;  or  alias Torque for ISQ::TorqueValue;  or  alias Car for Automobile { ... }
const ALIAS_PATTERN = /\b(?:(?:public|private|protected)\s+)?alias\s+(\w+)\s+for\s+([\w:]+)\s*[;{]/g;

// Extended keyword → SysMLNodeKind mapping
const EXT_KIND_MAP: Record<string, SysMLNodeKind> = {
  requirement: 'RequirementDefinition', constraint: 'ConstraintDefinition',
  interface: 'InterfaceDefinition', enum: 'EnumDefinition', calc: 'CalcDefinition',
  allocation: 'AllocationDefinition', flow: 'FlowDefinition', concern: 'ConcernDefinition',
  view: 'ViewDefinition', viewpoint: 'ViewpointDefinition', rendering: 'RenderingDefinition',
  metadata: 'MetadataDefinition', occurrence: 'OccurrenceDefinition',
};

// ─── Main parser ─────────────────────────────────────────────────────────────

const MAX_SOURCE_LENGTH = 2_000_000; // 2 MB safety limit

export function parseSysMLText(uri: string, source: string): { model: SysMLModel; diagnostics: DiagramDiagnostic[] } {
  if (!source || source.length === 0) {
    return { model: { uri, nodes: [], connections: [] }, diagnostics: [] };
  }
  if (source.length > MAX_SOURCE_LENGTH) {
    return {
      model: { uri, nodes: [], connections: [] },
      diagnostics: [{ severity: 'error', message: `Source exceeds maximum size (${MAX_SOURCE_LENGTH} characters)`, line: 1, column: 1 }],
    };
  }
  // 1. Strip // line comments first (notes — not part of model)
  // Replace with spaces (not empty) to preserve character offsets for lineCol()
  const noLineComments = source.replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
  // 2. Extract `comment` declarations before stripping /* */ (they use /* */ as body text)
  const { cleaned: preStripped, comments: extractedComments } = extractCommentDecls(noLineComments);
  // 3. Extract remaining /* */ block comments as anonymous comment elements
  // Skip those inside { } blocks (alias bodies, etc.)
  // Pre-compute brace depth at each position (O(n) instead of O(n*m))
  const braceDepthAt: number[] = new Array(preStripped.length);
  {
    let depth = 0;
    for (let i = 0; i < preStripped.length; i++) {
      if (preStripped[i] === '{') depth++;
      else if (preStripped[i] === '}') depth--;
      braceDepthAt[i] = depth;
    }
  }
  const blockCommentRe = /\/\*([\s\S]*?)\*\//g;
  let bcMatch: RegExpExecArray | null;
  while ((bcMatch = blockCommentRe.exec(preStripped)) !== null) {
    // Only top-level or package-level block comments become elements
    // Skip if inside a nested block (alias body, etc.) at depth 2+
    if (bcMatch.index > 0 && braceDepthAt[bcMatch.index - 1] >= 2) continue;
    const body = bcMatch[1].trim().replace(/^\*\s*/gm, '').trim(); // strip leading * from each line
    if (body) {
      extractedComments.push({ body, index: bcMatch.index });
    }
  }
  const stripped = preStripped.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const { text: clean, nameMap } = normalizeQuotedNames(stripped);

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
    const [, qualifiedPkg, member] = importMatch;
    // Extract the top-level package name (first segment of qualified path)
    const pkgName = qualifiedPkg.includes('::') ? qualifiedPkg.split('::')[0] : qualifiedPkg;
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

  // Track aliases so we can resolve them during type lookups (populated in step 0d)
  const aliasMap = new Map<string, string>(); // alias name → target name

  /** Resolve a type name that may be qualified (e.g. `Pkg::SubPkg::Name` → look up `Name`).
   *  Also resolves aliases to their target types. */
  function resolveType(name: string): SysMLNode | undefined {
    // Try exact match first
    const exact = nodeIndex.get(name);
    if (exact) return exact;
    // Check aliases
    const aliasTarget = aliasMap.get(name);
    if (aliasTarget) {
      const resolved = nodeIndex.get(aliasTarget);
      if (resolved) return resolved;
    }
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
    const pkgName = dequote(pkgMatch[1], nameMap);
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

  // ── 0d. Parse alias declarations ────────────────────────────────────────

  interface AliasRange { id: string; name: string; start: number; end: number }
  const aliasRanges: AliasRange[] = [];

  ALIAS_PATTERN.lastIndex = 0;
  let aliasMatch: RegExpExecArray | null;
  while ((aliasMatch = ALIAS_PATTERN.exec(clean)) !== null) {
    const aliasName = dequote(aliasMatch[1], nameMap);
    const target = aliasMatch[2]; // qualified or simple target name
    const targetSimple = target.includes('::') ? target.split('::').pop()! : target;

    aliasMap.set(aliasName, targetSimple);

    const { line: aLine, column: aCol } = lineCol(source, aliasMatch.index);
    const aliasNode: SysMLNode = {
      id: makeId('alias', aliasName),
      kind: 'Alias',
      name: aliasName,
      qualifiedName: `${aliasName} → ${target}`,
      children: [],
      attributes: [{ name: 'for', type: target }],
      connections: [],
      range: {
        start: { line: aLine - 1, character: aCol - 1 },
        end:   { line: aLine - 1, character: aCol - 1 + aliasMatch[0].length },
      },
    };
    nodes.push(aliasNode);
    nodeIndex.set(aliasName, aliasNode);

    // Track alias block range for comment ownership
    const aliasEnd = findBlockEnd(clean, aliasMatch.index + aliasMatch[0].length - 1);
    aliasRanges.push({ id: aliasNode.id, name: aliasName, start: aliasMatch.index, end: aliasEnd });

    // Composition edge to owner package if inside one
    const ownerPkg = findOwnerPackage(aliasMatch.index);
    if (ownerPkg) {
      connections.push({
        id: makeId('pkg-member', `${ownerPkg.name}_${aliasName}`),
        sourceId: ownerPkg.id,
        targetId: aliasNode.id,
        kind: 'composition',
        name: '',
      });
    }
  }

  // ── 0e. Create nodes for extracted comment/doc declarations ──────────────

  for (const ec of extractedComments) {
    const isDoc = ec.isDoc ?? false;
    const prefix = isDoc ? 'doc' : 'comment';
    const commentName = ec.name ?? (ec.about ? `about ${ec.about}` : `${prefix}_${ec.index}`);
    const displayName = isDoc
      ? (ec.name ?? '[doc]')
      : (ec.name ?? (ec.about ? `[about ${ec.about}]` : '[comment]'));
    const { line: cLine, column: cCol } = lineCol(source, ec.index);
    const commentNode: SysMLNode = {
      id: makeId(prefix, `${commentName}_${ec.index}`),
      kind: 'Comment',
      name: displayName,
      children: [],
      attributes: [{ name: 'text', value: ec.body }],
      connections: [],
      range: {
        start: { line: cLine - 1, character: cCol - 1 },
        end: { line: cLine - 1, character: cCol - 1 },
      },
    };
    nodes.push(commentNode);

    // Find owner: alias ranges first, then packages
    // Doc comments always attach to nearest enclosing element (deferred to section 0e-deferred for defs)
    const ownerAlias = aliasRanges.find(a => ec.index > a.start && ec.index < a.end);
    if (ownerAlias) {
      connections.push({
        id: makeId('owns', `${ownerAlias.name}_${commentName}_${ec.index}`),
        sourceId: ownerAlias.id,
        targetId: commentNode.id,
        kind: 'composition',
        name: '',
      });
    } else if (!isDoc) {
      // Regular comments attach to package; doc comments defer to after defs are parsed
      const ownerPkg = findOwnerPackage(ec.index);
      if (ownerPkg) {
        connections.push({
          id: makeId('pkg-member', `${ownerPkg.name}_${commentName}_${ec.index}`),
          sourceId: ownerPkg.id,
          targetId: commentNode.id,
          kind: 'composition',
          name: '',
        });
      }
    }

    // "about" and doc ownership edges are deferred to after definitions are parsed
  }

  // ── 1. Extract all *Definitions ────────────────────────────────────────

  DEF_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = DEF_PATTERN.exec(clean)) !== null) {
    const [, abstractKw, keyword, rawName, specializes] = match;
    const name = dequote(rawName, nameMap);
    const kind = `${keyword.charAt(0).toUpperCase()}${keyword.slice(1)}Definition` as SysMLNodeKind;
    const id = makeId('def', name);

    const { line: defLine, column: defCol } = lineCol(source, match.index);
    const blockEndIdx = findBlockEnd(clean, match.index + match[0].length - 1);
    const { line: defEndLine, column: defEndCol } = lineCol(source, blockEndIdx);
    // Check for parallel keyword between definition name and opening brace (not in the name itself)
    const afterName = match[0].slice(match[0].indexOf(name) + name.length);
    const isParallel = /\bparallel\b/.test(afterName);
    const node: SysMLNode = {
      id,
      kind,
      name,
      qualifiedName: name,
      isAbstract: !!abstractKw,
      ...(isParallel ? { isParallel: true } : {}),
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

  // ── 1c. Extended definitions (requirement, constraint, enum, use case, etc.) ──
  // Registered early so usages in section 2 can resolve enum defs, requirement defs, etc.

  // Helper: parse a definition pattern and create node + edges
  function parseExtDef(pattern: RegExp, kind: SysMLNodeKind, nameGroup: number, abstractGroup: number, specGroup: number): void {
    pattern.lastIndex = 0;
    while ((match = pattern.exec(clean)) !== null) {
      const abstractKw = match[abstractGroup];
      const name = dequote(match[nameGroup], nameMap);
      const specializes = match[specGroup];
      const id = makeId('def', name);
      if (definedNames.has(name)) continue;
      definedNames.add(name);
      const { line: dL, column: dC } = lineCol(source, match.index);
      const blockEnd = findBlockEnd(clean, match.index + match[0].length - 1);
      const { line: dEL, column: dEC } = lineCol(source, blockEnd);
      nodes.push({
        id, kind, name, qualifiedName: name, isAbstract: !!abstractKw,
        children: [], attributes: [], connections: [],
        range: { start: { line: dL - 1, character: dC - 1 }, end: { line: dEL - 1, character: dEC - 1 } },
      });
      nodeIndex.set(name, nodes[nodes.length - 1]);
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

  // Single-word extended defs
  EXT_DEF_PATTERN.lastIndex = 0;
  while ((match = EXT_DEF_PATTERN.exec(clean)) !== null) {
    const kind = EXT_KIND_MAP[match[2]];
    if (!kind) continue;
    const abstractKw = match[1];
    const name = dequote(match[3], nameMap);
    const specializes = match[4];
    const id = makeId('def', name);
    if (definedNames.has(name)) continue;
    definedNames.add(name);
    const { line: dL, column: dC } = lineCol(source, match.index);
    const blockEnd = findBlockEnd(clean, match.index + match[0].length - 1);
    const { line: dEL, column: dEC } = lineCol(source, blockEnd);
    nodes.push({
      id, kind, name, qualifiedName: name, isAbstract: !!abstractKw,
      children: [], attributes: [], connections: [],
      range: { start: { line: dL - 1, character: dC - 1 }, end: { line: dEL - 1, character: dEC - 1 } },
    });
    nodeIndex.set(name, nodes[nodes.length - 1]);
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

  // Multi-word defs
  for (const [pattern, kind] of [
    [USE_CASE_DEF_PATTERN, 'UseCaseDefinition'],
    [ANALYSIS_CASE_DEF_PATTERN, 'AnalysisCaseDefinition'],
    [VERIFICATION_CASE_DEF_PATTERN, 'VerificationCaseDefinition'],
  ] as [RegExp, SysMLNodeKind][]) {
    parseExtDef(pattern, kind, 2, 1, 3);
  }
  defPositions.sort((a, b) => b.start - a.start);

  // Pre-built index of usage positions for fast enclosing-usage lookup
  // Includes both typed and untyped usages so nested items can find their parent usage
  interface UsagePosition { name: string; start: number; end: number; }
  const usagePositions: UsagePosition[] = [];
  {
    // Typed usages
    USAGE_PATTERN.lastIndex = 0;
    let um: RegExpExecArray | null;
    while ((um = USAGE_PATTERN.exec(clean)) !== null) {
      const end = findBlockEnd(clean, um.index + um[0].length - 1);
      usagePositions.push({ name: um[4], start: um.index, end }); // [4]=name (after derived?, ref?, keyword)
    }
    // Untyped usages (e.g. `item SourceData { ... }`)
    UNTYPED_USAGE_PATTERN.lastIndex = 0;
    while ((um = UNTYPED_USAGE_PATTERN.exec(clean)) !== null) {
      // Skip if preceded by 'in', 'out', 'inout', or 'def'
      const pre = clean.slice(Math.max(0, um.index - 7), um.index);
      if (/\b(inout|in|out|def)\s+$/.test(pre)) continue;
      // Skip duplicates already captured by typed pattern
      const name = dequote(um[4], nameMap); // [4]=name (after derived?, ref?, keyword)
      const start = um.index;
      if (usagePositions.some(up => up.start === start)) continue;
      const end = findBlockEnd(clean, um.index + um[0].length - 1);
      usagePositions.push({ name, start, end });
    }
    // Multi-word usages (use case, analysis case, verification case)
    for (const pat of [USE_CASE_USAGE_PATTERN, USE_CASE_UNTYPED_PATTERN,
                        ANALYSIS_CASE_USAGE_PATTERN, ANALYSIS_CASE_UNTYPED_PATTERN,
                        VERIFICATION_CASE_USAGE_PATTERN, VERIFICATION_CASE_UNTYPED_PATTERN]) {
      const scanRe = new RegExp(pat.source, 'g');
      while ((um = scanRe.exec(clean)) !== null) {
        const name = dequote(um[1], nameMap);
        const start = um.index;
        if (usagePositions.some(up => up.start === start)) continue;
        const end = findBlockEnd(clean, um.index + um[0].length - 1);
        usagePositions.push({ name, start, end });
      }
    }
    // Also scan perform/exhibit blocks so nested items can find them as parents
    const performScanRe = new RegExp(PERFORM_PATTERN.source, 'g');
    while ((um = performScanRe.exec(clean)) !== null) {
      const end = findBlockEnd(clean, um.index + um[0].length - 1);
      usagePositions.push({ name: dequote(um[1], nameMap), start: um.index, end });
    }
    const exhibitScanRe = new RegExp(EXHIBIT_PATTERN.source, 'g');
    while ((um = exhibitScanRe.exec(clean)) !== null) {
      const end = findBlockEnd(clean, um.index + um[0].length - 1);
      usagePositions.push({ name: dequote(um[1], nameMap), start: um.index, end });
    }
    usagePositions.sort((a, b) => b.start - a.start);
  }

  // ── Pre-create container usage nodes (untyped usages with { bodies) ───────
  // These must exist in nodeIndex before section 2 so nested typed usages
  // can find their enclosing container via findOwnerUsage.
  {
    UNTYPED_USAGE_PATTERN.lastIndex = 0;
    let cm: RegExpExecArray | null;
    while ((cm = UNTYPED_USAGE_PATTERN.exec(clean)) !== null) {
      // Only pre-create if the match ends with `{` (block body = container)
      if (cm[0][cm[0].length - 1] !== '{') continue;
      const pre = clean.slice(Math.max(0, cm.index - 9), cm.index);
      if (/\b(inout|in|out|def|perform|exhibit|entry|exit|do)\s+$/.test(pre)) continue;
      // Skip if the declaration header itself has `: Type` (typed usage, handled elsewhere)
      const header = cm[0]; // e.g. "action fulfillOrder {" — only the header, not body
      const keyword = cm[3];
      const afterKw = header.slice(header.indexOf(keyword) + keyword.length);
      if (/\w+\s*(?:\[[\d..*]+\])?\s*:\s*\w+/.test(afterKw)) continue;

      const usageName = dequote(cm[4], nameMap);
      const isDerived = !!cm[1];
      const isRef = !!cm[2];
      const usagePos = cm.index;
      const blockEnd = findBlockEnd(clean, cm.index + cm[0].length - 1);

      // Find owner (def or package)
      let ownerNode: SysMLNode | undefined = findOwnerDef(usagePos);
      const usagePkg = findOwnerPackage(usagePos);
      const ownerName = ownerNode ? ownerNode.name : usagePkg ? usagePkg.name : '_top';

      // Skip if already in nodeIndex
      if (nodeIndex.has(`${ownerName}.${usageName}`)) continue;

      const usageKind = `${keyword.charAt(0).toUpperCase()}${keyword.slice(1)}Usage` as SysMLNodeKind;
      const usageId = makeId('usage', `${ownerName}_${usageName}`);
      const { line: uL, column: uC } = lineCol(source, usagePos);
      const { line: uEL, column: uEC } = lineCol(source, blockEnd);
      const containerNode: SysMLNode = {
        id: usageId, kind: usageKind, name: usageName,
        ...(isRef ? { isRef: true } : {}),
        ...(isDerived ? { isDerived: true } : {}),
        children: [], attributes: [], connections: [],
        range: { start: { line: uL - 1, character: uC - 1 }, end: { line: uEL - 1, character: uEC - 1 } },
      };
      nodes.push(containerNode);
      nodeIndex.set(`${ownerName}.${usageName}`, containerNode);
      if (!nodeIndex.has(usageName)) nodeIndex.set(usageName, containerNode);

      // Composition to owner (noncomposite for ref features)
      if (ownerNode || usagePkg) {
        const ownerId = ownerNode ? ownerNode.id : usagePkg!.id;
        connections.push({
          id: makeId('owns', `${ownerName}_${usageName}`),
          sourceId: ownerId, targetId: usageId, kind: isRef ? 'noncomposite' : 'composition', name: '',
        });
      }
    }
  }

  // Pre-create multi-word usage containers (use case, analysis case, verification case)
  {
    const multiWordPrecreate: [RegExp, RegExp, string, string][] = [
      [USE_CASE_USAGE_PATTERN, USE_CASE_UNTYPED_PATTERN, 'UseCaseUsage', 'use case'],
      [ANALYSIS_CASE_USAGE_PATTERN, ANALYSIS_CASE_UNTYPED_PATTERN, 'AnalysisCaseUsage', 'analysis case'],
      [VERIFICATION_CASE_USAGE_PATTERN, VERIFICATION_CASE_UNTYPED_PATTERN, 'VerificationCaseUsage', 'verification case'],
    ];
    for (const [typedPat, untypedPat, kind, displayKw] of multiWordPrecreate) {
      for (const pat of [typedPat, untypedPat]) {
        const scanRe = new RegExp(pat.source, 'g');
        let cm: RegExpExecArray | null;
        while ((cm = scanRe.exec(clean)) !== null) {
          if (cm[0][cm[0].length - 1] !== '{') continue;
          const usageName = dequote(cm[1], nameMap);
          const usagePos = cm.index;

          let ownerNode: SysMLNode | undefined = findOwnerDef(usagePos);
          const usagePkg = findOwnerPackage(usagePos);
          const ownerName = ownerNode ? ownerNode.name : usagePkg ? usagePkg.name : '_top';

          if (nodeIndex.has(`${ownerName}.${usageName}`)) continue;

          const typeName = cm[2] && cm[2] !== '{' ? simpleName(cm[2]) : undefined;
          const usageId = makeId('usage', `${ownerName}_${usageName}`);
          const { line: uL, column: uC } = lineCol(source, usagePos);
          const blockEnd = findBlockEnd(clean, cm.index + cm[0].length - 1);
          const { line: uEL, column: uEC } = lineCol(source, blockEnd);
          const containerNode: SysMLNode = {
            id: usageId, kind: kind as SysMLNodeKind, name: usageName,
            ...(typeName ? { qualifiedName: typeName } : {}),
            children: [], attributes: [], connections: [],
            range: { start: { line: uL - 1, character: uC - 1 }, end: { line: uEL - 1, character: uEC - 1 } },
          };
          nodes.push(containerNode);
          nodeIndex.set(`${ownerName}.${usageName}`, containerNode);
          if (!nodeIndex.has(usageName)) nodeIndex.set(usageName, containerNode);

          if (ownerNode || usagePkg) {
            connections.push({
              id: makeId('owns', `${ownerName}_${usageName}`),
              sourceId: (ownerNode ?? usagePkg!).id, targetId: usageId, kind: 'composition', name: '',
            });
          }
          if (typeName) {
            const typeNode = resolveType(typeName);
            if (typeNode) {
              connections.push({ id: makeId('typeref', `${usageName}_${typeName}`), sourceId: usageId, targetId: typeNode.id, kind: 'typereference', name: '' });
            }
          }
        }
      }
    }
  }

  /** Find the innermost usage enclosing the given offset (excluding self). */
  function findOwnerUsage(offset: number, selfIndex: number): { node: SysMLNode; start: number } | undefined {
    let best: { node: SysMLNode; start: number } | undefined;
    for (const up of usagePositions) {
      if (up.start === selfIndex) continue;
      if (offset > up.start && offset < up.end) {
        // Find the most specific (innermost) enclosing usage
        if (best && up.start <= best.start) continue;
        const parentUsage = nodeIndex.get(up.name) ??
          nodeIndex.get(`${findOwnerDef(up.start)?.name ?? ''}.${up.name}`);
        // Also try package-qualified lookup
        const pkg = findOwnerPackage(up.start);
        const parentUsage2 = parentUsage ?? (pkg ? nodeIndex.get(`${pkg.name}.${up.name}`) : undefined);
        if (parentUsage2) best = { node: parentUsage2, start: up.start };
      }
    }
    return best;
  }

  // ── 1c. Extract entry/exit/do behaviors inside state defs and state usages ──
  // These appear as compartment attributes like "entry / actionName" in the diagram.
  {
    const STATE_BEHAVIOR_RE = /\b(entry|exit|do)\s*(?:action\s+)?(\w+)?(?:\s*:\s*([\w:]+))?\s*[;{]/g;
    STATE_BEHAVIOR_RE.lastIndex = 0;
    let sbm: RegExpExecArray | null;
    while ((sbm = STATE_BEHAVIOR_RE.exec(clean)) !== null) {
      const [, behaviorKind, actionName, typeName] = sbm;
      const pos = sbm.index;

      // Skip false positives: "do" preceded by "if"
      if (behaviorKind === 'do') {
        const preDo = clean.slice(Math.max(0, pos - 5), pos);
        if (/\bif\s*$/.test(preDo)) continue;
      }

      // Must be inside a state def or state usage body — find the innermost one
      let ownerState: SysMLNode | undefined;
      let ownerStart = -1;

      // Check defPositions for enclosing state def
      for (const dp of defPositions) {
        if (pos > dp.start && pos < dp.end && dp.start > ownerStart) {
          const node = nodeIndex.get(dp.name);
          if (node && node.kind === 'StateDefinition') {
            ownerState = node;
            ownerStart = dp.start;
          }
        }
      }

      // Also check usagePositions for enclosing state usage (may be closer)
      for (const up of usagePositions) {
        if (pos > up.start && pos < up.end && up.start > ownerStart) {
          const node = nodeIndex.get(up.name) ??
            nodeIndex.get(`${findOwnerDef(up.start)?.name ?? ''}.${up.name}`);
          if (node && node.kind === 'StateUsage') {
            ownerState = node;
            ownerStart = up.start;
          }
        }
      }

      if (!ownerState) continue;

      const typeSimple = typeName ? simpleName(typeName) : '';
      const kindLabel = behaviorKind === 'do' ? 'do action' : `${behaviorKind} action`;
      const displayText = actionName
        ? (typeSimple ? `${kindLabel} / ${actionName} : ${typeSimple}` : `${kindLabel} / ${actionName}`)
        : kindLabel;
      ownerState.attributes.push({
        name: displayText,
        type: undefined,
        value: `__${behaviorKind}__`,
      });

      // Also create a graphical node for STV rendering (entry/do/exit as nested action nodes)
      const behaviorNodeName = actionName ?? behaviorKind;
      const behaviorId = makeId('behavior', `${ownerState.name}_${behaviorKind}_${behaviorNodeName}`);
      const behaviorKindMap: Record<string, string> = { entry: 'EntryActionUsage', do: 'DoActionUsage', exit: 'ExitActionUsage' };
      const { line: bL, column: bC } = lineCol(source, pos);
      const bEnd = findBlockEnd(clean, sbm.index + sbm[0].length - 1);
      const { line: bEL, column: bEC } = lineCol(source, bEnd);
      const behaviorNode: SysMLNode = {
        id: behaviorId,
        kind: behaviorKindMap[behaviorKind] as SysMLNodeKind,
        name: actionName ? `${kindLabel} / ${actionName}` : kindLabel,
        qualifiedName: typeSimple || undefined,
        children: [], attributes: [], connections: [],
        range: { start: { line: bL - 1, character: bC - 1 }, end: { line: bEL - 1, character: bEC - 1 } },
      };
      nodes.push(behaviorNode);
      nodeIndex.set(behaviorId, behaviorNode);
      // Also register under scoped name so then-resolution can find it
      nodeIndex.set(`${ownerState.name}__${behaviorKind}`, behaviorNode);
      connections.push({
        id: makeId('owns', `${ownerState.name}_${behaviorKind}_${behaviorNodeName}`),
        sourceId: ownerState.id,
        targetId: behaviorId,
        kind: 'composition',
        name: '',
      });
      if (typeName) {
        const typeNode = resolveType(simpleName(typeName));
        if (typeNode) {
          connections.push({
            id: makeId('typeref', `${behaviorNodeName}_${typeSimple}`),
            sourceId: behaviorId,
            targetId: typeNode.id,
            kind: 'typereference',
            name: '',
          });
        }
      }
    }
  }

  // ── 2-pre. Create perform/exhibit nodes BEFORE usage parsing ──────────────
  // These must be in nodeIndex before inner usages are parsed so findOwnerUsage works.
  {
    PERFORM_PATTERN.lastIndex = 0;
    let pm: RegExpExecArray | null;
    while ((pm = PERFORM_PATTERN.exec(clean)) !== null) {
      const [, rawActionName, typeName] = pm;
      const actionName = dequote(rawActionName, nameMap);
      const usagePos = pm.index;
      const blockEnd = findBlockEnd(clean, usagePos + pm[0].length - 1);
      const id = makeId('usage', actionName);
      const { line: uL, column: uC } = lineCol(source, usagePos);
      const { line: uEL, column: uEC } = lineCol(source, blockEnd);
      const performNode: SysMLNode = {
        id, kind: 'PerformActionUsage', name: actionName,
        children: [], attributes: [], connections: [],
        range: { start: { line: uL - 1, character: uC - 1 }, end: { line: uEL - 1, character: uEC - 1 } },
      };
      nodes.push(performNode);
      nodeIndex.set(actionName, performNode);

      // Composition: owner → perform node + add to owner's attributes
      let ownerNode = findOwnerDef(usagePos);
      const enclosingUsage = findOwnerUsage(usagePos, usagePos);
      if (enclosingUsage && (!ownerNode || enclosingUsage.start > (defPositions.find(d => d.name === ownerNode!.name)?.start ?? -1))) {
        ownerNode = enclosingUsage.node;
      }
      const usagePkg = findOwnerPackage(usagePos);
      if (ownerNode) {
        connections.push({ id: makeId('owns', `${ownerNode.name}_${actionName}`), sourceId: ownerNode.id, targetId: id, kind: 'composition', name: '' });
        if (ownerNode.kind.endsWith('Definition')) {
          ownerNode.attributes.push({ name: actionName, type: typeName ? simpleName(typeName) : '', value: 'perform' });
        }
      } else if (usagePkg) {
        connections.push({ id: makeId('owns', `${usagePkg.name}_${actionName}`), sourceId: usagePkg.id, targetId: id, kind: 'composition', name: '' });
      }
      if (typeName) {
        const typeNode = resolveType(simpleName(typeName));
        if (typeNode) {
          connections.push({ id: makeId('typeref', `${actionName}_${simpleName(typeName)}`), sourceId: id, targetId: typeNode.id, kind: 'typereference', name: '' });
        }
      }
    }

    EXHIBIT_PATTERN.lastIndex = 0;
    let em: RegExpExecArray | null;
    while ((em = EXHIBIT_PATTERN.exec(clean)) !== null) {
      const [, rawStateName, typeName] = em;
      const stateName = dequote(rawStateName, nameMap);
      const usagePos = em.index;
      const blockEnd = findBlockEnd(clean, usagePos + em[0].length - 1);
      const id = makeId('usage', stateName);
      const { line: uL, column: uC } = lineCol(source, usagePos);
      const { line: uEL, column: uEC } = lineCol(source, blockEnd);
      const exhibitNode: SysMLNode = {
        id, kind: 'ExhibitStateUsage', name: stateName,
        children: [], attributes: [], connections: [],
        range: { start: { line: uL - 1, character: uC - 1 }, end: { line: uEL - 1, character: uEC - 1 } },
      };
      nodes.push(exhibitNode);
      nodeIndex.set(stateName, exhibitNode);

      let ownerNode = findOwnerDef(usagePos);
      const enclosingUsage = findOwnerUsage(usagePos, usagePos);
      if (enclosingUsage && (!ownerNode || enclosingUsage.start > (defPositions.find(d => d.name === ownerNode!.name)?.start ?? -1))) {
        ownerNode = enclosingUsage.node;
      }
      const usagePkg = findOwnerPackage(usagePos);
      if (ownerNode) {
        connections.push({ id: makeId('owns', `${ownerNode.name}_${stateName}`), sourceId: ownerNode.id, targetId: id, kind: 'composition', name: '' });
        if (ownerNode.kind.endsWith('Definition')) {
          ownerNode.attributes.push({ name: stateName, type: typeName ? simpleName(typeName) : '', value: 'exhibit' });
        }
      } else if (usagePkg) {
        connections.push({ id: makeId('owns', `${usagePkg.name}_${stateName}`), sourceId: usagePkg.id, targetId: id, kind: 'composition', name: '' });
      }
      if (typeName) {
        const typeNode = resolveType(simpleName(typeName));
        if (typeNode) {
          connections.push({ id: makeId('typeref', `${stateName}_${simpleName(typeName)}`), sourceId: id, targetId: typeNode.id, kind: 'typereference', name: '' });
        }
      }
    }
  }

  // ── 2. Extract usages — create usage nodes + owner→usage + usage→typeDef edges ──

  USAGE_PATTERN.lastIndex = 0;

  while ((match = USAGE_PATTERN.exec(clean)) !== null) {
    const [, derivedKw, refKw, keyword, rawUsageName, multBefore, typeName, multAfter] = match;
    const multiplicity = multBefore || multAfter || undefined;
    const usageName = dequote(rawUsageName, nameMap);
    const isDerived = !!derivedKw;
    const isRef = !!refKw;

    // Skip if preceded by 'in', 'out', 'inout', 'perform', 'exhibit', 'entry', 'exit', 'do' — handled separately
    const pre = clean.slice(Math.max(0, match.index - 9), match.index);
    if (/\b(inout|in|out|perform|exhibit|entry|exit|do)\s+$/.test(pre)) continue;

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
      ownerNode.attributes.push({ name: displayName, type: typeSimple, value: isRef ? `ref ${keyword}` : keyword, ...(isDerived ? { isDerived: true } : {}) });
    }

    // Build the usage SysMLNode
    const usageKind = `${keyword.charAt(0).toUpperCase()}${keyword.slice(1)}Usage` as SysMLNodeKind;
    const usageId = makeId('usage', `${ownerName}_${usageName}`);

    const { line: usageLine, column: usageCol } = lineCol(source, usagePos);
    const usageBlockEndIdx = findBlockEnd(clean, match.index + match[0].length - 1);
    const { line: usageEndLine, column: usageEndCol } = lineCol(source, usageBlockEndIdx);
    // Check if this usage has the 'parallel' keyword
    const isParallel = /parallel\s*[{;]/.test(match[0]) || /parallel\s*$/.test(clean.slice(match.index, match.index + match[0].length + 20));

    const usageNode: SysMLNode = {
      id: usageId,
      kind: usageKind,
      name: usageName,
      qualifiedName: typeSimple,   // reuse qualifiedName to carry the type name
      ...(isRef ? { isRef: true } : {}),
      ...(isDerived ? { isDerived: true } : {}),
      ...(multiplicity ? { multiplicity } : {}),
      ...(isParallel ? { isParallel: true } : {}),
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

    // owner ──[composition/noncomposite]──► usage node (only if there's an actual owner)
    if (ownerNode || usagePkg) {
      const ownerId = ownerNode ? ownerNode.id : usagePkg!.id;
      connections.push({
        id: makeId('owns', `${ownerName}_${usageName}`),
        sourceId: ownerId,
        targetId: usageId,
        kind: isRef ? 'noncomposite' : 'composition',
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
    const [fullMatch, derivedKw, refKw, keyword, rawUsageName] = match;
    const usageName = dequote(rawUsageName, nameMap);
    const isDerived = !!derivedKw;
    const isRef = !!refKw;

    // Skip if preceded by 'in', 'out', 'inout', 'def', 'perform', 'exhibit', 'entry', 'exit', 'do'
    const pre = clean.slice(Math.max(0, match.index - 9), match.index);
    if (/\b(inout|in|out|perform|exhibit|entry|exit|do)\s+$/.test(pre)) continue;
    if (/\bdef\s+$/.test(pre)) continue;   // skip `part def Foo`

    // Skip if this name was already captured as a typed usage or definition
    const usagePos = match.index;

    // Already handled by typed USAGE_PATTERN if the header itself has `: Type`
    const afterKw = fullMatch.slice(fullMatch.indexOf(keyword) + keyword.length);
    if (/\w+\s*(?:\[[\d..*]+\])?\s*:\s*\w+/.test(afterKw)) continue;

    // Find enclosing definition or usage block
    let ownerNode: SysMLNode | undefined = findOwnerDef(usagePos);
    let ownerPos = ownerNode ? defPositions.find(d => d.name === ownerNode!.name)!.start : -1;

    // Also check enclosing usages — always prefer usage over def
    const enclosingUsage2 = findOwnerUsage(usagePos, match.index);
    if (enclosingUsage2) {
      ownerPos = enclosingUsage2.start;
      ownerNode = enclosingUsage2.node;
    }

    const usagePkg = findOwnerPackage(usagePos);
    const ownerName = ownerNode ? ownerNode.name : usagePkg ? usagePkg.name : '_top';

    // Skip if already registered under this owner
    if (nodeIndex.has(`${ownerName}.${usageName}`)) continue;
    // Skip if a node with same name+kind already exists under a different (more specific) owner
    // AND that node's source range overlaps this match's position (same declaration, different owner resolution)
    const dedupLine = lineCol(source, usagePos).line;
    const alreadyOwnedElsewhere = [...nodeIndex.entries()].some(([k, v]) =>
      v.name === usageName && v.kind === `${keyword.charAt(0).toUpperCase()}${keyword.slice(1)}Usage` && k.endsWith(`.${usageName}`) && k !== `${ownerName}.${usageName}`
      && v.range && (v.range.start.line + 1) === dedupLine
    );
    if (alreadyOwnedElsewhere) continue;

    if (ownerNode && ownerNode.kind.endsWith('Definition')) {
      ownerNode.attributes.push({ name: usageName, type: undefined, value: isRef ? `ref ${keyword}` : keyword, ...(isDerived ? { isDerived: true } : {}) });
    }

    const usageKind = `${keyword.charAt(0).toUpperCase()}${keyword.slice(1)}Usage` as SysMLNodeKind;
    const usageId = makeId('usage', `${ownerName}_${usageName}`);

    const { line: usageLine, column: usageCol } = lineCol(source, usagePos);
    const usageBlockEndIdx = findBlockEnd(clean, match.index + match[0].length - 1);
    const { line: usageEndLine, column: usageEndCol } = lineCol(source, usageBlockEndIdx);
    const isParallel2 = /parallel\s*[{;]/.test(fullMatch);
    const usageNode: SysMLNode = {
      id: usageId,
      kind: usageKind,
      name: usageName,
      ...(isRef ? { isRef: true } : {}),
      ...(isDerived ? { isDerived: true } : {}),
      ...(isParallel2 ? { isParallel: true } : {}),
      children: [], attributes: [], connections: [],
      range: {
        start: { line: usageLine - 1, character: usageCol - 1 },
        end:   { line: usageEndLine - 1, character: usageEndCol - 1 },
      },
    };

    nodes.push(usageNode);
    nodeIndex.set(`${ownerName}.${usageName}`, usageNode);
    if (!nodeIndex.has(usageName)) nodeIndex.set(usageName, usageNode);

    // Determine the actual owner — re-check by scanning the source text for enclosing braces
    let actualOwnerId = ownerNode ? ownerNode.id : usagePkg?.id;
    if (!enclosingUsage2) {
      // Direct brace-depth scan: find the nearest enclosing { } that belongs to a known usage
      let bestUp: { name: string; start: number } | undefined;
      // First try usagePositions
      for (const up of usagePositions) {
        if (up.start === match.index) continue;
        if (usagePos > up.start && usagePos < up.end) {
          if (!bestUp || up.start > bestUp.start) bestUp = up;
        }
      }
      // Fallback: scan backward in the clean text to find the nearest unclosed '{' that
      // belongs to a usage keyword, then find the node for that usage
      if (!bestUp) {
        let depth = 0;
        for (let i = usagePos - 1; i >= 0; i--) {
          if (clean[i] === '}') depth++;
          if (clean[i] === '{') {
            if (depth > 0) { depth--; continue; }
            // Found an unclosed '{' — check if it's preceded by a usage keyword + name
            const before = clean.slice(Math.max(0, i - 200), i);
            const usageMatch = before.match(/\b(?:state|part|action|port|item)\s+(\w+)\s*(?::\s*[\w:]+\s*)?(?:parallel\s*)?$/);
            if (usageMatch) {
              const parentName = usageMatch[1];
              // Find this in usagePositions
              const parentUp = usagePositions.find(up => up.name === parentName && up.start < i);
              if (parentUp) { bestUp = parentUp; break; }
            }
          }
        }
      }
      if (bestUp) {
        const parentNode = nodeIndex.get(bestUp.name) ??
          nodeIndex.get(`${findOwnerDef(bestUp.start)?.name ?? ''}.${bestUp.name}`) ??
          nodeIndex.get(`${usagePkg?.name ?? ''}.${bestUp.name}`);
        if (parentNode) {
          actualOwnerId = parentNode.id;
          nodeIndex.set(`${bestUp.name}.${usageName}`, usageNode);
        }
      }
    }

    if (actualOwnerId) {
      connections.push({
        id: makeId('owns', `${ownerName}_${usageName}`),
        sourceId: actualOwnerId,
        targetId: usageId,
        kind: isRef ? 'noncomposite' : 'composition',
        name: '',
      });
    }
  }

  // ── 2a-multi. Extract multi-word usages (use case, analysis case, verification case) ──

  const multiWordUsages: [RegExp, RegExp, string, string][] = [
    [USE_CASE_USAGE_PATTERN, USE_CASE_UNTYPED_PATTERN, 'UseCaseUsage', 'use case'],
    [ANALYSIS_CASE_USAGE_PATTERN, ANALYSIS_CASE_UNTYPED_PATTERN, 'AnalysisCaseUsage', 'analysis case'],
    [VERIFICATION_CASE_USAGE_PATTERN, VERIFICATION_CASE_UNTYPED_PATTERN, 'VerificationCaseUsage', 'verification case'],
  ];

  for (const [typedPat, untypedPat, kind, displayKw] of multiWordUsages) {
    // Typed: `use case driveVehicle : DriveVehicle { }`
    typedPat.lastIndex = 0;
    while ((match = typedPat.exec(clean)) !== null) {
      const [, rawName, typeName] = match;
      const usageName = dequote(rawName, nameMap);
      const usagePos = match.index;

      let ownerNode: SysMLNode | undefined = findOwnerDef(usagePos);
      let ownerPos = ownerNode ? defPositions.find(d => d.name === ownerNode!.name)?.start ?? -1 : -1;
      const encUsage = findOwnerUsage(usagePos, match.index);
      if (encUsage && encUsage.start > ownerPos) { ownerNode = encUsage.node; }

      const usagePkg = findOwnerPackage(usagePos);
      const ownerName = ownerNode ? ownerNode.name : usagePkg ? usagePkg.name : '_top';

      if (nodeIndex.has(`${ownerName}.${usageName}`)) continue;

      const typeSimple = simpleName(typeName);
      if (ownerNode && ownerNode.kind.endsWith('Definition')) {
        ownerNode.attributes.push({ name: usageName, type: typeSimple, value: displayKw });
      }

      const usageId = makeId('usage', `${ownerName}_${usageName}`);
      const { line: uL, column: uC } = lineCol(source, usagePos);
      const uEnd = findBlockEnd(clean, match.index + match[0].length - 1);
      const { line: uEL, column: uEC } = lineCol(source, uEnd);

      const usageNode: SysMLNode = {
        id: usageId, kind: kind as SysMLNodeKind, name: usageName, qualifiedName: typeSimple,
        children: [], attributes: [], connections: [],
        range: { start: { line: uL - 1, character: uC - 1 }, end: { line: uEL - 1, character: uEC - 1 } },
      };
      nodes.push(usageNode);
      nodeIndex.set(`${ownerName}.${usageName}`, usageNode);
      if (!nodeIndex.has(usageName)) nodeIndex.set(usageName, usageNode);

      if (ownerNode || usagePkg) {
        connections.push({ id: makeId('owns', `${ownerName}_${usageName}`), sourceId: (ownerNode ?? usagePkg!).id, targetId: usageId, kind: 'composition', name: '' });
      }
      const typeNode = resolveType(typeName);
      if (typeNode) {
        connections.push({ id: makeId('typeref', `${usageName}_${typeName}`), sourceId: usageId, targetId: typeNode.id, kind: 'typereference', name: '' });
      }
    }

    // Untyped: `use case driveVehicle { }`
    untypedPat.lastIndex = 0;
    while ((match = untypedPat.exec(clean)) !== null) {
      const [, rawName] = match;
      const usageName = dequote(rawName, nameMap);
      const usagePos = match.index;

      let ownerNode: SysMLNode | undefined = findOwnerDef(usagePos);
      let ownerPos = ownerNode ? defPositions.find(d => d.name === ownerNode!.name)?.start ?? -1 : -1;
      const encUsage = findOwnerUsage(usagePos, match.index);
      if (encUsage && encUsage.start > ownerPos) { ownerNode = encUsage.node; }

      const usagePkg = findOwnerPackage(usagePos);
      const ownerName = ownerNode ? ownerNode.name : usagePkg ? usagePkg.name : '_top';

      if (nodeIndex.has(`${ownerName}.${usageName}`)) continue;

      if (ownerNode && ownerNode.kind.endsWith('Definition')) {
        ownerNode.attributes.push({ name: usageName, type: undefined, value: displayKw });
      }

      const usageId = makeId('usage', `${ownerName}_${usageName}`);
      const { line: uL, column: uC } = lineCol(source, usagePos);
      const uEnd = findBlockEnd(clean, match.index + match[0].length - 1);
      const { line: uEL, column: uEC } = lineCol(source, uEnd);

      const usageNode: SysMLNode = {
        id: usageId, kind: kind as SysMLNodeKind, name: usageName,
        children: [], attributes: [], connections: [],
        range: { start: { line: uL - 1, character: uC - 1 }, end: { line: uEL - 1, character: uEC - 1 } },
      };
      nodes.push(usageNode);
      nodeIndex.set(`${ownerName}.${usageName}`, usageNode);
      if (!nodeIndex.has(usageName)) nodeIndex.set(usageName, usageNode);

      if (ownerNode || usagePkg) {
        connections.push({ id: makeId('owns', `${ownerName}_${usageName}`), sourceId: (ownerNode ?? usagePkg!).id, targetId: usageId, kind: 'composition', name: '' });
      }
    }
  }

  // ── 2b. Extract attribute = value assignments ───────────────────────────

  ATTRIBUTE_VALUE_PATTERN.lastIndex = 0;

  while ((match = ATTRIBUTE_VALUE_PATTERN.exec(clean)) !== null) {
    const [, rawAttrName, attrType, attrValue] = match;
    const attrName = dequote(rawAttrName, nameMap);

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
    const [, direction, keyword, rawParamName, typeName] = match;
    const paramName = dequote(rawParamName, nameMap);

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
      ownerIsPortOrActionUsage: ownerNode.kind === 'PortUsage' || ownerNode.kind === 'ActionUsage' || ownerNode.kind === 'PerformActionUsage' || ownerNode.kind === 'StateUsage' || ownerNode.kind === 'ExhibitStateUsage',
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
    const [, direction, keyword, rawParamName] = match;
    const paramName = dequote(rawParamName, nameMap);

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
      ownerIsPortOrActionUsage: ownerNode.kind === 'PortUsage' || ownerNode.kind === 'ActionUsage' || ownerNode.kind === 'PerformActionUsage' || ownerNode.kind === 'StateUsage' || ownerNode.kind === 'ExhibitStateUsage',
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

  // ── 2e-pre. Conjugated port usages: port p : ~PortDef; ──────────────────
  CONJUGATED_PORT_PATTERN.lastIndex = 0;
  while ((match = CONJUGATED_PORT_PATTERN.exec(clean)) !== null) {
    const [, rawPortName, typeName] = match;
    const portName = dequote(rawPortName, nameMap);
    const usagePos = match.index;
    let ownerNode: SysMLNode | undefined = findOwnerDef(usagePos);
    const enclosingUsage = findOwnerUsage(usagePos, match.index);
    if (enclosingUsage && (!ownerNode || enclosingUsage.start > (defPositions.find(d => d.name === ownerNode!.name)?.start ?? -1))) {
      ownerNode = enclosingUsage.node;
    }
    const usagePkg = findOwnerPackage(usagePos);
    const ownerName = ownerNode ? ownerNode.name : usagePkg ? usagePkg.name : '_top';
    if (nodeIndex.has(`${ownerName}.${portName}`)) continue;
    const typeSimple = simpleName(typeName);
    if (ownerNode && ownerNode.kind.endsWith('Definition')) {
      ownerNode.attributes.push({ name: portName, type: `~${typeSimple}`, value: 'port' });
    }
    const portId = makeId('usage', `${ownerName}_${portName}`);
    const { line: pL, column: pC } = lineCol(source, usagePos);
    const pEnd = findBlockEnd(clean, match.index + match[0].length - 1);
    const { line: pEL, column: pEC } = lineCol(source, pEnd);
    const portNode: SysMLNode = {
      id: portId, kind: 'PortUsage', name: portName, qualifiedName: `~${typeSimple}`,
      children: [], attributes: [], connections: [],
      range: { start: { line: pL - 1, character: pC - 1 }, end: { line: pEL - 1, character: pEC - 1 } },
    };
    nodes.push(portNode);
    nodeIndex.set(`${ownerName}.${portName}`, portNode);
    if (!nodeIndex.has(portName)) nodeIndex.set(portName, portNode);
    if (ownerNode || usagePkg) {
      connections.push({ id: makeId('owns', `${ownerName}_${portName}`), sourceId: (ownerNode ?? usagePkg!).id, targetId: portId, kind: 'composition', name: '' });
    }
    // Type reference to the original port def (without ~)
    const typeNode = resolveType(typeName);
    if (typeNode) {
      connections.push({ id: makeId('typeref', `${portName}_${typeSimple}`), sourceId: portId, targetId: typeNode.id, kind: 'typereference', name: '' });
    }
  }

  // ── 2e. Specialization operators on usages: :> (subsets), :>> (redefines), ::> (references) ──

  type SpecOpKind = 'subsetting' | 'redefinition' | 'referencesubsetting' | 'crossing';
  const specOpSpecs: [RegExp, string, SpecOpKind, string][] = [
    [SUBSETTING_PATTERN,          ':>',  'subsetting',          '«subsets»'],
    [REDEFINITION_PATTERN,        ':>>', 'redefinition',        '«redefines»'],
    [REFERENCE_SUBSETTING_PATTERN,'::>', 'referencesubsetting', '«references»'],
    [CROSSING_PATTERN,            '=>',  'crossing',            '«crosses»'],
  ];

  for (const [pattern, op, connKind, label] of specOpSpecs) {
    pattern.lastIndex = 0;
    while ((match = pattern.exec(clean)) !== null) {
      const [, keyword, rawUsageName, multBefore, typeName, targetName, multAfter] = match;
      const mult = multBefore || multAfter || undefined;
      const usageName = dequote(rawUsageName, nameMap);
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
        ownerNode.attributes.push({ name: displayName, type: targetSimple, value: `${keyword} ${op}` });
      }
      const usageKind = `${keyword.charAt(0).toUpperCase()}${keyword.slice(1)}Usage` as SysMLNodeKind;
      const usageId = makeId('usage', `${ownerName}_${usageName}`);
      const { line: uL, column: uC } = lineCol(source, usagePos);
      const uEnd = findBlockEnd(clean, match.index + match[0].length - 1);
      const { line: uEL, column: uEC } = lineCol(source, uEnd);
      const usageNode: SysMLNode = {
        id: usageId, kind: usageKind, name: usageName, qualifiedName: targetSimple,
        ...(mult ? { multiplicity: mult } : {}),
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
        connections.push({ id: makeId(connKind, `${usageName}_${targetSimple}`), sourceId: usageId, targetId: targetNode.id, kind: connKind, name: label });
      }
      // For typed redefines/subsets (e.g., `part x : Type :>> y`), also create type reference edge
      if (typeName) {
        const typeNode = resolveType(typeName);
        if (typeNode) {
          connections.push({ id: makeId('typeref', `${usageName}_${simpleName(typeName)}`), sourceId: usageId, targetId: typeNode.id, kind: 'typereference', name: '' });
        }
      }
    }
  }

  // ── 2f. Unnamed redefines: `part redefines cyl[4];` ───────────────────────
  UNNAMED_REDEFINE_PATTERN.lastIndex = 0;
  while ((match = UNNAMED_REDEFINE_PATTERN.exec(clean)) !== null) {
    const [, keyword, targetName, mult] = match;
    const pre = clean.slice(Math.max(0, match.index - 7), match.index);
    if (/\b(inout|in|out)\s+$/.test(pre)) continue;
    // Check if this was already matched by the named REDEFINITION_PATTERN
    // (named redefines have a name before the operator)
    const preFull = clean.slice(Math.max(0, match.index - 30), match.index);
    if (/\w\s*(?::>>\s*|\bredefines\s+)$/.test(preFull)) continue;
    const usagePos = match.index;
    let ownerNode: SysMLNode | undefined = findOwnerDef(usagePos);
    let ownerPos = ownerNode ? defPositions.find(d => d.name === ownerNode!.name)?.start ?? -1 : -1;
    const enclosingUsage = findOwnerUsage(usagePos, match.index);
    if (enclosingUsage && enclosingUsage.start > ownerPos) { ownerNode = enclosingUsage.node; }
    const usagePkg = findOwnerPackage(usagePos);
    const ownerName = ownerNode ? ownerNode.name : usagePkg ? usagePkg.name : '_top';
    const targetSimple = simpleName(targetName);
    const usageName = targetSimple; // unnamed redefine uses the target as the name
    if (nodeIndex.has(`${ownerName}.${usageName}`)) continue;
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
      ...(mult ? { multiplicity: mult } : {}),
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
      connections.push({ id: makeId('redefinition', `${usageName}_${targetSimple}`), sourceId: usageId, targetId: targetNode.id, kind: 'redefinition', name: '«redefines»' });
    }
  }

  // ── 2i. Behavioral: successions, control nodes ─────────────────────────────
  // (perform/exhibit nodes already created in section 2-pre above)

  // ── 2j. Control nodes: fork, join, merge, decide ────────────────────────────

  CONTROL_NODE_PATTERN.lastIndex = 0;
  while ((match = CONTROL_NODE_PATTERN.exec(clean)) !== null) {
    const [, nodeType, rawNodeName] = match;
    const nodeName = dequote(rawNodeName, nameMap);
    const kindMap: Record<string, SysMLNodeKind> = {
      fork: 'ForkNode', join: 'JoinNode', merge: 'MergeNode', decide: 'DecideNode',
    };
    const kind = kindMap[nodeType];
    if (!kind) continue;
    const usagePos = match.index;
    // Find owner to scope the control node
    let ownerNode = findOwnerDef(usagePos);
    const ownerPos = ownerNode ? defPositions.find(d => d.name === ownerNode!.name)?.start ?? -1 : -1;
    const enclosingUsage = findOwnerUsage(usagePos, match.index);
    if (enclosingUsage && enclosingUsage.start > ownerPos) {
      ownerNode = enclosingUsage.node;
    }
    const usagePkg = findOwnerPackage(usagePos);
    const ctrlOwnerName = ownerNode ? ownerNode.name : usagePkg ? usagePkg.name : '_top';
    const id = makeId('control', `${ctrlOwnerName}_${nodeName}`);
    const { line: cL, column: cC } = lineCol(source, usagePos);
    const cEnd = findBlockEnd(clean, match.index + match[0].length - 1);
    const { line: cEL, column: cEC } = lineCol(source, cEnd);
    const controlNode: SysMLNode = {
      id, kind, name: nodeName,
      children: [], attributes: [], connections: [],
      range: { start: { line: cL - 1, character: cC - 1 }, end: { line: cEL - 1, character: cEC - 1 } },
    };
    nodes.push(controlNode);
    // Index under scoped key (owner.name) so same-named nodes in different containers don't collide
    nodeIndex.set(`${ctrlOwnerName}.${nodeName}`, controlNode);
    if (!nodeIndex.has(nodeName)) nodeIndex.set(nodeName, controlNode);
    // Add composition to enclosing owner
    if (ownerNode) {
      connections.push({ id: makeId('owns', `${ownerNode.name}_${nodeName}`), sourceId: ownerNode.id, targetId: id, kind: 'composition', name: '' });
    } else if (usagePkg) {
      connections.push({ id: makeId('owns', `${usagePkg.name}_${nodeName}`), sourceId: usagePkg.id, targetId: id, kind: 'composition', name: '' });
    }
  }

  // ── 2k. Create start/terminate nodes when referenced ────────────────────────

  // Helper: ensure a special node exists (start, done, terminate) scoped to its container.
  // Each action container gets its own start/terminate nodes.
  function ensureSpecialNode(name: string, ownerOffset: number): void {
    // Find the enclosing container to scope the special node
    let ownerNode = findOwnerDef(ownerOffset);
    const ownerDefPos = ownerNode ? defPositions.find(d => d.name === ownerNode!.name)?.start ?? -1 : -1;
    const enclosingUsage = findOwnerUsage(ownerOffset, ownerOffset);
    if (enclosingUsage && enclosingUsage.start > ownerDefPos) {
      ownerNode = enclosingUsage.node;
    }
    const usagePkg = findOwnerPackage(ownerOffset);

    // Scope the node name to the container so each action gets its own start/terminate
    const ownerName = ownerNode ? ownerNode.name : usagePkg ? usagePkg.name : '_top';
    const scopedKey = `${ownerName}__${name}`;
    if (nodeIndex.has(scopedKey)) return;

    const kindMap: Record<string, SysMLNodeKind> = {
      start: 'StartNode', done: 'DoneNode', terminate: 'TerminateNode',
    };
    const kind = kindMap[name] ?? 'ForkNode';
    const id = makeId('control', `${ownerName}_${name}`);
    const { line: sL, column: sC } = lineCol(source, ownerOffset);
    const specialNode: SysMLNode = {
      id, kind, name,
      children: [], attributes: [], connections: [],
      range: { start: { line: sL - 1, character: sC - 1 }, end: { line: sL - 1, character: sC - 1 } },
    };
    nodes.push(specialNode);
    // Register under scoped key (per-container) AND under plain name scoped to offset
    nodeIndex.set(scopedKey, specialNode);
    if (ownerNode) {
      connections.push({ id: makeId('owns', `${ownerNode.name}_${name}`), sourceId: ownerNode.id, targetId: id, kind: 'composition', name: '' });
    } else if (usagePkg) {
      connections.push({ id: makeId('owns', `${usagePkg.name}_${name}`), sourceId: usagePkg.id, targetId: id, kind: 'composition', name: '' });
    }
  }

  // Resolve a node name at a given offset — tries container-scoped lookup first,
  // then falls back to global lookup.
  const SPECIAL_NAMES = new Set(['start', 'done', 'terminate']);
  const BEHAVIOR_LABEL_TO_KIND: Record<string, string> = { 'entry action': 'entry', 'do action': 'do', 'exit action': 'exit' };
  function findOwnerNameAtOffset(offset: number): string {
    let owner = findOwnerDef(offset);
    const ownerDefPos = owner ? defPositions.find(d => d.name === owner!.name)?.start ?? -1 : -1;
    const enc = findOwnerUsage(offset, offset);
    if (enc && enc.start > ownerDefPos) owner = enc.node;
    const pkg = findOwnerPackage(offset);
    return owner ? owner.name : pkg ? pkg.name : '_top';
  }
  function resolveNodeAtOffset(name: string, offset: number): SysMLNode | undefined {
    const ownerName = findOwnerNameAtOffset(offset);
    // Special nodes (start/done/terminate) are stored with __ separator
    if (SPECIAL_NAMES.has(name)) {
      return nodeIndex.get(`${ownerName}__${name}`);
    }
    // Behavior action labels (entry action, do action, exit action) → resolve to behavior node
    if (BEHAVIOR_LABEL_TO_KIND[name]) {
      return nodeIndex.get(`${ownerName}__${BEHAVIOR_LABEL_TO_KIND[name]}`);
    }
    // Regular nodes: try scoped name first (owner.name), then global fallback
    return nodeIndex.get(`${ownerName}.${name}`) ?? nodeIndex.get(name);
  }

  // ── 2l. Successions ───────────────────────────────────────────────────────

  // Pre-scan: collect all transition statement ranges so succession/then don't double-match
  const transitionRanges: { start: number; end: number }[] = [];
  {
    // Named transitions
    const trScan = new RegExp(TRANSITION_NAMED_PATTERN.source, 'g');
    let trm: RegExpExecArray | null;
    while ((trm = trScan.exec(clean)) !== null) {
      const afterName = clean.indexOf(trm[1], trm.index) + trm[1].length;
      let si = afterName;
      while (si < clean.length && clean[si] !== ';' && clean[si] !== '{') si++;
      transitionRanges.push({ start: trm.index, end: findBlockEnd(clean, si) });
    }
    // Anonymous transitions
    const trAnonScan = new RegExp(TRANSITION_ANON_PATTERN.source, 'g');
    while ((trm = trAnonScan.exec(clean)) !== null) {
      let si = trm.index + trm[0].length;
      while (si < clean.length && clean[si] !== ';' && clean[si] !== '{') si++;
      transitionRanges.push({ start: trm.index, end: findBlockEnd(clean, si) });
    }
  }
  function isInsideTransition(offset: number): boolean {
    return transitionRanges.some(r => offset >= r.start && offset < r.end);
  }

  // "first X then Y;" — standalone succession
  SUCCESSION_PATTERN.lastIndex = 0;
  while ((match = SUCCESSION_PATTERN.exec(clean)) !== null) {
    // Skip if inside a transition statement — handled by transition parser
    if (isInsideTransition(match.index)) continue;

    const [, rawFromName, rawToName] = match;
    const fromName = dequote(rawFromName, nameMap);
    const toName = dequote(rawToName, nameMap);
    if (SPECIAL_NAMES.has(fromName)) ensureSpecialNode(fromName, match.index);
    if (SPECIAL_NAMES.has(toName)) ensureSpecialNode(toName, match.index);
    const fromNode = resolveNodeAtOffset(fromName, match.index);
    const toNode = resolveNodeAtOffset(toName, match.index);
    if (fromNode && toNode) {
      connections.push({
        id: makeId('succession', `${fromName}_${toName}_${match.index}`),
        sourceId: fromNode.id, targetId: toNode.id,
        kind: 'succession', name: '',
      });
    }
  }

  // "first X;" alone (no then) — in state context this means X is the initial state
  // Creates a start → X succession edge; in action context just ensures the node exists
  {
    const firstAloneRe = /\bfirst\s+(\w+)\s*;/g;
    firstAloneRe.lastIndex = 0;
    let fm: RegExpExecArray | null;
    while ((fm = firstAloneRe.exec(clean)) !== null) {
      const name = dequote(fm[1], nameMap);
      if (name === 'start' || name === 'done' || name === 'terminate') ensureSpecialNode(name, fm.index);

      // Skip if inside a transition statement — handled by transition parser
      if (isInsideTransition(fm.index)) continue;

      // Check if inside a state def — if so, create start → X initial succession
      let insideStateDef = false;
      for (const dp of defPositions) {
        if (fm.index > dp.start && fm.index < dp.end) {
          const node = nodeIndex.get(dp.name);
          if (node && node.kind === 'StateDefinition') {
            insideStateDef = true;
            break;
          }
        }
      }
      if (insideStateDef) {
        ensureSpecialNode('start', fm.index);
        const startNode = resolveNodeAtOffset('start', fm.index);
        const targetNode = resolveNodeAtOffset(name, fm.index);
        if (startNode && targetNode) {
          connections.push({
            id: makeId('initial', `start_${name}_${fm.index}`),
            sourceId: startNode.id, targetId: targetNode.id,
            kind: 'succession', name: '',
          });
        }
      }
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
      if (/\b(?:perform|exhibit|entry|exit|do)\s+$/.test(pre)) continue;
      const endPos = dm.index + dm[0].length;
      declPositions.push({ name: dequote(dm[1], nameMap), end: endPos });
    }
    // perform/exhibit declarations also count for succession resolution
    const performDeclRe = /\b(?:perform|exhibit)\s+(?:action\s+|state\s+)?(\w+)(?:\s*:\s*[\w:]+)?\s*[;{]/g;
    performDeclRe.lastIndex = 0;
    let pdm: RegExpExecArray | null;
    while ((pdm = performDeclRe.exec(clean)) !== null) {
      declPositions.push({ name: dequote(pdm[1], nameMap), end: pdm.index + pdm[0].length });
    }
    // Transition declarations also count
    const transDeclRe = /\btransition\s+(\w+)\s*[;{]/g;
    transDeclRe.lastIndex = 0;
    while ((pdm = transDeclRe.exec(clean)) !== null) {
      declPositions.push({ name: dequote(pdm[1], nameMap), end: pdm.index + pdm[0].length });
    }
    // Also "first start;" counts as a declaration of start
    const firstRe = /\bfirst\s+(\w+)\s*;/g;
    firstRe.lastIndex = 0;
    while ((dm = firstRe.exec(clean)) !== null) {
      declPositions.push({ name: dequote(dm[1], nameMap), end: dm.index + dm[0].length });
    }
    // Entry/exit/do declarations: "entry;" or "entry action name;" — for then-resolution
    // Per spec 7.18.2: "entry; then off;" means succession from entry action to off
    const entryDeclRe = /\b(entry|exit|do)\s*(?:action\s+)?(\w+)?\s*[;{]/g;
    entryDeclRe.lastIndex = 0;
    while ((dm = entryDeclRe.exec(clean)) !== null) {
      const behaviorKind = dm[1];
      const actionName = dm[2] ? dequote(dm[2], nameMap) : undefined;
      const endPos = dm.index + dm[0].length;
      // Only entry actions should serve as sources for "then" successions
      if (behaviorKind === 'entry') {
        // For "entry;" (no name) or "entry action name;", treat as a declaration
        // Resolve entry declaration to its behavior node (not a start node)
        // The behavior node is registered under ownerName__entry in section 1c
        const resolvedName = actionName ?? 'entry action';
        declPositions.push({ name: resolvedName, end: endPos });
      }
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

  // Pre-scan shorthand accept...then positions so inline-then doesn't double-match
  const handledShorthandThenPositions = new Set<number>();
  {
    const preScan = new RegExp(SHORTHAND_ACCEPT_THEN_PATTERN.source, 'g');
    let psm: RegExpExecArray | null;
    while ((psm = preScan.exec(clean)) !== null) {
      const thenIdx = psm.index + psm[0].lastIndexOf('then');
      handledShorthandThenPositions.add(thenIdx);
    }
  }

  INLINE_THEN_PATTERN.lastIndex = 0;
  while ((match = INLINE_THEN_PATTERN.exec(clean)) !== null) {
    // Skip if this "then" is part of "first X then Y;" or "if G then A;"
    if (handledThenPositions.has(match.index)) continue;
    // Skip if inside a transition statement — handled by transition parser
    if (isInsideTransition(match.index)) continue;
    // Check if preceded by "if guard" — those are handled separately
    const preThen = clean.slice(Math.max(0, match.index - 60), match.index);
    if (/\bif\s+[\w.]+\s+$/.test(preThen)) continue;
    // Skip "then" inside "first ... then ..."
    if (/\bfirst\s+\w+\s+$/.test(preThen)) continue;
    // Skip "then" handled by shorthand accept...then parser (position-based)
    if (handledShorthandThenPositions.has(match.index)) continue;

    const toName = dequote(match[1], nameMap);
    if (SPECIAL_NAMES.has(toName)) ensureSpecialNode(toName, match.index);

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
    if (SPECIAL_NAMES.has(fromName)) ensureSpecialNode(fromName, match.index);

    const fromNode = resolveNodeAtOffset(fromName, match.index);
    const toNode = resolveNodeAtOffset(toName, match.index);
    if (fromNode && toNode) {
      connections.push({
        id: makeId('then', `${fromName}_${toName}_${match.index}`),
        sourceId: fromNode.id, targetId: toNode.id,
        kind: 'succession', name: '',
      });
    }
  }

  // Validate that an if-guard expression resolves to a Boolean feature.
  // Emits a warning diagnostic if the guard is not found or not typed as Boolean.
  function validateGuardBoolean(guard: string, matchIndex: number): void {
    // Locate the guard token position within the "if guard then" match
    const ifStr = clean.slice(matchIndex, matchIndex + 3 + guard.length + 10);
    const guardLocalOffset = ifStr.indexOf(guard);
    const guardOffset = matchIndex + (guardLocalOffset >= 0 ? guardLocalOffset : 3);
    const { line, column } = lineCol(source, guardOffset);

    // For dotted expressions (e.g. ping.response.isActive), resolve step by step
    const parts = guard.split('.');
    let currentNode: SysMLNode | undefined;

    // Resolve first part in scope
    const firstName = parts[0];
    currentNode = resolveNodeAtOffset(firstName, matchIndex) ?? nodeIndex.get(firstName);

    if (!currentNode) {
      diagnostics.push({
        severity: 'warning',
        message: `Guard '${guard}' is not defined — 'if' condition must be a Boolean expression`,
        line, column, endLine: line, endColumn: column + guard.length,
      });
      return;
    }

    // Walk dotted path: for each subsequent part, look for an attribute or child with that name
    for (let i = 1; i < parts.length; i++) {
      if (!currentNode) break;
      const part = parts[i];
      // Check attributes of current node
      const foundAttr = currentNode.attributes.find(a => a.name === part) as { name: string; type?: string } | undefined;
      if (foundAttr) {
        // If the attribute has a type, check it at the end
        if (i === parts.length - 1) {
          if (foundAttr.type && foundAttr.type !== 'Boolean') {
            diagnostics.push({
              severity: 'warning',
              message: `Guard '${guard}' has type '${foundAttr.type}' — 'if' condition must be a Boolean expression`,
              line, column, endLine: line, endColumn: column + guard.length,
            });
          }
          return;
        }
        // Try to resolve the attribute's type to continue walking
        const attrTypeNode: SysMLNode | undefined = foundAttr.type ? nodeIndex.get(foundAttr.type) : undefined;
        if (attrTypeNode) { currentNode = attrTypeNode; continue; }
      }
      // Check child nodes
      const childNode: SysMLNode | undefined = nodeIndex.get(`${currentNode.name}.${part}`) ?? nodeIndex.get(part);
      if (childNode) { currentNode = childNode; continue; }
      // Can't resolve further — emit warning
      diagnostics.push({
        severity: 'warning',
        message: `Guard '${guard}': cannot resolve '${part}' — 'if' condition must be a Boolean expression`,
        line, column, endLine: line, endColumn: column + guard.length,
      });
      return;
    }

    // Final resolved node: check its type (qualifiedName carries the type for usage nodes)
    if (currentNode.qualifiedName && currentNode.qualifiedName !== 'Boolean'
        && !currentNode.qualifiedName.endsWith('::Boolean')) {
      diagnostics.push({
        severity: 'warning',
        message: `Guard '${guard}' has type '${currentNode.qualifiedName}' — 'if' condition must be a Boolean expression`,
        line, column, endLine: line, endColumn: column + guard.length,
      });
    } else if (!currentNode.qualifiedName && currentNode.kind !== 'AttributeDefinition') {
      // No type info and not a definition — likely not a boolean
      diagnostics.push({
        severity: 'warning',
        message: `Guard '${guard}' is not typed as Boolean — 'if' condition must be a Boolean expression`,
        line, column, endLine: line, endColumn: column + guard.length,
      });
    }
  }

  // Track positions handled by if-then-else to avoid double-matching
  const handledIfPositions = new Set<number>();

  // "if guard then action; else action2;" — conditional succession with else branch
  IF_THEN_ELSE_PATTERN.lastIndex = 0;
  while ((match = IF_THEN_ELSE_PATTERN.exec(clean)) !== null) {
    if (isInsideTransition(match.index)) continue;
    const [, guard, rawThenName, rawElseName] = match;
    const thenName = dequote(rawThenName, nameMap);
    const elseName = dequote(rawElseName, nameMap);
    const pos = match.index;
    handledIfPositions.add(pos);
    validateGuardBoolean(guard, pos);
    // Find the nearest preceding declaration as the source
    let fromName: string | undefined;
    for (let i = declPositions.length - 1; i >= 0; i--) {
      if (declPositions[i].end <= pos) {
        fromName = declPositions[i].name;
        break;
      }
    }
    if (!fromName) continue;
    const fromNode = resolveNodeAtOffset(fromName, pos);
    const thenNode = resolveNodeAtOffset(thenName, pos);
    const elseNode = resolveNodeAtOffset(elseName, pos);
    if (fromNode && thenNode) {
      connections.push({
        id: makeId('guard', `${fromName}_${thenName}_${match.index}`),
        sourceId: fromNode.id, targetId: thenNode.id,
        kind: 'succession', name: `[${guard}]`,
      });
    }
    if (fromNode && elseNode) {
      connections.push({
        id: makeId('guard', `${fromName}_${elseName}_${match.index}`),
        sourceId: fromNode.id, targetId: elseNode.id,
        kind: 'succession', name: '[else]',
      });
    }
  }

  // "if guard then action;" — conditional succession from nearest preceding decide/node
  IF_THEN_PATTERN.lastIndex = 0;
  while ((match = IF_THEN_PATTERN.exec(clean)) !== null) {
    // Skip if already handled by IF_THEN_ELSE_PATTERN
    if (handledIfPositions.has(match.index)) continue;
    if (isInsideTransition(match.index)) continue;
    const [, guard, rawToName] = match;
    const toName = dequote(rawToName, nameMap);
    const pos = match.index;
    validateGuardBoolean(guard, pos);
    // Find the nearest preceding declaration as the source
    let fromName: string | undefined;
    for (let i = declPositions.length - 1; i >= 0; i--) {
      if (declPositions[i].end <= pos) {
        fromName = declPositions[i].name;
        break;
      }
    }
    if (!fromName) continue;
    const fromNode = resolveNodeAtOffset(fromName, pos);
    const toNode = resolveNodeAtOffset(toName, pos);
    if (fromNode && toNode) {
      connections.push({
        id: makeId('guard', `${fromName}_${toName}_${match.index}`),
        sourceId: fromNode.id, targetId: toNode.id,
        kind: 'succession', name: `[${guard}]`,
      });
    }
  }

  // ── 2l-extra. Transition usages ──────────────────────────────────────────────
  // SysML v2 transition syntax inside state defs:
  //   transition transName first source accept trigger if guard then target;
  //   transition first source accept trigger then target;   (anonymous)
  //   transition transName { first source; accept trigger; if guard; then target; }
  // Components: first=source, accept=trigger, if=guard, do=effect, then=target
  {
    // Helper to parse a transition body and create the succession edge
    function parseTransitionBody(body: string, pos: number, transName: string | null): void {
      const firstMatch = body.match(/\bfirst\s+(\w+)/);
      const thenMatch = body.match(/\bthen\s+(\w+)/);
      // Accept: "accept TriggerName [via port]" or "accept after 5[min]"
      const acceptMatch = body.match(/\baccept\s+(after\s+[\d[\].\w]+|\w+)(?:\s+via\s+(\w+))?/);
      const ifMatch = body.match(/\bif\s+([\w.]+)/);
      const doMatch = body.match(/\bdo\s+(?:action\s+)?(\w+)/);

      const sourceName = firstMatch?.[1] ? dequote(firstMatch[1], nameMap) : undefined;
      const targetName = thenMatch?.[1] ? dequote(thenMatch[1], nameMap) : undefined;
      const triggerText = acceptMatch?.[1] ? dequote(acceptMatch[1], nameMap) : undefined;
      const viaPort = acceptMatch?.[2] ? dequote(acceptMatch[2], nameMap) : undefined;
      const guardExpr = ifMatch?.[1];
      const effectName = doMatch?.[1] ? dequote(doMatch[1], nameMap) : undefined;

      // Build label: "trigger via port [guard] / effect"
      const labelParts: string[] = [];
      if (triggerText) {
        labelParts.push(viaPort ? `${triggerText} via ${viaPort}` : triggerText);
      }
      if (guardExpr) labelParts.push(`[${guardExpr}]`);
      if (effectName) labelParts.push(`/ ${effectName}`);
      const edgeLabel = labelParts.length > 0 ? labelParts.join(' ') : '';

      if (sourceName && targetName) {
        if (SPECIAL_NAMES.has(sourceName)) ensureSpecialNode(sourceName, pos);
        if (SPECIAL_NAMES.has(targetName)) ensureSpecialNode(targetName, pos);
        const fromNode = resolveNodeAtOffset(sourceName, pos);
        const toNode = resolveNodeAtOffset(targetName, pos);
        if (fromNode && toNode) {
          connections.push({
            id: makeId('transition', `${transName ?? 'anon'}_${pos}`),
            sourceId: fromNode.id,
            targetId: toNode.id,
            kind: 'transition',
            name: edgeLabel,
          });
        }
      }

      if (transName) {
        declPositions.push({ name: transName, end: pos + body.length });
      }
    }

    // Named transitions: "transition transName first ... then ...;"
    TRANSITION_NAMED_PATTERN.lastIndex = 0;
    let tm: RegExpExecArray | null;
    while ((tm = TRANSITION_NAMED_PATTERN.exec(clean)) !== null) {
      const transName = dequote(tm[1], nameMap);
      const pos = tm.index;
      // Find the end of the full transition statement (block or semicolon)
      const afterName = clean.indexOf(transName, pos) + transName.length;
      // Scan forward to find the terminating ; or { block
      let scanIdx = afterName;
      while (scanIdx < clean.length && clean[scanIdx] !== ';' && clean[scanIdx] !== '{') scanIdx++;
      const blockEnd = findBlockEnd(clean, scanIdx);
      const body = clean.slice(pos, blockEnd);
      parseTransitionBody(body, pos, transName);
    }

    // Anonymous transitions: "transition first ... then ...;"
    TRANSITION_ANON_PATTERN.lastIndex = 0;
    while ((tm = TRANSITION_ANON_PATTERN.exec(clean)) !== null) {
      const pos = tm.index;
      // Find end of statement
      let scanIdx = pos + tm[0].length;
      while (scanIdx < clean.length && clean[scanIdx] !== ';' && clean[scanIdx] !== '{') scanIdx++;
      const blockEnd = findBlockEnd(clean, scanIdx);
      const body = clean.slice(pos, blockEnd);
      parseTransitionBody(body, pos, null);
    }
  }

  // ── 2l-shorthand. Shorthand transitions: "accept trigger [via port] [if guard] [do effect] then target;"
  // Per SysML v2 spec 7.18.3 (TargetTransitionUsage): source inferred from lexically previous state
  {
    // Build sorted list of state declaration positions for source inference
    const stateDeclPositions: { name: string; end: number; pos: number }[] = [];
    {
      const stateUsageRe = /\bstate\s+(\w+)\s*(?::\s*[\w:]+\s*)?[;{]/g;
      stateUsageRe.lastIndex = 0;
      let sm: RegExpExecArray | null;
      while ((sm = stateUsageRe.exec(clean)) !== null) {
        const pre = clean.slice(Math.max(0, sm.index - 8), sm.index);
        if (/\bdef\s+$/.test(pre) || /\bexhibit\s+$/.test(pre)) continue;
        const blockEnd = findBlockEnd(clean, sm.index + sm[0].length - 1);
        stateDeclPositions.push({ name: dequote(sm[1], nameMap), end: blockEnd, pos: sm.index });
      }
      stateDeclPositions.sort((a, b) => a.end - b.end);
    }

    /** Find the nearest preceding state declaration before the given offset. */
    function findPreviousState(offset: number): string | undefined {
      for (let i = stateDeclPositions.length - 1; i >= 0; i--) {
        if (stateDeclPositions[i].end <= offset) return stateDeclPositions[i].name;
      }
      return undefined;
    }

    SHORTHAND_ACCEPT_THEN_PATTERN.lastIndex = 0;
    let stm: RegExpExecArray | null;
    while ((stm = SHORTHAND_ACCEPT_THEN_PATTERN.exec(clean)) !== null) {
      const pos = stm.index;

      // Skip if inside a full transition statement (already handled)
      if (isInsideTransition(pos)) continue;

      // Must be inside a state def or state usage body
      let insideState = false;
      for (const dp of defPositions) {
        if (pos > dp.start && pos < dp.end) {
          const node = nodeIndex.get(dp.name);
          if (node && (node.kind === 'StateDefinition' || node.kind === 'StateUsage')) {
            insideState = true;
            break;
          }
        }
      }
      if (!insideState) {
        // Also check usagePositions for state usages with bodies
        for (const up of usagePositions) {
          if (pos > up.start && pos < up.end) {
            const node = nodeIndex.get(up.name) ??
              nodeIndex.get(`${findOwnerNameAtOffset(up.start)}.${up.name}`);
            if (node && (node.kind === 'StateUsage' || node.kind === 'StateDefinition')) {
              insideState = true;
              break;
            }
          }
        }
      }
      if (!insideState) continue;

      const [, bodyText, rawTargetName] = stm;
    const targetName = dequote(rawTargetName, nameMap);

      // Two-step: parse components from the body between "accept" and "then"
      const acceptMatch = bodyText.match(/^(after\s+[\d\[\].\w]+|\w+)/);
      const viaMatch = bodyText.match(/\bvia\s+(\w+)/);
      const ifMatch = bodyText.match(/\bif\s+([\w.]+)/);
      const doMatch = bodyText.match(/\bdo\s+(?:action\s+)?(\w+)/);
      const triggerText = acceptMatch?.[1]?.trim();
      const viaPort = viaMatch?.[1];
      const guardExpr = ifMatch?.[1];
      const effectName = doMatch?.[1];

      // Track this "then" position so INLINE_THEN_PATTERN skips it
      const thenPos = pos + stm[0].lastIndexOf('then');
      handledShorthandThenPositions.add(thenPos);

      // Infer source from the nearest preceding state declaration
      const sourceName = findPreviousState(pos);
      if (!sourceName || !targetName) continue;

      if (SPECIAL_NAMES.has(targetName)) ensureSpecialNode(targetName, pos);

      const fromNode = resolveNodeAtOffset(sourceName, pos);
      const toNode = resolveNodeAtOffset(targetName, pos);
      if (fromNode && toNode) {
        const labelParts: string[] = [];
        if (triggerText) labelParts.push(viaPort ? `${triggerText} via ${viaPort}` : triggerText);
        if (guardExpr) labelParts.push(`[${guardExpr}]`);
        if (effectName) labelParts.push(`/ ${effectName}`);

        connections.push({
          id: makeId('shorthand-trans', `${sourceName}_${targetName}_${pos}`),
          sourceId: fromNode.id,
          targetId: toNode.id,
          kind: 'transition',
          name: labelParts.join(' '),
        });
      }
    }
  }

  // ── 2m. Relationships: satisfy, verify, allocate, bind ─────────────────────

  type RelKind = SysMLConnection['kind'];
  const relSpecs: [RegExp, RelKind, string, boolean][] = [
    // [pattern, connKind, label, reverseDirection]
    [SATISFY_PATTERN,  'satisfy',  '«satisfy»',  true],   // partNode → reqNode
    [VERIFY_PATTERN,   'verify',   '«verify»',   true],
    [ALLOCATE_PATTERN, 'allocate', '«allocate»',  false],
    [BIND_PATTERN,     'bind',     '=',           false],
  ];
  for (const [pattern, connKind, label, reverse] of relSpecs) {
    pattern.lastIndex = 0;
    while ((match = pattern.exec(clean)) !== null) {
      const a = dequote(match[1].split('.')[0], nameMap), b = dequote(match[2].split('.')[0], nameMap);
      const aNode = nodeIndex.get(a), bNode = nodeIndex.get(b);
      if (aNode && bNode) {
        const [src, tgt] = reverse ? [bNode, aNode] : [aNode, bNode];
        connections.push({ id: makeId(connKind, `${a}_${b}_${match.index}`), sourceId: src.id, targetId: tgt.id, kind: connKind, name: label });
      }
    }
  }

  // ── 0e-deferred. Create "about" annotation and doc ownership edges ──

  for (const ec of extractedComments) {
    const isDoc = ec.isDoc ?? false;
    const prefix = isDoc ? 'doc' : 'comment';
    const commentName = ec.name ?? (ec.about ? `about ${ec.about}` : `${prefix}_${ec.index}`);
    const commentId = makeId(prefix, `${commentName}_${ec.index}`);

    // "about" annotation edges
    if (ec.about) {
      const targetNode = nodeIndex.get(ec.about) ?? nodeIndex.get(dequote(ec.about, nameMap));
      if (targetNode) {
        connections.push({
          id: makeId('annotate', `${commentName}_${ec.about}_${ec.index}`),
          sourceId: commentId,
          targetId: targetNode.id,
          kind: 'annotate',
          name: '«annotate»',
        });
      }
    }

    // Doc ownership: attach to nearest enclosing definition or package
    if (isDoc && !aliasRanges.some(a => ec.index > a.start && ec.index < a.end)) {
      const ownerDef = findOwnerDef(ec.index);
      if (ownerDef) {
        connections.push({
          id: makeId('owns', `${ownerDef.name}_${commentName}_${ec.index}`),
          sourceId: ownerDef.id,
          targetId: commentId,
          kind: 'composition',
          name: '',
        });
      } else {
        const ownerPkg = findOwnerPackage(ec.index);
        if (ownerPkg) {
          connections.push({
            id: makeId('pkg-member', `${ownerPkg.name}_${commentName}_${ec.index}`),
            sourceId: ownerPkg.id,
            targetId: commentId,
            kind: 'composition',
            name: '',
          });
        }
      }
    }
  }

  // ── 3. Extract explicit connect statements ──────────────────────────────

  CONNECT_PATTERN.lastIndex = 0;

  while ((match = CONNECT_PATTERN.exec(clean)) !== null) {
    const [, rawFrom, rawTo] = match;
    const from = dequote(rawFrom, nameMap);
    const to = dequote(rawTo, nameMap);
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

  // ── 4. Extract flow, succession flow, and message statements ────────────

  // Helper to resolve a dotted name like "action1.item1" to the root node
  function resolveFlowEnd(raw: string): SysMLNode | undefined {
    const root = raw.split('.')[0];
    return nodeIndex.get(root);
  }

  // Streaming flow: flow [name] [of Payload] [from] X.out to Y.in;
  FLOW_PATTERN.lastIndex = 0;
  while ((match = FLOW_PATTERN.exec(clean)) !== null) {
    // Skip if preceded by "succession " — handled by SUCCESSION_FLOW_PATTERN
    const pre = clean.slice(Math.max(0, match.index - 13), match.index);
    if (/\bsuccession\s+$/.test(pre)) continue;
    const [, flowName, payload, rawFrom, rawTo] = match;
    const fromStr = dequote(rawFrom, nameMap);
    const toStr = dequote(rawTo, nameMap);
    const sourceNode = resolveFlowEnd(fromStr);
    const targetNode = resolveFlowEnd(toStr);
    if (!sourceNode || !targetNode) continue;
    const fromParts2 = fromStr.split('.');
    const toParts2 = toStr.split('.');
    const hasPortEndpoints = fromParts2.length > 1 && toParts2.length > 1;
    // Label: keep payload/name labels; skip generic «flow» when pins already show item names
    let label: string | undefined;
    if (payload) {
      label = `«flow» of ${simpleName(payload)}`;
    } else if (flowName) {
      label = `«flow» ${flowName}`;
    } else if (hasPortEndpoints) {
      label = undefined; // pins show item names, no need for redundant label
    } else {
      label = '«flow»';
    }
    const flowStart = lineCol(source, match.index);
    const flowEnd = lineCol(source, match.index + match[0].length);
    connections.push({
      id: makeId('flow', `${sourceNode.id}_${targetNode.id}_${match.index}`),
      sourceId: sourceNode.id, targetId: targetNode.id,
      kind: 'flow', name: label,
      sourcePort: hasPortEndpoints ? fromParts2.slice(1).join('.') : undefined,
      targetPort: hasPortEndpoints ? toParts2.slice(1).join('.') : undefined,
      range: {
        start: { line: flowStart.line - 1, character: flowStart.column - 1 },
        end: { line: flowEnd.line - 1, character: flowEnd.column - 1 },
      },
    });
  }

  // Succession flow: succession flow [name] [of Payload] [from] X to Y;
  SUCCESSION_FLOW_PATTERN.lastIndex = 0;
  while ((match = SUCCESSION_FLOW_PATTERN.exec(clean)) !== null) {
    const [, flowName, payload, rawFrom, rawTo] = match;
    const sourceNode = resolveFlowEnd(dequote(rawFrom, nameMap));
    const targetNode = resolveFlowEnd(dequote(rawTo, nameMap));
    if (!sourceNode || !targetNode) continue;
    const label = payload ? `«succession flow» of ${simpleName(payload)}` : (flowName ? `«succession flow» ${flowName}` : '«succession flow»');
    connections.push({
      id: makeId('succflow', `${sourceNode.id}_${targetNode.id}_${match.index}`),
      sourceId: sourceNode.id, targetId: targetNode.id,
      kind: 'successionflow', name: label,
    });
  }

  // Message: message [name] [of Payload] from X to Y;
  MESSAGE_PATTERN.lastIndex = 0;
  while ((match = MESSAGE_PATTERN.exec(clean)) !== null) {
    const [, msgName, payload, rawFrom, rawTo] = match;
    const sourceNode = resolveFlowEnd(dequote(rawFrom, nameMap));
    const targetNode = resolveFlowEnd(dequote(rawTo, nameMap));
    if (!sourceNode || !targetNode) continue;
    const label = payload ? `«message» of ${simpleName(payload)}` : (msgName ? `«message» ${msgName}` : '«message»');
    connections.push({
      id: makeId('message', `${sourceNode.id}_${targetNode.id}_${match.index}`),
      sourceId: sourceNode.id, targetId: targetNode.id,
      kind: 'message', name: label,
    });
  }

  // Deduplicate connections (same source+target+kind)
  const seen = new Set<string>();
  const uniqueConnections = connections.filter((c) => {
    const key = `${c.sourceId}→${c.targetId}:${c.kind}`;
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
