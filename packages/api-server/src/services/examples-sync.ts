import { prisma } from '../db.js';
import { readFileSync, writeFileSync, mkdirSync, unlinkSync, readdirSync, rmdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = resolve(__dirname, '../../prisma/examples');

/**
 * Sync a single file to the prisma/examples/ directory on disk.
 * Called after admin creates or updates a file in a system project.
 */
export async function syncFileToDisk(fileId: string): Promise<void> {
  try {
    const file = await prisma.sysMLFile.findUnique({
      where: { id: fileId },
      include: { project: { select: { name: true, isSystem: true, parent: { select: { isSystem: true } } } } },
    });
    if (!file || !file.project.isSystem) return;

    const subDir = resolve(EXAMPLES_DIR, file.project.name);
    if (!subDir.startsWith(EXAMPLES_DIR)) return;

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
 * Remove a file from the prisma/examples/ directory on disk.
 * Called after admin deletes a file from a system project.
 */
export function removeFileFromDisk(projectName: string, fileName: string): void {
  try {
    const safeName = fileName.endsWith('.sysml') ? fileName : `${fileName}.sysml`;
    const filePath = resolve(EXAMPLES_DIR, projectName, safeName);
    if (!filePath.startsWith(EXAMPLES_DIR)) return;

    if (existsSync(filePath)) unlinkSync(filePath);

    // Remove subdir if empty
    const subDir = resolve(EXAMPLES_DIR, projectName);
    if (existsSync(subDir) && readdirSync(subDir).length === 0) {
      rmdirSync(subDir);
    }
  } catch (err) {
    console.error('[Examples Sync] Failed to remove file from disk:', err);
  }
}

/**
 * Rename a file on disk within prisma/examples/.
 */
export function renameFileOnDisk(projectName: string, oldName: string, newName: string): void {
  try {
    const oldSafe = oldName.endsWith('.sysml') ? oldName : `${oldName}.sysml`;
    const newSafe = newName.endsWith('.sysml') ? newName : `${newName}.sysml`;
    const oldPath = resolve(EXAMPLES_DIR, projectName, oldSafe);
    const newPath = resolve(EXAMPLES_DIR, projectName, newSafe);
    if (!oldPath.startsWith(EXAMPLES_DIR) || !newPath.startsWith(EXAMPLES_DIR)) return;

    if (existsSync(oldPath)) {
      const content = readFileSync(oldPath, 'utf-8');
      unlinkSync(oldPath);
      writeFileSync(newPath, content, 'utf-8');
    }
  } catch (err) {
    console.error('[Examples Sync] Failed to rename file on disk:', err);
  }
}
