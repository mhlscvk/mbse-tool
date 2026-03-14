# Phase 1 Architecture & Development Plan — systemodel.com

---

## 1. Executive Summary

Build **systemodel.com** as a modular, API-first web platform for SysML v2 modeling. The system is decomposed into independently deployable modules from day one, so each phase adds capability without restructuring what came before.

Phase 1 delivers the **foundation only**: user auth, project management, SysML v2 file storage, a text editor, and the structural scaffolding that every future module will plug into. No advanced diagrams, no simulation, no AI correction yet — but the architecture makes all of those straightforward additions.

The recommended stack is a **monorepo with clear module boundaries**, a React frontend, a Node.js/TypeScript backend, PostgreSQL for structured data, and S3-compatible object storage for `.sysml` files. Hosting on a cloud provider (AWS or Render/Railway for early stage) with CI/CD from day one.

Claude Code is used as a **module-by-module implementation assistant**, not a one-shot code generator.

---

## 2. Phase-Based Development Roadmap

### Phase 1 — Core Foundation (Current)
> Establish the platform skeleton that all future phases extend.

- Web app with authentication and user roles
- Project/workspace management
- `.sysml` file upload, storage, retrieval
- Basic SysML v2 text editor (syntax highlighting, save/load)
- Modular backend API (REST, OpenAPI spec)
- Database schema designed for extensibility
- MCP gateway stub (defined, not fully tooled)
- Payment foundation (Stripe integration, subscription model skeleton)

### Phase 2 — Parser & Basic Graphical View
- SysML v2 parser module (AST generation from text)
- Basic block diagram / BDD rendering
- Model validation layer (structural rules)
- Editor ↔ diagram synchronization

### Phase 3 — AI & MCP Integration
- Full MCP tool registry
- AI model inspection and suggestion engine
- Controlled correction workflow (diff-based, user-approved)
- Audit/history trail for AI changes

### Phase 4 — Advanced Views & Collaboration
- IBD, sequence, state machine diagrams
- Multi-user collaboration on models
- Role-based access per project

### Phase 5 — Simulation
- Simulation module (pluggable execution engine)
- Trace and execution view
- Simulation result storage and replay

**Why phased?** SysML v2 tooling is complex. Attempting full delivery risks producing a brittle, unmaintainable system. Each phase produces working, shippable software. Each phase's interfaces are stable contracts for the next.

---

## 3. Phase 1 Scope Definition

### In scope — Phase 1

| Area | Deliverable |
|---|---|
| Web platform | React SPA, routing, responsive layout |
| Authentication | JWT-based login, registration, password reset |
| User roles | Admin, Standard User, Viewer (role-based access control) |
| Payment foundation | Stripe customer creation, subscription plan model, billing portal stub |
| Project management | Create, list, open, delete projects/workspaces |
| File handling | Upload `.sysml` files, store in object storage, retrieve, version |
| SysML v2 text editor | Monaco editor with SysML v2 syntax highlighting, save/load |
| Backend API | REST API, OpenAPI spec, structured error handling, logging |
| Database schema | Users, projects, files, roles, subscriptions — designed for extension |
| MCP gateway stub | Route defined, auth-protected, returns model metadata (tools TBD in Phase 3) |
| Model processing scaffold | `model-core` module with interfaces for parser/validator (not implemented) |
| CI/CD | Automated build, lint, test pipeline from day one |

### Out of scope — Phase 1 (deferred)

- SysML v2 parser / AST generation
- Any graphical diagram rendering
- Model validation logic
- AI correction workflows
- Full MCP tool implementations
- Real-time collaboration
- Simulation engine
- Advanced subscription management / enterprise billing
- Audit/history trail

---

## 4. Recommended Modular Architecture

### Module Map

```
systemodel.com
├── frontend-web          [Phase 1]
├── backend-api           [Phase 1]
├── auth-module           [Phase 1]
├── project-module        [Phase 1]
├── file-module           [Phase 1]
├── editor-module         [Phase 1]
├── payment-module        [Phase 1 — foundation]
├── model-core            [Phase 1 — interfaces only]
├── mcp-gateway           [Phase 1 — stub; Phase 3 — full]
├── storage-layer         [Phase 1]
├── parser-module         [Phase 2]
├── diagram-module        [Phase 2]
├── validation-module     [Phase 2]
├── ai-correction-module  [Phase 3]
├── simulation-module     [Phase 5]
└── shared                [Phase 1]
```

---

### Module Descriptions

**`frontend-web`** — Phase 1
- React SPA: login, dashboard, project view, editor
- Communicates only through the backend API — no direct DB access
- Independent: can be redeployed, redesigned, or replaced without touching backend
- Lazy-loads heavy features (editor, future diagram renderer) to keep initial bundle small

**`backend-api`** — Phase 1
- Express/Fastify Node.js API, TypeScript
- Routes delegate to feature modules; no business logic in route handlers
- OpenAPI spec is the contract — frontend and MCP consumers both depend on it
- Stateless: scales horizontally

**`auth-module`** — Phase 1
- JWT issuance, refresh, revocation
- bcrypt password hashing, rate limiting
- Isolated so it can be replaced with an external IdP (Auth0, Cognito) later without touching other modules

**`project-module`** — Phase 1
- CRUD for workspaces/projects
- Owns project metadata, membership, and access control checks
- Clean boundary: other modules reference project IDs but don't own project state

**`file-module`** — Phase 1
- Handles `.sysml` file upload, versioning, retrieval
- Stores file content in object storage (S3/compatible), metadata in DB
- Decoupled from editor and parser: either can call file APIs independently

**`editor-module`** — Phase 1
- Monaco editor integration with SysML v2 grammar for syntax highlighting
- Autosave, manual save, version history UI
- SysML v2 grammar file is its own versioned asset — updatable independently

**`payment-module`** — Phase 1 (foundation)
- Stripe customer and subscription creation
- Subscription plan definitions in DB
- Billing portal redirect
- Full metering, invoicing, and upgrade flows deferred to Phase 2/3

**`model-core`** — Phase 1 (interfaces only)
- Defines TypeScript interfaces: `SysMLDocument`, `ModelElement`, `ValidationResult`, `ParseResult`
- No implementation yet — parser and validator will implement these in Phase 2
- Central contract layer: all modules that touch model data depend on these types, not on each other

**`mcp-gateway`** — Phase 1 (stub), Phase 3 (full)
- Exposes an MCP-compliant HTTP endpoint
- Phase 1: auth-protected route that returns project/file metadata
- Phase 3: full tool registry (read model, suggest correction, query elements)
- Independent: can be versioned and extended without touching core API

**`storage-layer`** — Phase 1
- PostgreSQL via Prisma ORM
- S3-compatible object storage (AWS S3, MinIO, Cloudflare R2)
- All DB access goes through this layer — no raw queries in feature modules
- Schema migrations managed here; other modules never alter schema directly

**`parser-module`** — Phase 2
- Implements `ParseResult` from `model-core`
- Runs as a separate service or worker (CPU-intensive, should not block API)
- SysML v2 grammar is versioned and swappable

**`diagram-module`** — Phase 2
- Consumes parsed AST, renders SVG/canvas diagrams
- Loaded lazily in the frontend
- Isolated: diagram rendering bugs don't affect editor or API

**`validation-module`** — Phase 2
- Implements `ValidationResult` from `model-core`
- Runs async; results stored and surfaced in editor UI

**`ai-correction-module`** — Phase 3
- Consumes validation results and model AST
- Proposes corrections as diffs
- User must approve changes — never applies automatically
- Full audit trail of AI suggestions and user decisions

**`simulation-module`** — Phase 5
- Pluggable execution engine
- Consumes model AST from parser
- Completely isolated — can be added without touching any Phase 1–4 modules

**`shared`** — Phase 1
- Common TypeScript types, error models, config schema, logging utilities
- No business logic — pure utilities
- All modules may depend on `shared`; `shared` depends on nothing

---

## 5. Scalable Technical Approach

### Monorepo with module boundaries
Use a **monorepo** (Turborepo or Nx) with each module as its own package. This gives:
- Shared tooling (TypeScript, ESLint, Prettier) without duplication
- Independent versioning per package when needed
- Clear import boundaries enforced by lint rules (no cross-module internal imports)

### API-first design
- All backend functionality exposed through a versioned REST API (`/api/v1/...`)
- OpenAPI spec generated from code — single source of truth
- Frontend, MCP gateway, and future third-party clients all consume the same API
- Makes future MCP tool implementations trivial: they call existing API endpoints

### Frontend/backend separation
- Frontend is a pure SPA — no server-side rendering needed for Phase 1
- Backend is stateless — session state in JWT, file state in object storage
- Scales independently: frontend on CDN, backend on autoscaling compute

### Memory efficiency
- Parser and diagram rendering run as separate workers/services, not in the main API process
- Large `.sysml` files streamed from object storage — never fully loaded into API memory
- Frontend lazy-loads the editor and (later) diagram renderer on demand

### Extensibility for SysML v2 updates
- SysML v2 grammar file is a **versioned asset**
- Grammar version stored per project — allows migration without breaking existing models
- `model-core` interfaces are versioned — breaking changes require a new interface version

### Maintainability
- Structured logging (JSON, with request IDs) from day one
- Each module has its own error namespace
- Integration tests hit real DB (no mocking of storage layer)
- Each module independently testable with its own test suite

---

## 6. Hosting and Deployment Recommendation

### Claude Code and hosting
There is no native hosting integration between Claude Code and any cloud provider. Claude Code is a development assistant — it writes, edits, and reasons about code in your local environment. Hosting is entirely separate and managed by you.

The practical workflow: Claude Code helps you build and configure the deployment infrastructure (Dockerfiles, CI/CD pipelines, IaC scripts) as part of the codebase. You then deploy to your chosen provider.

### Recommended hosting options

| Layer | Early Stage (low cost) | Growth Stage |
|---|---|---|
| Frontend | Vercel or Cloudflare Pages | Same (scales automatically) |
| Backend API | Railway or Render | AWS ECS / Fly.io |
| Database | Supabase (managed Postgres) | AWS RDS or Neon |
| Object Storage | Cloudflare R2 (no egress fees) | AWS S3 |
| CI/CD | GitHub Actions | Same |

### Recommended starting point
**Vercel (frontend) + Railway (backend) + Supabase (Postgres) + Cloudflare R2 (storage)**

- Low operational overhead
- Each component scales independently
- No vendor lock-in on application code — switching providers means only changing env vars and deploy config
- All four services have generous free tiers for development

### When to move to AWS
When you have paying users and need SLAs, fine-grained IAM, VPC isolation, or enterprise compliance requirements. Migrate backend to ECS, DB to RDS — application code does not change.

---

## 7. Recommended Development Workflow Using Claude Code

Work **one module at a time**, in this order:

### Step 1 — Architecture lock
Define module boundaries, interfaces, and API contracts before writing any code. Use Claude Code to review and challenge the architecture. Produce an ADR (Architecture Decision Record) for each major choice.

### Step 2 — Shared + model-core first
Build `shared` types and `model-core` interfaces before any feature module. Every other module depends on these. Changes here are expensive later.

### Step 3 — Storage layer
Define and migrate the database schema. Review it carefully — schema changes in production are costly. Claude Code can generate Prisma schemas and migrations.

### Step 4 — Backend modules, one at a time
Order: `auth-module` → `project-module` → `file-module` → `payment-module` → `mcp-gateway stub`

For each module:
1. Write the OpenAPI spec for the module's routes
2. Ask Claude Code to scaffold the module structure
3. Implement handlers and service logic
4. Write integration tests
5. Review and refactor before moving on

### Step 5 — Frontend, screen by screen
Order: login/register → dashboard → project view → editor

For each screen:
1. Define the UI contract (what data comes from API)
2. Ask Claude Code to scaffold the component
3. Wire to API
4. Test in browser

### Step 6 — CI/CD pipeline
Set up GitHub Actions for lint, test, and deploy on every PR. Do this early — not at the end.

### Step 7 — Review cycles
After each module: read the code, ask Claude Code to identify issues, simplify, and check for security problems. Don't accumulate technical debt across modules.

### Step 8 — Phase boundary
Before starting Phase 2, do a full architectural review. Confirm `model-core` interfaces are ready for the parser. Adjust if needed before the parser is built on top of them.

### Rules for using Claude Code effectively
- Give one module objective per session
- Always provide the relevant interface definitions as context
- Ask for scaffolds and logic separately — don't generate everything at once
- Always review before accepting
- Use Claude Code to write tests, not just implementation

---

## 8. MCP and AI Accessibility Strategy

### Design principle
The API is the MCP surface. MCP tools are thin wrappers over existing API endpoints — they don't bypass business logic or access the database directly.

### Phase 1 — MCP stub
- Define the MCP gateway route: `POST /mcp/v1/tools/{tool_name}`
- Auth-protected with API key (separate from user JWT)
- Phase 1 tools: `list_projects`, `get_file`, `list_files`
- Returns structured JSON — no free-form text

### Phase 3 — Full MCP tool registry
Tools added incrementally:
- `read_model` — returns parsed AST of a `.sysml` file
- `validate_model` — returns validation results
- `suggest_correction` — returns a proposed diff
- `apply_correction` — applies a user-approved diff (requires explicit user confirmation token)

### Safety principles for AI correction
- **No silent writes**: AI can never modify a model without a user-approved confirmation step
- **Diff-based changes**: corrections expressed as diffs, not full file replacements
- **Audit trail**: every AI suggestion and user decision logged with timestamp, user ID, and model version
- **Rollback**: every applied correction creates a new file version — previous version always recoverable
- **Rate limiting**: MCP endpoints rate-limited per API key to prevent runaway AI loops

### Extensibility
New MCP tools are added by registering them in the tool registry — no changes to existing tools or core API. The registry is a configuration-driven map of tool name → handler function.

---

## 9. Risks and Design Warnings

| Risk | Severity | Mitigation |
|---|---|---|
| **SysML v2 complexity** — the spec is large and not all tooling is mature | High | Scope the parser incrementally; start with a subset of SysML v2 constructs; use the official OMG grammar as the reference |
| **Parser/editor/view sync** — keeping text, AST, and diagram consistent is hard | High | Single source of truth is always the text file; parser and diagram derive from it, never the reverse; sync is event-driven with debounce |
| **Graphical accuracy** — SysML v2 diagrams have precise notation rules | Medium | Use a reference implementation (SysIDE, Cameo) as visual ground truth; start with BDD only; add diagram types one at a time |
| **Simulation expansion** — simulation requires deep model semantics | High | Keep simulation module completely isolated from Phase 1–4; define only the interface contract in Phase 1 |
| **Modular versioning** — interface changes break multiple modules | Medium | Version `model-core` interfaces explicitly; use semver; treat breaking interface changes as requiring a migration plan |
| **Payment/role complexity** — billing edge cases multiply fast | Medium | Use Stripe's data model as the source of truth for subscription state; don't replicate subscription logic beyond what's needed for access control |
| **AI correction reliability** — AI suggestions may be semantically wrong | High | Never auto-apply; always diff-based; always user-approved; log everything; provide easy one-click rollback |
| **Long-term maintainability** — monorepo grows large | Medium | Enforce module boundary lint rules from day one; conduct quarterly architectural reviews; don't let `shared` become a dumping ground |

---

## 10. Concrete Recommendation

### What to build first
1. Monorepo scaffold with `shared`, `model-core` (interfaces only), and `storage-layer` (Prisma schema)
2. `backend-api` with `auth-module` (login, register, JWT)
3. `frontend-web` with login screen wired to auth API
4. `project-module` + project dashboard UI
5. `file-module` + `.sysml` upload/retrieve + Monaco editor

### Stack

| Layer | Choice |
|---|---|
| Language | TypeScript throughout (frontend + backend) |
| Frontend | React + Vite |
| Editor | Monaco Editor |
| Backend | Fastify (Node.js) |
| ORM | Prisma |
| Database | PostgreSQL |
| Object Storage | Cloudflare R2 |
| Monorepo | Turborepo |
| CI/CD | GitHub Actions |
| Payments | Stripe |

### Hosting direction
Start with **Vercel + Railway + Supabase + Cloudflare R2**. Low cost, low ops overhead, production-grade. Migrate to AWS when revenue justifies it.

### First implementation steps on systemodel.com
1. Register domain, point to Vercel
2. Set up GitHub monorepo with CI/CD
3. Provision Supabase DB and Cloudflare R2 bucket
4. Deploy backend to Railway with environment variables
5. Build and ship modules in the order listed above
6. Gate features behind role checks and subscription status from day one — retrofitting auth is painful
