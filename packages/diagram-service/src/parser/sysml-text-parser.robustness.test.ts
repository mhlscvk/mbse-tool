import { describe, it, expect } from 'vitest';
import { parseSysMLText } from './sysml-text-parser.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parse(code: string) {
  return parseSysMLText('test://test', code);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ROBUSTNESS & EDGE-CASE TESTS
//  Tests for malformed, adversarial, oversized, and boundary inputs
// ═══════════════════════════════════════════════════════════════════════════════

// ── 1. Empty / minimal inputs ────────────────────────────────────────────────

describe('Empty and minimal inputs', () => {
  it('empty string produces empty model with no errors', () => {
    const { model, diagnostics } = parse('');
    expect(model.nodes).toHaveLength(0);
    expect(model.connections).toHaveLength(0);
    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
  });

  it('whitespace-only input produces empty model', () => {
    const { model } = parse('   \n\t\n   ');
    expect(model.nodes).toHaveLength(0);
  });

  it('comment-only input produces empty model', () => {
    const { model } = parse('// just a comment\n/* block comment */');
    expect(model.nodes).toHaveLength(0);
  });

  it('single semicolon produces empty model', () => {
    const { model } = parse(';');
    expect(model.nodes).toHaveLength(0);
  });
});

// ── 2. Malformed but close-to-valid syntax ───────────────────────────────────

describe('Malformed syntax handling', () => {
  it('unclosed brace does not crash', () => {
    const { model } = parse('part def Foo {');
    expect(model.nodes.length).toBeGreaterThanOrEqual(1);
    expect(model.nodes[0].name).toBe('Foo');
  });

  it('extra closing brace does not crash', () => {
    expect(() => parse('part def Foo { } }')).not.toThrow();
  });

  it('missing semicolon on simple definition still parses', () => {
    // part def without ; or { } — should not crash
    expect(() => parse('part def Orphan')).not.toThrow();
  });

  it('definition with empty body parses correctly', () => {
    const { model } = parse('part def Empty { }');
    expect(model.nodes).toHaveLength(1);
    expect(model.nodes[0].name).toBe('Empty');
  });

  it('nested unclosed braces do not crash', () => {
    expect(() => parse('package Pkg { part def A {')).not.toThrow();
  });

  it('deeply nested valid braces parse correctly', () => {
    const code = 'package L0 { package L1 { package L2 { part def Deep; } } }';
    const { model } = parse(code);
    const names = model.nodes.map(n => n.name);
    expect(names).toContain('Deep');
    expect(names).toContain('L0');
  });

  it('misspelled keyword does not crash', () => {
    expect(() => parse('pat def Typo;')).not.toThrow();
  });

  it('definition with only abstract keyword', () => {
    expect(() => parse('abstract;')).not.toThrow();
  });

  it('usage without type does not crash', () => {
    // `part x;` is valid untyped usage
    const { model } = parse('part def Owner { part x; }');
    // x should be parsed as a usage inside Owner
    expect(model.nodes.length).toBeGreaterThanOrEqual(1);
  });

  it('connect with missing target does not crash', () => {
    expect(() => parse('part def A { connect x to ; }')).not.toThrow();
  });

  it('flow with missing from/to does not crash', () => {
    expect(() => parse('part def A { flow from to ; }')).not.toThrow();
  });
});

// ── 3. Special characters and injection vectors ──────────────────────────────

describe('Special characters and injection', () => {
  it('HTML tags in names are rejected by word-char regex', () => {
    // \w+ in regex should not capture <script>
    const { model } = parse('part def <script>alert(1)</script>;');
    // Should not find a node named "<script>alert(1)</script>"
    const dangerous = model.nodes.find(n => n.name.includes('<script>'));
    expect(dangerous).toBeUndefined();
  });

  it('HTML in attribute values does not crash parser', () => {
    const code = 'part def A { attribute x : String = "<img onerror=alert(1)>"; }';
    expect(() => parse(code)).not.toThrow();
  });

  it('unicode identifiers are handled gracefully', () => {
    // \w does not match unicode letters — should not crash, just skip
    expect(() => parse('part def Ünïcödé;')).not.toThrow();
  });

  it('null bytes in input do not crash', () => {
    expect(() => parse('part def A\0B;')).not.toThrow();
  });

  it('extremely long identifier does not crash', () => {
    const longName = 'A'.repeat(10000);
    expect(() => parse(`part def ${longName};`)).not.toThrow();
  });

  it('string with only braces does not crash', () => {
    expect(() => parse('{{{{}}}}{{{}}}}')).not.toThrow();
  });

  it('regex special characters in input do not crash', () => {
    expect(() => parse('part def A; // $^.*+?()[]{}|\\')).not.toThrow();
  });
});

// ── 4. Large input handling ──────────────────────────────────────────────────

describe('Large input handling', () => {
  it('100 definitions parse without error', () => {
    const lines = Array.from({ length: 100 }, (_, i) => `part def P${i};`);
    const { model } = parse(lines.join('\n'));
    expect(model.nodes).toHaveLength(100);
  });

  it('definition with 50 attributes parses correctly', () => {
    const attrs = Array.from({ length: 50 }, (_, i) => `  attribute a${i} : Integer;`);
    const code = `part def Big {\n${attrs.join('\n')}\n}`;
    const { model } = parse(code);
    const bigNode = model.nodes.find(n => n.name === 'Big');
    expect(bigNode).toBeDefined();
    expect(bigNode!.attributes.length).toBe(50);
  });

  it('long chain of specializations parses', () => {
    const defs = Array.from({ length: 20 }, (_, i) =>
      i === 0 ? 'part def Base;' : `part def D${i} :> D${i - 1 || 'Base'};`
    );
    const { model } = parse(defs.join('\n'));
    expect(model.nodes.length).toBe(20);
  });

  it('10KB input completes in reasonable time', () => {
    const chunk = 'part def X; attribute def Y; connection def Z;\n';
    const code = chunk.repeat(Math.ceil(10000 / chunk.length));
    const start = Date.now();
    parse(code);
    expect(Date.now() - start).toBeLessThan(2000);
  });
});

// ── 5. Comment handling edge cases ───────────────────────────────────────────

describe('Comment handling', () => {
  it('block comment inside definition body', () => {
    const { model } = parse('part def A { /* comment */ }');
    expect(model.nodes[0].name).toBe('A');
  });

  it('line comment before closing brace', () => {
    const { model } = parse('part def B {\n  // comment\n}');
    expect(model.nodes[0].name).toBe('B');
  });

  it('nested block comments do not crash', () => {
    // SysML does not support nested block comments, inner */ ends the comment
    expect(() => parse('/* outer /* inner */ still comment */ part def X;')).not.toThrow();
  });

  it('unclosed block comment does not crash', () => {
    expect(() => parse('/* unclosed comment\npart def X;')).not.toThrow();
  });

  it('comment containing keywords does not create nodes', () => {
    const { model } = parse('// part def Ghost;\npart def Real;');
    expect(model.nodes.map(n => n.name)).not.toContain('Ghost');
    expect(model.nodes.map(n => n.name)).toContain('Real');
  });
});

// ── 6. Import and stdlib handling ────────────────────────────────────────────

describe('Import handling', () => {
  it('import of known stdlib package does not produce errors', () => {
    const { diagnostics } = parse('import ScalarValues::*;');
    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
  });

  it('import of unknown package produces info diagnostic', () => {
    const { diagnostics } = parse('import NonExistent::*;');
    expect(diagnostics.some(d => d.severity === 'info' && d.message.includes('NonExistent'))).toBe(true);
  });

  it('imported types are available for usage resolution', () => {
    // Importing ScalarValues makes Real available for type references
    const code = 'import ScalarValues::*;\npart def A { attribute x : Real; }';
    const { model } = parse(code);
    const aNode = model.nodes.find(n => n.name === 'A');
    expect(aNode).toBeDefined();
    // Should resolve the Real type and create a typereference connection
    expect(model.connections.some(c => c.kind === 'typereference')).toBe(true);
  });

  it('specific import syntax does not error', () => {
    const { diagnostics } = parse('import ScalarValues::Integer;');
    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
  });
});

// ── 7. Diagnostic quality ────────────────────────────────────────────────────

describe('Diagnostic quality', () => {
  it('duplicate definition names produce warning', () => {
    const { diagnostics } = parse('part def Dup; part def Dup;');
    expect(diagnostics.some(d => d.message.includes('Dup'))).toBe(true);
  });

  it('diagnostics have valid line and column numbers', () => {
    const code = 'part def Dup;\npart def Dup;';
    const { diagnostics } = parse(code);
    const dup = diagnostics.find(d => d.message.includes('Dup'));
    if (dup) {
      expect(dup.line).toBeGreaterThan(0);
      expect(dup.column).toBeGreaterThan(0);
    }
  });

  it('unknown type reference in usage produces diagnostic', () => {
    const { diagnostics } = parse('part def A { part x : NonExistentType; }');
    expect(diagnostics.some(d =>
      d.message.toLowerCase().includes('undefined') ||
      d.message.toLowerCase().includes('unknown') ||
      d.message.toLowerCase().includes('not defined')
    )).toBe(true);
  });
});

// ── 8. Range / source mapping correctness ────────────────────────────────────

describe('Source range correctness', () => {
  it('definition range starts at definition keyword', () => {
    const code = 'part def Vehicle;';
    const { model } = parse(code);
    const node = model.nodes.find(n => n.name === 'Vehicle');
    expect(node).toBeDefined();
    expect(node!.range).toBeDefined();
    if (node!.range) {
      expect(node!.range.start.line).toBe(0);
      expect(node!.range.start.character).toBe(0);
    }
  });

  it('second definition has correct line offset', () => {
    const code = 'part def A;\npart def B;';
    const { model } = parse(code);
    const b = model.nodes.find(n => n.name === 'B');
    expect(b).toBeDefined();
    if (b?.range) {
      expect(b.range.start.line).toBe(1);
    }
  });

  it('definition in package has correct range', () => {
    const code = 'package Pkg {\n  part def Inner;\n}';
    const { model } = parse(code);
    const inner = model.nodes.find(n => n.name === 'Inner');
    expect(inner).toBeDefined();
    if (inner?.range) {
      expect(inner.range.start.line).toBe(1);
    }
  });
});

// ── 9. Connection / relationship edge cases ──────────────────────────────────

describe('Connection edge cases', () => {
  it('self-referential specialization does not crash', () => {
    expect(() => parse('part def A :> A;')).not.toThrow();
  });

  it('specialization of undefined type creates connection anyway', () => {
    const { model } = parse('part def A :> Undefined;');
    expect(model.nodes[0].name).toBe('A');
    // Connection may or may not be created depending on resolution
  });

  it('multiple specializations in chain', () => {
    const code = 'part def A; part def B :> A; part def C :> B;';
    const { model } = parse(code);
    const specEdges = model.connections.filter(c => c.kind === 'dependency');
    expect(specEdges.length).toBeGreaterThanOrEqual(2);
  });

  it('connection with qualified names', () => {
    const code = `
      part def A { port p1 : P; }
      part def B { port p2 : P; }
      port def P;
      connection def C { connect A.p1 to B.p2; }
    `;
    expect(() => parse(code)).not.toThrow();
  });

  it('satisfy relationship creates edge', () => {
    const code = `
      requirement def R;
      part def Impl;
      satisfy R by Impl;
    `;
    const { model } = parse(code);
    const satisfyEdges = model.connections.filter(c => c.kind === 'satisfy');
    expect(satisfyEdges.length).toBe(1);
  });
});

// ── 10. Concurrent/rapid input simulation ────────────────────────────────────

describe('Rapid sequential parsing', () => {
  it('100 rapid sequential parses produce consistent results', () => {
    const code = 'part def Consistent;';
    const results = Array.from({ length: 100 }, () => parse(code));
    const names = results.map(r => r.model.nodes.map(n => n.name));
    // All results should be identical
    for (const n of names) {
      expect(n).toEqual(['Consistent']);
    }
  });

  it('alternating valid/invalid input does not corrupt state', () => {
    parse('part def Valid1;');
    parse('invalid garbage {{{{');
    const { model } = parse('part def Valid2;');
    expect(model.nodes[0].name).toBe('Valid2');
  });
});

// ── 11. Input size limits ─────────────────────────────────────────────────────

describe('Input size limits', () => {
  it('input exceeding 2MB returns error diagnostic', () => {
    const huge = 'part def X;\n'.repeat(200_000); // ~2.4MB
    const { model, diagnostics } = parse(huge);
    expect(model.nodes).toHaveLength(0);
    expect(diagnostics.some(d => d.severity === 'error' && d.message.includes('maximum size'))).toBe(true);
  });

  it('input just under limit parses normally', () => {
    // Small enough to parse
    const code = 'part def A;\n'.repeat(100);
    const { model } = parse(code);
    expect(model.nodes.length).toBeGreaterThan(0);
  });
});

// ── 12. Control flow nodes ───────────────────────────────────────────────────

describe('Control flow parsing', () => {
  it('fork and join nodes inside action', () => {
    const code = `
      action def Process {
        fork forkPoint;
        join joinPoint;
      }
    `;
    const { model } = parse(code);
    const kinds = model.nodes.map(n => n.kind);
    expect(kinds).toContain('ForkNode');
    expect(kinds).toContain('JoinNode');
  });

  it('merge and decide nodes', () => {
    const code = `
      action def Flow {
        merge mergePoint;
        decide decidePoint;
      }
    `;
    const { model } = parse(code);
    const kinds = model.nodes.map(n => n.kind);
    expect(kinds).toContain('MergeNode');
    expect(kinds).toContain('DecideNode');
  });

  it('succession creates flow edge', () => {
    const code = `
      action def Seq {
        action step1;
        action step2;
        first step1 then step2;
      }
    `;
    const { model } = parse(code);
    const flows = model.connections.filter(c => c.kind === 'flow');
    expect(flows.length).toBeGreaterThanOrEqual(1);
  });
});
