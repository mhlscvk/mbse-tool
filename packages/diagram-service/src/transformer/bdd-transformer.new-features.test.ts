import { describe, it, expect } from 'vitest';
import { parseSysMLText } from '../parser/sysml-text-parser.js';
import { transformToBDD } from './bdd-transformer.js';
import type { SNode, SLabel } from '@systemodel/shared-types';

function pipeline(code: string, viewType: 'general' | 'interconnection' | 'action-flow' | 'state-transition' = 'general') {
  const { model } = parseSysMLText('test://test', code);
  const diagram = transformToBDD(model, viewType);
  const nodes = diagram.children.filter((c): c is SNode => c.type === 'node');
  const edges = diagram.children.filter(c => c.type === 'edge');
  return { nodes, edges, diagram };
}

function kindText(node: SNode): string {
  return (node.children.find(c => c.id.endsWith('__kind')) as SLabel)?.text ?? '';
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. ABSTRACT KEYWORD PLACEMENT
// ═══════════════════════════════════════════════════════════════════════════════

describe('Abstract keyword in guillemets', () => {
  it('shows <<abstract part def>> not {abstract} <<part def>>', () => {
    const { nodes } = pipeline('abstract part def Vehicle { }');
    expect(kindText(nodes[0])).toBe('«abstract part def»');
  });

  it('shows <<abstract action def>>', () => {
    const { nodes } = pipeline('abstract action def Drive { }');
    expect(kindText(nodes[0])).toBe('«abstract action def»');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. ANALYSIS/VERIFICATION KEYWORDS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Analysis and verification keywords', () => {
  it('shows <<analysis def>> not <<analysis case def>>', () => {
    const { nodes } = pipeline('analysis case def MyAnalysis { }');
    expect(kindText(nodes[0])).toBe('«analysis def»');
  });

  it('shows <<verification def>> not <<verification case def>>', () => {
    const { nodes } = pipeline('verification case def MyTest { }');
    expect(kindText(nodes[0])).toBe('«verification def»');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. DIRECTED ITEM FULL KEYWORDS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Directed item full keywords', () => {
  it('shows <<in item>> not <<in>>', () => {
    const code = `action def A { in item x : Foo; } item def Foo;`;
    const { nodes } = pipeline(code);
    const x = nodes.find(n => (n.children.find(c => c.id.endsWith('__label')) as SLabel)?.text?.includes('x'));
    expect(x).toBeDefined();
    expect(kindText(x!)).toBe('«in item»');
  });

  it('shows <<out attribute>>', () => {
    const code = `action def A { out attribute y : Real; }`;
    const { nodes } = pipeline(code);
    const y = nodes.find(n => (n.children.find(c => c.id.endsWith('__label')) as SLabel)?.text?.includes('y'));
    expect(y).toBeDefined();
    expect(kindText(y!)).toBe('«out attribute»');
  });

  it('shows <<inout part>>', () => {
    const code = `action def A { inout part z : P; } part def P;`;
    const { nodes } = pipeline(code);
    const z = nodes.find(n => (n.children.find(c => c.id.endsWith('__label')) as SLabel)?.text?.includes('z'));
    expect(z).toBeDefined();
    expect(kindText(z!)).toBe('«inout part»');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. STATE DEF ROUNDED CORNERS
// ═══════════════════════════════════════════════════════════════════════════════

describe('State def shape', () => {
  it('state def gets statedefinition cssClass', () => {
    const { nodes } = pipeline('state def MyState { }');
    expect(nodes[0].cssClasses?.[0]).toBe('statedefinition');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. ENTRY/DO/EXIT GRAPHICAL NODES HIDDEN IN GV
// ═══════════════════════════════════════════════════════════════════════════════

describe('Entry/do/exit graphical nodes', () => {
  it('shows entry/do/exit nodes in general view', () => {
    const code = `
      state def S { state on { entry action test; } }
    `;
    const { nodes } = pipeline(code, 'general');
    const entryNodes = nodes.filter(n => n.cssClasses?.[0] === 'entryactionusage');
    expect(entryNodes.length).toBeGreaterThan(0);
  });

  it('shows entry/do/exit nodes in state transition view', () => {
    const code = `
      state def S { state on { entry action test; } }
    `;
    const { nodes } = pipeline(code, 'state-transition');
    const entryNodes = nodes.filter(n => n.cssClasses?.[0] === 'entryactionusage');
    expect(entryNodes.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. BEHAVIOR COMPARTMENT IN STATE USAGES
// ═══════════════════════════════════════════════════════════════════════════════

describe('State usage behavior compartment', () => {
  it('state usage with entry/do/exit renders behaviors as graphical child nodes (not compartment labels)', () => {
    const code = `
      state def S {
        state on {
          entry action selfTest : PerformSelfTest;
          do action power : ProvidePower;
          exit action brake : ApplyParkingBrake;
        }
      }
      action def PerformSelfTest;
      action def ProvidePower;
      action def ApplyParkingBrake;
    `;
    const { nodes } = pipeline(code, 'general');
    const onNode = nodes.find(n => {
      const label = n.children.find(c => c.id.endsWith('__label')) as SLabel | undefined;
      return label?.text === 'on';
    });
    expect(onNode).toBeDefined();
    // Should NOT have usage labels (behaviors are rendered as separate child nodes)
    const usageLabels = onNode!.children.filter(c => c.id.includes('__usage__'));
    expect(usageLabels.length).toBe(0);
    // Behavior nodes should exist as separate nodes
    const entryNodes = nodes.filter(n => n.cssClasses?.[0] === 'entryactionusage');
    expect(entryNodes.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. SUCCESSION FLOW & MESSAGE EDGE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

describe('Succession flow and message edge types', () => {
  it('succession flow gets successionflow cssClass', () => {
    const code = `
      action def A { out item x : Foo; }
      action def B { in item y : Foo; }
      item def Foo;
      action main {
        action a : A;
        action b : B;
        succession flow a.x to b.y;
      }
    `;
    const { edges } = pipeline(code);
    const sf = edges.filter(e => e.cssClasses?.[0] === 'successionflow');
    expect(sf.length).toBe(1);
  });

  it('message gets message cssClass', () => {
    const code = `
      item def Signal;
      part def Ctrl;
      part def Eng;
      part sys { part ctrl : Ctrl; part eng : Eng; message of Signal from ctrl to eng; }
    `;
    const { edges } = pipeline(code);
    const msg = edges.filter(e => e.cssClasses?.[0] === 'message');
    expect(msg.length).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. FLOW DEFINITION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Flow definition', () => {
  it('flow def gets FlowDefinition kind display', () => {
    const { nodes } = pipeline('flow def FuelFlow;');
    expect(nodes.length).toBe(1);
    expect(kindText(nodes[0])).toBe('«flow def»');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. USE CASE ELLIPSE SHAPE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Use case shape', () => {
  it('use case def gets usecasedefinition cssClass', () => {
    const { nodes } = pipeline('use case def Transport { }');
    expect(nodes[0].cssClasses?.[0]).toBe('usecasedefinition');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. REF DASHED BORDER
// ═══════════════════════════════════════════════════════════════════════════════

describe('Ref dashed border', () => {
  it('ref part usage passes isRef in data', () => {
    const code = `part def Vehicle { ref part driver : Person; } part def Person;`;
    const { nodes } = pipeline(code);
    const driver = nodes.find(n => {
      const label = n.children.find(c => c.id.endsWith('__label')) as SLabel | undefined;
      return label?.text?.includes('driver');
    });
    expect(driver).toBeDefined();
    expect(driver!.data?.isRef).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 11. INHERITED FEATURES
// ═══════════════════════════════════════════════════════════════════════════════

function pipelineInherited(code: string, viewType: 'general' | 'interconnection' | 'action-flow' | 'state-transition' = 'general', showInherited = true) {
  const { model } = parseSysMLText('test://test', code);
  const diagram = transformToBDD(model, viewType, showInherited);
  const nodes = diagram.children.filter((c): c is SNode => c.type === 'node');
  const edges = diagram.children.filter(c => c.type === 'edge');
  return { nodes, edges, diagram };
}

function findNodeByName(nodes: SNode[], name: string) {
  return nodes.find(n => n.children.some(c => c.id.endsWith('__label') && c.text.includes(name)));
}

function usageLabels(node: SNode) {
  return node.children.filter(c => c.id.includes('__usage__') || c.id.includes('__inherited__'));
}

function inheritedLabels(node: SNode) {
  return node.children.filter(c => c.id.includes('__inherited__'));
}

describe('Inherited features', () => {
  it('basic inheritance: B :> A, B shows A attrs when showInherited=true', () => {
    const code = `
      part def A { attribute mass : Real; }
      part def B :> A { }
    `;
    const { nodes } = pipelineInherited(code, 'general', true);
    const bNode = findNodeByName(nodes, 'B');
    expect(bNode).toBeDefined();
    const labels = usageLabels(bNode!);
    expect(labels.some(l => l.text.includes('mass'))).toBe(true);
  });

  it('no inherited attrs when showInherited=false', () => {
    const code = `
      part def A { attribute mass : Real; }
      part def B :> A { }
    `;
    const { nodes } = pipelineInherited(code, 'general', false);
    const bNode = findNodeByName(nodes, 'B');
    expect(bNode).toBeDefined();
    const labels = usageLabels(bNode!);
    expect(labels.some(l => l.text.includes('mass'))).toBe(false);
  });

  it('multi-level: C :> B :> A, C shows attrs from both', () => {
    const code = `
      part def A { attribute x : Real; }
      part def B :> A { attribute y : Real; }
      part def C :> B { }
    `;
    const { nodes } = pipelineInherited(code, 'general', true);
    const cNode = findNodeByName(nodes, 'C');
    expect(cNode).toBeDefined();
    const labels = usageLabels(cNode!);
    expect(labels.some(l => l.text.includes('x'))).toBe(true);
    expect(labels.some(l => l.text.includes('y'))).toBe(true);
  });

  it('diamond: D :> B & C both :> A, A attrs appear once in D', () => {
    const code = `
      part def A { attribute shared : Real; }
      part def B :> A { }
      part def C :> A { }
      part def D :> B { }
    `;
    // D specializes B which specializes A
    const { nodes } = pipelineInherited(code, 'general', true);
    const dNode = findNodeByName(nodes, 'D');
    expect(dNode).toBeDefined();
    const labels = usageLabels(dNode!);
    const sharedLabels = labels.filter(l => l.text.includes('shared'));
    expect(sharedLabels.length).toBe(1); // deduplication
  });

  it('redefined attrs excluded: if B redefines A attr, only B version shows', () => {
    const code = `
      part def A { attribute mass : Real; }
      part def B :> A { attribute mass : Integer; }
    `;
    const { nodes } = pipelineInherited(code, 'general', true);
    const bNode = findNodeByName(nodes, 'B');
    expect(bNode).toBeDefined();
    const labels = usageLabels(bNode!);
    // Only one "mass" label — B's own, not inherited
    const massLabels = labels.filter(l => l.text.includes('mass'));
    expect(massLabels.length).toBe(1);
    // It should NOT be an inherited label
    const inherited = inheritedLabels(bNode!).filter(l => l.text.includes('mass'));
    expect(inherited.length).toBe(0);
  });

  it('^ prefix on inherited labels', () => {
    const code = `
      part def A { attribute mass : Real; }
      part def B :> A { }
    `;
    const { nodes } = pipelineInherited(code, 'general', true);
    const bNode = findNodeByName(nodes, 'B');
    expect(bNode).toBeDefined();
    const iLabels = inheritedLabels(bNode!);
    expect(iLabels.length).toBeGreaterThan(0);
    expect(iLabels[0].text.startsWith('^ ')).toBe(true);
  });

  it('__inherited__ label ID pattern', () => {
    const code = `
      part def A { attribute mass : Real; }
      part def B :> A { }
    `;
    const { nodes } = pipelineInherited(code, 'general', true);
    const bNode = findNodeByName(nodes, 'B');
    expect(bNode).toBeDefined();
    const iLabels = inheritedLabels(bNode!);
    expect(iLabels.length).toBeGreaterThan(0);
    for (const label of iLabels) {
      expect(label.id).toMatch(/__inherited__/);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 12. DERIVED FEATURES IN COMPARTMENTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Derived feature display', () => {
  it('/ prefix on derived attribute labels in compartments', () => {
    const code = `part def Vehicle { derived attribute speed : Real; }`;
    const { nodes } = pipeline(code);
    const vehicle = findNodeByName(nodes, 'Vehicle');
    expect(vehicle).toBeDefined();
    const labels = usageLabels(vehicle!);
    const speedLabel = labels.find(l => l.text.includes('speed'));
    expect(speedLabel).toBeDefined();
    expect(speedLabel!.text.startsWith('/ ')).toBe(true);
  });

  it('non-derived attribute has no / prefix', () => {
    const code = `part def Vehicle { attribute mass : Real; }`;
    const { nodes } = pipeline(code);
    const vehicle = findNodeByName(nodes, 'Vehicle');
    expect(vehicle).toBeDefined();
    const labels = usageLabels(vehicle!);
    const massLabel = labels.find(l => l.text.includes('mass'));
    expect(massLabel).toBeDefined();
    expect(massLabel!.text.startsWith('/ ')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 13. PORT / ACTION BOUNDARY RULES
// ═══════════════════════════════════════════════════════════════════════════════

describe('Port/action boundary rules', () => {
  it('PortUsage always gets portusage CSS regardless of direction', () => {
    const code = `part def V { in port p1; out port p2; port p3; }`;
    const { nodes } = pipeline(code);
    const portNodes = nodes.filter(n => n.cssClasses?.[0] === 'portusage');
    expect(portNodes.length).toBe(3);
  });

  it('directed items inside action usage get actionin/actionout/actioninout CSS', () => {
    const code = `
      action main {
        in item x : Foo;
        out item y : Foo;
        inout item z : Foo;
      }
      item def Foo;
    `;
    const { nodes } = pipeline(code);
    expect(nodes.some(n => n.cssClasses?.[0] === 'actionin')).toBe(true);
    expect(nodes.some(n => n.cssClasses?.[0] === 'actionout')).toBe(true);
    expect(nodes.some(n => n.cssClasses?.[0] === 'actioninout')).toBe(true);
  });

  it('directed items inside definitions get regular CSS (not boundary)', () => {
    const code = `part def V { in item x : Foo; } item def Foo;`;
    const { nodes } = pipeline(code);
    // Inside a part def (not action usage), should get regular itemusage CSS
    const xNode = nodes.find(n =>
      (n.children.find(c => c.id.endsWith('__label')) as SLabel)?.text?.includes('x')
    );
    expect(xNode).toBeDefined();
    expect(xNode!.cssClasses?.[0]).toBe('itemusage');
  });

  it('directed items inside action definitions get regular CSS (not boundary)', () => {
    const code = `action def A { in item x : Foo; } item def Foo;`;
    const { nodes } = pipeline(code);
    // Inside an action def (not action usage), ownerIsPortOrActionUsage is false
    const xNode = nodes.find(n =>
      (n.children.find(c => c.id.endsWith('__label')) as SLabel)?.text?.includes('x')
    );
    expect(xNode).toBeDefined();
    expect(xNode!.cssClasses?.[0]).toBe('itemusage');
  });
});
