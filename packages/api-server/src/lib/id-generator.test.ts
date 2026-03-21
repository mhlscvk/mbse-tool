import { describe, it, expect } from 'vitest';
import {
  generateStartupId,
  generateProjectDisplayId,
  generateFileDisplayId,
  generateElementDisplayId,
  generateNotificationDisplayId,
  userOwnerRef,
} from './id-generator.js';

describe('ID Generator', () => {
  describe('generateStartupId', () => {
    it('formats as ENT-{NAME}-{SEQ}', () => {
      expect(generateStartupId('numeric', 1)).toBe('ENT-NUMERIC-001');
    });

    it('pads sequence to 3 digits', () => {
      expect(generateStartupId('test', 42)).toBe('ENT-TEST-042');
    });

    it('strips non-alphanumeric characters from name', () => {
      expect(generateStartupId('my-startup!', 1)).toBe('ENT-MYSTARTUP-001');
    });

    it('uppercases the name', () => {
      expect(generateStartupId('acme', 5)).toBe('ENT-ACME-005');
    });
  });

  describe('generateProjectDisplayId', () => {
    it('uses SYS prefix for system projects', () => {
      const id = generateProjectDisplayId('SYSTEM', '0001');
      expect(id).toMatch(/^PRJ-SYS-0001-[A-Z0-9]{5}$/);
    });

    it('uses ENT prefix for startup projects', () => {
      const id = generateProjectDisplayId('STARTUP', 'NUMERIC');
      expect(id).toMatch(/^PRJ-ENT-NUMERIC-[A-Z0-9]{5}$/);
    });

    it('uses USR prefix for user projects', () => {
      const id = generateProjectDisplayId('USER', 'U145');
      expect(id).toMatch(/^PRJ-USR-U145-[A-Z0-9]{5}$/);
    });

    it('generates unique IDs on successive calls', () => {
      const ids = new Set(Array.from({ length: 50 }, () => generateProjectDisplayId('USER', 'U001')));
      // With 5-char random suffix from 30 chars, collisions in 50 should be extremely rare
      expect(ids.size).toBe(50);
    });

    it('truncates long owner refs to 12 chars', () => {
      const id = generateProjectDisplayId('STARTUP', 'AVERYLONGSTARTUPNAME');
      // "AVERYLONGSTARTUPNAME" stripped → "AVERYLONGSTARTUPNAME", sliced to 12 → "AVERYLONGSTA"
      expect(id).toMatch(/^PRJ-ENT-AVERYLONGSTA-[A-Z0-9]{5}$/);
    });
  });

  describe('generateFileDisplayId', () => {
    it('formats as FIL-{RANDOM}', () => {
      expect(generateFileDisplayId()).toMatch(/^FIL-[A-Z0-9]{5}$/);
    });

    it('generates unique IDs', () => {
      const ids = new Set(Array.from({ length: 50 }, () => generateFileDisplayId()));
      expect(ids.size).toBe(50);
    });
  });

  describe('generateElementDisplayId', () => {
    it('formats as ELM-{RANDOM}', () => {
      expect(generateElementDisplayId()).toMatch(/^ELM-[A-Z0-9]{5}$/);
    });
  });

  describe('generateNotificationDisplayId', () => {
    it('formats as NTF-{RANDOM}', () => {
      expect(generateNotificationDisplayId()).toMatch(/^NTF-[A-Z0-9]{5}$/);
    });
  });

  describe('userOwnerRef', () => {
    it('returns U + last 3 chars of user ID', () => {
      expect(userOwnerRef('clx1234abc')).toBe('Uabc');
    });

    it('handles short IDs', () => {
      expect(userOwnerRef('ab')).toBe('Uab');
    });
  });

  describe('character set safety', () => {
    it('never contains ambiguous characters (I, O, 0, 1)', () => {
      // Generate many IDs and check none contain ambiguous chars
      const ids = Array.from({ length: 200 }, () => generateFileDisplayId());
      for (const id of ids) {
        const suffix = id.slice(4); // strip "FIL-"
        expect(suffix).not.toMatch(/[IO01]/);
      }
    });
  });
});
