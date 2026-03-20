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
│   └── auth-helpers.ts    # isAdmin(), assertProjectAccess(), assertWriteAccess()
├── services/
│   └── file-ops.ts        # Unified file CRUD — used by REST routes, AI tools, AND MCP tools
├── middleware/
│   ├── auth.ts            # requireAuth, requireAdmin (JWT verification)
│   └── error.ts           # Global error handler (AppError-aware)
├── routes/                # Thin handlers: validate → call service → respond
│   ├── auth.ts            # Register, login, OAuth, password reset, email verify
│   ├── projects.ts        # Project CRUD + tree builder
│   ├── files.ts           # File CRUD (delegates to file-ops.ts)
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

**Models**: User, Project (recursive tree), SysMLFile, AiUsage, AiChatMessage, McpToken, AiProviderKey

**Key indexes**: projectId on SysMLFile, userId on AiUsage, token on McpToken

**Migration note**: The `resetToken`/`resetTokenExp` columns were added in migration `20260320120000_add_reset_token_and_indexes`. Run `prisma migrate deploy` when deploying.

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
- 8 tools: list_projects, list_files, read_file, create_file, update_file, apply_edit, delete_file, search_files
- Tool name whitelist validation across all providers
- SSE streaming for chat responses

## Security Highlights

- CSRF via Content-Type enforcement (exempts /mcp, allows DELETE with no body)
- Rate limiting: 5 tiers (auth, register, api, aiChat, mcp)
- File size: 10MB max, file names sanitized, search bounded (100 files, 50 results, 200-char lines)
- MCP sessions: max 5/user, 500 total, 24h TTL
- Error middleware: never leaks internal details (Prisma, stack traces)

## Testing

**Total: 481 tests** (all passing)

- `api-server`: 60 tests across 6 suites
  - `ai/encryption.test.ts` (14): AES-256-GCM encrypt/decrypt, tampering, key masking
  - `ai/tools.test.ts` (12): tool execution, access control, size limits, name sanitization
  - `ai/providers.test.ts` (5): tool schema validation
  - `middleware/auth.test.ts` (12): JWT validation, expired tokens, role checks
  - `middleware/error.test.ts` (4): Zod errors, AppError, info leakage prevention
  - `middleware/csrf.test.ts` (13): Content-Type enforcement for all methods
- `diagram-service`: 421 tests across 13 suites (parser, transformer, view filters, WebSocket, etc.)

Run tests:
```bash
pnpm --filter @systemodel/api-server test
pnpm --filter @systemodel/diagram-service test
```

## Frontend

- React 18 + Vite + TypeScript
- Zustand stores: auth, theme, ai-settings, recent-files (all isolated, no cross-store deps)
- Services: api-client (REST), ai-client (SSE streaming), diagram-client (WebSocket), lsp-client (WebSocket with reconnect)
- Pages: LoginPage, ProjectsPage, EditorPage, SettingsPage, TrainingPage
- ErrorBoundary wraps entire app

## Branch History

Working branch: `claude/onedrive-local-integration-GtEz8`

Commits (chronological):
1. `b799124` — Fix security, auth, and reliability issues from code review (20 files, +512/-57)
2. `bb33968` — Deep audit: fix security vulnerabilities, bugs, and expand test coverage (11 files, +393/-31)
3. `6fdcee4` — Add architecture plan for easy-to-develop modular refactor
4. `25d3da6` — Refactor api-server: service layer, shared config, and asyncHandler (18 files, +964/-1142)

## Pre-existing TypeScript Warnings

These files have pre-existing implicit `any` errors (not from our changes):
- `src/mcp/resources.ts` — `line`, `i`, `f` parameters
- `src/middleware/auth.test.ts` — mock `statusCode`/`body` properties
- `src/routes/mcp.ts` — `err` in catch callback

These are harmless and don't affect runtime. The project compiles and runs successfully despite them.

## Deployment

Production at systemodel.com on Hetzner VPS:
```
Nginx (80/443, SSL) → api-server (3003) + diagram-service (3002) + lsp-server (3001) + static SPA
```
PM2 manages services. Always use `pm2 start ecosystem.config.cjs` (not `pm2 restart all`) to ensure correct `cwd` for dotenv.
