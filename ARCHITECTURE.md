# Systemodel — Easy-to-Develop Architecture

## Problem: Current Pain Points

1. **Tool duplication**: `ai/tools.ts` (210 lines) and `mcp/tools.ts` (314 lines) implement the same 8 tools independently
2. **No service layer**: Route handlers directly call Prisma — business logic is untestable without HTTP
3. **Scattered validation**: Zod schemas defined inline in 8 route files, email regex repeated 3x
4. **Repeated boilerplate**: Every route has `try { ... } catch (err) { next(err) }` and copy-pasted error responses
5. **Magic constants**: `10 * 1024 * 1024`, `500`, `50`, `'ADMIN'` scattered across 6+ files
6. **Monolithic auth.ts**: 432 lines handling registration, login, OAuth, email verify, password reset, profile

## New Architecture

```
packages/api-server/src/
├── index.ts                    # App bootstrap (unchanged)
├── db.ts                       # Prisma singleton (unchanged)
│
├── config/
│   ├── constants.ts            # All magic numbers in one place
│   └── schemas.ts              # Shared Zod schemas (email, id, pagination)
│
├── lib/
│   ├── errors.ts               # AppError classes + asyncHandler wrapper
│   └── auth-helpers.ts         # isAdmin(), assertProjectAccess(), signToken()
│
├── services/                   # Business logic — no Express dependency
│   ├── file-ops.ts             # CRUD + search (used by routes, AI tools, MCP tools)
│   ├── project-ops.ts          # Project CRUD + tree builder
│   ├── auth-ops.ts             # Register, login, OAuth, password reset logic
│   └── ai-quota.ts             # Free tier quota tracking
│
├── middleware/
│   ├── auth.ts                 # requireAuth, requireAdmin (unchanged)
│   └── error.ts                # Error handler (enhanced for AppError)
│
├── routes/
│   ├── auth.ts                 # Thin handlers → call auth-ops
│   ├── projects.ts             # Thin handlers → call project-ops
│   ├── files.ts                # Thin handlers → call file-ops
│   ├── ai-chat.ts              # SSE streaming (calls ai-quota, file-ops)
│   ├── ai-keys.ts              # Encryption key management
│   ├── mcp.ts                  # MCP session management
│   ├── mcp-tokens.ts           # MCP token CRUD
│   └── admin.ts                # Admin endpoints
│
├── ai/
│   ├── tools.ts                # Tool definitions + executeToolCall → calls file-ops
│   ├── providers.ts            # LLM provider adapters (unchanged)
│   ├── encryption.ts           # AES-256-GCM (unchanged)
│   └── system-prompt.ts        # (unchanged)
│
└── mcp/
    ├── server.ts               # MCP server factory (unchanged)
    ├── tools.ts                # registerTools → calls file-ops (no more duplication)
    ├── resources.ts            # (unchanged)
    ├── prompts.ts              # (unchanged)
    └── events.ts               # (unchanged)
```

## What Changes (4 new files, 6 modified files)

### NEW: `config/constants.ts`
Every magic number in one place. Adding a new limit = add one line here.

```typescript
// File size & content limits
export const MAX_FILE_BYTES = 10 * 1024 * 1024;     // 10 MB
export const MAX_FILE_NAME_LENGTH = 255;
export const MAX_SEARCH_QUERY_LENGTH = 500;
export const MAX_SEARCH_RESULTS = 50;
export const MAX_SEARCH_FILES = 100;
export const MAX_LINE_PREVIEW_LENGTH = 200;

// AI limits
export const MAX_TOOL_ROUNDS = 10;
export const MAX_FREE_TIER_TOOL_ROUNDS = 3;
export const MAX_CONTEXT_LINES = 500;

// Auth
export const BCRYPT_ROUNDS = 12;
export const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;  // 24h
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;         // 1h

// Rate limiting
export const RATE_LIMIT = {
  auth:     { windowMs: 15 * 60 * 1000, max: 10 },
  register: { windowMs: 60 * 60 * 1000, max: 5 },
  api:      { windowMs: 60 * 1000,      max: 100 },
  aiChat:   { windowMs: 60 * 1000,      max: 20 },
  mcp:      { windowMs: 60 * 1000,      max: 200 },
} as const;

// Project
export const MAX_PROJECT_DEPTH = 2;
```

### NEW: `config/schemas.ts`
Shared validation. No more defining `z.string().email()` in 3 places.

```typescript
import { z } from 'zod';

export const email = z.string().email().transform(e => e.toLowerCase().trim());
export const id = z.string().cuid();
export const fileName = z.string().min(1).max(255);
export const fileContent = z.string().min(1);
export const password = z.string().min(8);
export const provider = z.enum(['anthropic', 'openai', 'gemini']);
```

### NEW: `lib/errors.ts`
Typed errors + automatic try/catch wrapper. Adding a new route = zero boilerplate.

```typescript
import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export const NotFound = (what: string) => new AppError(404, 'Not Found', `${what} not found`);
export const Forbidden = (msg = 'System projects are read-only') => new AppError(403, 'Forbidden', msg);
export const BadRequest = (msg: string) => new AppError(400, 'Bad Request', msg);

// Wraps an async route handler — eliminates try/catch in every route
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
```

### NEW: `lib/auth-helpers.ts`
Extracted from routes where it was duplicated 10+ times.

```typescript
import { prisma } from '../db.js';

export function isAdmin(role?: string): boolean {
  return role?.toUpperCase() === 'ADMIN';
}

export async function assertProjectAccess(projectId: string, userId: string, userRole?: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, OR: [{ ownerId: userId }, { isSystem: true }] },
  });
  if (!project) return { allowed: false, isSystem: false, isAdmin: false };
  return { allowed: true, isSystem: project.isSystem, isAdmin: isAdmin(userRole) };
}

export function assertWriteAccess(access: { allowed: boolean; isSystem: boolean; isAdmin: boolean }) {
  if (!access.allowed) throw NotFound('Project');
  if (access.isSystem && !access.isAdmin) throw Forbidden();
}
```

### NEW: `services/file-ops.ts`
Core file operations — used by REST routes, AI tools, AND MCP tools. **Eliminates the duplication.**

```typescript
import { prisma } from '../db.js';
import { mcpEvents } from '../mcp/events.js';
import { MAX_FILE_BYTES, MAX_FILE_NAME_LENGTH, MAX_SEARCH_QUERY_LENGTH,
         MAX_SEARCH_RESULTS, MAX_SEARCH_FILES, MAX_LINE_PREVIEW_LENGTH } from '../config/constants.js';
import { NotFound, Forbidden, BadRequest } from '../lib/errors.js';

// Pure business logic — no Express, no MCP SDK. Just data in, data out.

export async function listFiles(projectId: string) {
  return prisma.sysMLFile.findMany({
    where: { projectId },
    select: { id: true, name: true, size: true, createdAt: true, updatedAt: true },
  });
}

export async function getFile(fileId: string, projectId: string) {
  const file = await prisma.sysMLFile.findFirst({ where: { id: fileId, projectId } });
  if (!file) throw NotFound('File');
  return file;
}

export async function createFile(projectId: string, name: string, content: string, userId: string) {
  const safeName = sanitizeFileName(name);
  assertContentSize(content);
  const file = await prisma.sysMLFile.create({
    data: { name: safeName, content, size: Buffer.byteLength(content, 'utf8'), projectId },
  });
  mcpEvents.emitFileChange({ fileId: file.id, userId, action: 'created' });
  return file;
}

export async function updateFile(fileId: string, content: string, userId: string) {
  assertContentSize(content);
  const size = Buffer.byteLength(content, 'utf8');
  const updated = await prisma.sysMLFile.update({ where: { id: fileId }, data: { content, size } });
  mcpEvents.emitFileChange({ fileId, userId, action: 'updated' });
  return updated;
}

export async function deleteFile(fileId: string, userId: string) {
  const file = await prisma.sysMLFile.findUnique({ where: { id: fileId } });
  if (!file) throw NotFound('File');
  await prisma.sysMLFile.delete({ where: { id: fileId } });
  mcpEvents.emitFileChange({ fileId, userId, action: 'deleted' });
  return file;
}

export async function searchFiles(projectId: string, query: string) {
  const q = query.slice(0, MAX_SEARCH_QUERY_LENGTH).toLowerCase();
  const files = await prisma.sysMLFile.findMany({
    where: { projectId },
    select: { id: true, name: true, content: true },
    take: MAX_SEARCH_FILES,
  });
  const matches: string[] = [];
  outer: for (const file of files) {
    for (const [i, line] of file.content.split('\n').entries()) {
      if (line.toLowerCase().includes(q)) {
        matches.push(`${file.name}:${i + 1} — ${line.trim().slice(0, MAX_LINE_PREVIEW_LENGTH)}`);
        if (matches.length >= MAX_SEARCH_RESULTS) break outer;
      }
    }
  }
  return matches;
}

// ── Internal helpers ─────────────────────────────────────────────
function sanitizeFileName(name: string): string {
  const safe = name.replace(/[\\/\0]/g, '').slice(0, MAX_FILE_NAME_LENGTH);
  if (!safe) throw BadRequest('Invalid file name');
  return safe;
}

function assertContentSize(content: string) {
  if (Buffer.byteLength(content, 'utf8') > MAX_FILE_BYTES) {
    throw BadRequest(`Content exceeds ${MAX_FILE_BYTES} byte limit`);
  }
}
```

### How This Simplifies Everything

**Before (files.ts route — 20 lines per handler):**
```typescript
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const { allowed, isSystem, isAdmin } = await assertProjectAccess(req.params.projectId, req.userId!, req.userRole);
    if (!allowed) { res.status(404).json({ error: 'Not Found', message: 'Project not found' }); return; }
    if (isSystem && !isAdmin) { res.status(403).json({ error: 'Forbidden', message: 'System projects are read-only' }); return; }
    const { name, content } = fileCreateSchema.parse(req.body);
    const contentSize = Buffer.byteLength(content, 'utf8');
    if (contentSize > MAX_CONTENT_BYTES) { res.status(413).json({...}); return; }
    const safeName = name.replace(/[\\/\0]/g, '').slice(0, 255);
    if (!safeName) { res.status(400).json({...}); return; }
    const file = await prisma.sysMLFile.create({ data: { name: safeName, content, size: contentSize, projectId: req.params.projectId } });
    mcpEvents.emitFileChange({ fileId: file.id, userId: req.userId!, action: 'created' });
    res.status(201).json({ data: file });
  } catch (err) { next(err); }
});
```

**After (5 lines):**
```typescript
router.post('/', asyncHandler(async (req: AuthRequest, res) => {
  assertWriteAccess(await assertProjectAccess(req.params.projectId, req.userId!, req.userRole));
  const { name, content } = fileCreateSchema.parse(req.body);
  const file = await fileOps.createFile(req.params.projectId, name, content, req.userId!);
  res.status(201).json({ data: file });
}));
```

**Before (MCP create_file — 30 lines):**
```typescript
server.tool('create_file', '...', { projectId: z.string(), name: z.string(), content: z.string() },
  async ({ projectId, name, content }) => {
    const project = await prisma.project.findFirst({ where: { id: projectId, ownerId: userId } });
    if (!project) return { content: [{ type: 'text', text: 'Error: ...' }], isError: true };
    const safeName = name.replace(/[\\/\0]/g, '').slice(0, 255);
    if (!safeName) return { content: [{ type: 'text', text: 'Error: ...' }], isError: true };
    const size = Buffer.byteLength(content, 'utf8');
    if (size > 10 * 1024 * 1024) return { content: [{ type: 'text', text: 'Error: ...' }], isError: true };
    const file = await prisma.sysMLFile.create({ ... });
    mcpEvents.emitFileChange({ ... });
    return { content: [{ type: 'text', text: JSON.stringify({ ... }) }] };
  }
);
```

**After (5 lines):**
```typescript
server.tool('create_file', '...', { projectId: z.string(), name: z.string(), content: z.string() },
  async ({ projectId, name, content }) => {
    const file = await fileOps.createFile(projectId, name, content, userId);
    return mcpResult(JSON.stringify({ id: file.id, name: file.name, size: file.size }));
  }
);
```

**Before (AI tool create_file — 10 lines):**
```typescript
case 'create_file': {
  const proj = await prisma.project.findFirst({ where: { id: args.projectId, ownerId: userId } });
  if (!proj) return { result: 'Error: ...', isError: true };
  const safeName = (args.name as string).replace(/[\\/\0]/g, '').slice(0, 255);
  if (!safeName) return { result: 'Error: Invalid file name', isError: true };
  const size = Buffer.byteLength(args.content as string, 'utf8');
  if (size > 10 * 1024 * 1024) return { result: 'Error: Content exceeds 10MB limit', isError: true };
  const created = await prisma.sysMLFile.create({ ... });
  mcpEvents.emitFileChange({ ... });
  return { result: JSON.stringify({ ... }), isError: false };
}
```

**After (3 lines):**
```typescript
case 'create_file': {
  const file = await fileOps.createFile(args.projectId, args.name, args.content, userId);
  return { result: JSON.stringify({ id: file.id, name: file.name, size: file.size }), isError: false };
}
```

## Implementation Order

Each step is independently committable and testable:

1. **`config/constants.ts`** — Extract all magic numbers (zero risk, pure data)
2. **`config/schemas.ts`** — Extract shared Zod schemas
3. **`lib/errors.ts`** — AppError + asyncHandler
4. **`lib/auth-helpers.ts`** — Extract isAdmin + assertProjectAccess
5. **`services/file-ops.ts`** — Extract file CRUD from routes
6. **Rewire `routes/files.ts`** — Use file-ops + asyncHandler
7. **Rewire `ai/tools.ts`** — Use file-ops (delete ~100 lines)
8. **Rewire `mcp/tools.ts`** — Use file-ops (delete ~200 lines)
9. **Rewire `routes/projects.ts`** — Use auth-helpers + asyncHandler
10. **Rewire `routes/auth.ts`** — Use constants + schemas
11. **Update error middleware** — Handle AppError
12. **Rewire `index.ts`** — Use RATE_LIMIT constants
13. **Tests** — Add unit tests for services/file-ops, lib/errors

## What This Achieves

| Metric | Before | After |
|--------|--------|-------|
| Lines to add a new file route | ~20 | ~5 |
| Lines to add an AI+MCP tool | ~40 (write twice) | ~8 (write once) |
| Places to change file size limit | 4 files | 1 file |
| Places to change isAdmin logic | 10 locations | 1 function |
| try/catch blocks in routes | 18 | 0 (asyncHandler) |
| Test coverage of business logic | Requires HTTP mocking | Direct function calls |

## Rules for New Development

1. **Business logic goes in `services/`** — never in route handlers or MCP tools
2. **Route handlers are thin** — validate, call service, return response
3. **Constants go in `config/constants.ts`** — never hardcode numbers
4. **Shared schemas go in `config/schemas.ts`** — route-specific schemas stay in their route file
5. **Throw `AppError`** — never manually write `res.status(4xx).json({...})` for standard errors
6. **Use `asyncHandler`** — never write `try { } catch (err) { next(err) }`
