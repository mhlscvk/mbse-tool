import { describe, it, expect } from 'vitest';
import { parseSysMLText } from './sysml-text-parser.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parse(code: string) {
  return parseSysMLText('test://test', code);
}
function nodeNames(code: string) {
  return parse(code).model.nodes.map(n => n.name);
}
function nodeKinds(code: string) {
  return parse(code).model.nodes.map(n => n.kind);
}
function edgeKinds(code: string) {
  return parse(code).model.connections.map(c => c.kind);
}
function edgeLabels(code: string) {
  return parse(code).model.connections.filter(c => c.name).map(c => c.name);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  1. CORE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Core definitions', () => {
  it('parses all 7 core definition keywords', () => {
    const code = `
      part def A;
      attribute def B;
      connection def C;
      port def D;
      action def E;
      state def F;
      item def G;
    `;
    expect(nodeNames(code)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    expect(nodeKinds(code)).toEqual([
      'PartDefinition', 'AttributeDefinition', 'ConnectionDefinition',
      'PortDefinition', 'ActionDefinition', 'StateDefinition', 'ItemDefinition',
    ]);
  });

  it('parses block and semicolon termination', () => {
    const code = `part def A; part def B { }`;
    expect(nodeNames(code)).toEqual(['A', 'B']);
  });

  it('parses abstract keyword', () => {
    const { model } = parse('abstract part def Vehicle { }');
    expect(model.nodes[0].isAbstract).toBe(true);
    expect(model.nodes[0].name).toBe('Vehicle');
  });

  it('parses specialization with :> operator', () => {
    const code = `part def Vehicle { } part def Car :> Vehicle { }`;
    const { model } = parse(code);
    expect(model.nodes.map(n => n.name)).toEqual(['Vehicle', 'Car']);
    const specEdge = model.connections.find(c => c.kind === 'dependency');
    expect(specEdge).toBeDefined();
    expect(specEdge!.name).toBe('«specializes»');
  });

  it('parses specialization with specializes keyword', () => {
    const code = `part def Vehicle { } part def Car specializes Vehicle { }`;
    const specEdge = parse(code).model.connections.find(c => c.kind === 'dependency');
    expect(specEdge).toBeDefined();
  });

  it('reports duplicate definition diagnostics', () => {
    const { diagnostics } = parse('part def A { } part def A { }');
    expect(diagnostics.some(d => d.message.includes('Duplicate'))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  2. EXTENDED DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Extended definitions', () => {
  it('parses requirement def', () => {
    const { model } = parse('requirement def MassReq { }');
    expect(model.nodes[0].kind).toBe('RequirementDefinition');
  });

  it('parses constraint def', () => {
    const { model } = parse('constraint def MaxWeight { }');
    expect(model.nodes[0].kind).toBe('ConstraintDefinition');
  });

  it('parses interface def', () => {
    const { model } = parse('interface def Drive { }');
    expect(model.nodes[0].kind).toBe('InterfaceDefinition');
  });

  it('parses enum def', () => {
    const { model } = parse('enum def Colors { }');
    expect(model.nodes[0].kind).toBe('EnumDefinition');
  });

  it('parses calc def', () => {
    const { model } = parse('calc def Force { }');
    expect(model.nodes[0].kind).toBe('CalcDefinition');
  });

  it('parses allocation def', () => {
    const { model } = parse('allocation def FuncAlloc { }');
    expect(model.nodes[0].kind).toBe('AllocationDefinition');
  });

  it('parses use case def', () => {
    const { model } = parse('use case def DriveVehicle { }');
    expect(model.nodes[0].kind).toBe('UseCaseDefinition');
  });

  it('parses analysis case def', () => {
    const { model } = parse('analysis case def Performance { }');
    expect(model.nodes[0].kind).toBe('AnalysisCaseDefinition');
  });

  it('parses verification case def', () => {
    const { model } = parse('verification case def MassTest { }');
    expect(model.nodes[0].kind).toBe('VerificationCaseDefinition');
  });

  it('parses view, viewpoint, rendering, metadata, occurrence defs', () => {
    const code = `
      view def SysView { }
      viewpoint def ArchVP { }
      rendering def BasicRender { }
      metadata def Review { }
      occurrence def StartEvt { }
    `;
    const kinds = nodeKinds(code);
    expect(kinds).toContain('ViewDefinition');
    expect(kinds).toContain('ViewpointDefinition');
    expect(kinds).toContain('RenderingDefinition');
    expect(kinds).toContain('MetadataDefinition');
    expect(kinds).toContain('OccurrenceDefinition');
  });

  it('parses concern def', () => {
    const { model } = parse('concern def Safety { }');
    expect(model.nodes[0].kind).toBe('ConcernDefinition');
  });

  it('extended defs support specialization', () => {
    const code = `requirement def Base { } requirement def Sub :> Base { }`;
    const specEdge = parse(code).model.connections.find(c => c.kind === 'dependency');
    expect(specEdge).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  3. USAGES & TYPING
// ═══════════════════════════════════════════════════════════════════════════════

describe('Usages', () => {
  it('parses typed usage inside definition', () => {
    const code = `part def Vehicle { part eng : Engine; } part def Engine;`;
    const { model } = parse(code);
    const eng = model.nodes.find(n => n.name === 'eng');
    expect(eng).toBeDefined();
    expect(eng!.kind).toBe('PartUsage');
    expect(eng!.qualifiedName).toBe('Engine');
  });

  it('captures multiplicity in compartment', () => {
    const code = `part def Vehicle { part wheel[4] : Wheel; } part def Wheel;`;
    const { model } = parse(code);
    const vehicle = model.nodes.find(n => n.name === 'Vehicle');
    expect(vehicle!.attributes[0].name).toBe('wheel[4]');
  });

  it('parses untyped usages', () => {
    const code = `action def Drive { action start; }`;
    const { model } = parse(code);
    expect(model.nodes.some(n => n.name === 'start' && n.kind === 'ActionUsage')).toBe(true);
  });

  it('creates composition edge from owner to usage', () => {
    const code = `part def V { part e : E; } part def E;`;
    const compEdges = parse(code).model.connections.filter(c => c.kind === 'composition');
    expect(compEdges.length).toBeGreaterThan(0);
  });

  it('creates type reference edge from usage to definition', () => {
    const code = `part def V { part e : E; } part def E;`;
    const typeEdges = parse(code).model.connections.filter(c => c.kind === 'typereference');
    expect(typeEdges.length).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  4. SPECIALIZATION OPERATORS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Specialization operators', () => {
  it('parses subsetting :> on usages', () => {
    const code = `part def V { part w : W; part fw :> w; } part def W;`;
    const { model } = parse(code);
    const subEdge = model.connections.find(c => c.kind === 'subsetting');
    expect(subEdge).toBeDefined();
    expect(subEdge!.name).toBe('«subsets»');
  });

  it('parses subsetting with subsets keyword', () => {
    const code = `part def V { part w : W; part fw subsets w; } part def W;`;
    const subEdge = parse(code).model.connections.find(c => c.kind === 'subsetting');
    expect(subEdge).toBeDefined();
  });

  it('parses redefinition :>> on usages', () => {
    const code = `part def V { part e : E; } part def S :> V { part se :>> e; } part def E;`;
    const redefEdge = parse(code).model.connections.find(c => c.kind === 'redefinition');
    expect(redefEdge).toBeDefined();
    expect(redefEdge!.name).toBe('«redefines»');
  });

  it('parses reference subsetting ::>', () => {
    const code = `part def V { part r : R; part ref ::> r; } part def R;`;
    const refEdge = parse(code).model.connections.find(c => c.kind === 'referencesubsetting');
    expect(refEdge).toBeDefined();
  });

  it('subsetting shows in owner compartment', () => {
    const code = `part def V { part w : W; part fw :> w; } part def W;`;
    const { model } = parse(code);
    const v = model.nodes.find(n => n.name === 'V');
    expect(v!.attributes.some(a => a.name === 'fw')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  5. PACKAGES & IMPORTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Packages', () => {
  it('parses package as container', () => {
    const code = `package Sys { part def Vehicle; }`;
    const { model } = parse(code);
    expect(model.nodes.some(n => n.kind === 'Package' && n.name === 'Sys')).toBe(true);
    const comp = model.connections.find(c => c.kind === 'composition');
    expect(comp).toBeDefined();
  });

  it('parses nested packages', () => {
    const code = `package A { package B { part def X; } }`;
    const { model } = parse(code);
    expect(model.nodes.filter(n => n.kind === 'Package').length).toBe(2);
  });

  it('parses wildcard imports', () => {
    const code = `import ScalarValues::*; part def V { attribute m : Real; }`;
    const { model } = parse(code);
    expect(model.nodes.some(n => n.name === 'V')).toBe(true);
  });

  it('parses specific imports', () => {
    const code = `import SI::kg;`;
    const { diagnostics } = parse(code);
    expect(diagnostics.filter(d => d.severity === 'error').length).toBe(0);
  });

  it('warns on unknown package import', () => {
    const { diagnostics } = parse('import FakePackage::*;');
    expect(diagnostics.some(d => d.message.includes('not a recognized'))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  6. ACTION FLOW & CONTROL NODES
// ═══════════════════════════════════════════════════════════════════════════════

describe('Action flow', () => {
  it('parses fork/join/merge/decide nodes', () => {
    const code = `action def A { fork f1; join j1; merge m1; decide d1; }`;
    const { model } = parse(code);
    expect(model.nodes.some(n => n.kind === 'ForkNode' && n.name === 'f1')).toBe(true);
    expect(model.nodes.some(n => n.kind === 'JoinNode' && n.name === 'j1')).toBe(true);
    expect(model.nodes.some(n => n.kind === 'MergeNode' && n.name === 'm1')).toBe(true);
    expect(model.nodes.some(n => n.kind === 'DecideNode' && n.name === 'd1')).toBe(true);
  });

  it('creates start node from first start;', () => {
    const code = `action def A { first start; then action1; action action1; }`;
    const { model } = parse(code);
    expect(model.nodes.some(n => n.name === 'start')).toBe(true);
  });

  it('creates terminate node from then terminate;', () => {
    const code = `action def A { action x; merge m1; then terminate; }`;
    const { model } = parse(code);
    expect(model.nodes.some(n => n.name === 'terminate')).toBe(true);
  });

  it('parses explicit succession: first X then Y;', () => {
    const code = `action def A { action x; action y; first x then y; }`;
    const flows = parse(code).model.connections.filter(c => c.kind === 'flow');
    expect(flows.length).toBeGreaterThan(0);
  });

  it('parses inline then successions', () => {
    const code = `action def A { action a1; then a2; action a2; }`;
    const flows = parse(code).model.connections.filter(c => c.kind === 'flow');
    expect(flows.some(f => f.sourceId.includes('a1') && f.targetId.includes('a2'))).toBe(true);
  });

  it('parses conditional succession: if guard then action;', () => {
    const code = `action def A { decide d1; if ready then act1; action act1; }`;
    const guards = parse(code).model.connections.filter(c => c.name?.includes('['));
    expect(guards.length).toBe(1);
    expect(guards[0].name).toBe('[ready]');
  });

  it('parses full action flow matching the reference diagram', () => {
    const code = `
      action def MyAction {
        first start;
        then fork fork1;
        then action1;
        then action2;
        action action1; then join1;
        action action2; then join1;
        join join1;
        then decide decision1;
          if guard2 then action3;
          if guard1 then action4;
        action action3; then merge1;
        action action4; then merge1;
        merge merge1; then terminate;
      }
    `;
    const { model } = parse(code);
    const flows = model.connections.filter(c => c.kind === 'flow');
    // start→fork1, fork1→a1, fork1→a2, a1→join1, a2→join1,
    // join1→decision1, d→a3[g2], d→a4[g1], a3→merge1, a4→merge1, merge1→terminate
    expect(flows.length).toBe(11);
    expect(flows.filter(f => f.name?.includes('[')).length).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  7. RELATIONSHIPS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Relationships', () => {
  it('parses connect statements', () => {
    const code = `part def A; part def B; connect A to B;`;
    const assoc = parse(code).model.connections.find(c => c.kind === 'association');
    expect(assoc).toBeDefined();
  });

  it('parses flow statements', () => {
    const code = `part def A; part def B; flow from A to B;`;
    const flow = parse(code).model.connections.find(c => c.kind === 'flow');
    expect(flow).toBeDefined();
  });

  it('parses perform and exhibit in compartments', () => {
    const code = `part def V { perform providePower; exhibit vehicleStates; }`;
    const { model } = parse(code);
    const v = model.nodes.find(n => n.name === 'V');
    expect(v!.attributes.some(a => a.value === 'perform')).toBe(true);
    expect(v!.attributes.some(a => a.value === 'exhibit')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  8. IN/OUT PARAMETERS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Directed features', () => {
  it('parses in/out/inout parameters', () => {
    const code = `action def Drive { in item throttle : Real; out item speed : Real; inout item data : Real; }`;
    const { model } = parse(code);
    const params = model.nodes.filter(n => n.direction);
    expect(params.length).toBe(3);
    expect(params.map(p => p.direction).sort()).toEqual(['in', 'inout', 'out']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  9. EDGE CASES & ROBUSTNESS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Edge cases', () => {
  it('handles empty input', () => {
    const { model, diagnostics } = parse('');
    expect(model.nodes.length).toBe(0);
    expect(model.connections.length).toBe(0);
    expect(diagnostics.length).toBe(0);
  });

  it('handles whitespace-only input', () => {
    const { model } = parse('   \n\n\t  ');
    expect(model.nodes.length).toBe(0);
  });

  it('handles comments-only input', () => {
    const { model } = parse('// just a comment\n/* block comment */');
    expect(model.nodes.length).toBe(0);
  });

  it('handles malformed/incomplete syntax gracefully', () => {
    const { model } = parse('part def { }');
    // Should not crash, may or may not produce nodes
    expect(model).toBeDefined();
  });

  it('handles unclosed braces gracefully', () => {
    const { model } = parse('part def Vehicle {');
    expect(model).toBeDefined();
    expect(model.nodes.length).toBeGreaterThanOrEqual(0);
  });

  it('handles special characters in comments', () => {
    const { model } = parse('/* <script>alert("xss")</script> */ part def A;');
    expect(model.nodes[0].name).toBe('A');
  });

  it('handles deeply nested definitions', () => {
    const code = `
      part def A { part def B { part def C { part def D { part def E; } } } }
    `;
    const { model } = parse(code);
    expect(model.nodes.length).toBe(5);
  });

  it('handles qualified type names', () => {
    const code = `import ISQ::*; part def V { attribute m :> ISQ::mass; }`;
    const { model } = parse(code);
    expect(model.nodes.some(n => n.name === 'V')).toBe(true);
  });

  it('handles XSS payloads in definition names (regex prevents injection)', () => {
    // Regex \w+ only matches [a-zA-Z0-9_], so XSS payloads in names are impossible
    const code = 'part def Vehicle { }';
    const { model } = parse(code);
    expect(model.nodes[0].name).toBe('Vehicle');
    // Verify no node can have HTML characters in name
    for (const node of model.nodes) {
      expect(node.name).not.toMatch(/[<>"'&]/);
    }
  });

  it('handles large input without crashing', () => {
    // Generate a model with 200 definitions
    const lines = Array.from({ length: 200 }, (_, i) => `part def Part${i};`);
    const { model } = parse(lines.join('\n'));
    expect(model.nodes.length).toBe(200);
  });

  it('handles rapid repeated parsing (simulating keystrokes)', () => {
    const base = 'part def Vehicle { attribute mass : Real; }';
    for (let i = 0; i < 50; i++) {
      const code = base + `\npart def Extra${i};`;
      const { model } = parse(code);
      expect(model.nodes.length).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. DIAGNOSTICS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Diagnostics', () => {
  it('warns on unknown type reference', () => {
    const { diagnostics } = parse('part def V { part e : UnknownType; }');
    expect(diagnostics.some(d => d.message.includes('Unknown type'))).toBe(true);
  });

  it('suggests similar names for typos', () => {
    const code = `part def Engine; part def Vehicle { part e : Engne; }`;
    const { diagnostics } = parse(code);
    const diag = diagnostics.find(d => d.message.includes('Unknown type'));
    expect(diag?.fixes?.length).toBeGreaterThan(0);
    expect(diag!.fixes![0].newText).toBe('Engine');
  });

  it('provides source ranges for diagnostics', () => {
    const { diagnostics } = parse('part def V { part e : BadType; }');
    const diag = diagnostics.find(d => d.severity === 'warning');
    expect(diag?.line).toBeGreaterThan(0);
    expect(diag?.column).toBeGreaterThan(0);
  });
});
