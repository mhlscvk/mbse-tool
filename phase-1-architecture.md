# Phase 1 Architecture — systemodel.com SysML v2 Web Platform

---

## 1. Purpose and Scope

This document defines the recommended architecture for **Phase 1** of the `systemodel.com` web platform.

Phase 1 is the **foundation release** of a modular SysML v2 web application intended to grow over time into a broader modeling, validation, AI-assisted, and simulation-capable engineering platform.

This document covers:

- the architectural shape of the first release
- the module structure and boundaries
- the Phase 1 implementation scope and delivery plan
- the technical stack and hosting direction
- the recommended development workflow using Claude Code

This document does **not** define full source code, detailed UI designs, or final implementation of later-phase features such as advanced simulation, rich collaborative modeling, or full AI-driven correction.

---

## 2. Product Vision and Phase Context

The long-term vision for `systemodel.com` is a **web-based SysML v2 platform** that can:

- read and manage `.sysml` files
- support SysML v2 text editing
- display graphical representations of models
- support authenticated users and role-based access
- support subscriptions and payment-gated features
- expose capabilities to AI systems through MCP
- help inspect and correct models
- evolve its language support in a modular way
- later support advanced views, analysis, and simulation

Phase 1 should **not** attempt to deliver the entire vision. It should instead establish the **minimum stable architecture** that future phases can build on without major rework.

The key Phase 1 goal is to create a **production-shaped core platform** with the right boundaries, contracts, and extension points.

---

## 3. Phase-Based Development Roadmap

### Phase 1 — Core Foundation (Current)
> Establish the platform skeleton that all future phases extend.

- Web app with authentication and user roles
- Project/workspace management
- `.sysml` file upload, storage, retrieval, and revision
- Basic SysML v2 text editor (syntax highlighting, save/load, diagnostics)
- Parser integration and normalized internal model
- Initial graphical rendering for a supported subset
- Modular backend API (REST, OpenAPI spec)
- Database schema designed for extensibility
- MCP gateway foundation (auth-protected, model inspection tools)
- Payment/entitlement foundation (Stripe integration, subscription model skeleton)

### Phase 2 — Advanced Parser & Graphical Views
- Broad SysML v2 language coverage in the parser
- IBD, sequence, and additional diagram types
- Rich model validation layer (semantic rules)
- Advanced editor ↔ diagram synchronization

### Phase 3 — AI & MCP Integration
- Full MCP tool registry
- AI model inspection and suggestion engine
- Controlled correction workflow (diff-based, user-approved)
- Audit/history trail for AI changes

### Phase 4 — Collaboration & Enterprise
- Multi-user real-time collaboration on models
- Organization-wide administration
- Advanced billing plans and enterprise governance

### Phase 5 — Simulation
- Simulation module (pluggable execution engine)
- Trace and execution view
- Simulation result storage and replay

**Why phased?** SysML v2 tooling is complex. Attempting full delivery risks producing a brittle, unmaintainable system. Each phase produces working, shippable software. Each phase's interfaces are stable contracts for the next.

---

## 4. Phase 1 Objectives

Phase 1 objectives are:

1. Establish the core web platform on `systemodel.com`
2. Support user authentication and a basic role model
3. Create the project and workspace structure
4. Enable `.sysml` file upload, storage, and revision workflow
5. Provide basic SysML v2 text editing with diagnostics
6. Provide a first graphical rendering path for a supported subset
7. Define a modular internal architecture for future growth
8. Establish API-first foundations for browser and AI access
9. Create the validation and correction preparation layer
10. Prepare the platform for subscription/payment gating

Phase 1 success means a user can:

- sign in and manage their account
- create a project/workspace
- upload or edit a `.sysml` model
- save and trigger parsing/validation
- view diagnostics in the editor
- see a first graphical representation for supported structures
- access the platform through well-defined APIs

---

## 5. Phase 1 Scope Definition

### 5.1 In Scope — Phase 1

| Area | Deliverable |
|---|---|
| Web platform | React SPA, routing, responsive layout, deployment pipeline |
| Authentication | JWT-based login, registration, password reset, session management |
| User roles | Admin, Standard User, Viewer (centralized role-based access control) |
| Payment foundation | Stripe customer creation, subscription plan model, billing portal stub, feature gating |
| Project management | Create, list, open, delete projects/workspaces |
| File handling | Upload `.sysml` files, store in object storage, retrieve, revision history |
| SysML v2 text editor | Monaco editor with SysML v2 syntax highlighting, save/load, diagnostics display |
| Parser integration | Parser adapter, normalized internal model, structured diagnostics |
| Initial graphical viewer | View transformation pipeline for a supported subset, unsupported-construct reporting |
| Validation foundation | Validation interface, issue types, severity categories, traceable output |
| Backend API | REST API, OpenAPI spec, structured error handling, structured logging |
| Database schema | Users, projects, files, revisions, roles, subscriptions — designed for extension |
| MCP gateway | Auth-protected route, model inspection tools, audit logging |
| Model-core interfaces | TypeScript interfaces for parser, validator, and renderer contracts |
| CI/CD | Automated build, lint, test, and deploy pipeline |

### 5.2 Out of Scope — Phase 1 (Deferred)

- Broad/full SysML v2 language completeness
- Advanced diagram families (IBD, sequence, state machine)
- Rich semantic validation and refactoring tools
- AI correction workflows and autonomous agent actions
- Full MCP tool implementations
- Real-time collaboration
- Simulation engine
- Advanced subscription management / enterprise billing
- Organization-wide administration
- Multi-region deployment

---

## 6. Architectural Principles

The following principles govern Phase 1 design and implementation.

### 6.1 Modular Monolith First
Phase 1 should be implemented as a **modular monolith**, not as early microservices. Internal package boundaries should be strict, but deployment should remain operationally simple. Extract services in later phases only when justified by real load or isolation needs.

### 6.2 API-First
All major capabilities should be exposed through a versioned REST API (`/api/v1/...`). The frontend, MCP gateway, and future third-party clients all consume the same API. The OpenAPI spec is the contract — generated from code, not written by hand.

### 6.3 Model Core as the Center
The normalized SysML model representation is the central artifact that parsing, validation, rendering, and AI tooling operate on. All modules depend on `model-core` interfaces — not on each other.

### 6.4 Traceable and Revisioned Changes
All model changes should be associated with a revision history and a clear audit trail, especially in preparation for future AI-assisted editing.

### 6.5 Low Memory Usage by Design
Load heavy modules only when needed. Stream large files from object storage — never fully load into API memory. Lazy-load the editor and diagram renderer in the frontend. Isolate CPU-intensive operations (parser, renderer) for future worker extraction.

### 6.6 Extensibility for SysML v2 Evolution
Language support and modeling semantics should be version-aware and adapter-based so parser and validation logic can evolve without breaking the platform. Grammar version is stored per project.

### 6.7 Safe AI Integration
AI operates through explicit, permission-aware tool contracts and never through uncontrolled direct mutation of model storage.

### 6.8 Deferred Complexity
High-risk areas such as simulation, complete language coverage, rich collaboration, and advanced AI correction should be intentionally deferred until the core platform is stable.

---

## 7. System Context

### 7.1 Primary Actors

**End User** — signs in, creates projects, edits and validates SysML v2 models, views graphical output.

**Paid User** — entitled to premium features such as additional projects or advanced capabilities.

**Administrator** — manages system settings, users, plans, and operational visibility.

**AI Client** — an external AI system accessing the platform through MCP-compatible tool interfaces.

### 7.2 External Systems

**Identity Provider** — handles account authentication (internal JWT or external IdP such as Auth0).

**Payment Provider (Stripe)** — handles checkout, subscriptions, billing events, and entitlement state updates.

**Database** — PostgreSQL for structured data (users, projects, metadata, revisions, diagnostics).

**Object Storage** — S3-compatible storage for `.sysml` file content and artifacts.

**Hosting Platform** — hosts frontend (CDN), backend API, and later background workers.

### 7.3 Core Internal Runtime Areas

- browser frontend
- application/API backend
- parser and model processing layer
- validation layer
- rendering/view transformation layer
- storage layer
- AI/MCP adapter layer

---

## 8. Recommended Modular Architecture

### 8.1 Module Map

```
systemodel.com (monorepo)
├── apps/
│   ├── web                   [Phase 1] — React frontend
│   └── api                   [Phase 1] — Fastify backend
├── packages/
│   ├── shared-types          [Phase 1] — common types, errors, config, utilities
│   ├── model-core            [Phase 1] — SysML model interfaces and contracts
│   ├── auth-core             [Phase 1] — JWT, roles, permissions
│   ├── billing-core          [Phase 1] — Stripe integration, entitlement model
│   ├── parser-adapter        [Phase 1] — SysML v2 parser integration
│   ├── validation-core       [Phase 1] — validation rules and issue model
│   ├── viewer-core           [Phase 1] — model-to-view transformation (limited subset)
│   ├── mcp-adapter           [Phase 1] — MCP tool gateway (foundation)
│   ├── storage-layer         [Phase 1] — Prisma ORM, object storage client
│   ├── ai-correction         [Phase 3] — AI suggestion and patch workflow
│   └── simulation-core       [Phase 5] — simulation engine interface
└── docs/                     — architecture documents
```

---

### 8.2 Module Descriptions

**`shared-types`** — Phase 1
- Common TypeScript types, error models, config schema, logging utilities
- No business logic — pure utilities
- All modules may depend on `shared-types`; `shared-types` depends on nothing

**`model-core`** — Phase 1 (interfaces; implementations in Phase 2+)
- Defines TypeScript interfaces: `SysMLDocument`, `ModelElement`, `ParseResult`, `ValidationResult`, `RenderViewModel`
- Central contract layer — all modules that touch model data depend on these types, not on each other
- Version-aware: breaking interface changes require a new interface version

**`auth-core`** — Phase 1
- JWT issuance, refresh, revocation
- bcrypt password hashing, rate limiting
- Centralized role and permission checks
- Isolated so it can be replaced with an external IdP without touching other modules

**`billing-core`** — Phase 1 (foundation)
- Stripe customer and subscription creation
- Subscription plan definitions in DB
- Feature gating decisions
- Billing portal redirect
- Full metering and upgrade flows deferred to later phases

**`parser-adapter`** — Phase 1
- Accepts `.sysml` source text, emits `ParseResult` (normalized model + diagnostics)
- Treated as a replaceable adapter behind a stable contract
- SysML v2 grammar is a versioned, swappable asset
- Runs isolated — CPU-intensive, should not block the main API process

**`validation-core`** — Phase 1 (foundation)
- Implements `ValidationResult` from `model-core`
- Deterministic structural checks
- Issues include: ID, severity, message, location, category, source stage
- Runs async; results stored and surfaced in editor UI
- AI-assisted correction builds on this module in Phase 3

**`viewer-core`** — Phase 1 (limited subset)
- Consumes normalized model, emits `RenderViewModel`
- Supports an intentionally limited set of graphical views (BDD first)
- Reports unsupported constructs explicitly — never silently omits them
- Isolated: rendering bugs don't affect editor or API

**`mcp-adapter`** — Phase 1 (foundation), Phase 3 (full)
- Exposes MCP-compliant endpoints: `POST /mcp/v1/tools/{tool_name}`
- Auth-protected with API key (separate from user JWT)
- Phase 1 tools: `list_projects`, `get_file`, `list_files`, `get_diagnostics`
- All tools call existing API endpoints — no direct DB access
- Phase 3 adds: `read_model`, `validate_model`, `suggest_correction`, `apply_correction`

**`storage-layer`** — Phase 1
- PostgreSQL via Prisma ORM
- S3-compatible object storage (Cloudflare R2 recommended)
- All DB access goes through this layer — no raw queries in feature modules
- Schema migrations managed here; other modules never alter schema directly

**`ai-correction`** — Phase 3
- Consumes validation results and model AST
- Proposes corrections as diffs — never applies automatically
- Full audit trail of AI suggestions and user decisions
- Rollback always available via revision history

**`simulation-core`** — Phase 5
- Pluggable execution engine interface
- Consumes model AST from parser
- Completely isolated — added without touching Phase 1–4 modules

---

## 9. Core Data and Model Strategy

### 9.1 Source Model
The raw `.sysml` text uploaded or edited by the user. Stored as:
- the canonical authored source
- revisioned content (every save creates a new revision)
- auditable, user-originated data

### 9.2 Normalized Internal Model
The application's structured internal representation of a parsed model. It must:
- be independent from frontend concerns
- be stable enough for validation and rendering
- be version-aware
- support future parser adapter changes

This normalized model is the **main shared contract** between parser, validation, and rendering.

### 9.3 Diagnostics
Represented as structured records with:
- issue ID, severity, message
- location/range in source
- category and source stage
- related element reference where available

Diagnostics are deterministic and reproducible.

### 9.4 Render View Model
The graphical layer consumes a view-oriented transformation of the normalized model — not raw source text. This enables multiple future view types and cleaner unsupported feature reporting.

### 9.5 Revisions and Audit History
All meaningful actions should be traceable:
- source changes
- parse outputs
- validation runs
- AI proposals and approval/rejection decisions

This is especially important as the platform grows toward AI-assisted editing.

---

## 10. Phase 1 Key Workflows

### 10.1 Sign In and Project Creation
1. User signs in or registers
2. Role and entitlement checks applied
3. User creates a project/workspace
4. Project metadata stored
5. User redirected to project workspace

### 10.2 Upload or Import `.sysml`
1. User uploads a `.sysml` file
2. System stores raw source as a revisioned artifact in object storage
3. Parser adapter runs; emits normalized model and diagnostics
4. Diagnostics displayed in UI
5. Viewer renders supported structures if parsing succeeds sufficiently

### 10.3 Edit and Save Model Text
1. User opens source in editor
2. User modifies text
3. Save action creates a new source revision
4. Parse and validation triggered
5. Diagnostics returned and displayed
6. Viewer refreshes if renderable content is available

### 10.4 Parse and Return Diagnostics
1. Source enters parser pipeline
2. Parser emits structured `ParseResult`
3. Validation layer runs deterministic rules
4. Diagnostics combined, categorized, stored
5. UI receives issue list with source location mapping

### 10.5 Render Initial Graphical View
1. User requests graphical view
2. `viewer-core` loads normalized model
3. Supported subset transformed into `RenderViewModel`
4. Unsupported constructs flagged explicitly
5. Viewer displays result with associated warnings

### 10.6 MCP / AI Access Request
1. AI client connects through authenticated tool interface
2. Access scoped per tool and API key
3. Requested project/model data retrieved via API
4. Tool receives bounded structured response
5. Access logged for audit purposes

### 10.7 Correction Proposal Workflow
1. AI or user submits a proposed patch
2. Proposal stored separately from committed source
3. Validation run against proposed change
4. Result displayed to user
5. User accepts or rejects
6. Accepted changes become a new revision; previous revision always recoverable

---

## 11. API Strategy

### 11.1 API Design Principles
- Versioned REST API: `/api/v1/...`
- OpenAPI spec generated from code — single source of truth
- Frontend and MCP gateway both consume the same API
- Stateless: session state in JWT, file content in object storage

### 11.2 API Categories

**Authentication APIs** — register, login, refresh token, password reset

**Project APIs** — create/list/update/delete projects, manage membership

**File and Revision APIs** — upload file, fetch source, save revision, list revision history

**Parse and Diagnostics APIs** — trigger parse, fetch parse result, fetch diagnostics

**Render and View APIs** — request view, retrieve render payload, fetch unsupported construct notices

**Validation APIs** — run checks, retrieve issue catalog, validate proposed patches

**Entitlement APIs** — fetch plan state, check feature access, handle subscription webhooks

**MCP / AI Tool APIs** — inspect project, inspect model, retrieve diagnostics, submit patch proposal, validate patch

---

## 12. Technology Stack

| Layer | Choice | Rationale |
|---|---|---|
| Language | TypeScript (frontend + backend) | Single language, strong types across module boundaries |
| Frontend framework | React + Vite | Mature ecosystem, fast build, lazy-load friendly |
| Editor | Monaco Editor | VS Code engine, extensible grammar support |
| Backend framework | Fastify (Node.js) | High performance, plugin architecture, TypeScript-native |
| ORM | Prisma | Type-safe DB access, migration management |
| Database | PostgreSQL | Relational, extensible, proven at scale |
| Object storage | Cloudflare R2 | S3-compatible, no egress fees |
| Monorepo tooling | Turborepo | Incremental builds, workspace management |
| CI/CD | GitHub Actions | Native to repo, broad ecosystem |
| Payments | Stripe | Industry standard, webhook-driven, Stripe-hosted billing portal |
| Auth | JWT (internal) → Auth0/Cognito (later) | Simple to start, replaceable without touching other modules |

---

## 13. Hosting and Deployment

### 13.1 Claude Code and Hosting
There is no native hosting integration between Claude Code and any cloud provider. Claude Code is a development assistant — it builds and configures the deployment infrastructure (Dockerfiles, CI/CD pipelines, IaC scripts) as part of the codebase. You deploy to your chosen provider.

### 13.2 Recommended Hosting Stack

| Layer | Phase 1 (low cost, low ops) | Growth Stage |
|---|---|---|
| Frontend | Vercel or Cloudflare Pages | Same (auto-scales via CDN) |
| Backend API | Railway or Render | AWS ECS or Fly.io |
| Database | Supabase (managed Postgres) | AWS RDS or Neon |
| Object Storage | Cloudflare R2 | AWS S3 |
| CI/CD | GitHub Actions | Same |

**Recommended start:** Vercel + Railway + Supabase + Cloudflare R2
- Low operational overhead
- Each component scales independently
- No vendor lock-in — switching providers means changing env vars and deploy config only
- All four have generous free tiers for development

**When to move to AWS:** When you have paying users and need SLAs, fine-grained IAM, VPC isolation, or enterprise compliance requirements.

### 13.3 Environments
Define from day one:
- **Local development** — isolated DB, local object storage (MinIO)
- **Staging** — mirrors production, used for integration testing
- **Production** — real users, monitored, rollback-capable

### 13.4 CI/CD Requirements
- Linting and type checks on every PR
- Unit and integration tests
- Package integrity checks
- Staged deployment (staging before production)
- Rollback procedure documented

---

## 14. Development Workflow Using Claude Code

Use Claude Code as a **module-by-module development assistant**, not a one-shot product generator.

### 14.1 Work Document-First
Before implementation, create and maintain:
- `system-context.md`
- `repository-structure.md`
- `domain-model.md`
- `api-spec.md`
- `ui-architecture.md`
- `validation-strategy.md`
- `mcp-strategy.md`

### 14.2 Build Order (Module by Module)

| Step | Module | Output |
|---|---|---|
| 1 | `shared-types` + `model-core` | Core contracts — all other modules depend on these |
| 2 | `storage-layer` | Prisma schema and migrations |
| 3 | `auth-core` + API auth routes | Login, register, JWT |
| 4 | `frontend-web` login screen | Wired to auth API |
| 5 | Project module + dashboard UI | Create, list, manage projects |
| 6 | `file-module` + object storage | Upload, retrieve, revision history |
| 7 | `parser-adapter` + diagnostics | Parse on save, show issues |
| 8 | Editor screen | Monaco + save loop + diagnostics |
| 9 | `viewer-core` + viewer screen | First graphical render |
| 10 | `billing-core` + entitlement | Feature gating, Stripe foundation |
| 11 | `mcp-adapter` foundation | Auth-protected model inspection tools |

### 14.3 Per-Module Workflow
For each module, follow this sequence:
1. Write the OpenAPI spec or interface contract for the module
2. Ask Claude Code to scaffold the module structure
3. Implement handlers and service logic
4. Write integration tests (hit real DB — no mocking storage)
5. Review and refactor before moving to the next module

### 14.4 Rules for Using Claude Code Effectively
- Give one module objective per session
- Always provide relevant interface definitions as context
- Ask for scaffolds and logic separately — don't generate everything at once
- Always review before accepting
- Use Claude Code to write tests, not just implementation
- After each module: ask Claude Code to identify hidden coupling, security issues, and simplification opportunities

### 14.5 Phase Boundary Review
Before starting Phase 2, conduct a full architectural review:
- Confirm `model-core` interfaces are ready for the parser
- Confirm `validation-core` is ready for semantic rules
- Confirm `viewer-core` is ready for additional diagram types
- Adjust interfaces before building Phase 2 modules on top of them

---

## 15. MCP and AI Accessibility Strategy

### 15.1 Design Principle
The API is the MCP surface. MCP tools are thin wrappers over existing API endpoints — they do not bypass business logic or access the database directly.

### 15.2 Phase 1 — MCP Foundation
- Route: `POST /mcp/v1/tools/{tool_name}`
- Auth-protected with API key (separate from user JWT)
- Phase 1 tools: `list_projects`, `get_file`, `list_files`, `get_diagnostics`
- Returns structured JSON — no free-form text

### 15.3 Phase 3 — Full MCP Tool Registry
- `read_model` — returns parsed AST of a `.sysml` file
- `validate_model` — returns validation results
- `suggest_correction` — returns a proposed diff
- `apply_correction` — applies a user-approved diff (requires explicit confirmation token)

New tools added by registering in the tool registry — no changes to existing tools or core API.

### 15.4 AI Safety Principles
- **No silent writes** — AI can never modify a model without a user-approved confirmation step
- **Diff-based changes** — corrections expressed as diffs, not full file replacements
- **Audit trail** — every AI suggestion and user decision logged with timestamp, user ID, and model version
- **Rollback** — every applied correction creates a new file revision — previous version always recoverable
- **Rate limiting** — MCP endpoints rate-limited per API key to prevent runaway AI loops

---

## 16. Risks and Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| **SysML v2 complexity** — spec is large, tooling is not fully mature | High | Declare a supported subset in Phase 1; use versioned parser adapters; use the official OMG grammar as reference |
| **Parser/editor/view sync** — text, AST, and diagram can drift out of sync | High | Single source of truth is always the text file; parser and diagram derive from it, never the reverse; sync is event-driven with debounce |
| **Graphical accuracy** — SysML v2 notation rules are precise | Medium | Explicitly mark supported/unsupported constructs; use SysIDE or Cameo as visual ground truth; add diagram types one at a time |
| **Simulation expansion** — simulation demands can distort Phase 1 architecture | High | Defer simulation completely; define only the interface extension point in Phase 1 |
| **Modular versioning drift** — parser, validation, and rendering evolve incompatibly | Medium | Version `model-core` interfaces with semver; treat breaking changes as requiring a migration plan |
| **Payment/role complexity** — billing edge cases multiply fast | Medium | Use Stripe's data model as source of truth for subscription state; centralize entitlement checks in `billing-core` |
| **AI correction reliability** — AI suggestions may be semantically wrong | High | Never auto-apply; always diff-based; always user-approved; log everything; one-click rollback always available |
| **Long-term maintainability** — monorepo grows large | Medium | Enforce module boundary lint rules from day one; regular architectural reviews; keep `shared-types` focused |
| **Operational overreach** — too many services too early | Medium | Stay with modular monolith in Phase 1; extract services only when justified by real load |

---

## 17. Phase 1 Delivery Plan

### Increment 1 — Platform Foundation
- monorepo structure (Turborepo)
- `shared-types` and `model-core` interfaces
- `storage-layer` schema and migrations
- environment configuration (local, staging, production)
- CI/CD pipeline
- structured logging and error tracking

### Increment 2 — Identity and Project Shell
- `auth-core`: registration, login, JWT, roles
- project/workspace CRUD
- basic navigation shell in frontend
- role-aware access control from day one

### Increment 3 — File and Revision Management
- `.sysml` file upload
- object storage integration (Cloudflare R2)
- revision history
- file retrieval APIs

### Increment 4 — Parser and Diagnostics Foundation
- `parser-adapter` integration
- normalized model output
- diagnostic schema
- parse-on-save flow

### Increment 5 — Text Editing Workflow
- Monaco editor with SysML v2 grammar
- save/refresh loop
- diagnostics integration in editor UI
- error-aware editing cycle

### Increment 6 — Initial Graphical Viewer
- `viewer-core` view transformation pipeline
- limited supported graphical representation (BDD first)
- unsupported-construct handling and reporting

### Increment 7 — MCP / AI Access Foundation
- `mcp-adapter` with auth-protected tool routes
- model inspection and diagnostics access tools
- patch proposal contract definition
- audit logging

### Increment 8 — Entitlement / Billing Readiness
- `billing-core`: Stripe customer + subscription creation
- feature gating model
- plan metadata
- subscription-ready account structure
- billing portal redirect

---

## 18. Acceptance Criteria

Phase 1 is complete when all of the following are true.

### Product Acceptance
- a user can register or sign in
- a user can create a project
- a user can upload or edit a `.sysml` file
- the system stores revisions
- parsing can be triggered reliably
- diagnostics are displayed clearly in the editor
- supported model content can be rendered graphically
- unsupported content is reported explicitly
- role-aware access control is functioning
- entitlement checks gate features correctly

### Architecture Acceptance
- module boundaries are documented and enforced by lint rules
- normalized model representation is established and used by validation and rendering
- `model-core` interfaces are stable and versioned
- MCP access foundation is defined and auth-protected
- entitlement checks are centralized in `billing-core`
- architecture documents are present and aligned with implementation

### Operational Acceptance
- staging and production deployment path exists and is documented
- structured logs and error reporting are available
- environment configuration is controlled via environment variables
- rollback procedure is documented and tested

---

## 19. Recommended Next Documents

After this file, the following documents should be created in order:

| Document | Purpose |
|---|---|
| `repository-structure.md` | Monorepo layout, package ownership, naming rules, dependency boundaries |
| `domain-model.md` | Core entities: user, project, file, revision, diagnostic, entitlement, patch proposal |
| `api-spec.md` | Application API contracts and endpoint categories (OpenAPI source of truth) |
| `ui-architecture.md` | Frontend structure, routes, state ownership, editor/view integration, lazy-loading strategy |
| `validation-strategy.md` | Issue taxonomy, deterministic validation approach, future rule-pack model |
| `mcp-strategy.md` | AI access policy, tool contracts, audit requirements, patch proposal workflow |
| `phase-1-iteration-plan.md` | Practical implementation order and deliverables for the first development cycle |

---

## 20. Concrete Starting Recommendation

### What to build first (in order)
1. Monorepo scaffold with `shared-types`, `model-core` (interfaces), and `storage-layer` (Prisma schema)
2. `auth-core` + API auth routes (login, register, JWT)
3. `frontend-web` login screen wired to auth API
4. Project module + project dashboard UI
5. `file-module` + `.sysml` upload/retrieve + Monaco editor
6. `parser-adapter` + diagnostics display
7. `viewer-core` + first graphical render (BDD subset)
8. `billing-core` + entitlement gating
9. `mcp-adapter` foundation

### Hosting direction
Start with **Vercel + Railway + Supabase + Cloudflare R2**. Low cost, low ops overhead, production-grade. Migrate to AWS when revenue and compliance requirements justify it.

### Architecture style
**Modular monolith in a Turborepo monorepo** with strict package boundaries. Extract services only when justified by real load or isolation needs — not prematurely.

This is the best starting architecture for `systemodel.com` because it is:
- modular enough for future service extraction
- simple enough to build and debug in Phase 1
- scalable in structure without premature infrastructure complexity
- suitable for later AI assistance and simulation growth
- aligned with a staged, architecture-first development workflow using Claude Code
