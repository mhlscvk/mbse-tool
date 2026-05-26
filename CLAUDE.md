# Claude Code Memory — Systemodel

## What This Project Is

Systemodel is a web-based SysML v2 modeling platform. It parses SysML v2 text, generates AST, lays out diagrams, and provides AI-assisted editing via chat and MCP. It runs as a pnpm monorepo with 5 packages.

## Monorepo Structure

```
packages/
├── shared-types/      # TypeScript interfaces (AST, diagram, API types) — no deps
├── diagram-service/   # SysML parser → AST → ELK layout (port 3002, WebSocket)
├── lsp-server/        # Language Server Protocol bridge (port 3001, WebSocket)
├── api-server/        # REST API, auth, AI chat, MCP server (port 3003)
└── web-client/        # React frontend, Monaco editor, diagram viewer (port 5173)
```

## API Server Architecture (post-refactor)

The api-server follows a **service-layer architecture** designed for easy development:

```
src/
├── config/
│   ├── constants.ts       # ALL magic numbers: rate limits, file sizes, TTLs, depths
│   └── schemas.ts         # Shared Zod schemas: email, password, fileName, provider
├── lib/
│   ├── errors.ts          # AppError classes + asyncHandler (eliminates try/catch)
│   ├── auth-helpers.ts    # isAdmin(), assertProjectAccess(), assertWriteAccess()
│   └── id-generator.ts    # Custom display ID generators (PRJ-*, FIL-*, ELM-*, NTF-*)
├── services/
│   ├── file-ops.ts        # Unified file CRUD — used by REST routes, AI tools, AND MCP tools
│   ├── startup-ops.ts     # Startup CRUD, member management, access checks
│   ├── element-lock-ops.ts # Element check-out/check-in with audit logging
│   ├── notification-ops.ts # Lock request notifications
│   └── audit-ops.ts       # Audit log queries
├── middleware/
│   ├── auth.ts            # requireAuth, requireAdmin (JWT verification)
│   └── error.ts           # Global error handler (AppError-aware)
├── routes/                # Thin handlers: validate → call service → respond
│   ├── auth.ts            # Register, login, OAuth, password reset, email verify
│   ├── projects.ts        # Project CRUD + tree builder (supports 3 project types)
│   ├── files.ts           # File CRUD (delegates to file-ops.ts)
│   ├── startups.ts        # Startup CRUD + member management
│   ├── element-locks.ts   # Element check-out/check-in + audit log
│   ├── notifications.ts   # Lock request notifications
│   ├── ai-chat.ts         # SSE streaming chat with tool-use loop
│   ├── ai-keys.ts         # Encrypted API key management
│   ├── mcp.ts             # MCP session management
│   ├── mcp-tokens.ts      # MCP token CRUD
│   └── admin.ts           # Admin endpoints (sync examples)
├── ai/
│   ├── tools.ts           # AI tool definitions + executeToolCall (uses file-ops)
│   ├── providers.ts       # Anthropic, OpenAI, Gemini adapters with tool-use streaming
│   ├── encryption.ts      # AES-256-GCM encrypt/decrypt for API keys
│   └── system-prompt.ts   # System prompt for AI assistant
├── mcp/
│   ├── server.ts          # MCP server factory (createMcpServer)
│   ├── tools.ts           # MCP tool registration (uses file-ops — no duplication)
│   ├── resources.ts       # MCP resources (file subscriptions, syntax reference)
│   ├── prompts.ts         # MCP prompts (review, explain, generate)
│   └── events.ts          # EventEmitter for file change notifications
├── db.ts                  # Prisma singleton
└── index.ts               # Express app bootstrap, middleware pipeline
```

### Key Design Patterns

1. **Business logic in `services/`** — never in route handlers or MCP tools
2. **Route handlers are thin** — validate input, call service, return JSON
3. **`asyncHandler`** wraps all routes — zero manual try/catch blocks
4. **`AppError`** classes (`NotFound`, `Forbidden`, `BadRequest`, `PayloadTooLarge`) — throw from anywhere, error middleware formats the response
5. **`file-ops.ts`** is the single source of truth for file operations — REST routes, AI tools, and MCP tools all call the same functions
6. **Constants in one place** — `config/constants.ts` has every magic number
7. **Shared Zod schemas** — `config/schemas.ts` for email, password, provider, fileName

### How to Add New Features

- **New route**: Create handler in `routes/`, use `asyncHandler`, call a service
- **New file operation**: Add to `services/file-ops.ts`, it's automatically available to REST + AI + MCP
- **New AI/MCP tool**: Add tool definition to `ai/tools.ts`, implement using `file-ops`, then register in `mcp/tools.ts` using the same service
- **New constant**: Add to `config/constants.ts`
- **New validation schema**: Add to `config/schemas.ts` if shared, or keep in route file if route-specific

## Database

PostgreSQL via Prisma ORM. Schema at `packages/api-server/prisma/schema.prisma`.

**Models**: User, Startup, StartupMember, Project (recursive tree), SysMLFile, ElementLock, LockNotification, AuditLog, AiUsage, AiChatMessage, McpToken, AiProviderKey

**Enums**: Role (VIEWER/EDITOR/ADMIN), ProjectType (SYSTEM/STARTUP/USER), StartupRole (SITE_ADMIN/STARTUP_ADMIN/STARTUP_USER), LockOperation (CHECK_OUT/CHECK_IN)

**Key indexes**: projectId on SysMLFile, startupId on Project, fileId+elementName on ElementLock (unique), holderId+read on LockNotification

**Migration history**:
- `20260315133754_init` — Initial schema
- `20260317000000_add_email_verify_google_auth` — Email verification + Google OAuth
- `20260317183818_add_ai_usage_tracking` — AI usage tracking
- `20260317184703_add_ai_chat_messages` — AI chat messages
- `20260318120000_add_mcp_tokens` — MCP tokens
- `20260318150000_add_indexes` — Performance indexes
- `20260318160000_add_ai_provider_keys` — AI provider key storage
- `20260320120000_add_reset_token_and_indexes` — Password reset tokens
- `20260321120000_add_startups_element_locks_project_types` — **Startups, element locks, project types, display IDs, notifications, audit log**

Run `prisma migrate deploy` when deploying.

## Project Types & Access Control

### Three Project Types
- **SYSTEM**: Read-only for all users, writable by admins only (e.g. Examples)
- **STARTUP** (Enterprise): Isolated per startup, accessible only to startup members
- **USER**: Personal projects, accessible only to the owner

### Startup Roles
- **SITE_ADMIN**: Full access to all startups and projects (maps to User.role=ADMIN)
- **STARTUP_ADMIN**: Full access within their startup (manage projects, members, force check-in)
- **STARTUP_USER**: Read all files, edit only checked-out elements

### Element-Level Locking
- Users check out individual SysML elements (right-click → Check-out)
- Only one user can hold a lock on an element at a time
- Non-locked elements are read-only for everyone
- All check-out/check-in operations are audit-logged
- Lock request notifications can be sent to the lock holder

### Display IDs
Custom human-readable IDs for all major entities:
- Startup: `ENT-NUMERIC-001`
- Project: `PRJ-ENT-NUMERIC-X4P72` / `PRJ-USR-U145-B9M31` / `PRJ-SYS-0001-A8K29`
- File: `FIL-8D21K`
- Element: `ELM-54PQ9`
- Notification: `NTF-99321`

Internal CUIDs remain the primary keys; display IDs are unique secondary identifiers.

## Authentication

- JWT with HS256 (explicit algorithm enforcement)
- Timing-safe login (bcrypt always runs, even for non-existent users)
- Email enumeration prevention (identical responses for existing/new accounts)
- Google OAuth (via google-auth-library)
- Email verification (skip in dev mode)
- Password reset via separate `resetToken`/`resetTokenExp` columns (not shared with verify token)

## AI Integration

- 3 providers: Anthropic (Claude), OpenAI (GPT), Google (Gemini)
- Free tier: Claude Haiku, 50 requests/month, 3 tool rounds max
- Paid tier: User provides API key (encrypted AES-256-GCM), unlimited, 10 tool rounds max
- 6 tools: list_projects, list_files, read_file, update_file, apply_edit, search_files
- Least-privilege: create_file and delete_file removed from AI and MCP tools (server-enforced in file-ops.ts)
- Tool name whitelist validation across all providers
- SSE streaming for chat responses

## MCP & AI Least-Privilege Policy

MCP and AI chat tools are restricted to **read and update only**:
- **Allowed**: list_projects, list_files, read_file, update_file, apply_edit, search_files
- **Blocked**: create_file, delete_file (removed from tool definitions)
- **Defense-in-depth**: `file-ops.ts` rejects `createFile`/`deleteFile` calls from `mcp` or `ai_chat` source
- **API keys**: AES-256-GCM encrypted at rest, decrypted only in-memory during API call, never logged or sent to clients
- File creation and deletion remain available via REST API routes only

## Security Highlights

- CSRF via Content-Type enforcement (exempts /mcp, allows DELETE with no body)
- Rate limiting: 6 tiers (auth, register, api, aiChat, mcp, bugReport)
- File naming: `.sysml` extension enforced server-side via `normalizeSysMLFileName()`, all extensions stripped and `.sysml` appended
- File size: 10MB max, file names sanitized, search bounded (100 files, 50 results, 200-char lines)
- Admin visibility: admins no longer see other users' personal projects in normal listing (fixed data leak); cross-user visibility only via Settings → Admin
- MCP sessions: max 5/user, 500 total, 24h TTL
- Error middleware: never leaks internal details (Prisma, stack traces)
- Element locks: TOCTOU prevention via unique constraint catch (P2002), file-to-project validation
- Element name sanitization: control characters stripped, length enforced (max 500)
- Notification spam prevention: 5-minute cooldown dedup per requester/element/holder
- Self-notification prevention: cannot request lock on element you hold
- Notification access control: project membership verified before sending lock request
- Startup ID race condition: retry loop with P2002 catch for concurrent creates
- Audit log queries capped (100 entries max) to prevent resource exhaustion

## Monitoring

All backend services expose `/health` (liveness) and `/ready` (readiness) endpoints — no auth, no rate limit:
- **api-server**: `/health`, `/ready` (checks PostgreSQL via `SELECT 1`)
- **diagram-service**: `/health`, `/ready` (checks parser self-test)
- **lsp-server**: `/health`, `/ready` (checks HTTP server availability)
- Health routes defined in `api-server/src/routes/health.ts`, inline in `diagram-service/src/index.ts` and `lsp-server/src/index.ts`
- External monitoring via UptimeRobot (free tier, 5-min interval, email alerts)
- Setup docs: `docs/monitoring-setup.md`

## Testing

**Total: 1151 tests** (pre-commit hook full coverage; 1014 via root `pnpm test` = api-server + diagram-service) — all passing, 0 skipped.

> **Count note (updated 2026-05-26, Faz 2 Slice 4 Security B1+B3; prod HEAD `477b87d`):** Authoritative current totals are the per-package subtotals below — api-server **345**, diagram-service **674**, web-client **132** = **1151**. Slice 4 added +5 to api-server (340 → 345): B1 `listMembers` conditional-email ×2, B3 change-password ×3. Slice 3b added the web-client RTL harness and +4 (128 → 132). The per-suite enumerations that follow reflect the earlier 1009 baseline and have not been line-by-line re-derived; trust the bolded package subtotals for current counts.

- `api-server`: 345 tests across 24 suites
  - `ai/encryption.test.ts` (14): AES-256-GCM encrypt/decrypt, tampering, key masking
  - `ai/tools.test.ts` (17): tool execution, access control, size limits, least-privilege enforcement
  - `ai/providers.test.ts` (5): tool schema validation, least-privilege tool exclusion
  - `middleware/auth.test.ts` (12): JWT validation, expired tokens, role checks
  - `middleware/error.test.ts` (4): Zod errors, AppError, info leakage prevention
  - `middleware/csrf.test.ts` (13): Content-Type enforcement for all methods
  - `lib/id-generator.test.ts` (16): display ID formats, uniqueness, truncation, ambiguous char exclusion
  - `services/startup-ops.test.ts` (23): startup CRUD, member management, role-based access, slug conflicts
  - `services/element-lock-ops.test.ts` (18): check-out/check-in, force check-in, TOCTOU (P2002), file-project validation, element name sanitization, audit logging
  - `services/notification-ops.test.ts` (15): create/list/read notifications, self-notification prevention, cooldown dedup, project access check, unread count
  - `routes/startups-invitations.test.ts` (10): invitation CRUD, email-based invitations, role assignment, duplicate prevention, revocation
  - `services/file-ops.test.ts` (95): file CRUD, .sysml normalization (16 cases), sanitization, SysML package helpers, content size limits, applyEdit, search, MCP events, least-privilege source guards (mcp/ai_chat blocked from create/delete)
  - `lib/auth-helpers.test.ts` (19): isAdmin, assertProjectAccess (system/USER/STARTUP), assertWriteAccess
  - `routes/admin.test.ts` (9): admin user listing, user project listing, scope verification, authorization guards
  - `mcp/events.test.ts` (6): file change event emission
  - `routes/files.test.ts` (8): file CRUD access control, SSE token format, move file dual-access check
  - `routes/health.test.ts` (3): liveness response format, readiness DB ok/fail scenarios
  - `routes/auth.test.ts` (10): registration security (disposable domains, timing-safe login), password reset token validation, JWT format, safe user object
  - `routes/ai-keys.test.ts` (8): key encryption, masking, provider validation, upsert pattern, schema validation
  - `routes/mcp-tokens.test.ts` (11): token masking, limit enforcement, format, expiration, soft delete, user scoping, schema validation
- `web-client`: 132 tests across 12 suites
  - Theme store (4), recent files (13), sysml helpers (22), cursor fix (6), line diff (13)
  - `edgeLabelPlacement.test.ts` (23): candidate-based placement, collision avoidance, obstacles, direction helpers
  - `resolveEdgeLabelOverlaps.test.ts` (14): overlap detection, group resolution, determinism
  - `Diagram/DiagramViewer.data-node-id.test.tsx` (2): data-node-id ↔ model.children node id parity (Slice 3a W1 backfill)
  - `Diagram/bug-render-01.test.tsx` (2): model A→B switch reconciliation repro — no stale A entry-action node persists (settled + rapid switch); clean-reconciliation baseline guard (Slice 3b W5)
- `diagram-service`: 674 tests across 24 suites
  - Parser: 6 suites (391 tests) — core parser, state, new features, robustness, security, OMG vehicle model
  - Transformer: 5 suites (124 tests) — BDD core, state, new features, robustness, audit
  - View filters (59), WebSocket server (17), ELK layout (7)

Run tests:
```bash
pnpm --filter @systemodel/api-server test
pnpm --filter @systemodel/diagram-service test
pnpm --filter @systemodel/web-client test
```

## Frontend

- React 18 + Vite + TypeScript
- Zustand stores: auth, theme, ai-settings, recent-files (all isolated, no cross-store deps)
- Services: api-client (REST), ai-client (SSE streaming), diagram-client (WebSocket), lsp-client (WebSocket with reconnect)
- Pages: LoginPage, ProjectsPage, EditorPage, SettingsPage, TrainingPage
- ErrorBoundary wraps entire app

## Diagram Layout

- ELK layered algorithm for all views (DOWN direction for behavioral/flow containers)
- **Action flow fix**: Succession edges (`first X then Y`) now drive layout ordering in ALL containers, not just behavioral kinds. Packages with actions render in correct topological order.
- Flow edges get `elk.layered.priority.direction: 10` to override generic positioning
- View-specific spacing: AFV uses 40px node / 50px layer, GV uses 30px / 40px
- Containers with flow edges automatically get behavioral spacing and edge inclusion

## Branch History

Working branch: `master`

Commits (chronological):
1. `b799124` — Fix security, auth, and reliability issues from code review (20 files, +512/-57)
2. `bb33968` — Deep audit: fix security vulnerabilities, bugs, and expand test coverage (11 files, +393/-31)
3. `6fdcee4` — Add architecture plan for easy-to-develop modular refactor
4. `25d3da6` — Refactor api-server: service layer, shared config, and asyncHandler (18 files, +964/-1142)
5. `f729a65` — Add CLAUDE.md memory file and update README with new architecture
6. (latest) — Add project types, startup isolation, element-level locking, display IDs, notifications, audit log

## Deployment

Production at systemodel.com on Hetzner VPS:
```
Nginx (80/443, SSL) → api-server (3003) + diagram-service (3002) + lsp-server (3001) + static SPA
```
PM2 manages services. Always use `pm2 start ecosystem.config.cjs` (not `pm2 restart all`) to ensure correct `cwd` for dotenv.

## New API Endpoints (from startup/lock feature)

### Startups
- `GET /api/startups` — List user's startups (admins see all)
- `POST /api/startups` — Create startup (admin only)
- `GET /api/startups/:id` — Get startup details
- `PATCH /api/startups/:id` — Update startup
- `DELETE /api/startups/:id` — Delete startup (admin only)
- `GET /api/startups/:id/members` — List members
- `POST /api/startups/:id/members` — Add member
- `PATCH /api/startups/:id/members/:userId` — Update role
- `DELETE /api/startups/:id/members/:userId` — Remove member

### Element Locks
- `GET /api/projects/:projectId/element-locks/files/:fileId/locks` — List file locks
- `GET /api/projects/:projectId/element-locks/files/:fileId/locks/:elementName` — Get lock status
- `POST /api/projects/:projectId/element-locks/files/:fileId/locks` — Check out element
- `DELETE /api/projects/:projectId/element-locks/files/:fileId/locks/:elementName` — Check in element
- `DELETE /api/projects/:projectId/element-locks/files/:fileId/locks/:elementName/force` — Force check-in (admin)
- `GET /api/projects/:projectId/element-locks/audit-log` — Get audit log

### Notifications
- `GET /api/notifications` — List notifications
- `GET /api/notifications/unread-count` — Get unread count
- `POST /api/notifications` — Send lock request
- `PATCH /api/notifications/:id/read` — Mark as read
- `POST /api/notifications/mark-all-read` — Mark all as read

### Admin (read-only cross-user visibility)
- `POST /api/admin/sync-examples` — Re-import system examples from disk
- `GET /api/admin/users` — List all users (safe fields only, no passwords)
- `GET /api/admin/users/:userId/projects` — List user's personal projects
- `GET /api/admin/projects/:projectId/files` — List files in any project
- `GET /api/admin/files/:fileId` — Read a single file's content

### File Naming
- All files enforced to end with `.sysml` via `normalizeSysMLFileName()` in `services/file-ops.ts`
- Backend strips all extensions, appends `.sysml` — never trusts frontend
- On rename, root `package` declaration in file content is updated to match new name
- SysML identifiers with spaces/special chars are auto-quoted: `package 'Cruise Control' {}`
