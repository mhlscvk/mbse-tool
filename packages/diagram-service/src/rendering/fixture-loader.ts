// Phase 0 test helper. Loads the source/IR/SModelRoot triple for a state-
// machine fixture so test cases can assert all three layers cheaply. The
// fixture format is documented in tests/fixtures/state-machine/empty/README.md.

import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import type { SModelRoot, StateMachineIR } from '@systemodel/shared-types';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = resolve(here, '../../tests/fixtures/state-machine');

export interface StateMachineFixture {
  name: string;
  sysml: string;
  expectedIR: StateMachineIR;
  expectedSModel: SModelRoot;
}

export function loadStateMachineFixture(name: string): StateMachineFixture {
  const dir = resolve(FIXTURE_ROOT, name);
  return {
    name,
    sysml: readFileSync(resolve(dir, 'model.sysml'), 'utf-8'),
    expectedIR: JSON.parse(readFileSync(resolve(dir, 'expected-ir.json'), 'utf-8')) as StateMachineIR,
    expectedSModel: JSON.parse(readFileSync(resolve(dir, 'expected-smodel.json'), 'utf-8')) as SModelRoot,
  };
}
