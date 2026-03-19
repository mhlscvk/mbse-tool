/**
 * Export/Import the "Examples" system project.
 *
 * Uses a directory tree at prisma/examples/ instead of a JSON file.
 * Each subdirectory is a subproject, each .sysml file is a model file.
 *
 * Usage:
 *   npx tsx prisma/seed-examples.ts export   — dump DB Examples to prisma/examples/
 *   npx tsx prisma/seed-examples.ts import   — upsert prisma/examples/ into the database
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, rmSync, existsSync } from 'fs';
import { resolve, dirname, basename, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = resolve(__dirname, 'examples');
const prisma = new PrismaClient();

// ─── Export ──────────────────────────────────────────────────────────────────

async function exportExamples() {
  const root = await prisma.project.findFirst({
    where: { name: 'Examples', parentId: null, isSystem: true },
  });
  if (!root) { console.error('No "Examples" root project found.'); process.exit(1); }

  const children = await prisma.project.findMany({
    where: { parentId: root.id },
    include: { files: { select: { name: true, content: true } } },
    orderBy: { name: 'asc' },
  });

  // Clean and recreate the examples directory
  if (existsSync(EXAMPLES_DIR)) rmSync(EXAMPLES_DIR, { recursive: true });
  mkdirSync(EXAMPLES_DIR, { recursive: true });

  let totalFiles = 0;
  for (const child of children) {
    const subDir = join(EXAMPLES_DIR, child.name);
    mkdirSync(subDir, { recursive: true });
    for (const file of child.files) {
      const filePath = join(subDir, `${file.name}.sysml`);
      writeFileSync(filePath, file.content, 'utf-8');
      totalFiles++;
    }
    console.log(`  ${child.name}/ (${child.files.length} files)`);
  }

  console.log(`Exported ${children.length} subprojects, ${totalFiles} files to ${EXAMPLES_DIR}`);
}

// ─── Import (also used by admin sync endpoint) ──────────────────────────────

export async function importExamples() {
  if (!existsSync(EXAMPLES_DIR)) {
    throw new Error(`Examples directory not found: ${EXAMPLES_DIR}`);
  }

  // Find or create a system user to own the Examples project
  let systemUser = await prisma.user.findFirst({ where: { email: 'system@systemodel.com' } });
  if (!systemUser) {
    systemUser = await prisma.user.create({
      data: { email: 'system@systemodel.com', name: 'System', emailVerified: true, role: 'ADMIN' },
    });
    console.log('Created system user: system@systemodel.com');
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

  // Read subdirectories
  const entries = readdirSync(EXAMPLES_DIR).filter(e =>
    statSync(join(EXAMPLES_DIR, e)).isDirectory(),
  );

  let totalFiles = 0;
  for (const dirName of entries) {
    const dirPath = join(EXAMPLES_DIR, dirName);

    // Find or create subproject
    let sub = await prisma.project.findFirst({
      where: { name: dirName, parentId: root.id, isSystem: true, ownerId: systemUser.id },
    });
    if (sub) {
      await prisma.sysMLFile.deleteMany({ where: { projectId: sub.id } });
    } else {
      sub = await prisma.project.create({
        data: { name: dirName, ownerId: systemUser.id, parentId: root.id, depth: 1, isSystem: true },
      });
    }

    // Read .sysml files and batch insert
    const files = readdirSync(dirPath).filter(f => f.endsWith('.sysml'));
    const fileData = files.map(fileName => {
      const content = readFileSync(join(dirPath, fileName), 'utf-8');
      return { name: basename(fileName, '.sysml'), content, size: Buffer.byteLength(content, 'utf-8'), projectId: sub.id };
    });
    if (fileData.length > 0) {
      await prisma.sysMLFile.createMany({ data: fileData });
    }

    totalFiles += files.length;
    console.log(`  ${dirName} (${files.length} files)`);
  }

  console.log(`Imported ${entries.length} subprojects, ${totalFiles} files.`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

const command = process.argv[2];
if (command === 'export') {
  exportExamples().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
} else if (command === 'import') {
  importExamples().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
} else {
  console.log('Usage: npx tsx prisma/seed-examples.ts [export|import]');
  process.exit(1);
}
