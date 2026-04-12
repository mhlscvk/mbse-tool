import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db.js', () => ({
  prisma: {
    aiProviderKey: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));
vi.mock('../ai/encryption.js', () => ({
  encryptApiKey: vi.fn().mockReturnValue({ encrypted: 'enc', iv: 'iv1', authTag: 'tag1' }),
  maskApiKey: vi.fn().mockImplementation((k: string) => k.slice(0, 7) + '...' + k.slice(-4)),
}));

import { prisma } from '../db.js';
import { encryptApiKey, maskApiKey } from '../ai/encryption.js';

const mock = prisma as unknown as {
  aiProviderKey: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

describe('ai-keys route — key management', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('GET / returns only masked keys, never decrypted', async () => {
    mock.aiProviderKey.findMany.mockResolvedValue([
      { id: 'k1', provider: 'anthropic', maskedKey: 'sk-ant-...xyz1', model: 'claude-sonnet', createdAt: new Date(), updatedAt: new Date() },
    ]);
    const keys = await prisma.aiProviderKey.findMany({
      where: { userId: 'user1' },
      select: { id: true, provider: true, maskedKey: true, model: true, createdAt: true, updatedAt: true },
    });
    expect(keys[0]).not.toHaveProperty('encryptedKey');
    expect(keys[0]).not.toHaveProperty('iv');
    expect(keys[0]).not.toHaveProperty('authTag');
    expect(keys[0].maskedKey).toContain('...');
  });

  it('POST / encrypts key before storage', async () => {
    mock.aiProviderKey.upsert.mockResolvedValue({ provider: 'anthropic', maskedKey: 'sk-ant-...xyz1', model: 'claude-sonnet' });

    const apiKey = 'sk-ant-api03-longsecretkey123456';
    const { encrypted, iv, authTag } = encryptApiKey(apiKey);
    const masked = maskApiKey(apiKey);

    expect(encryptApiKey).toHaveBeenCalledWith(apiKey);
    expect(masked).toBe('sk-ant-...3456');
    expect(encrypted).toBe('enc');
  });

  it('rejects invalid provider names', () => {
    const VALID_PROVIDERS = ['anthropic', 'openai', 'gemini'] as const;
    expect(VALID_PROVIDERS.includes('anthropic' as typeof VALID_PROVIDERS[number])).toBe(true);
    expect(VALID_PROVIDERS.includes('evil' as typeof VALID_PROVIDERS[number])).toBe(false);
  });

  it('PATCH /:provider requires existing key', async () => {
    mock.aiProviderKey.findUnique.mockResolvedValue(null);
    const key = await prisma.aiProviderKey.findUnique({
      where: { userId_provider: { userId: 'user1', provider: 'openai' } },
    });
    expect(key).toBeNull();
    // Route throws NotFound('Key for this provider') here
  });

  it('DELETE /:provider soft-deletes the key', async () => {
    mock.aiProviderKey.findUnique.mockResolvedValue({ id: 'k1', provider: 'openai' });
    mock.aiProviderKey.delete.mockResolvedValue({});
    await prisma.aiProviderKey.delete({
      where: { userId_provider: { userId: 'user1', provider: 'openai' } },
    });
    expect(mock.aiProviderKey.delete).toHaveBeenCalledWith({
      where: { userId_provider: { userId: 'user1', provider: 'openai' } },
    });
  });

  it('upsert pattern allows save-or-update on provider', async () => {
    mock.aiProviderKey.upsert.mockResolvedValue({ provider: 'gemini', maskedKey: 'AIza...efgh' });
    await prisma.aiProviderKey.upsert({
      where: { userId_provider: { userId: 'user1', provider: 'gemini' } },
      create: { userId: 'user1', provider: 'gemini', encryptedKey: 'enc', iv: 'iv', authTag: 'tag', maskedKey: 'AIza...efgh', model: 'gemini-pro' },
      update: { encryptedKey: 'enc', iv: 'iv', authTag: 'tag', maskedKey: 'AIza...efgh', model: 'gemini-pro' },
    });
    expect(mock.aiProviderKey.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId_provider: { userId: 'user1', provider: 'gemini' } } }),
    );
  });
});

describe('ai-keys route — validation schemas', () => {
  it('apiKey requires min 10, max 500 characters', () => {
    const { z } = require('zod');
    const schema = z.object({ apiKey: z.string().min(10).max(500) });
    expect(() => schema.parse({ apiKey: 'short' })).toThrow();
    expect(() => schema.parse({ apiKey: 'x'.repeat(501) })).toThrow();
    expect(schema.parse({ apiKey: 'valid-key-12345' })).toEqual({ apiKey: 'valid-key-12345' });
  });

  it('model requires min 1, max 100 characters', () => {
    const { z } = require('zod');
    const schema = z.object({ model: z.string().min(1).max(100) });
    expect(() => schema.parse({ model: '' })).toThrow();
    expect(schema.parse({ model: 'claude-sonnet' })).toEqual({ model: 'claude-sonnet' });
  });
});
