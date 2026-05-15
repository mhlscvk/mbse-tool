import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ZodError } from 'zod';
import { FeatureFlagsService } from './feature-flags-service.js';

function makePrisma(initial: unknown = null) {
  let stored: unknown = initial;
  return {
    state: () => stored,
    user: {
      findUnique: vi.fn(async () => ({ featureFlags: stored })),
      update: vi.fn(async (args: { data: { featureFlags: unknown } }) => {
        stored = args.data.featureFlags;
        return { id: 'u1', featureFlags: stored };
      }),
    },
  };
}

describe('FeatureFlagsService.get', () => {
  it('returns {} when the row has no featureFlags', async () => {
    const prisma = makePrisma(null);
    const svc = new FeatureFlagsService(prisma as never);
    expect(await svc.get('u1')).toEqual({});
  });

  it('returns the boolean flags that are set', async () => {
    const prisma = makePrisma({
      'state-machine-new-renderer': true,
      'requirement-new-renderer': false,
    });
    const svc = new FeatureFlagsService(prisma as never);
    const flags = await svc.get('u1');
    expect(flags['state-machine-new-renderer']).toBe(true);
    expect(flags['requirement-new-renderer']).toBe(false);
  });

  it('rejects an unknown key with ZodError (strict schema)', async () => {
    const prisma = makePrisma({ 'pixel-doubler': true });
    const svc = new FeatureFlagsService(prisma as never);
    await expect(svc.get('u1')).rejects.toBeInstanceOf(ZodError);
  });
});

describe('FeatureFlagsService.set', () => {
  it('writes a fresh row when none exists', async () => {
    const prisma = makePrisma(null);
    const svc = new FeatureFlagsService(prisma as never);
    const merged = await svc.set('u1', { 'state-machine-new-renderer': true });
    expect(merged).toEqual({ 'state-machine-new-renderer': true });
    expect(prisma.state()).toEqual({ 'state-machine-new-renderer': true });
  });

  it('merges into existing flags rather than replacing the row', async () => {
    const prisma = makePrisma({ 'state-machine-new-renderer': true });
    const svc = new FeatureFlagsService(prisma as never);
    const merged = await svc.set('u1', { 'requirement-new-renderer': false });
    expect(merged).toEqual({
      'state-machine-new-renderer': true,
      'requirement-new-renderer': false,
    });
  });

  it('treats null as a key deletion (null-as-delete semantic)', async () => {
    const prisma = makePrisma({
      'state-machine-new-renderer': true,
      'requirement-new-renderer': false,
    });
    const svc = new FeatureFlagsService(prisma as never);
    const merged = await svc.set('u1', { 'requirement-new-renderer': null });
    expect(merged).toEqual({ 'state-machine-new-renderer': true });
    expect(merged).not.toHaveProperty('requirement-new-renderer');
  });

  it('rejects unknown patch keys with ZodError', async () => {
    const prisma = makePrisma(null);
    const svc = new FeatureFlagsService(prisma as never);
    await expect(svc.set('u1', { 'unknown-flag': true } as never)).rejects.toBeInstanceOf(ZodError);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('keys not mentioned in the patch are left untouched', async () => {
    const prisma = makePrisma({ 'state-machine-new-renderer': true });
    const svc = new FeatureFlagsService(prisma as never);
    const merged = await svc.set('u1', {});
    expect(merged).toEqual({ 'state-machine-new-renderer': true });
  });
});
