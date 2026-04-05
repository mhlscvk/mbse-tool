/**
 * Computes line-level diff hunks between two strings.
 * Each hunk describes a contiguous region of changed/added/deleted lines.
 */

export interface DiffHunk {
  /** Unique id for this hunk */
  id: string;
  /** 1-based start line in the NEW content */
  newStartLine: number;
  /** 1-based end line in the NEW content (inclusive). 0 if pure deletion. */
  newEndLine: number;
  /** The original lines from old content (for reverting) */
  oldLines: string[];
  /** The new lines in this hunk */
  newLines: string[];
  /** 'added' = lines only in new, 'deleted' = lines only in old, 'modified' = both differ */
  type: 'added' | 'deleted' | 'modified';
}

/**
 * Simple LCS-based diff between two line arrays.
 * Returns edit operations: 'equal', 'insert', 'delete'.
 */
interface EditOp {
  type: 'equal' | 'insert' | 'delete';
  oldLine?: string;  // present for 'equal' and 'delete'
  newLine?: string;  // present for 'equal' and 'insert'
}

function computeEditOps(oldLines: string[], newLines: string[]): EditOp[] {
  const m = oldLines.length;
  const n = newLines.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build edit operations
  const ops: EditOp[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      ops.push({ type: 'equal', oldLine: oldLines[i - 1], newLine: newLines[j - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ type: 'insert', newLine: newLines[j - 1] });
      j--;
    } else {
      ops.push({ type: 'delete', oldLine: oldLines[i - 1] });
      i--;
    }
  }
  ops.reverse();
  return ops;
}

let hunkIdCounter = 0;

/**
 * Compute diff hunks between old and new content strings.
 */
export function computeDiffHunks(oldContent: string, newContent: string): DiffHunk[] {
  if (oldContent === newContent) return [];

  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const ops = computeEditOps(oldLines, newLines);

  // Walk ops and group consecutive non-equal ops into hunks
  const hunks: DiffHunk[] = [];
  let newLineNum = 1; // 1-based line number in new content

  let pendingOld: string[] = [];
  let pendingNew: string[] = [];
  let hunkNewStart = -1;

  const flushHunk = () => {
    if (pendingOld.length === 0 && pendingNew.length === 0) return;
    const type: DiffHunk['type'] =
      pendingOld.length === 0 ? 'added' :
      pendingNew.length === 0 ? 'deleted' : 'modified';

    hunks.push({
      id: `ai_hunk_${++hunkIdCounter}`,
      newStartLine: type === 'deleted' ? hunkNewStart : hunkNewStart,
      newEndLine: type === 'deleted' ? 0 : hunkNewStart + pendingNew.length - 1,
      oldLines: [...pendingOld],
      newLines: [...pendingNew],
      type,
    });
    pendingOld = [];
    pendingNew = [];
    hunkNewStart = -1;
  };

  for (const op of ops) {
    if (op.type === 'equal') {
      flushHunk();
      newLineNum++;
    } else if (op.type === 'insert') {
      if (hunkNewStart === -1) hunkNewStart = newLineNum;
      pendingNew.push(op.newLine!);
      newLineNum++;
    } else { // delete
      if (hunkNewStart === -1) hunkNewStart = newLineNum;
      pendingOld.push(op.oldLine!);
    }
  }
  flushHunk();

  return hunks;
}
