import { PrismaClient } from '@prisma/client';
import { readdirSync, readFileSync, statSync } from 'fs';
import { resolve, dirname, basename, join } from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = resolve(__dirname, 'examples');

async function main() {
  // Find or create admin user
  const adminEmail = 'mhlscvk@gmail.com';
  let admin = await prisma.user.findFirst({ where: { email: adminEmail } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'Muhlis',
        passwordHash: bcrypt.hashSync('M3uhl5is0.1', 12),
        emailVerified: true,
        role: 'ADMIN',
      },
    });
    console.log(`Admin account created: ${adminEmail}`);
  }

  // Find or create system user
  let systemUser = await prisma.user.findFirst({ where: { email: 'system@systemodel.com' } });
  if (!systemUser) {
    systemUser = await prisma.user.create({
      data: { email: 'system@systemodel.com', name: 'System', emailVerified: true, role: 'ADMIN' },
    });
  }

  // Find or create root "Examples" project
  let root = await prisma.project.findFirst({
    where: { name: 'Examples', parentId: null, isSystem: true, ownerId: systemUser.id },
  });
  if (!root) {
    root = await prisma.project.create({
      data: { name: 'Examples', ownerId: systemUser.id, parentId: null, depth: 0, isSystem: true },
    });
  }

  const dirs = readdirSync(EXAMPLES_DIR).filter(e => statSync(join(EXAMPLES_DIR, e)).isDirectory());
  let totalFiles = 0;

  for (const dirName of dirs) {
    const dirPath = resolve(EXAMPLES_DIR, dirName);
    if (!dirPath.startsWith(EXAMPLES_DIR)) continue;

    const sub = await prisma.project.findFirst({
      where: { name: dirName, parentId: root.id, isSystem: true, ownerId: systemUser.id },
    });
    if (sub) {
      // Subproject already exists — skip to preserve admin edits
      console.log(`  Skipping "${dirName}" (already exists)`);
      continue;
    }

    const newSub = await prisma.project.create({
      data: { name: dirName, ownerId: systemUser.id, parentId: root.id, depth: 1, isSystem: true },
    });

    const files = readdirSync(dirPath).filter(f => f.endsWith('.sysml'));
    const fileData = files.map(fileName => {
      const filePath = resolve(dirPath, fileName);
      if (!filePath.startsWith(EXAMPLES_DIR)) return null;
      const content = readFileSync(filePath, 'utf-8');
      return { name: basename(fileName, '.sysml'), content, size: Buffer.byteLength(content, 'utf-8'), projectId: newSub.id };
    }).filter(Boolean) as { name: string; content: string; size: number; projectId: string }[];

    if (fileData.length > 0) await prisma.sysMLFile.createMany({ data: fileData });
    totalFiles += fileData.length;
  }

  console.log(`Seeded: ${dirs.length} subprojects, ${totalFiles} files`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
