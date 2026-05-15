/**
 * Export/Import the "Examples" and "Örnekler" system projects.
 *
 * Uses directory trees at prisma/examples/ (EN) and prisma/examples-tr/ (TR).
 * Each subdirectory is a subproject, each .sysml file is a model file.
 *
 * Usage:
 *   npx tsx prisma/seed-examples.ts export   — dump DB Examples to prisma/examples/
 *   npx tsx prisma/seed-examples.ts import   — upsert prisma/examples/ AND prisma/examples-tr/ into the database
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync, writeFileSync, readdirSync, lstatSync, statSync, mkdirSync, rmSync, existsSync } from 'fs';
import { resolve, dirname, basename, join } from 'path';
import { fileURLToPath } from 'url';
import { generateFileDisplayId, generateProjectDisplayId } from '../src/lib/id-generator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = resolve(__dirname, 'examples');
const EXAMPLES_TR_DIR = resolve(__dirname, 'examples-tr');
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

/**
 * Import a single examples directory tree as a system project owned by the
 * system user.  Used for both English (Examples) and Turkish (Örnekler) sets.
 */
async function importExamplesFrom(opts: {
  sourceDir: string;
  rootName: string;
  systemUserId: string;
  /** Subdirectories to skip when walking sourceDir. */
  excludeDirs?: string[];
}) {
  const { sourceDir, rootName, systemUserId, excludeDirs = [] } = opts;

  if (!existsSync(sourceDir)) {
    console.log(`[seed-examples] ${rootName}: directory not found at ${sourceDir} — skipping.`);
    return { dirs: 0, files: 0 };
  }

  // Find or create root project
  let root = await prisma.project.findFirst({
    where: { name: rootName, parentId: null, isSystem: true, ownerId: systemUserId },
  });
  if (!root) {
    root = await prisma.project.create({
      data: { name: rootName, ownerId: systemUserId, parentId: null, depth: 0, isSystem: true, projectType: 'SYSTEM', displayId: generateProjectDisplayId('SYSTEM', rootName) },
    });
  }

  const skip = new Set(excludeDirs);
  const entries = readdirSync(sourceDir).filter(e =>
    !skip.has(e) && statSync(join(sourceDir, e)).isDirectory(),
  );

  let totalFiles = 0;
  for (const dirName of entries) {
    const dirPath = join(sourceDir, dirName);

    let sub = await prisma.project.findFirst({
      where: { name: dirName, parentId: root.id, isSystem: true, ownerId: systemUserId },
    });
    if (sub) {
      await prisma.sysMLFile.deleteMany({ where: { projectId: sub.id } });
    } else {
      sub = await prisma.project.create({
        data: { name: dirName, ownerId: systemUserId, parentId: root.id, depth: 1, isSystem: true, projectType: 'SYSTEM', displayId: generateProjectDisplayId('SYSTEM', dirName) },
      });
    }

    const MAX_DEPTH = 5;
    function collectSysmlFiles(dir: string, depth = 0): string[] {
      if (depth > MAX_DEPTH) return [];
      const result: string[] = [];
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const fullPath = join(dir, entry.name);
        if (lstatSync(fullPath).isSymbolicLink()) continue;
        if (entry.isDirectory()) result.push(...collectSysmlFiles(fullPath, depth + 1));
        else if (entry.name.endsWith('.sysml')) result.push(fullPath);
      }
      return result;
    }
    const filePaths = collectSysmlFiles(dirPath);
    const fileData = filePaths.map(filePath => {
      const content = readFileSync(filePath, 'utf-8');
      return { name: basename(filePath, '.sysml'), content, size: Buffer.byteLength(content, 'utf-8'), projectId: sub.id, displayId: generateFileDisplayId() };
    });
    if (fileData.length > 0) {
      await prisma.sysMLFile.createMany({ data: fileData });
    }

    totalFiles += filePaths.length;
    console.log(`  ${rootName}/${dirName} (${filePaths.length} files)`);
  }

  console.log(`Imported ${rootName}: ${entries.length} subprojects, ${totalFiles} files.`);
  return { dirs: entries.length, files: totalFiles };
}

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

  // Import English demo examples (excluding "Standard Libraries" — that is
  // its own top-level system project, shared across languages).
  const en = await importExamplesFrom({
    sourceDir: EXAMPLES_DIR,
    rootName: 'Examples',
    systemUserId: systemUser.id,
    excludeDirs: ['Standard Libraries'],
  });
  // Import Turkish demo examples (best-effort: skips if directory absent).
  const tr = await importExamplesFrom({
    sourceDir: EXAMPLES_TR_DIR,
    rootName: 'Örnekler',
    systemUserId: systemUser.id,
  });
  // Import the OMG Standard Libraries as its own top-level system project.
  // Source is examples/Standard Libraries/ on disk; surfaced in the UI as
  // a sibling of Examples/Örnekler that is visible in every language.
  const stdLibDir = join(EXAMPLES_DIR, 'Standard Libraries');
  const stdLib = await importExamplesFrom({
    sourceDir: stdLibDir,
    rootName: 'Standard Libraries',
    systemUserId: systemUser.id,
  });

  console.log(`Total: ${en.dirs + tr.dirs + stdLib.dirs} subprojects, ${en.files + tr.files + stdLib.files} files.`);
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
