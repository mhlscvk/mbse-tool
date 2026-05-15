import { prisma } from '../db.js';
import { readFileSync, writeFileSync, mkdirSync, unlinkSync, readdirSync, rmdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = resolve(__dirname, '../../prisma/examples');
const EXAMPLES_TR_DIR = resolve(__dirname, '../../prisma/examples-tr');

/**
 * Pick the on-disk base directory for a system file based on its root
 * project name.  Files under "Examples" sync to prisma/examples/, files
 * under "Örnekler" sync to prisma/examples-tr/.  Anything else returns
 * null and is not synced.
 */
function baseDirForRootName(rootName: string | null | undefined): string | null {
  if (rootName === 'Examples') return EXAMPLES_DIR;
  if (rootName === 'Örnekler') return EXAMPLES_TR_DIR;
  return null;
}

/**
 * Sync a single file to the appropriate examples directory on disk.
 * Called after admin creates or updates a file in a system project.
 */
export async function syncFileToDisk(fileId: string): Promise<void> {
  try {
    const file = await prisma.sysMLFile.findUnique({
      where: { id: fileId },
      include: {
        project: {
          select: {
            name: true,
            isSystem: true,
            parent: { select: { name: true, isSystem: true } },
          },
        },
      },
    });
    if (!file || !file.project.isSystem) return;

    const rootName = file.project.parent?.name ?? file.project.name;
    const baseDir = baseDirForRootName(rootName);
    if (!baseDir) return;

    const subDir = resolve(baseDir, file.project.name);
    if (!subDir.startsWith(baseDir)) return;

    mkdirSync(subDir, { recursive: true });
    const fileName = file.name.endsWith('.sysml') ? file.name : `${file.name}.sysml`;
    const filePath = resolve(subDir, fileName);
    if (!filePath.startsWith(subDir)) return;

    writeFileSync(filePath, file.content, 'utf-8');
  } catch (err) {
    console.error('[Examples Sync] Failed to sync file to disk:', err);
  }
}

/**
 * Remove a file from the examples directory on disk.  Caller passes the
 * root project name ("Examples" or "Örnekler") so we know which base
 * directory to clean.
 */
export function removeFileFromDisk(rootName: string, projectName: string, fileName: string): void {
  try {
    const baseDir = baseDirForRootName(rootName);
    if (!baseDir) return;

    const safeName = fileName.endsWith('.sysml') ? fileName : `${fileName}.sysml`;
    const filePath = resolve(baseDir, projectName, safeName);
    if (!filePath.startsWith(baseDir)) return;

    if (existsSync(filePath)) unlinkSync(filePath);

    const subDir = resolve(baseDir, projectName);
    if (existsSync(subDir) && readdirSync(subDir).length === 0) {
      rmdirSync(subDir);
    }
  } catch (err) {
    console.error('[Examples Sync] Failed to remove file from disk:', err);
  }
}

/**
 * Rename a file on disk within the appropriate examples directory.
 */
export function renameFileOnDisk(rootName: string, projectName: string, oldName: string, newName: string): void {
  try {
    const baseDir = baseDirForRootName(rootName);
    if (!baseDir) return;

    const oldSafe = oldName.endsWith('.sysml') ? oldName : `${oldName}.sysml`;
    const newSafe = newName.endsWith('.sysml') ? newName : `${newName}.sysml`;
    const oldPath = resolve(baseDir, projectName, oldSafe);
    const newPath = resolve(baseDir, projectName, newSafe);
    if (!oldPath.startsWith(baseDir) || !newPath.startsWith(baseDir)) return;

    if (existsSync(oldPath)) {
      const content = readFileSync(oldPath, 'utf-8');
      unlinkSync(oldPath);
      writeFileSync(newPath, content, 'utf-8');
    }
  } catch (err) {
    console.error('[Examples Sync] Failed to rename file on disk:', err);
  }
}
