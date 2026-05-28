// Slice 6c Aşama 1 — parser regression tests for interface def `end` handling.
// Bug-A (no end nodes) and Bug-B (scope-blind connect resolver) are tested
// jointly: the proof a parsed model "looks right" is what the rest of the
// diagram pipeline consumes. Identity tests at the bottom guarantee the
// outside-def `connect` resolution stays unchanged (no cross-view regression).

import { describe, it, expect } from 'vitest';
import { parseSysMLText } from './sysml-text-parser.js';

function parse(code: string) {
  return parseSysMLText('test://interface-ends', code).model;
}

describe('Slice 6c — interface def end declarations (Bug-A)', () => {
  it('named typed end → PortUsage node + composition + typereference', () => {
    const model = parse(`
      port def Pd;
      interface def Iface {
        end ep : Pd;
      }
    `);
    const end = model.nodes.find(n => n.name === 'ep');
    expect(end).toBeDefined();
    expect(end!.kind).toBe('PortUsage');
    expect(end!.id).toBe('usage__Iface_ep');
    expect(end!.qualifiedName).toBe('Pd');

    const iface = model.nodes.find(n => n.name === 'Iface')!;
    const pd = model.nodes.find(n => n.name === 'Pd')!;
    expect(model.connections).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'composition', sourceId: iface.id, targetId: end!.id }),
      expect.objectContaining({ kind: 'typereference', sourceId: end!.id, targetId: pd.id }),
    ]));
  });

  it('named end without type → node + composition, no typereference', () => {
    const model = parse(`
      interface def Iface {
        end ep;
      }
    `);
    const end = model.nodes.find(n => n.name === 'ep');
    expect(end).toBeDefined();
    expect(end!.qualifiedName).toBeUndefined();
    expect(model.connections.some(c => c.kind === 'typereference' && c.sourceId === end!.id)).toBe(false);
  });

  it('anonymous end gets synthesized name "end1", "end2" (per-def counter)', () => {
    const model = parse(`
      port def Outlet;
      interface def Iface {
        end : Outlet;
        end : ~Outlet;
      }
    `);
    const ends = model.nodes.filter(n => /^end\d+$/.test(n.name)).sort((a, b) => a.name.localeCompare(b.name));
    expect(ends.map(n => n.name)).toEqual(['end1', 'end2']);
    expect(ends[0].qualifiedName).toBe('Outlet');
    expect(ends[1].qualifiedName).toBe('~Outlet'); // conjugate preserved
  });

  it('named conjugate end (~Type) preserves the prefix in qualifiedName', () => {
    const model = parse(`
      port def Outlet;
      interface def Iface { end consumer : ~Outlet; }
    `);
    const c = model.nodes.find(n => n.name === 'consumer')!;
    expect(c.qualifiedName).toBe('~Outlet');
  });

  it('end is recognised ONLY inside interface/connection defs, not in a part def', () => {
    // `end x : T;` outside a relevant def body must NOT create a node — `end`
    // is a contextual keyword. (A bare `part def` body cannot host ends.)
    const model = parse(`
      port def Pd;
      part def Box {
        end shouldNotExist : Pd;
      }
    `);
    expect(model.nodes.some(n => n.name === 'shouldNotExist')).toBe(false);
  });
});

describe('Slice 6c — def-local scope for interface connect (Bug-B)', () => {
  it('connect resolves the def-local end, NOT a same-named outer port', () => {
    // Two `ep`s in scope: the def-local end and the outer part's port. The
    // pre-fix parser bound to the outer one (Bug-IV-DEF-USAGE-01).
    const model = parse(`
      port def Pd;
      part outer { port ep : Pd; }
      interface def Iface {
        end ep : Pd;
        part inner { port q : Pd; }
        interface connect ep to inner.q;
      }
    `);
    const innerConnect = model.connections.find(c => c.kind === 'association' && /ep\s*→\s*inner\.q/.test(c.name ?? ''));
    expect(innerConnect).toBeDefined();
    expect(innerConnect!.sourceId).toBe('usage__Iface_ep');         // def-local end, not outer.ep
    expect(innerConnect!.sourceId).not.toBe('usage__outer_ep');
  });

  it('connect outside a def keeps the global resolution (regression guard)', () => {
    // Identity: the system-level connect must keep resolving via the global
    // simple-name slot, otherwise the fix would break every non-def connect.
    const model = parse(`
      port def Pd;
      part a { port p : Pd; }
      part b { port p : Pd; }
      connect a.p to b.p;
    `);
    const conn = model.connections.find(c => c.kind === 'association');
    expect(conn).toBeDefined();
    const a = model.nodes.find(n => n.name === 'a')!;
    const b = model.nodes.find(n => n.name === 'b')!;
    expect(conn!.sourceId).toBe(a.id);
    expect(conn!.targetId).toBe(b.id);
  });

  it('po-interfaces shape: 0 spurious cross-context edges; def-local ends carry the 14', () => {
    // Mini reproduction of the Bug-IV-DEF-USAGE-01 case — must match the
    // hand-verified post-fix counts from CP-1.
    const model = parse(`
      package Interfaces {
        port def USB_A; port def USB_C;
        interface def Iface {
          part converter { port a1; port pin4; interface connect a1 to pin4; }
          end usbA : USB_A;
          end usbC : USB_C;
          interface connect usbC.a1 to converter.a1;
          interface connect converter.pin4 to usbA.pin4;
        }
        part system {
          part adapter { port usbA : USB_A; }
          part device { port usbC : USB_C; }
          interface : Iface connect adapter.usbA to device.usbC;
        }
      }
    `);
    const usbAEnd = model.nodes.find(n => n.id === 'usage__Iface_usbA');
    const usbCEnd = model.nodes.find(n => n.id === 'usage__Iface_usbC');
    expect(usbAEnd).toBeDefined();
    expect(usbCEnd).toBeDefined();

    const spurious = model.connections.filter(c =>
      c.sourceId === 'usage__device_usbC' && /usage__Iface/.test(c.targetId) && c.kind === 'association' ||
      /usage__Iface/.test(c.sourceId) && c.targetId === 'usage__adapter_usbA' && c.kind === 'association',
    );
    expect(spurious).toHaveLength(0);

    const sys = model.connections.find(c =>
      c.kind === 'association' && c.sourceId === 'usage__system_adapter' && c.targetId === 'usage__system_device',
    );
    expect(sys).toBeDefined(); // system-level interface connect preserved
  });
});
