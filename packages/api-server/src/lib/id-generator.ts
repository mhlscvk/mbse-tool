import crypto from 'crypto';

/**
 * Generates a random alphanumeric suffix (uppercase + digits).
 * Default length: 5 characters → 60M+ combinations.
 */
function randomSuffix(length = 5): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid ambiguity
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

/**
 * Generate a startup ID: ENT-{SHORTNAME}-{SEQ}
 * Example: ENT-NUMERIC-001
 */
export function generateStartupId(shortName: string, seq: number): string {
  const name = shortName.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `ENT-${name}-${String(seq).padStart(3, '0')}`;
}

/**
 * Generate a project display ID: PRJ-{TYPE}-{OWNER}-{RANDOM}
 * Examples:
 *   PRJ-SYS-0001-A8K29
 *   PRJ-ENT-NUMERIC-X4P72
 *   PRJ-USR-U145-B9M31
 */
export function generateProjectDisplayId(
  type: 'SYSTEM' | 'STARTUP' | 'USER',
  ownerRef: string,
): string {
  const prefix = type === 'SYSTEM' ? 'SYS' : type === 'STARTUP' ? 'ENT' : 'USR';
  const owner = ownerRef.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  return `PRJ-${prefix}-${owner}-${randomSuffix()}`;
}

/**
 * Generate a file display ID: FIL-{RANDOM}
 * Example: FIL-8D21K
 */
export function generateFileDisplayId(): string {
  return `FIL-${randomSuffix()}`;
}

/**
 * Generate an element lock display ID: ELM-{RANDOM}
 * Example: ELM-54PQ9
 */
export function generateElementDisplayId(): string {
  return `ELM-${randomSuffix()}`;
}

/**
 * Generate a notification display ID: NTF-{RANDOM}
 * Example: NTF-99321
 */
export function generateNotificationDisplayId(): string {
  return `NTF-${randomSuffix()}`;
}

/**
 * Generate a user display reference for project IDs.
 * Takes the last 4 chars of the CUID → e.g. "U" + "145" = "U145"
 */
export function userOwnerRef(userId: string): string {
  return 'U' + userId.slice(-3);
}
