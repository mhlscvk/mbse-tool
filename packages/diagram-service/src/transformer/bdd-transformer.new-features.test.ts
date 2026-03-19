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
  it('hides entry/do/exit nodes in general view', () => {
    const code = `
      state def S { state on { entry action test; } }
    `;
    const { nodes } = pipeline(code, 'general');
    const entryNodes = nodes.filter(n => n.cssClasses?.[0] === 'entryactionusage');
    expect(entryNodes.length).toBe(0);
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
  it('state usage with entry/do/exit gets compartment labels', () => {
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
    // Should have usage labels for entry/do/exit
    const usageLabels = onNode!.children.filter(c => c.id.includes('__usage__'));
    expect(usageLabels.length).toBe(3);
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
