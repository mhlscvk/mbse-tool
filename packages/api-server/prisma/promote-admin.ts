/**
 * Promote a user to ADMIN role.
 *
 * Usage:
 *   npx tsx prisma/promote-admin.ts <email>
 *   npx tsx prisma/promote-admin.ts --list          — list all users and their roles
 *   npx tsx prisma/promote-admin.ts --demote <email> — set user back to EDITOR
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help') {
    console.log('Usage:');
    console.log('  npx tsx prisma/promote-admin.ts <email>          Promote user to ADMIN');
    console.log('  npx tsx prisma/promote-admin.ts --demote <email> Set user back to EDITOR');
    console.log('  npx tsx prisma/promote-admin.ts --list           List all users');
    process.exit(0);
  }

  if (args[0] === '--list') {
    const users = await prisma.user.findMany({
      select: { email: true, name: true, role: true, emailVerified: true },
      orderBy: { email: 'asc' },
    });
    if (users.length === 0) {
      console.log('No users found.');
    } else {
      console.log('Users:');
      for (const u of users) {
        const verified = u.emailVerified ? '' : ' (unverified)';
        console.log(`  ${u.role.padEnd(6)} ${u.email} — ${u.name ?? '(no name)'}${verified}`);
      }
    }
    process.exit(0);
  }

  const demote = args[0] === '--demote';
  const email = demote ? args[1] : args[0];

  if (!email) {
    console.error('Error: email is required.');
    process.exit(1);
  }

  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) {
    console.error(`User not found: ${email}`);
    const similar = await prisma.user.findMany({
      where: { email: { contains: email.split('@')[0] } },
      select: { email: true },
      take: 5,
    });
    if (similar.length > 0) {
      console.log('Did you mean:');
      for (const s of similar) console.log(`  ${s.email}`);
    }
    process.exit(1);
  }

  const newRole = demote ? 'EDITOR' : 'ADMIN';
  if (user.role === newRole) {
    console.log(`${email} is already ${newRole}.`);
    process.exit(0);
  }

  await prisma.user.update({ where: { id: user.id }, data: { role: newRole } });
  console.log(`${user.role} → ${newRole}: ${email}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
