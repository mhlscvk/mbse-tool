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
