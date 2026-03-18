/**
 * Export/Import the "Examples" system project.
 *
 * Usage:
 *   npx tsx prisma/seed-examples.ts export   — dump local Examples project to examples-data.json
 *   npx tsx prisma/seed-examples.ts import   — upsert examples-data.json into the database
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = resolve(__dirname, 'examples-data.json');
const prisma = new PrismaClient();

interface FileData { name: string; content: string; size: number }
interface ProjectData { name: string; depth: number; files: FileData[]; children: ProjectData[] }

// ─── Export ──────────────────────────────────────────────────────────────────

async function exportExamples() {
  const root = await prisma.project.findFirst({
    where: { name: 'Examples', parentId: null },
    include: { files: { select: { name: true, content: true, size: true } } },
  });
  if (!root) { console.error('No "Examples" root project found.'); process.exit(1); }

  async function buildTree(projectId: string, depth: number): Promise<ProjectData> {
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: {
        files: { select: { name: true, content: true, size: true } },
        children: { select: { id: true, name: true, depth: true } },
      },
    });
    const children: ProjectData[] = [];
    for (const child of project.children) {
      children.push(await buildTree(child.id, child.depth));
    }
    return { name: project.name, depth, files: project.files, children };
  }

  const tree = await buildTree(root.id, 0);
  writeFileSync(DATA_FILE, JSON.stringify(tree, null, 2));
  console.log(`Exported to ${DATA_FILE}`);
  console.log(`  Root: ${tree.name}`);
  const countFiles = (t: ProjectData): number =>
    t.files.length + t.children.reduce((s, c) => s + countFiles(c), 0);
  const countProjects = (t: ProjectData): number =>
    1 + t.children.reduce((s, c) => s + countProjects(c), 0);
  console.log(`  Projects: ${countProjects(tree)}, Files: ${countFiles(tree)}`);
}

// ─── Import ──────────────────────────────────────────────────────────────────

async function importExamples() {
  let data: ProjectData;
  try {
    data = JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
  } catch {
    console.error(`Cannot read ${DATA_FILE}. Run "export" first.`);
    process.exit(1);
  }

  // Find or create a system user to own the Examples project
  let systemUser = await prisma.user.findFirst({ where: { email: 'system@systemodel.com' } });
  if (!systemUser) {
    systemUser = await prisma.user.create({
      data: { email: 'system@systemodel.com', name: 'System', emailVerified: true, role: 'ADMIN' },
    });
    console.log('Created system user: system@systemodel.com');
  }

  async function upsertTree(node: ProjectData, parentId: string | null, depth: number) {
    // Find existing project by name + parentId + system flag
    let project = await prisma.project.findFirst({
      where: { name: node.name, parentId, isSystem: true, ownerId: systemUser!.id },
    });
    if (project) {
      // Delete old files and re-create
      await prisma.sysMLFile.deleteMany({ where: { projectId: project.id } });
    } else {
      project = await prisma.project.create({
        data: { name: node.name, ownerId: systemUser!.id, parentId, depth, isSystem: true },
      });
    }

    // Create files
    for (const file of node.files) {
      await prisma.sysMLFile.create({
        data: { name: file.name, content: file.content, size: file.size, projectId: project.id },
      });
    }

    // Recurse into children
    for (const child of node.children) {
      await upsertTree(child, project.id, depth + 1);
    }

    console.log(`  ${'  '.repeat(depth)}${node.name} (${node.files.length} files)`);
  }

  console.log('Importing Examples project...');
  await upsertTree(data, null, 0);
  console.log('Done.');
}

// ─── Main ────────────────────────────────────────────────────────────────────

const command = process.argv[2];
if (command === 'export') {
  exportExamples().then(() => prisma.$disconnect());
} else if (command === 'import') {
  importExamples().then(() => prisma.$disconnect());
} else {
  console.log('Usage: npx tsx prisma/seed-examples.ts [export|import]');
  process.exit(1);
}
