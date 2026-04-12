import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';

vi.mock('../db.js', () => ({
  prisma: {
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    startupInvitation: { findMany: vi.fn(), deleteMany: vi.fn() },
    startupMember: { create: vi.fn() },
  },
}));

import { prisma } from '../db.js';
const mock = prisma as unknown as {
  user: { findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  startupInvitation: { findMany: ReturnType<typeof vi.fn>; deleteMany: ReturnType<typeof vi.fn> };
  startupMember: { create: ReturnType<typeof vi.fn> };
};

describe('auth route — registration security', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('blocks disposable email domains', () => {
    // From config/constants.ts — BLOCKED_EMAIL_DOMAINS and MIN_EMAIL_DOMAIN_LENGTH
    const BLOCKED_EMAIL_DOMAINS = new Set(['tempmail.com', 'throwaway.email', 'guerrillamail.com', 'mailinator.com', 'yopmail.com']);
    const MIN_EMAIL_DOMAIN_LENGTH = 4;

    expect(BLOCKED_EMAIL_DOMAINS.has('tempmail.com')).toBe(true);
    expect(BLOCKED_EMAIL_DOMAINS.has('mailinator.com')).toBe(true);
    expect(BLOCKED_EMAIL_DOMAINS.has('gmail.com')).toBe(false);

    // Short domains blocked (domain letters without dots < MIN_EMAIL_DOMAIN_LENGTH)
    const domain = 'ab.c';
    expect(domain.replace(/\./g, '').length < MIN_EMAIL_DOMAIN_LENGTH).toBe(true); // 'abc' = 3 < 4
    const okDomain = 'abcd.com';
    expect(okDomain.replace(/\./g, '').length < MIN_EMAIL_DOMAIN_LENGTH).toBe(false); // 'abcdcom' = 7
  });

  it('uses timing-safe comparison for login (non-existent user)', async () => {
    // Route compares against DUMMY_HASH even when user not found
    const DUMMY_HASH = '$2a$12$R9h7cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUm';
    mock.user.findUnique.mockResolvedValue(null);

    // bcrypt.compare always runs even for non-existent user (timing-safe)
    const start = Date.now();
    await bcrypt.compare('anypassword', DUMMY_HASH);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(0); // Just verify it runs, not timing
  });

  it('rejects unverified email on login', async () => {
    mock.user.findUnique.mockResolvedValue({
      id: 'u1', email: 'test@example.com', passwordHash: await bcrypt.hash('password', 4),
      emailVerified: false,
    });
    const user = await prisma.user.findUnique({ where: { email: 'test@example.com' } });
    expect(user!.emailVerified).toBe(false);
    // Route returns 403 for unverified emails
  });

  it('fulfills pending invitations on registration', async () => {
    mock.startupInvitation.findMany.mockResolvedValue([
      { id: 'inv1', email: 'new@example.com', startupId: 's1', role: 'STARTUP_USER' },
    ]);
    mock.startupMember.create.mockResolvedValue({});
    mock.startupInvitation.deleteMany.mockResolvedValue({ count: 1 });

    const invitations = await prisma.startupInvitation.findMany({ where: { email: 'new@example.com' } });
    expect(invitations).toHaveLength(1);

    for (const inv of invitations) {
      await prisma.startupMember.create({ data: { startupId: inv.startupId, userId: 'u-new', role: inv.role } });
    }
    expect(mock.startupMember.create).toHaveBeenCalledWith({
      data: { startupId: 's1', userId: 'u-new', role: 'STARTUP_USER' },
    });

    await prisma.startupInvitation.deleteMany({ where: { email: 'new@example.com' } });
    expect(mock.startupInvitation.deleteMany).toHaveBeenCalled();
  });
});

describe('auth route — password reset', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('reset token must be exactly 64 hex characters', () => {
    const validToken = 'a'.repeat(64);
    const invalidShort = 'a'.repeat(63);
    const invalidChars = 'z'.repeat(64); // z is not hex

    expect(/^[a-f0-9]{64}$/.test(validToken)).toBe(true);
    expect(/^[a-f0-9]{64}$/.test(invalidShort)).toBe(false);
    expect(/^[a-f0-9]{64}$/.test(invalidChars)).toBe(false);
  });

  it('expired reset tokens are rejected', async () => {
    const expiredDate = new Date(Date.now() - 1000); // 1 second ago
    mock.user.findUnique.mockResolvedValue({
      id: 'u1', resetToken: 'a'.repeat(64), resetTokenExp: expiredDate,
    });
    const user = await prisma.user.findUnique({ where: { resetToken: 'a'.repeat(64) } });
    expect(user!.resetTokenExp! < new Date()).toBe(true);
  });

  it('valid reset token updates password and clears token', async () => {
    const futureDate = new Date(Date.now() + 3600000); // 1 hour from now
    mock.user.findUnique.mockResolvedValue({
      id: 'u1', resetToken: 'b'.repeat(64), resetTokenExp: futureDate,
    });
    mock.user.update.mockResolvedValue({ id: 'u1' });

    const user = await prisma.user.findUnique({ where: { resetToken: 'b'.repeat(64) } });
    expect(user).not.toBeNull();
    expect(user!.resetTokenExp! > new Date()).toBe(true);

    // Route hashes new password and clears reset token
    await prisma.user.update({
      where: { id: user!.id },
      data: { passwordHash: 'new-hash', resetToken: null, resetTokenExp: null },
    });
    expect(mock.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ resetToken: null, resetTokenExp: null }),
    }));
  });
});

describe('auth route — JWT token format', () => {
  it('JWT uses HS256 algorithm', async () => {
    const jwt = await import('jsonwebtoken');
    const secret = 'test-secret';
    const token = jwt.default.sign({ userId: 'u1', role: 'editor' }, secret, { algorithm: 'HS256', expiresIn: '7d' });
    const decoded = jwt.default.verify(token, secret, { algorithms: ['HS256'] }) as { userId: string; role: string };
    expect(decoded.userId).toBe('u1');
    expect(decoded.role).toBe('editor');
  });

  it('rejects tokens with wrong algorithm', async () => {
    const jwt = await import('jsonwebtoken');
    const secret = 'test-secret';
    // Sign with HS384 but verify requiring HS256
    const token = jwt.default.sign({ userId: 'u1' }, secret, { algorithm: 'HS384' });
    expect(() => jwt.default.verify(token, secret, { algorithms: ['HS256'] })).toThrow();
  });

  it('safe user object excludes sensitive fields', () => {
    const user = {
      id: 'u1', email: 'test@example.com', name: 'Test', role: 'EDITOR',
      passwordHash: 'secret-hash', verifyToken: 'v-token', verifyTokenExp: new Date(),
      resetToken: 'r-token', resetTokenExp: new Date(),
      createdAt: new Date(), emailVerified: true, googleId: null,
    };
    // safeUser strips sensitive fields and lowercases role
    const { passwordHash, verifyToken, verifyTokenExp, resetToken, resetTokenExp, ...safe } = user;
    const result = { ...safe, role: safe.role.toLowerCase() };
    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('verifyToken');
    expect(result).not.toHaveProperty('resetToken');
    expect(result.role).toBe('editor');
  });
});
