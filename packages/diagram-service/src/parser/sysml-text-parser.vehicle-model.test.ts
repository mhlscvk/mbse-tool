/**
 * Parser validation against the official OMG SysML v2 Simple Vehicle Model
 * Source: https://www.omg.org/spec/SysML/2.0 (ptc/25-04-31)
 * 1,580 lines covering the full SysML v2 language
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseSysMLText } from './sysml-text-parser.js';

const src = readFileSync(join(__dirname, 'fixtures/SimpleVehicleModel.sysml'), 'utf8');
const { model, diagnostics } = parseSysMLText('SimpleVehicleModel.sysml', src);

describe('Official OMG SimpleVehicleModel (ptc/25-04-31)', () => {

  it('parses without errors', () => {
    const errors = diagnostics.filter(d => d.severity === 'error');
    expect(errors).toEqual([]);
  });

  it('produces a substantial model (500+ nodes, 700+ connections)', () => {
    expect(model.nodes.length).toBeGreaterThan(500);
    expect(model.connections.length).toBeGreaterThan(700);
  });

  // ── Structural elements ──────────────────────────────────────────────

  describe('Part definitions', () => {
    const partDefs = model.nodes.filter(n => n.kind === 'PartDefinition');

    it('parses 30+ part definitions', () => {
      expect(partDefs.length).toBeGreaterThanOrEqual(30);
    });

    it('includes Vehicle', () => {
      expect(partDefs.some(n => n.name === 'Vehicle')).toBe(true);
    });

    it('includes Engine', () => {
      expect(partDefs.some(n => n.name === 'Engine')).toBe(true);
    });

    it('includes Transmission', () => {
      expect(partDefs.some(n => n.name === 'Transmission')).toBe(true);
    });

    it('includes Wheel', () => {
      expect(partDefs.some(n => n.name === 'Wheel')).toBe(true);
    });
  });

  describe('Part usages', () => {
    const partUsages = model.nodes.filter(n => n.kind === 'PartUsage');

    it('parses 80+ part usages', () => {
      expect(partUsages.length).toBeGreaterThanOrEqual(80);
    });

    it('includes vehicle instances', () => {
      expect(partUsages.some(n => n.name === 'vehicle')).toBe(true);
    });

    it('includes engine instances', () => {
      expect(partUsages.some(n => n.name === 'engine')).toBe(true);
    });
  });

  // ── Port definitions & usages ──────────────────────────────────────

  describe('Ports', () => {
    const portDefs = model.nodes.filter(n => n.kind === 'PortDefinition');
    const portUsages = model.nodes.filter(n => n.kind === 'PortUsage');

    it('parses 20+ port definitions', () => {
      expect(portDefs.length).toBeGreaterThanOrEqual(20);
    });

    it('parses 60+ port usages', () => {
      expect(portUsages.length).toBeGreaterThanOrEqual(60);
    });
  });

  // ── Attributes ─────────────────────────────────────────────────────

  describe('Attributes', () => {
    const attrDefs = model.nodes.filter(n => n.kind === 'AttributeDefinition');
    const attrUsages = model.nodes.filter(n => n.kind === 'AttributeUsage');

    it('parses attribute definitions', () => {
      expect(attrDefs.length).toBeGreaterThanOrEqual(5);
    });

    it('parses 50+ attribute usages', () => {
      expect(attrUsages.length).toBeGreaterThanOrEqual(50);
    });
  });

  // ── Actions ────────────────────────────────────────────────────────

  describe('Actions', () => {
    const actionDefs = model.nodes.filter(n => n.kind === 'ActionDefinition');
    const actionUsages = model.nodes.filter(n => n.kind === 'ActionUsage');
    const performs = model.nodes.filter(n => n.kind === 'PerformActionUsage');

    it('parses action definitions', () => {
      expect(actionDefs.length).toBeGreaterThanOrEqual(5);
    });

    it('parses 30+ action usages', () => {
      expect(actionUsages.length).toBeGreaterThanOrEqual(30);
    });

    it('parses perform action usages', () => {
      expect(performs.length).toBeGreaterThanOrEqual(5);
    });
  });

  // ── States ─────────────────────────────────────────────────────────

  describe('States', () => {
    const stateDefs = model.nodes.filter(n => n.kind === 'StateDefinition');
    const stateUsages = model.nodes.filter(n => n.kind === 'StateUsage');
    const exhibits = model.nodes.filter(n => n.kind === 'ExhibitStateUsage');
    const entries = model.nodes.filter(n => n.kind === 'EntryActionUsage');
    const dos = model.nodes.filter(n => n.kind === 'DoActionUsage');

    it('parses state definitions', () => {
      expect(stateDefs.length).toBeGreaterThanOrEqual(2);
    });

    it('parses 15+ state usages', () => {
      expect(stateUsages.length).toBeGreaterThanOrEqual(15);
    });

    it('parses exhibit state usages', () => {
      expect(exhibits.length).toBeGreaterThanOrEqual(2);
    });

    it('parses entry/do actions', () => {
      expect(entries.length).toBeGreaterThanOrEqual(2);
      expect(dos.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── Requirements ───────────────────────────────────────────────────

  describe('Requirements', () => {
    const reqDefs = model.nodes.filter(n => n.kind === 'RequirementDefinition');
    const reqUsages = model.nodes.filter(n => n.kind === 'RequirementUsage');

    it('parses requirement definitions', () => {
      expect(reqDefs.length).toBeGreaterThanOrEqual(3);
    });

    it('parses requirement usages', () => {
      expect(reqUsages.length).toBeGreaterThanOrEqual(5);
    });
  });

  // ── Use Cases ──────────────────────────────────────────────────────

  describe('Use Cases', () => {
    const ucDefs = model.nodes.filter(n => n.kind === 'UseCaseDefinition');
    const ucUsages = model.nodes.filter(n => n.kind === 'UseCaseUsage');

    it('parses use case definitions', () => {
      expect(ucDefs.length).toBeGreaterThanOrEqual(2);
    });

    it('parses use case usages', () => {
      expect(ucUsages.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── Calculations ───────────────────────────────────────────────────

  describe('Calculations', () => {
    const calcDefs = model.nodes.filter(n => n.kind === 'CalcDefinition');

    it('parses calc definitions (analysis)', () => {
      expect(calcDefs.length).toBeGreaterThanOrEqual(5);
    });
  });

  // ── P1 behavioral types ────────────────────────────────────────────

  describe('P1 behavioral types', () => {
    it('parses AcceptActionUsage', () => {
      expect(model.nodes.filter(n => n.kind === 'AcceptActionUsage').length).toBeGreaterThanOrEqual(1);
    });

    it('parses EventOccurrenceUsage', () => {
      expect(model.nodes.filter(n => n.kind === 'EventOccurrenceUsage').length).toBeGreaterThanOrEqual(1);
    });

    it('parses AssertConstraintUsage', () => {
      expect(model.nodes.filter(n => n.kind === 'AssertConstraintUsage').length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── P3 membership types ────────────────────────────────────────────

  describe('P3 membership types', () => {
    it('parses SubjectMembership', () => {
      expect(model.nodes.filter(n => n.kind === 'SubjectMembership').length).toBeGreaterThanOrEqual(1);
    });

    it('parses ActorMembership', () => {
      expect(model.nodes.filter(n => n.kind === 'ActorMembership').length).toBeGreaterThanOrEqual(1);
    });

    it('parses ObjectiveMembership', () => {
      expect(model.nodes.filter(n => n.kind === 'ObjectiveMembership').length).toBeGreaterThanOrEqual(1);
    });

    it('parses ViewRenderingMembership', () => {
      expect(model.nodes.filter(n => n.kind === 'ViewRenderingMembership').length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Views ──────────────────────────────────────────────────────────

  describe('Views', () => {
    const viewDefs = model.nodes.filter(n => n.kind === 'ViewDefinition');
    const viewUsages = model.nodes.filter(n => n.kind === 'ViewUsage');
    const vpDefs = model.nodes.filter(n => n.kind === 'ViewpointDefinition');

    it('parses view definitions', () => {
      expect(viewDefs.length).toBeGreaterThanOrEqual(2);
    });

    it('parses viewpoint definitions', () => {
      expect(vpDefs.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Control nodes ──────────────────────────────────────────────────

  describe('Control nodes', () => {
    it('parses fork nodes', () => {
      expect(model.nodes.filter(n => n.kind === 'ForkNode').length).toBeGreaterThanOrEqual(1);
    });

    it('parses join nodes', () => {
      expect(model.nodes.filter(n => n.kind === 'JoinNode').length).toBeGreaterThanOrEqual(1);
    });

    it('parses start/done nodes', () => {
      expect(model.nodes.filter(n => n.kind === 'StartNode').length).toBeGreaterThanOrEqual(1);
      expect(model.nodes.filter(n => n.kind === 'DoneNode').length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Connections ────────────────────────────────────────────────────

  describe('Connection kinds', () => {
    const edgeKinds = new Set(model.connections.map(c => c.kind));

    it('has composition edges', () => {
      expect(edgeKinds.has('composition')).toBe(true);
    });

    it('has type reference edges', () => {
      expect(edgeKinds.has('typereference')).toBe(true);
    });

    it('has succession edges', () => {
      expect(edgeKinds.has('succession')).toBe(true);
    });

    it('has transition edges', () => {
      expect(edgeKinds.has('transition')).toBe(true);
    });

    it('has flow edges', () => {
      expect(edgeKinds.has('flow')).toBe(true);
    });

    it('has message edges', () => {
      expect(edgeKinds.has('message')).toBe(true);
    });

    it('has bind edges', () => {
      expect(edgeKinds.has('bind')).toBe(true);
    });

    it('has subsetting edges', () => {
      expect(edgeKinds.has('subsetting')).toBe(true);
    });

    it('has redefinition edges', () => {
      expect(edgeKinds.has('redefinition')).toBe(true);
    });

    it('has allocate edges', () => {
      expect(edgeKinds.has('allocate')).toBe(true);
    });
  });

  // ── Packages ───────────────────────────────────────────────────────

  describe('Packages', () => {
    const packages = model.nodes.filter(n => n.kind === 'Package');

    it('parses 50+ packages', () => {
      expect(packages.length).toBeGreaterThanOrEqual(50);
    });

    it('includes top-level SimpleVehicleModel', () => {
      expect(packages.some(n => n.name === 'SimpleVehicleModel')).toBe(true);
    });

    it('includes Definitions package', () => {
      expect(packages.some(n => n.name === 'Definitions')).toBe(true);
    });
  });

  // ── Enumerations ───────────────────────────────────────────────────

  describe('Enumerations', () => {
    const enumDefs = model.nodes.filter(n => n.kind === 'EnumDefinition');

    it('parses enum definitions', () => {
      expect(enumDefs.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── Misc ───────────────────────────────────────────────────────────

  describe('Other elements', () => {
    it('parses interface definitions', () => {
      expect(model.nodes.filter(n => n.kind === 'InterfaceDefinition').length).toBeGreaterThanOrEqual(2);
    });

    it('parses allocation definition', () => {
      expect(model.nodes.filter(n => n.kind === 'AllocationDefinition').length).toBeGreaterThanOrEqual(1);
    });

    it('parses metadata definitions', () => {
      expect(model.nodes.filter(n => n.kind === 'MetadataDefinition').length).toBeGreaterThanOrEqual(1);
    });

    it('parses concern definition', () => {
      expect(model.nodes.filter(n => n.kind === 'ConcernDefinition').length).toBeGreaterThanOrEqual(1);
    });

    it('parses comments', () => {
      expect(model.nodes.filter(n => n.kind === 'Comment').length).toBeGreaterThanOrEqual(5);
    });

    it('parses alias', () => {
      expect(model.nodes.filter(n => n.kind === 'Alias').length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Node kind coverage ─────────────────────────────────────────────

  describe('Node kind diversity', () => {
    const kinds = new Set(model.nodes.map(n => n.kind));

    it('produces 30+ distinct node kinds', () => {
      expect(kinds.size).toBeGreaterThanOrEqual(30);
    });

    it('covers all major SysML v2 functional areas', () => {
      // Structure
      expect(kinds.has('PartDefinition')).toBe(true);
      expect(kinds.has('PartUsage')).toBe(true);
      expect(kinds.has('PortDefinition')).toBe(true);
      expect(kinds.has('PortUsage')).toBe(true);
      // Behavior
      expect(kinds.has('ActionDefinition')).toBe(true);
      expect(kinds.has('ActionUsage')).toBe(true);
      expect(kinds.has('StateDefinition')).toBe(true);
      expect(kinds.has('StateUsage')).toBe(true);
      // Requirements
      expect(kinds.has('RequirementDefinition')).toBe(true);
      expect(kinds.has('RequirementUsage')).toBe(true);
      // Cases
      expect(kinds.has('UseCaseDefinition')).toBe(true);
      expect(kinds.has('UseCaseUsage')).toBe(true);
      // Views
      expect(kinds.has('ViewDefinition')).toBe(true);
      expect(kinds.has('ViewpointDefinition')).toBe(true);
    });
  });
});
