import { describe, it, expect } from 'vitest';
import { parseSysMLText } from '../parser/sysml-text-parser.js';
import { transformToBDD } from './bdd-transformer.js';
import type { SNode, SEdge } from '@systemodel/shared-types';

function pipeline(code: string) {
  const { model } = parseSysMLText('test://test', code);
  const diagram = transformToBDD(model);
  const nodes = diagram.children.filter((c): c is SNode => c.type === 'node');
  const edges = diagram.children.filter((c): c is SEdge => c.type === 'edge');
  return { nodes, edges, diagram };
}

function findNode(nodes: SNode[], name: string) {
  return nodes.find(n => n.children.some(c => c.id.endsWith('__label') && c.text.includes(name)));
}

function kindText(node: SNode) {
  return node.children.find(c => c.id.endsWith('__kind'))?.text ?? '';
}

// ═══════════════════════════════════════════════════════════════════════════════

describe('Transformer: node shapes', () => {
  it('definitions get correct cssClass (lowercase kind)', () => {
    const { nodes } = pipeline('part def Vehicle { }');
    expect(nodes[0].cssClasses?.[0]).toBe('partdefinition');
  });

  it('usages get correct cssClass', () => {
    const { nodes } = pipeline('part def V { part e : E; } part def E;');
    const usage = nodes.find(n => n.cssClasses?.[0] === 'partusage');
    expect(usage).toBeDefined();
  });

  it('packages get package cssClass', () => {
    const { nodes } = pipeline('package Sys { }');
    expect(nodes[0].cssClasses?.[0]).toBe('package');
  });

  it('control nodes get correct cssClass', () => {
    const { nodes } = pipeline('action def A { fork f1; join j1; merge m1; decide d1; }');
    expect(nodes.some(n => n.cssClasses?.[0] === 'forknode')).toBe(true);
    expect(nodes.some(n => n.cssClasses?.[0] === 'joinnode')).toBe(true);
    expect(nodes.some(n => n.cssClasses?.[0] === 'mergenode')).toBe(true);
    expect(nodes.some(n => n.cssClasses?.[0] === 'decidenode')).toBe(true);
  });

  it('fork/join nodes have bar dimensions (wide, thin)', () => {
    const { nodes } = pipeline('action def A { fork f1; }');
    const fork = nodes.find(n => n.cssClasses?.[0] === 'forknode');
    expect(fork!.size.width).toBeGreaterThan(fork!.size.height);
    expect(fork!.size.height).toBeLessThanOrEqual(10);
  });

  it('merge/decide nodes have square-ish dimensions', () => {
    const { nodes } = pipeline('action def A { decide d1; }');
    const decide = nodes.find(n => n.cssClasses?.[0] === 'decidenode');
    expect(decide!.size.width).toBe(decide!.size.height);
  });
});

describe('Transformer: keyword display', () => {
  it('shows «part def» for part definitions', () => {
    const { nodes } = pipeline('part def Vehicle { }');
    expect(kindText(nodes[0])).toBe('«part def»');
  });

  it('shows «requirement def» for requirement definitions', () => {
    const { nodes } = pipeline('requirement def MassReq { }');
    expect(kindText(nodes[0])).toBe('«requirement def»');
  });

  it('shows «use case def» for use case definitions', () => {
    const { nodes } = pipeline('use case def Drive { }');
    expect(kindText(nodes[0])).toBe('«use case def»');
  });

  it('shows abstract inside guillemets per spec', () => {
    const { nodes } = pipeline('abstract part def Vehicle { }');
    expect(kindText(nodes[0])).toBe('«abstract part def»');
  });

  it('shows usage name : Type format', () => {
    const { nodes } = pipeline('part def V { part e : Engine; } part def Engine;');
    const usage = nodes.find(n => n.cssClasses?.[0] === 'partusage');
    const label = usage!.children.find(c => c.id.endsWith('__label'));
    expect(label!.text).toBe('e : Engine');
  });
});

describe('Transformer: nodes with visible children have no compartment labels', () => {
  it('definition with child attributes has no compartment labels; children are separate nodes', () => {
    const { nodes } = pipeline('part def Engine { attribute mass : Real; }');
    const eng = nodes.find(n => n.children.some(c => c.text === 'Engine'));
    expect(eng).toBeDefined();
    // No compartment labels — children are rendered as separate graphical nodes
    const usageLabels = eng!.children.filter(c => c.id.includes('__usage__'));
    expect(usageLabels.length).toBe(0);
    // The attribute exists as a separate SNode
    const attrNodes = nodes.filter(n => n.cssClasses?.[0] === 'attributeusage');
    expect(attrNodes.length).toBe(1);
  });

  it('filters out __doc__ from compartments', () => {
    const { nodes } = pipeline('part def V { }');
    for (const n of nodes) {
      const labels = n.children.filter(c => c.id.includes('__usage__'));
      for (const l of labels) {
        expect(l.text).not.toContain('__doc__');
      }
    }
  });

  it('definition with child attributes renders children as separate nodes, not compartment rows', () => {
    const big = pipeline('part def A { attribute x : Real; attribute y : Real; attribute z : Real; }');
    const bigNode = big.nodes.find(n => n.children.some(c => c.text === 'A'));
    expect(bigNode).toBeDefined();
    // No compartment labels
    const usageLabels = bigNode!.children.filter(c => c.id.includes('__usage__'));
    expect(usageLabels.length).toBe(0);
    // All 3 attributes exist as separate child nodes with correct cssClass
    const attrNodes = big.nodes.filter(n => n.cssClasses?.[0] === 'attributeusage');
    expect(attrNodes.length).toBe(3);
  });
});

describe('Transformer: edges', () => {
  it('composition edges get composition cssClass', () => {
    const { edges } = pipeline('part def V { part e : E; } part def E;');
    expect(edges.some(e => e.cssClasses?.[0] === 'composition')).toBe(true);
  });

  it('specialization edges get dependency cssClass', () => {
    const { edges } = pipeline('part def V { } part def C :> V { }');
    expect(edges.some(e => e.cssClasses?.[0] === 'dependency')).toBe(true);
  });

  it('type reference edges get typereference cssClass', () => {
    const { edges } = pipeline('part def V { part e : E; } part def E;');
    expect(edges.some(e => e.cssClasses?.[0] === 'typereference')).toBe(true);
  });

  it('succession edges get succession cssClass', () => {
    const { edges } = pipeline('action def A { action x; action y; first x then y; }');
    expect(edges.some(e => e.cssClasses?.[0] === 'succession')).toBe(true);
  });
});

describe('Transformer: empty/edge cases', () => {
  it('handles empty model', () => {
    const { nodes, edges } = pipeline('');
    expect(nodes.length).toBe(0);
    expect(edges.length).toBe(0);
  });

  it('handles model with only comments', () => {
    const { nodes } = pipeline('// nothing here');
    expect(nodes.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AFV: pin cloning, flow retargeting, compartment hiding
// ═══════════════════════════════════════════════════════════════════════════════

function afvPipeline(code: string) {
  const { model } = parseSysMLText('test://afv', code);
  const diagram = transformToBDD(model, 'action-flow');
  const nodes = diagram.children.filter((c): c is SNode => c.type === 'node');
  const edges = diagram.children.filter((c): c is SEdge => c.type === 'edge');
  return { nodes, edges, diagram };
}

const AFV_CODE = `package ActionFlow {
  action def GenerateTorque {
    in item engineTorque : Torque;
    in item fuelCmd : FuelCmd;
  }
  action def AmplifyTorque {
    in item engineTorque : Torque;
    out item transmissionTorque : Torque;
  }
  action def TransferTorque {
    in item transmissionTorque : Torque;
    out item driveshaftTorque : Torque;
  }
  action providePower : ProvidePower {
    action generateTorque : GenerateTorque;
    action amplifyTorque : AmplifyTorque;
    action transferTorque : TransferTorque;
    flow generateTorque.engineTorque to amplifyTorque.engineTorque;
    flow amplifyTorque.transmissionTorque to transferTorque.transmissionTorque;
  }
}`;

describe('AFV: pin cloning from definitions into usages', () => {
  it('clones directed items from action defs into action usages as pins', () => {
    const { nodes } = afvPipeline(AFV_CODE);
    const pins = nodes.filter(n => {
      const css = n.cssClasses?.[0];
      return css === 'actionin' || css === 'actionout' || css === 'actioninout';
    });
    expect(pins.length).toBeGreaterThanOrEqual(5);
  });

  it('cloned in-pins get actionin cssClass', () => {
    const { nodes } = afvPipeline(AFV_CODE);
    const inPins = nodes.filter(n => n.cssClasses?.[0] === 'actionin');
    expect(inPins.length).toBeGreaterThanOrEqual(3);
    // Each in-pin should have direction data
    for (const pin of inPins) {
      expect(pin.data?.direction).toBe('in');
    }
  });

  it('cloned out-pins get actionout cssClass', () => {
    const { nodes } = afvPipeline(AFV_CODE);
    const outPins = nodes.filter(n => n.cssClasses?.[0] === 'actionout');
    expect(outPins.length).toBeGreaterThanOrEqual(2);
    for (const pin of outPins) {
      expect(pin.data?.direction).toBe('out');
    }
  });

  it('cloned pins are small (16x16)', () => {
    const { nodes } = afvPipeline(AFV_CODE);
    const pins = nodes.filter(n => {
      const css = n.cssClasses?.[0];
      return css === 'actionin' || css === 'actionout';
    });
    for (const pin of pins) {
      expect(pin.size.width).toBe(16);
      expect(pin.size.height).toBe(16);
    }
  });

  it('cloned pins are connected to parent usage via composition', () => {
    const { edges, nodes } = afvPipeline(AFV_CODE);
    const pins = nodes.filter(n => n.cssClasses?.[0] === 'actionin' || n.cssClasses?.[0] === 'actionout');
    for (const pin of pins) {
      const compEdge = edges.find(e => e.cssClasses?.[0] === 'composition' && e.targetId === pin.id);
      expect(compEdge).toBeDefined();
    }
  });

  it('does not duplicate pins if usage already has own params', () => {
    const code = `package P {
      action def A { in item x : T; }
      action b : A { in item x : T; }
    }`;
    const { nodes } = afvPipeline(code);
    // Should have exactly one in-pin for x, not two
    const pins = nodes.filter(n => n.cssClasses?.[0] === 'actionin');
    const xPins = pins.filter(n => n.children.some(c => c.text.includes('x')));
    expect(xPins.length).toBe(1);
  });
});

describe('AFV: flow retargeting to pins', () => {
  it('flow edges connect pin-to-pin, not action-to-action', () => {
    const { edges } = afvPipeline(AFV_CODE);
    const flows = edges.filter(e => e.cssClasses?.[0] === 'flow');
    expect(flows.length).toBe(2);
    for (const flow of flows) {
      // Source and target should be pin node IDs (contain __param__)
      expect(flow.sourceId).toContain('__param__');
      expect(flow.targetId).toContain('__param__');
    }
  });

  it('flow edges have no label when connecting pin-to-pin', () => {
    const { edges } = afvPipeline(AFV_CODE);
    const flows = edges.filter(e => e.cssClasses?.[0] === 'flow');
    for (const flow of flows) {
      // No label children (pin names are shown on the pins themselves)
      expect(flow.children.length).toBe(0);
    }
  });

  it('flow edges carry source range for click navigation', () => {
    const { edges } = afvPipeline(AFV_CODE);
    const flows = edges.filter(e => e.cssClasses?.[0] === 'flow');
    for (const flow of flows) {
      expect(flow.data?.range).toBeDefined();
      const range = flow.data!.range as { start: { line: number }; end: { line: number } };
      expect(range.start.line).toBeGreaterThanOrEqual(0);
      expect(range.end.line).toBeGreaterThanOrEqual(range.start.line);
    }
  });
});

describe('AFV: compartment hiding for definitions', () => {
  it('action definitions hide directed items from compartments', () => {
    const { nodes } = afvPipeline(AFV_CODE);
    const genDef = nodes.find(n =>
      n.cssClasses?.[0] === 'actiondefinition' &&
      n.children.some(c => c.text === 'GenerateTorque')
    );
    expect(genDef).toBeDefined();
    // Should NOT have usage labels for in/out items
    const usageLabels = genDef!.children.filter(c => c.id.includes('__usage__'));
    expect(usageLabels.length).toBe(0);
  });

  it('non-AFV view: definitions with visible children have no compartment labels', () => {
    const { model } = parseSysMLText('test://gv', AFV_CODE);
    const diagram = transformToBDD(model, 'general');
    const nodes = diagram.children.filter((c): c is SNode => c.type === 'node');
    const genDef = nodes.find(n =>
      n.cssClasses?.[0] === 'actiondefinition' &&
      n.children.some(c => c.text === 'GenerateTorque')
    );
    expect(genDef).toBeDefined();
    // In non-AFV view, definitions with visible graphical children have no compartment labels
    const usageLabels = genDef!.children.filter(c => c.id.includes('__usage__'));
    expect(usageLabels.length).toBe(0);
    // The directed items exist as separate child nodes
    const directedNodes = nodes.filter(n =>
      n.cssClasses?.[0] === 'itemusage' &&
      n.children.some(c => c.id.endsWith('__label') && (c.text.includes('engineTorque') || c.text.includes('fuelCmd')))
    );
    expect(directedNodes.length).toBeGreaterThan(0);
  });
});

describe('AFV: flow with payload keeps label', () => {
  it('flow of Payload keeps «flow» label even with pin endpoints', () => {
    const code = `package P {
      item def Fuel;
      action def T { out item fuelOut : Fuel; }
      action def E { in item fuelIn : Fuel; }
      action p {
        action tank : T;
        action engine : E;
        flow of Fuel from tank.fuelOut to engine.fuelIn;
      }
    }`;
    const { edges } = afvPipeline(code);
    const flows = edges.filter(e => e.cssClasses?.[0] === 'flow');
    expect(flows.length).toBe(1);
    expect(flows[0].children.length).toBe(1);
    expect(flows[0].children[0].text).toContain('Fuel');
  });
});
