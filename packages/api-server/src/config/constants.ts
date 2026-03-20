// ── File & Content Limits ────────────────────────────────────────────────────
export const MAX_FILE_BYTES = 10 * 1024 * 1024;          // 10 MB
export const MAX_FILE_NAME_LENGTH = 255;
export const MAX_SEARCH_QUERY_LENGTH = 500;
export const MAX_SEARCH_RESULTS = 50;
export const MAX_SEARCH_FILES = 100;
export const MAX_LINE_PREVIEW_LENGTH = 200;

// ── AI Limits ────────────────────────────────────────────────────────────────
export const MAX_TOOL_ROUNDS = 10;
export const MAX_FREE_TIER_TOOL_ROUNDS = 3;
export const MAX_CONTEXT_LINES = 500;

// ── Auth ─────────────────────────────────────────────────────────────────────
export const BCRYPT_ROUNDS = 12;
export const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;  // 24 hours
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;         // 1 hour

// ── Rate Limiting ────────────────────────────────────────────────────────────
export const RATE_LIMIT = {
  auth:     { windowMs: 15 * 60 * 1000, max: 10 },
  register: { windowMs: 60 * 60 * 1000, max: 5 },
  api:      { windowMs: 60 * 1000,      max: 100 },
  aiChat:   { windowMs: 60 * 1000,      max: 20 },
  mcp:      { windowMs: 60 * 1000,      max: 200 },
  bugReport: { windowMs: 60 * 60 * 1000, max: 10 },
} as const;

// ── Project ──────────────────────────────────────────────────────────────────
export const MAX_PROJECT_DEPTH = 2;

// ── Bug Reports ─────────────────────────────────────────────────────────────
export const MAX_BUG_SCREENSHOT_BYTES = 5 * 1024 * 1024;  // 5 MB
export const MAX_BUG_REPORTS_PER_HOUR = 5;
