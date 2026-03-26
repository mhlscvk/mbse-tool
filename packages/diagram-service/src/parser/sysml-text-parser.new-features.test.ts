import { describe, it, expect } from 'vitest';
import { parseSysMLText } from './sysml-text-parser.js';

function parse(code: string) {
  return parseSysMLText('test://test', code);
}
function nodes(code: string) { return parse(code).model.nodes; }
function conns(code: string) { return parse(code).model.connections; }
function nodeNames(code: string) { return nodes(code).map(n => n.name); }
function nodeKinds(code: string) { return nodes(code).map(n => n.kind); }
function edgeKinds(code: string) { return conns(code).map(c => c.kind); }

// ═══════════════════════════════════════════════════════════════════════════════
// 1. CONJUGATED PORTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Conjugated ports', () => {
  it('parses port p : ~PortDef', () => {
    const code = `port def FuelPort; part def Engine { port ep : ~FuelPort; }`;
    const ep = nodes(code).find(n => n.name === 'ep');
    expect(ep).toBeDefined();
    expect(ep!.kind).toBe('PortUsage');
    expect(ep!.qualifiedName).toBe('~FuelPort');
  });

  it('creates composition edge for conjugated port', () => {
    const code = `port def P; part def A { port p : ~P; }`;
    const comp = conns(code).filter(c => c.kind === 'composition');
    const a = nodes(code).find(n => n.name === 'A');
    const p = nodes(code).find(n => n.name === 'p');
    expect(comp.some(c => c.sourceId === a!.id && c.targetId === p!.id)).toBe(true);
  });

  it('creates type reference edge for conjugated port', () => {
    const code = `port def FuelPort; part def Engine { port ep : ~FuelPort; }`;
    const typeref = conns(code).filter(c => c.kind === 'typereference');
    expect(typeref.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. SUCCESSION FLOW & MESSAGE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Succession flow and message', () => {
  it('parses succession flow X.out to Y.in', () => {
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
    const sf = conns(code).filter(c => c.kind === 'successionflow');
    expect(sf.length).toBe(1);
    expect(sf[0].name).toContain('succession flow');
  });

  it('parses message of Payload from X to Y', () => {
    const code = `
      item def Signal;
      part def Ctrl;
      part def Eng;
      part sys {
        part ctrl : Ctrl;
        part eng : Eng;
        message of Signal from ctrl to eng;
      }
    `;
    const msg = conns(code).filter(c => c.kind === 'message');
    expect(msg.length).toBe(1);
    expect(msg[0].name).toContain('message');
    expect(msg[0].name).toContain('Signal');
  });

  it('parses flow with payload', () => {
    const code = `
      item def Fuel;
      part def Tank { out item fuelOut : Fuel; }
      part def Engine { in item fuelIn : Fuel; }
      part v {
        part tank : Tank;
        part engine : Engine;
        flow of Fuel from tank.fuelOut to engine.fuelIn;
      }
    `;
    const flows = conns(code).filter(c => c.kind === 'flow');
    expect(flows.length).toBe(1);
    expect(flows[0].name).toContain('Fuel');
  });

  it('parses named flow', () => {
    const code = `
      part def A; part def B;
      flow myFlow from A to B;
    `;
    const flows = conns(code).filter(c => c.kind === 'flow');
    expect(flows.length).toBe(1);
    expect(flows[0].name).toContain('myFlow');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. TYPED ENTRY/DO/EXIT IN STATE USAGES
// ═══════════════════════════════════════════════════════════════════════════════

describe('Typed entry/do/exit in state usages', () => {
  it('assigns typed entry to innermost state usage', () => {
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
    const { model } = parse(code);
    const onState = model.nodes.find(n => n.name === 'on' && n.kind === 'StateUsage');
    expect(onState).toBeDefined();
    expect(onState!.attributes.some(a => a.value === '__entry__' && a.name.includes('selfTest'))).toBe(true);
    expect(onState!.attributes.some(a => a.value === '__do__' && a.name.includes('power'))).toBe(true);
    expect(onState!.attributes.some(a => a.value === '__exit__' && a.name.includes('brake'))).toBe(true);
  });

  it('does not assign on entry/do/exit to outer state def', () => {
    const code = `
      state def S {
        entry;
        state on {
          entry action test : TestAction;
        }
      }
      action def TestAction;
    `;
    const { model } = parse(code);
    const sDef = model.nodes.find(n => n.name === 'S' && n.kind === 'StateDefinition');
    expect(sDef).toBeDefined();
    // S should have its own "entry" but NOT "entry / test"
    const sEntries = sDef!.attributes.filter(a => a.value === '__entry__');
    expect(sEntries.length).toBe(1);
    expect(sEntries[0].name).toBe('entry action');
  });

  it('creates graphical entry/do/exit nodes', () => {
    const code = `
      state def S {
        state on {
          entry action selfTest : PerformSelfTest;
          do action power : ProvidePower;
        }
      }
      action def PerformSelfTest;
      action def ProvidePower;
    `;
    const { model } = parse(code);
    const entryNodes = model.nodes.filter(n => n.kind === 'EntryActionUsage');
    const doNodes = model.nodes.filter(n => n.kind === 'DoActionUsage');
    expect(entryNodes.length).toBeGreaterThan(0);
    expect(doNodes.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. PERFORM/EXHIBIT COMPARTMENT ATTRIBUTES
// ═══════════════════════════════════════════════════════════════════════════════

describe('Perform and exhibit attributes', () => {
  it('adds perform to owner attributes', () => {
    const code = `
      action def Drive;
      part def Vehicle {
        perform action drive : Drive;
      }
    `;
    const { model } = parse(code);
    const vehicle = model.nodes.find(n => n.name === 'Vehicle');
    expect(vehicle).toBeDefined();
    expect(vehicle!.attributes.some(a => a.value === 'perform')).toBe(true);
  });

  it('adds exhibit to owner attributes', () => {
    const code = `
      state def VehicleStates;
      part def Vehicle {
        exhibit state vs : VehicleStates;
      }
    `;
    const { model } = parse(code);
    const vehicle = model.nodes.find(n => n.name === 'Vehicle');
    expect(vehicle).toBeDefined();
    expect(vehicle!.attributes.some(a => a.value === 'exhibit')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. EXTENDED USAGE KEYWORDS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Extended usage keywords', () => {
  const extendedKeywords = [
    ['requirement', 'RequirementUsage'],
    ['constraint', 'ConstraintUsage'],
    ['interface', 'InterfaceUsage'],
    ['enum', 'EnumUsage'],
    ['calc', 'CalcUsage'],
    ['allocation', 'AllocationUsage'],
    ['connection', 'ConnectionUsage'],
    ['flow', 'FlowUsage'],
    ['view', 'ViewUsage'],
    ['viewpoint', 'ViewpointUsage'],
    ['rendering', 'RenderingUsage'],
    ['occurrence', 'OccurrenceUsage'],
    ['concern', 'ConcernUsage'],
    ['metadata', 'MetadataUsage'],
  ];

  for (const [keyword, expectedKind] of extendedKeywords) {
    it(`parses ${keyword} usage: ${keyword} myUsage : SomeType`, () => {
      const code = `${keyword} def SomeType; ${keyword} myUsage : SomeType;`;
      const n = nodes(code).find(n => n.name === 'myUsage');
      expect(n).toBeDefined();
      expect(n!.kind).toBe(expectedKind);
    });
  }

  it('parses flow def', () => {
    const code = `flow def FuelFlow;`;
    const n = nodes(code).find(n => n.name === 'FuelFlow');
    expect(n).toBeDefined();
    expect(n!.kind).toBe('FlowDefinition');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. POST-TYPE MULTIPLICITY & TYPED REDEFINES
// ═══════════════════════════════════════════════════════════════════════════════

describe('Post-type multiplicity and typed redefines', () => {
  it('parses multiplicity after type: part cyl : Cylinder[4..6]', () => {
    const code = `part def Engine { part cyl : Cylinder[4..6]; } part def Cylinder;`;
    const cyl = nodes(code).find(n => n.name === 'cyl');
    expect(cyl).toBeDefined();
    expect(cyl!.multiplicity).toBe('[4..6]');
  });

  it('parses typed redefines: part x : Type redefines y', () => {
    const code = `
      part def Engine { part cyl : Cylinder; }
      part def SmallEngine :> Engine {
        part smallCyl : SmallCylinder redefines cyl;
      }
      part def Cylinder;
      part def SmallCylinder;
    `;
    const smallCyl = nodes(code).find(n => n.name === 'smallCyl');
    expect(smallCyl).toBeDefined();
    const redefEdge = conns(code).find(c => c.kind === 'redefinition' && c.sourceId === smallCyl!.id);
    expect(redefEdge).toBeDefined();
  });

  it('parses typed :>> operator: part x : Type :>> y', () => {
    const code = `
      part def Vehicle { part eng : Engine; }
      part def BigVehicle :> Vehicle {
        part bigEng : BigEngine :>> eng;
      }
      part def Engine;
      part def BigEngine;
    `;
    const bigEng = nodes(code).find(n => n.name === 'bigEng');
    expect(bigEng).toBeDefined();
    const redefEdge = conns(code).find(c => c.kind === 'redefinition' && c.sourceId === bigEng!.id);
    expect(redefEdge).toBeDefined();
  });

  it('parses unnamed redefines: part redefines cyl[4]', () => {
    const code = `
      part def Engine { part cyl : Cylinder[4..6]; }
      part def SmallEngine :> Engine { part redefines cyl[4]; }
      part def Cylinder;
    `;
    const cyl = nodes(code).find(n => n.name === 'cyl' && n.kind === 'PartUsage' && n.multiplicity === '[4]');
    expect(cyl).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. PACKAGE-OWNED DEFINITIONS PRESERVED
// ═══════════════════════════════════════════════════════════════════════════════

describe('Package-owned definitions', () => {
  it('preserves action defs inside packages when successions exist', () => {
    const code = `
      package P {
        action def A1;
        action def A2;
        state def S {
          state off;
          state on;
          transition first off then on;
        }
      }
    `;
    const { model } = parse(code);
    // Transform would normally hide A1/A2 due to succession cleanup
    // but they're package children so should be preserved
    expect(model.nodes.some(n => n.name === 'A1')).toBe(true);
    expect(model.nodes.some(n => n.name === 'A2')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// P0: DecisionNode rename, CaseDefinition/CaseUsage
// ═══════════════════════════════════════════════════════════════════════════════

describe('P0: DecisionNode and Case types', () => {
  it('parses decide as DecisionNode (not DecideNode)', () => {
    const kinds = nodeKinds('package P { action def A { decide d1; } }');
    expect(kinds).toContain('DecisionNode');
    expect(kinds).not.toContain('DecideNode');
  });

  it('parses case def as CaseDefinition', () => {
    const kinds = nodeKinds('package P { case def MyCase { action step; } }');
    expect(kinds).toContain('CaseDefinition');
  });

  it('parses case usage as CaseUsage', () => {
    const kinds = nodeKinds('package P { case def C; case myCase : C; }');
    expect(kinds).toContain('CaseUsage');
  });

  it('does not confuse case with use case', () => {
    const kinds = nodeKinds('package P { use case def UC; case def C; }');
    expect(kinds).toContain('UseCaseDefinition');
    expect(kinds).toContain('CaseDefinition');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// P1: Action subtypes
// ═══════════════════════════════════════════════════════════════════════════════

describe('P1: Send and Accept actions', () => {
  it('parses send action', () => {
    const kinds = nodeKinds('package P { action def A { action s send data to target; } }');
    expect(kinds).toContain('SendActionUsage');
  });

  it('parses accept action', () => {
    const kinds = nodeKinds('package P { action def A { action r accept response; } }');
    expect(kinds).toContain('AcceptActionUsage');
  });
});

describe('P1: Conditional and loop actions', () => {
  it('parses if action', () => {
    const kinds = nodeKinds('package P { action def A { if isValid { action work; } } }');
    expect(kinds).toContain('IfActionUsage');
  });

  it('parses while loop', () => {
    const kinds = nodeKinds('package P { action def A { while loop monitor { action check; } } }');
    expect(kinds).toContain('WhileLoopActionUsage');
  });

  it('parses for loop', () => {
    const kinds = nodeKinds('package P { action def A { for item in list { action process; } } }');
    expect(kinds).toContain('ForLoopActionUsage');
  });

  it('parses assignment', () => {
    const kinds = nodeKinds('package P { action def A { assign result := value; } }');
    expect(kinds).toContain('AssignmentActionUsage');
  });
});

describe('P1: Include, Assert, Event', () => {
  it('parses include use case', () => {
    const kinds = nodeKinds('package P { use case def UC { include use case sub; } }');
    expect(kinds).toContain('IncludeUseCaseUsage');
  });

  it('parses assert constraint', () => {
    const kinds = nodeKinds('package P { part def V { assert constraint valid; } }');
    expect(kinds).toContain('AssertConstraintUsage');
  });

  it('parses event occurrence', () => {
    const kinds = nodeKinds('package P { action def A { event occurrence powerOn; } }');
    expect(kinds).toContain('EventOccurrenceUsage');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// P2: Connector/Port specializations
// ═══════════════════════════════════════════════════════════════════════════════

describe('P2: ConjugatedPortDefinition', () => {
  it('parses conjugated port definition', () => {
    const kinds = nodeKinds('package P { port def Fuel; port def ConjFuel conjugates Fuel; }');
    expect(kinds).toContain('ConjugatedPortDefinition');
  });

  it('creates conjugation edge', () => {
    const c = conns('package P { port def Fuel; port def ConjFuel conjugates Fuel; }');
    expect(c.some(e => e.kind === 'conjugation')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// P3: Membership types
// ═══════════════════════════════════════════════════════════════════════════════

describe('P3: Subject, Actor, Stakeholder', () => {
  it('parses subject inside requirement', () => {
    const kinds = nodeKinds('package P { requirement def R { subject s : Vehicle; } }');
    expect(kinds).toContain('SubjectMembership');
  });

  it('parses actor inside use case', () => {
    const kinds = nodeKinds('package P { use case def UC { actor driver : Person; } }');
    expect(kinds).toContain('ActorMembership');
  });

  it('parses stakeholder inside requirement', () => {
    const kinds = nodeKinds('package P { requirement def R { stakeholder agency : Org; } }');
    expect(kinds).toContain('StakeholderMembership');
  });

  it('ignores actor outside requirement/case context', () => {
    const kinds = nodeKinds('package P { part def V { actor driver; } }');
    expect(kinds).not.toContain('ActorMembership');
  });
});

describe('P3: Objective and ViewRendering', () => {
  it('parses objective inside case', () => {
    const kinds = nodeKinds('package P { use case def UC { objective goal : Req; } }');
    expect(kinds).toContain('ObjectiveMembership');
  });

  it('parses render inside view', () => {
    const kinds = nodeKinds('package P { view def V { render asTree : TreeRender; } }');
    expect(kinds).toContain('ViewRenderingMembership');
  });
});

describe('P3: Expose types', () => {
  it('parses namespace expose (::*)', () => {
    const kinds = nodeKinds('package P { view def V { expose P::*; } }');
    expect(kinds).toContain('NamespaceExpose');
  });

  it('parses membership expose (::Element)', () => {
    const kinds = nodeKinds('package P { view def V { expose P::MyPart; } }');
    expect(kinds).toContain('MembershipExpose');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// INDIVIDUAL, SNAPSHOT, TIMESLICE, INTERACTION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Individual occurrence definitions', () => {
  it('parses individual def Name :> Parent', () => {
    const code = `part def Vehicle; individual def Vehicle_1 :> Vehicle;`;
    const n = nodes(code).find(n => n.name === 'Vehicle_1');
    expect(n).toBeDefined();
    expect(n!.kind).toBe('OccurrenceDefinition');
    expect(n!.isIndividual).toBe(true);
  });

  it('parses individual occurrence def Name :> Parent', () => {
    const code = `individual occurrence def MyOcc :> SomeParent;`;
    const n = nodes(code).find(n => n.name === 'MyOcc');
    expect(n).toBeDefined();
    expect(n!.kind).toBe('OccurrenceDefinition');
    expect(n!.isIndividual).toBe(true);
  });

  it('parses individual def without parent', () => {
    const code = `individual def Ctx { }`;
    const n = nodes(code).find(n => n.name === 'Ctx');
    expect(n).toBeDefined();
    expect(n!.kind).toBe('OccurrenceDefinition');
    expect(n!.isIndividual).toBe(true);
  });

  it('creates specialization edge for individual def', () => {
    const code = `part def Vehicle; individual def Vehicle_1 :> Vehicle;`;
    const dep = conns(code).filter(c => c.kind === 'dependency');
    expect(dep.length).toBeGreaterThan(0);
  });
});

describe('Individual occurrence usages', () => {
  it('parses individual name : Type', () => {
    const code = `individual def Ctx; individual a : Ctx { }`;
    const n = nodes(code).find(n => n.name === 'a');
    expect(n).toBeDefined();
    expect(n!.kind).toBe('OccurrenceUsage');
    expect(n!.isIndividual).toBe(true);
    expect(n!.qualifiedName).toBe('Ctx');
  });

  it('parses untyped individual usage', () => {
    const code = `individual a { }`;
    const n = nodes(code).find(n => n.name === 'a');
    expect(n).toBeDefined();
    expect(n!.kind).toBe('OccurrenceUsage');
    expect(n!.isIndividual).toBe(true);
  });

  it('does not double-parse as occurrence usage', () => {
    const code = `individual occurrence myOcc : SomeType;`;
    const all = nodes(code).filter(n => n.name === 'myOcc');
    expect(all).toHaveLength(1);
    expect(all[0].isIndividual).toBe(true);
  });
});

describe('Snapshot usages', () => {
  it('parses snapshot name : Type', () => {
    const code = `individual def V1; individual a : V1 { snapshot t0 : V1; }`;
    const n = nodes(code).find(n => n.name === 't0');
    expect(n).toBeDefined();
    expect(n!.kind).toBe('OccurrenceUsage');
    expect(n!.portionKind).toBe('snapshot');
  });

  it('parses untyped snapshot', () => {
    const code = `individual a { snapshot t0_a { } }`;
    const n = nodes(code).find(n => n.name === 't0_a');
    expect(n).toBeDefined();
    expect(n!.kind).toBe('OccurrenceUsage');
    expect(n!.portionKind).toBe('snapshot');
  });

  it('creates composition edge from parent to snapshot', () => {
    const code = `individual a { snapshot t0 { } }`;
    const comp = conns(code).filter(c => c.kind === 'composition');
    const parent = nodes(code).find(n => n.name === 'a');
    const child = nodes(code).find(n => n.name === 't0');
    expect(parent).toBeDefined();
    expect(child).toBeDefined();
    expect(comp.some(c => c.sourceId === parent!.id && c.targetId === child!.id)).toBe(true);
  });
});

describe('Timeslice usages', () => {
  it('parses timeslice name', () => {
    const code = `individual a { timeslice t0_t2 { } }`;
    const n = nodes(code).find(n => n.name === 't0_t2');
    expect(n).toBeDefined();
    expect(n!.kind).toBe('OccurrenceUsage');
    expect(n!.portionKind).toBe('timeslice');
  });

  it('parses typed timeslice', () => {
    const code = `individual a { timeslice t0_t2 : SomeType { } }`;
    const n = nodes(code).find(n => n.name === 't0_t2');
    expect(n).toBeDefined();
    expect(n!.portionKind).toBe('timeslice');
    expect(n!.qualifiedName).toBe('SomeType');
  });
});

describe('Interaction definitions and usages', () => {
  it('parses interaction def', () => {
    const code = `interaction def Communicate;`;
    const n = nodes(code).find(n => n.name === 'Communicate');
    expect(n).toBeDefined();
    expect(n!.kind).toBe('InteractionDefinition');
  });

  it('parses interaction def with specialization', () => {
    const code = `interaction def Chat :> Communicate;`;
    const n = nodes(code).find(n => n.name === 'Chat');
    expect(n).toBeDefined();
    expect(n!.kind).toBe('InteractionDefinition');
    const dep = conns(code).filter(c => c.kind === 'dependency');
    expect(dep.length).toBeGreaterThan(0);
  });

  it('parses interaction usage typed', () => {
    const code = `interaction def Comm; part def P { interaction comm1 : Comm; }`;
    const n = nodes(code).find(n => n.name === 'comm1');
    expect(n).toBeDefined();
    expect(n!.kind).toBe('InteractionUsage');
  });

  it('parses interaction usage untyped', () => {
    const code = `part def P { interaction chat; }`;
    const n = nodes(code).find(n => n.name === 'chat');
    expect(n).toBeDefined();
    expect(n!.kind).toBe('InteractionUsage');
  });
});
