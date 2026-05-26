// Slice 5 — top-level / sub-state pseudo-initial render-loss diagnosis (α vs γ).
//
// WS-frame probe (Tarayıcı, 2026-05-26) proved prod sends NO pseudo-initial /
// startnode node for SensorSystem (DB id cmolrsqrq002oglb7a41d5fz5): 18 nodes,
// all state__*/behavior__*, zero startnode cssClass. Backend drops it. β (frontend)
// is ruled out. This harness runs the REAL prod model layer-by-layer to split:
//   (α)            transformer emits a pseudo-initial, the view-filter drops it
//   (γ-not-a-bug)  AST declares no StartNode → no initial to render (claim moot)
//   (γ-real-bug)   present in raw IR, lost in SModel build outside the filter
//
// NEEDS scripts/sensorsystem-real.sysml (gitignored, user IP — re-fetch via the
// reproduce-sensor-bug.ts header command). Run:
//   cd packages/diagram-service && npx tsx scripts/reproduce-slice5-pseudo-initial.ts

import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { parseSysMLText } from '../src/parser/sysml-text-parser.js';
import { transformAstToStateMachineIR } from '../src/rendering/state-machine/transformer.js';
import { stateMachineToSModelRoot } from '../src/rendering/state-machine/renderer.js';
import { applyViewFilter } from '../src/transformer/view-filters.js';

const here = dirname(fileURLToPath(import.meta.url));
const modelPath = resolve(here, 'sensorsystem-real.sysml');
if (!existsSync(modelPath)) {
  console.error('No model file at scripts/sensorsystem-real.sysml. See header to re-fetch.');
  process.exit(1);
}

const text = readFileSync(modelPath, 'utf-8');
const { model, diagnostics } = parseSysMLText('file:///sensorsystem-real.sysml', text);
const spec = { viewType: 'state-transition' as const, showInherited: false };

const isPseudoInitial = (n: { id?: string; kind?: string }) =>
  (n.kind === 'pseudo-initial') || /pseudo-initial/.test(n.id ?? '');

// ── AST-level: does the model declare initials (StartNode)? + filter precondition ──
const parentOf = new Map<string, string>();
for (const c of model.connections) {
  if (c.kind === 'composition' || c.kind === 'noncomposite') parentOf.set(c.targetId, c.sourceId);
}
const nameOf = new Map(model.nodes.map(n => [n.id, n.name ?? n.id]));
const entryParents = new Set<string>();
for (const n of model.nodes) {
  if (n.kind === 'EntryActionUsage') { const p = parentOf.get(n.id); if (p) entryParents.add(p); }
}
const startNodes = model.nodes.filter(n => n.kind === 'StartNode');

console.log('=== AST (parsed real prod model) ===');
console.log('parse diagnostics:', diagnostics.length);
const byKind: Record<string, number> = {};
for (const n of model.nodes) byKind[n.kind] = (byKind[n.kind] ?? 0) + 1;
console.log('node kind counts:', byKind);
console.log('StartNode count:', startNodes.length);
for (const s of startNodes) {
  const p = parentOf.get(s.id);
  console.log(`  StartNode ${s.id}: parent=${p ? `${nameOf.get(p)} (${p})` : 'NONE/root'}  parentHasEntryAction=${p ? entryParents.has(p) : false}`);
}

function safe<T>(label: string, fn: () => T): T | undefined {
  try { return fn(); } catch (err) { console.error(`${label} THREW:`, err instanceof Error ? err.message : err); return undefined; }
}

// ── Layer 1: raw IR (no filter) ──
const rawIr = safe('transformer (raw)', () => transformAstToStateMachineIR(model, spec));
const rawPseudo = rawIr ? rawIr.nodes.filter(isPseudoInitial) : [];
console.log('\n=== Layer 1 — RAW IR (transformer, no filter) ===');
console.log('IR nodes:', rawIr?.nodes.length, '| pseudo-initial:', rawPseudo.length, rawPseudo.map(n => n.id));

// ── Layer 2: filtered model → filtered IR ──
const filtered = applyViewFilter(model, 'state-transition');
const filteredStart = filtered.nodes.filter(n => n.kind === 'StartNode');
const filteredModel = { uri: model.uri, nodes: filtered.nodes, connections: filtered.connections };
const filteredIr = safe('transformer (filtered)', () => transformAstToStateMachineIR(filteredModel as never, spec));
const filtPseudo = filteredIr ? filteredIr.nodes.filter(isPseudoInitial) : [];
console.log('\n=== Layer 2 — POST view-filter ===');
console.log('AST StartNode:', startNodes.length, '→ filtered model StartNode:', filteredStart.length,
  filteredStart.length < startNodes.length ? '  ← FILTER DROPPED START NODE(S)' : '');
console.log('filtered IR pseudo-initial:', filtPseudo.length, filtPseudo.map(n => n.id));

// ── Layer 3: final SModel (frontend-bound) ──
const sModel = filteredIr ? safe('renderer', () => stateMachineToSModelRoot(filteredIr)) : undefined;
const smPseudo = sModel ? (sModel.children as Array<{ id: string; cssClasses?: string[] }>)
  .filter(c => isPseudoInitial(c) || c.cssClasses?.[0] === 'startnode') : [];
console.log('\n=== Layer 3 — FINAL SModel ===');
console.log('SModel children:', sModel?.children.length, '| startnode/pseudo-initial:', smPseudo.length, smPseudo.map(c => c.id));

// ── Attribution ──
console.log('\n=== ATTRIBUTION ===');
if (startNodes.length === 0) {
  console.log('γ-not-a-bug: AST declares ZERO StartNode → model never declared an initial → absence is CORRECT, claim MOOT.');
} else if (rawPseudo.length === 0) {
  console.log('γ-transformer: AST has StartNode(s) but raw IR has 0 pseudo-initial → transformer emit gap (bug in transformer).');
} else if (filtPseudo.length === 0) {
  console.log(`α-CONFIRMED: transformer emits ${rawPseudo.length} pseudo-initial, view-filter drops all. StartNode ${startNodes.length}→${filteredStart.length}.`);
  console.log('  Which filter line: parent-entry-hide (view-filters.ts:171-178) if a StartNode parentHasEntryAction=true above;');
  console.log('  else orphan-prune (view-filters.ts:232+) after start→entry remap.');
} else if (smPseudo.length === 0) {
  console.log('γ-real-bug: pseudo-initial survives the filter but is lost in SModel build (renderer/post step).');
} else {
  console.log('UNEXPECTED: pseudo-initial survives all backend layers — contradicts the WS-frame probe. Re-examine (maybe prod build != source, or viewType mapping differs).');
}
