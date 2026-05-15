import { describe, expect, it, afterEach } from 'vitest';
import { EnvFlagProvider } from './feature-flags.js';

const ENV_KEY = 'FF_STATE_MACHINE_NEW_RENDERER';

describe('EnvFlagProvider', () => {
  afterEach(() => {
    delete process.env[ENV_KEY];
  });

  it('returns false when the env var is unset', async () => {
    delete process.env[ENV_KEY];
    const p = new EnvFlagProvider();
    expect(
      await p.isEnabled('state-machine-new-renderer', { viewType: 'state-machine' }),
    ).toBe(false);
  });

  it('returns true only when the env var is the literal "true"', async () => {
    const p = new EnvFlagProvider();

    process.env[ENV_KEY] = 'true';
    expect(
      await p.isEnabled('state-machine-new-renderer', { viewType: 'state-machine' }),
    ).toBe(true);

    process.env[ENV_KEY] = '1';
    expect(
      await p.isEnabled('state-machine-new-renderer', { viewType: 'state-machine' }),
    ).toBe(false);

    process.env[ENV_KEY] = 'yes';
    expect(
      await p.isEnabled('state-machine-new-renderer', { viewType: 'state-machine' }),
    ).toBe(false);
  });

  it('derives the env var name from the flag key (kebab → upper-snake)', async () => {
    process.env.FF_REQUIREMENT_NEW_RENDERER = 'true';
    const p = new EnvFlagProvider();
    expect(
      await p.isEnabled('requirement-new-renderer', { viewType: 'state-machine' }),
    ).toBe(true);
    delete process.env.FF_REQUIREMENT_NEW_RENDERER;
  });
});
