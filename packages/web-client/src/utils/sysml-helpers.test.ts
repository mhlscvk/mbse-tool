import { describe, it, expect } from 'vitest';
import { parseSysmlElementRanges, getElementNameAtLine, findNodeByName, getNodeSourceRange } from './sysml-helpers.js';
import type { SNode } from '@systemodel/shared-types';

describe('parseSysmlElementRanges', () => {
  it('should parse a simple part definition', () => {
    const text = `package Vehicle {
  part def Engine {
    attribute power : Real;
  }
}`;
    const ranges = parseSysmlElementRanges(text);
    expect(ranges.has('Vehicle')).toBe(true);
    expect(ranges.has('Engine')).toBe(true);
    expect(ranges.get('Vehicle')).toEqual({ startLine: 1, endLine: 5 });
    expect(ranges.get('Engine')).toEqual({ startLine: 2, endLine: 4 });
  });

  it('should parse multiple element types', () => {
    const text = `part def Car {
}
action def Drive {
}
state def Running {
}
port def FuelPort {
}`;
    const ranges = parseSysmlElementRanges(text);
    expect(ranges.has('Car')).toBe(true);
    expect(ranges.has('Drive')).toBe(true);
    expect(ranges.has('Running')).toBe(true);
    expect(ranges.has('FuelPort')).toBe(true);
  });

  it('should handle nested elements with correct brace tracking', () => {
    const text = `part def Outer {
  part def Inner1 {
    attribute a : Integer;
  }
  part def Inner2 {
    attribute b : String;
  }
}`;
    const ranges = parseSysmlElementRanges(text);
    // Outer's closing brace is on line 8 (the last "}")
    expect(ranges.get('Outer')!.startLine).toBe(1);
    expect(ranges.get('Inner1')).toEqual({ startLine: 2, endLine: 4 });
    expect(ranges.get('Inner2')).toEqual({ startLine: 5, endLine: 7 });
  });

  it('should handle element usages (without def keyword)', () => {
    const text = `part engine : Engine {
  attribute rpm : Integer;
}`;
    const ranges = parseSysmlElementRanges(text);
    expect(ranges.has('engine')).toBe(true);
    expect(ranges.get('engine')).toEqual({ startLine: 1, endLine: 3 });
  });

  it('should return empty map for text without SysML elements', () => {
    const text = `// Just a comment
private import ScalarValues::*;`;
    const ranges = parseSysmlElementRanges(text);
    expect(ranges.size).toBe(0);
  });

  it('should handle empty text', () => {
    const ranges = parseSysmlElementRanges('');
    expect(ranges.size).toBe(0);
  });

  it('should handle element on a single line', () => {
    const text = `part def Simple { }`;
    const ranges = parseSysmlElementRanges(text);
    expect(ranges.has('Simple')).toBe(true);
    expect(ranges.get('Simple')).toEqual({ startLine: 1, endLine: 1 });
  });

  it('should handle attribute definitions', () => {
    const text = `attribute def Speed {
  attribute value : Real;
}`;
    const ranges = parseSysmlElementRanges(text);
    expect(ranges.has('Speed')).toBe(true);
  });

  it('should handle connection and interface definitions', () => {
    const text = `connection def Link {
}
interface def Connector {
}`;
    const ranges = parseSysmlElementRanges(text);
    expect(ranges.has('Link')).toBe(true);
    expect(ranges.has('Connector')).toBe(true);
  });

  it('should handle item definitions', () => {
    const text = `item def Fuel {
  attribute octane : Integer;
}`;
    const ranges = parseSysmlElementRanges(text);
    expect(ranges.has('Fuel')).toBe(true);
  });
});

describe('getElementNameAtLine', () => {
  const text = `package MyPackage {
  part def Vehicle {
    attribute speed : Real;
    part engine : Engine {
      attribute power : Real;
    }
  }
}`;

  it('should find element at its definition line', () => {
    expect(getElementNameAtLine(text, 1)).toBe('MyPackage');
    expect(getElementNameAtLine(text, 2)).toBe('Vehicle');
    expect(getElementNameAtLine(text, 4)).toBe('engine');
  });

  it('should find nearest element when inside a block', () => {
    // Line 3 is "attribute speed : Real;" — attribute matches the pattern
    expect(getElementNameAtLine(text, 3)).toBe('speed');
    // Line 5 is "attribute power : Real;" — attribute matches
    expect(getElementNameAtLine(text, 5)).toBe('power');
    // Line 6 is "}" closing engine — nearest def above is engine
    expect(getElementNameAtLine(text, 6)).toBe('power');
  });

  it('should return null for line before any element', () => {
    const text2 = `// header comment
package Foo {
}`;
    expect(getElementNameAtLine(text2, 1)).toBeNull();
  });

  it('should return null for empty text', () => {
    expect(getElementNameAtLine('', 1)).toBeNull();
  });

  it('should handle line beyond text length by searching from last line', () => {
    // Last definition found searching upward from end is "attribute power"
    expect(getElementNameAtLine(text, 100)).toBe('power');
  });
});

describe('findNodeByName', () => {
  const makeNode = (id: string, label: string): SNode => ({
    type: 'node',
    id,
    position: { x: 0, y: 0 },
    size: { width: 100, height: 50 },
    children: [
      { type: 'label', id: `${id}__label`, text: label, position: { x: 0, y: 0 } },
    ],
    cssClasses: ['partdefinition'],
  });

  const nodes = [
    makeNode('n1', 'Vehicle'),
    makeNode('n2', 'Engine'),
    makeNode('n3', 'Wheel'),
  ];

  it('should find a node by exact name match', () => {
    const result = findNodeByName(nodes, 'Engine');
    expect(result).toBeDefined();
    expect(result!.id).toBe('n2');
  });

  it('should return undefined for non-existent name', () => {
    expect(findNodeByName(nodes, 'Transmission')).toBeUndefined();
  });

  it('should return undefined for empty nodes array', () => {
    expect(findNodeByName([], 'Vehicle')).toBeUndefined();
  });

  it('should be case-sensitive', () => {
    expect(findNodeByName(nodes, 'vehicle')).toBeUndefined();
    expect(findNodeByName(nodes, 'Vehicle')).toBeDefined();
  });
});

describe('getNodeSourceRange', () => {
  it('should extract range from node data', () => {
    const node: SNode = {
      type: 'node', id: 'n1',
      position: { x: 0, y: 0 }, size: { width: 100, height: 50 },
      children: [], cssClasses: [],
      data: { range: { start: { line: 5, character: 2 }, end: { line: 10, character: 1 } } },
    };
    const range = getNodeSourceRange(node);
    expect(range).toEqual({ start: { line: 5, character: 2 }, end: { line: 10, character: 1 } });
  });

  it('should return undefined when node has no data', () => {
    const node: SNode = {
      type: 'node', id: 'n1',
      position: { x: 0, y: 0 }, size: { width: 100, height: 50 },
      children: [], cssClasses: [],
    };
    expect(getNodeSourceRange(node)).toBeUndefined();
  });

  it('should return undefined when node data has no range', () => {
    const node: SNode = {
      type: 'node', id: 'n1',
      position: { x: 0, y: 0 }, size: { width: 100, height: 50 },
      children: [], cssClasses: [],
      data: { someOther: 'value' },
    };
    expect(getNodeSourceRange(node)).toBeUndefined();
  });
});
