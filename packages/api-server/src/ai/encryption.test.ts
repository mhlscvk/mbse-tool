import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import { encryptApiKey, decryptApiKey, maskApiKey } from './encryption.js';

const TEST_KEY = crypto.randomBytes(32).toString('hex');

describe('AI key encryption (AES-256-GCM)', () => {
  beforeEach(() => {
    process.env.AI_ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    delete process.env.AI_ENCRYPTION_KEY;
  });

  it('encrypts and decrypts a key correctly', () => {
    const originalKey = 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890';
    const { encrypted, iv, authTag } = encryptApiKey(originalKey);
    const decrypted = decryptApiKey(encrypted, iv, authTag);
    expect(decrypted).toBe(originalKey);
  });

  it('produces different ciphertexts for same plaintext (random IV)', () => {
    const key = 'sk-test-1234567890';
    const first = encryptApiKey(key);
    const second = encryptApiKey(key);
    expect(first.encrypted).not.toBe(second.encrypted);
    expect(first.iv).not.toBe(second.iv);
  });

  it('detects tampered ciphertext', () => {
    const { encrypted, iv, authTag } = encryptApiKey('sk-test-key');
    // Tamper with the encrypted data
    const tampered = Buffer.from(encrypted, 'base64');
    tampered[0] ^= 0xff;
    expect(() => decryptApiKey(tampered.toString('base64'), iv, authTag)).toThrow();
  });

  it('detects tampered auth tag', () => {
    const { encrypted, iv, authTag } = encryptApiKey('sk-test-key');
    // Tamper with auth tag
    const tamperedTag = Buffer.from(authTag, 'base64');
    tamperedTag[0] ^= 0xff;
    expect(() => decryptApiKey(encrypted, iv, tamperedTag.toString('base64'))).toThrow();
  });

  it('rejects invalid IV length', () => {
    const { encrypted, authTag } = encryptApiKey('sk-test-key');
    const shortIv = Buffer.from([1, 2, 3]).toString('base64');
    expect(() => decryptApiKey(encrypted, shortIv, authTag)).toThrow('Invalid IV length');
  });

  it('rejects invalid auth tag length', () => {
    const { encrypted, iv } = encryptApiKey('sk-test-key');
    const shortTag = Buffer.from([1, 2, 3]).toString('base64');
    expect(() => decryptApiKey(encrypted, iv, shortTag)).toThrow('Invalid auth tag length');
  });

  it('throws when AI_ENCRYPTION_KEY is missing', () => {
    delete process.env.AI_ENCRYPTION_KEY;
    expect(() => encryptApiKey('sk-test')).toThrow('AI_ENCRYPTION_KEY');
  });

  it('throws when AI_ENCRYPTION_KEY has wrong length', () => {
    process.env.AI_ENCRYPTION_KEY = 'tooshort';
    expect(() => encryptApiKey('sk-test')).toThrow('AI_ENCRYPTION_KEY');
  });

  it('handles empty string encryption', () => {
    const { encrypted, iv, authTag } = encryptApiKey('');
    const decrypted = decryptApiKey(encrypted, iv, authTag);
    expect(decrypted).toBe('');
  });

  it('handles long keys', () => {
    const longKey = 'sk-' + 'a'.repeat(500);
    const { encrypted, iv, authTag } = encryptApiKey(longKey);
    const decrypted = decryptApiKey(encrypted, iv, authTag);
    expect(decrypted).toBe(longKey);
  });

  it('handles unicode in key value', () => {
    const unicodeKey = 'sk-test-\u00e9\u00e8\u00ea-key';
    const { encrypted, iv, authTag } = encryptApiKey(unicodeKey);
    const decrypted = decryptApiKey(encrypted, iv, authTag);
    expect(decrypted).toBe(unicodeKey);
  });
});

describe('maskApiKey', () => {
  it('masks a normal API key', () => {
    const masked = maskApiKey('sk-ant-api03-abcdefghijklmnop');
    expect(masked).toBe('sk-ant-...mnop');
    expect(masked).not.toContain('abcdef');
  });

  it('masks short keys completely', () => {
    expect(maskApiKey('abc')).toBe('***');
    expect(maskApiKey('123456789012')).toBe('***');
  });

  it('masks 13-char key showing first 7 and last 4', () => {
    const masked = maskApiKey('1234567890abc');
    expect(masked).toBe('1234567...0abc');
  });
});
