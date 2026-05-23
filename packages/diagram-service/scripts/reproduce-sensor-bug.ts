// Slice 2d.1 hotfix reproduction harness.
//
// Reproduces the "Cannot set properties of undefined (setting 'compartments')"
// crash the new state-machine renderer throws on real-world state machines that
// are modelled as a `state` USAGE nested in a part hierarchy (idiomatic SysML v2
// / MagicGrid), rather than as a standalone `state def` like the existing
// sensor-systems fixture.
//
// NEEDS A MODEL FILE at scripts/sensorsystem-real.sysml. That file is the real
// production SensorSystem.sysml (DB id cmolrsqrq002oglb7a41d5fz5) — it is
// gitignored and was deleted at the end of the 2026-05-23 session because it is
// the user's IP. To re-run:
//   • drop the anonymized fixture (created in Slice 2d.1) here, OR
//   • re-fetch the prod model:
//     ssh root@65.109.134.254 'docker exec systemodel-db psql -U postgres \
//       -d systemodel -tAc "SELECT content FROM sysml_files WHERE id=''...'';"' \
//       > packages/diagram-service/scripts/sensorsystem-real.sysml
//
// Run: cd packages/diagram-service && npx tsx scripts/reproduce-sensor-bug.ts

import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { parseSysMLText } from '../src/parser/sysml-text-parser.js';
import { transformAstToStateMachineIR } from '../src/rendering/state-machine/transformer.js';
import { stateMachineToSModelRoot } from '../src/rendering/state-machine/renderer.js';

const here = dirname(fileURLToPath(import.meta.url));
const modelPath = resolve(here, 'sensorsystem-real.sysml');

if (!existsSync(modelPath)) {
  console.error('No model file at scripts/sensorsystem-real.sysml.');
  console.error('Drop the anonymized fixture (or the prod model — gitignored) there. See header.');
  process.exit(1);
}

const text = readFileSync(modelPath, 'utf-8');
const { model, diagnostics } = parseSysMLText('file:///sensorsystem-real.sysml', text);

const byKind: Record<string, number> = {};
for (const n of model.nodes) byKind[n.kind] = (byKind[n.kind] ?? 0) + 1;

console.log('=== node kind counts ===');
console.log(byKind);

const states = model.nodes.filter(n => n.kind === 'StateUsage');
const defs = model.nodes.filter(n => n.kind === 'StateDefinition');
console.log('StateUsage:', states.length, states.map(s => s.name));
console.log('StateDefinition:', defs.length, defs.map(d => d.name));

const conns = model.connections;
console.log(
  'connections total:', conns.length,
  '| transition:', conns.filter(c => c.kind === 'transition').length,
  '| composition:', conns.filter(c => c.kind === 'composition').length,
);
console.log('parse diagnostics:', diagnostics.length);

console.log('\n=== transformer call ===');
try {
  const ir = transformAstToStateMachineIR(model, { viewType: 'state-transition', showInherited: false });
  console.log('transformer OK — IR nodes:', ir.nodes.length, 'edges:', ir.edges.length);
  try {
    const sm = stateMachineToSModelRoot(ir);
    console.log('renderer OK — SModelRoot children:', sm.children.length);
  } catch (err) {
    console.error('RENDERER THREW:');
    console.error(err instanceof Error ? err.stack : err);
  }
} catch (err) {
  console.error('TRANSFORMER THREW:');
  console.error(err instanceof Error ? err.stack : err);
}
