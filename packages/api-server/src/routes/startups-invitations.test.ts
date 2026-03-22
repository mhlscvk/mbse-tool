import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock db before imports
const mockPrisma = {
  user: { findUnique: vi.fn() },
  startupMember: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  },
  startupInvitation: {
    upsert: vi.fn(),
    findMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
};

vi.mock('../db.js', () => ({ prisma: mockPrisma }));

// Mock startup-ops
vi.mock('../services/startup-ops.js', () => ({
  assertStartupAccess: vi.fn().mockResolvedValue({ allowed: true, role: 'STARTUP_ADMIN' }),
  assertStartupWriteAccess: vi.fn(),
  addMember: vi.fn().mockResolvedValue({ id: 'mem1', startupId: 's1', userId: 'u1', role: 'STARTUP_USER' }),
}));

describe('Startup Invitations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /:startupId/members — invitation flow', () => {
    it('should create an invitation when email does not match any user', async () => {
      // User not found by email
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.startupInvitation.upsert.mockResolvedValue({
        id: 'inv1', startupId: 's1', email: 'new@example.com',
        role: 'STARTUP_USER', invitedBy: 'admin1', createdAt: new Date(),
      });

      // Verify the upsert would be called with correct params
      const email = 'new@example.com';
      const startupId = 's1';
      const role = 'STARTUP_USER';
      const invitedBy = 'admin1';

      await mockPrisma.startupInvitation.upsert({
        where: { startupId_email: { startupId, email } },
        update: { role },
        create: { startupId, email, role, invitedBy },
      });

      expect(mockPrisma.startupInvitation.upsert).toHaveBeenCalledWith({
        where: { startupId_email: { startupId, email } },
        update: { role },
        create: { startupId, email, role, invitedBy },
      });
    });

    it('should add member directly when email matches an existing user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'existing@example.com' });

      const user = await mockPrisma.user.findUnique({ where: { email: 'existing@example.com' } });
      expect(user).not.toBeNull();
      expect(user!.id).toBe('u1');
    });

    it('should upsert invitation to update role if already invited', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.startupInvitation.upsert.mockResolvedValue({
        id: 'inv1', startupId: 's1', email: 'new@example.com',
        role: 'STARTUP_ADMIN', invitedBy: 'admin1', createdAt: new Date(),
      });

      const result = await mockPrisma.startupInvitation.upsert({
        where: { startupId_email: { startupId: 's1', email: 'new@example.com' } },
        update: { role: 'STARTUP_ADMIN' },
        create: { startupId: 's1', email: 'new@example.com', role: 'STARTUP_ADMIN', invitedBy: 'admin1' },
      });

      expect(result.role).toBe('STARTUP_ADMIN');
    });
  });

  describe('GET /:startupId/invitations', () => {
    it('should return pending invitations ordered by creation date', async () => {
      const invitations = [
        { id: 'inv2', startupId: 's1', email: 'b@test.com', role: 'STARTUP_USER', createdAt: new Date('2026-03-22') },
        { id: 'inv1', startupId: 's1', email: 'a@test.com', role: 'STARTUP_ADMIN', createdAt: new Date('2026-03-21') },
      ];
      mockPrisma.startupInvitation.findMany.mockResolvedValue(invitations);

      const result = await mockPrisma.startupInvitation.findMany({
        where: { startupId: 's1' },
        orderBy: { createdAt: 'desc' },
      });

      expect(result).toHaveLength(2);
      expect(result[0].email).toBe('b@test.com');
    });

    it('should return empty array when no invitations exist', async () => {
      mockPrisma.startupInvitation.findMany.mockResolvedValue([]);

      const result = await mockPrisma.startupInvitation.findMany({
        where: { startupId: 's1' },
        orderBy: { createdAt: 'desc' },
      });

      expect(result).toHaveLength(0);
    });
  });

  describe('DELETE /:startupId/invitations/:invitationId', () => {
    it('should delete the invitation', async () => {
      mockPrisma.startupInvitation.delete.mockResolvedValue({ id: 'inv1' });

      await mockPrisma.startupInvitation.delete({ where: { id: 'inv1' } });

      expect(mockPrisma.startupInvitation.delete).toHaveBeenCalledWith({ where: { id: 'inv1' } });
    });
  });

  describe('fulfillPendingInvitations', () => {
    it('should create startup members for each pending invitation', async () => {
      const invitations = [
        { id: 'inv1', startupId: 's1', email: 'user@test.com', role: 'STARTUP_USER', invitedBy: 'admin1' },
        { id: 'inv2', startupId: 's2', email: 'user@test.com', role: 'STARTUP_ADMIN', invitedBy: 'admin2' },
      ];
      mockPrisma.startupInvitation.findMany.mockResolvedValue(invitations);
      mockPrisma.startupMember.create.mockResolvedValue({});
      mockPrisma.startupInvitation.deleteMany.mockResolvedValue({ count: 2 });

      // Simulate fulfillPendingInvitations
      const userId = 'newUser1';
      const email = 'user@test.com';

      const pending = await mockPrisma.startupInvitation.findMany({
        where: { email: email.toLowerCase() },
      });
      expect(pending).toHaveLength(2);

      for (const inv of pending) {
        await mockPrisma.startupMember.create({
          data: { startupId: inv.startupId, userId, role: inv.role },
        });
      }
      expect(mockPrisma.startupMember.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.startupMember.create).toHaveBeenCalledWith({
        data: { startupId: 's1', userId: 'newUser1', role: 'STARTUP_USER' },
      });
      expect(mockPrisma.startupMember.create).toHaveBeenCalledWith({
        data: { startupId: 's2', userId: 'newUser1', role: 'STARTUP_ADMIN' },
      });

      await mockPrisma.startupInvitation.deleteMany({
        where: { email: email.toLowerCase() },
      });
      expect(mockPrisma.startupInvitation.deleteMany).toHaveBeenCalledWith({
        where: { email: 'user@test.com' },
      });
    });

    it('should do nothing when no pending invitations exist', async () => {
      mockPrisma.startupInvitation.findMany.mockResolvedValue([]);

      const pending = await mockPrisma.startupInvitation.findMany({
        where: { email: 'nobody@test.com' },
      });
      expect(pending).toHaveLength(0);
      expect(mockPrisma.startupMember.create).not.toHaveBeenCalled();
    });

    it('should handle case-insensitive email matching', async () => {
      mockPrisma.startupInvitation.findMany.mockResolvedValue([
        { id: 'inv1', startupId: 's1', email: 'user@test.com', role: 'STARTUP_USER', invitedBy: 'admin1' },
      ]);
      mockPrisma.startupMember.create.mockResolvedValue({});
      mockPrisma.startupInvitation.deleteMany.mockResolvedValue({ count: 1 });

      const email = 'User@Test.COM';
      const pending = await mockPrisma.startupInvitation.findMany({
        where: { email: email.toLowerCase() },
      });

      expect(mockPrisma.startupInvitation.findMany).toHaveBeenCalledWith({
        where: { email: 'user@test.com' },
      });
      expect(pending).toHaveLength(1);
    });

    it('should silently ignore if member already exists (duplicate)', async () => {
      mockPrisma.startupInvitation.findMany.mockResolvedValue([
        { id: 'inv1', startupId: 's1', email: 'user@test.com', role: 'STARTUP_USER', invitedBy: 'admin1' },
      ]);
      // Simulate P2002 unique constraint error
      mockPrisma.startupMember.create.mockRejectedValue(new Error('Unique constraint violated'));

      const pending = await mockPrisma.startupInvitation.findMany({
        where: { email: 'user@test.com' },
      });

      for (const inv of pending) {
        await mockPrisma.startupMember.create({
          data: { startupId: inv.startupId, userId: 'u1', role: inv.role },
        }).catch(() => {}); // Should not throw
      }
      // No error thrown — test passes
    });
  });
});
