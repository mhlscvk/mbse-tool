# Repository Structure — systemodel.com SysML v2 Web Platform

---

## 1. Purpose

This document defines the monorepo layout, package ownership, naming conventions, dependency rules, and configuration structure for `systemodel.com`.

It is the authoritative reference for:
- where code lives
- what each package and app is responsible for
- what a package may and may not depend on
- how the repository is configured, built, and deployed

All contributors and Claude Code sessions must follow this structure.

---

## 2. Monorepo Tooling

The repository uses **Turborepo** as the monorepo build system with **npm workspaces**.

**Why Turborepo:**
- incremental builds — only rebuilds what changed
- parallel task execution across packages
- shared task pipeline configuration
- compatible with npm workspaces
- low configuration overhead

**Package manager:** npm workspaces

---

## 3. Top-Level Repository Layout

```
mbse-tool/
│
├── apps/
│   ├── web/                        # React frontend application
│   ├── api/                        # Fastify backend API
│   └── worker/                     # Background job processor (parsing, validation)
│
├── packages/
│   ├── shared-types/               # Common types, errors, constants
│   ├── model-core/                 # SysML model interfaces and contracts
│   ├── logging-core/               # Structured logging, event taxonomy, audit helpers
│   ├── config-core/                # Environment configuration and validation
│   ├── storage-layer/              # Prisma ORM + object storage client
│   ├── auth-core/                  # JWT, roles, permissions
│   ├── billing-core/               # Stripe integration, entitlement model
│   ├── parser-adapter/             # SysML v2 parser integration
│   ├── validation-core/            # Validation rules and diagnostic model
│   ├── viewer-core/                # Model-to-view transformation
│   └── mcp-adapter/                # MCP tool gateway
│
├── services/                       # Future microservices (reserved, not Phase 1)
│   ├── simulation-service/
│   ├── ai-analysis-service/
│   └── analytics-service/
│
├── infrastructure/                 # Deployment and infrastructure configuration
│   ├── docker/
│   ├── terraform/
│   ├── kubernetes/
│   └── deployment/
│
├── tests/                          # Cross-package integration and e2e tests
│   ├── integration/
│   ├── e2e/
│   └── fixtures/
│
├── scripts/                        # Development and operational scripts
│   ├── db-setup.sh
│   ├── db-migrate.sh
│   └── env-init.sh
│
├── docs/                           # Architecture and planning documents
│
├── .github/
│   └── workflows/                  # GitHub Actions CI/CD pipelines
│
├── turbo.json                      # Turborepo pipeline configuration
├── package.json                    # Root workspace definition
├── tsconfig.base.json              # Shared TypeScript base configuration
├── .eslintrc.base.js               # Shared ESLint base configuration
├── .prettierrc                     # Shared Prettier configuration
├── docker-compose.yml              # Local development infrastructure
├── .env.example                    # Environment variable template
└── README.md                       # Repository overview and setup guide
```

---

## 4. Apps

### 4.1 `apps/web` — Frontend Web Application

**Technology:** React, Vite, TypeScript

**Responsibilities:**
- login, registration, and account management screens
- project dashboard and navigation
- file upload and management UI
- SysML v2 text editor (Monaco Editor)
- diagnostics display panel
- graphical model viewer
- billing and subscription UI

**Must not:**
- access the database directly
- import from `storage-layer`, `auth-core`, or `billing-core`
- contain business logic — all logic lives in the API

**Internal structure:**
```
apps/web/
├── src/
│   ├── pages/              # Route-level page components
│   ├── components/         # Shared UI components
│   ├── features/           # Feature-scoped modules (editor, viewer, auth, projects)
│   ├── hooks/              # Shared React hooks
│   ├── services/           # API client functions (typed, generated from OpenAPI)
│   ├── utils/              # Frontend utilities
│   └── main.tsx            # App entry point
├── public/                 # Static assets
├── config/                 # Build and environment config
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

### 4.2 `apps/api` — Backend API

**Technology:** Fastify, Node.js, TypeScript

**Responsibilities:**
- expose all platform capabilities through a versioned REST API (`/api/v1/...`)
- orchestrate calls to feature packages
- enforce authentication and authorization on every route
- handle structured error responses and request logging
- serve as the only integration point for frontend and MCP clients

**Must not:**
- contain business logic directly in route handlers — delegate to packages
- access object storage or database directly — use `storage-layer`
- bypass authorization checks

**Internal structure:**
```
apps/api/
├── src/
│   ├── routes/             # Route definitions (auth, projects, files, mcp, billing)
│   ├── controllers/        # Request handlers, delegate to packages
│   ├── services/           # Orchestration logic
│   ├── middleware/         # Auth enforcement, rate limiting, request validation
│   ├── plugins/            # Fastify plugins (error handler, logger, openapi)
│   ├── validators/         # Request/response schema validators
│   └── server.ts           # Server entry point
├── config/
├── tsconfig.json
└── package.json
```

---

### 4.3 `apps/worker` — Background Job Processor

**Technology:** Node.js, TypeScript

**Responsibilities:**
- background parsing of large `.sysml` files
- async validation job execution
- future: simulation task processing
- future: analysis and export jobs

**Why separate from `apps/api`:**
- parsing is CPU-intensive and should not block the API process
- workers can be scaled independently from the API
- failure in a worker does not affect API availability

**Internal structure:**
```
apps/worker/
├── src/
│   ├── jobs/               # Job handler definitions
│   ├── processors/         # Core processing logic per job type
│   ├── queues/             # Job queue setup and configuration
│   └── utils/              # Worker utilities
├── tsconfig.json
└── package.json
```

---

## 5. Packages

### 5.1 `packages/shared-types` — Phase 1

**Responsibilities:**
- common TypeScript types used across all packages and apps
- error models and error codes
- domain entity base types
- API request/response types
- validation result types
- viewer data structure types
- constants

**Dependency rule:** May not import from any other internal package.

**Internal structure:**
```
packages/shared-types/
├── src/
│   ├── errors.ts           # Error classes and error codes
│   ├── entities.ts         # Shared domain entity types
│   ├── api.ts              # API request/response types
│   └── index.ts
├── tsconfig.json
└── package.json
```

---

### 5.2 `packages/model-core` — Phase 1

**Responsibilities:**
- defines the central TypeScript interfaces for all SysML model artifacts
- interfaces only — no implementation
- versioned: breaking changes require a new interface version
- the shared contract between parser, validation, rendering, and AI tooling

**Key interfaces:**
- `SysMLDocument` — top-level model container
- `ModelElement` — base type for all SysML elements
- `ParseResult` — output of the parser adapter
- `ParseJob` — parse job lifecycle (`PENDING`, `RUNNING`, `COMPLETED`, `FAILED`, `SUPERSEDED`)
- `ValidationResult` — diagnostic output of the validation module
- `ValidationIssue` — individual issue with ID, severity, message, location, category
- `RenderViewModel` — view-ready transformation of a parsed model

**Must not:** depend on UI or infrastructure code.

**Dependency rule:** May only import from `shared-types`.

**Internal structure:**
```
packages/model-core/
├── src/
│   ├── document.ts         # SysMLDocument, ModelElement
│   ├── parse.ts            # ParseResult, ParseJob, ParseJobStatus
│   ├── validation.ts       # ValidationResult, ValidationIssue
│   ├── render.ts           # RenderViewModel
│   └── index.ts
├── tsconfig.json
└── package.json
```

---

### 5.3 `packages/logging-core` — Phase 1

**Responsibilities:**
- structured logging factory (JSON output with request IDs)
- named event taxonomy (lifecycle events, AI events, system events)
- audit logging helpers
- observability utilities

**Key event categories:**
- Model lifecycle: `MODEL_UPLOAD_ACCEPTED`, `REVISION_CREATED`, `PARSE_STARTED`, `PARSE_COMPLETED`, `PARSE_FAILED`, `VALIDATION_COMPLETED`, `RENDER_GENERATED`
- AI tool: `MCP_TOOL_INVOKED`, `AI_PATCH_PROPOSED`, `AI_PATCH_APPROVED`, `AI_PATCH_REJECTED`
- System: `AUTH_LOGIN`, `AUTH_FAILED`, `BILLING_EVENT_RECEIVED`, `SYSTEM_ERROR`

**Dependency rule:** May only import from `shared-types`.

**Internal structure:**
```
packages/logging-core/
├── src/
│   ├── logger.ts           # Logger factory
│   ├── events.ts           # Named event constants and types
│   ├── audit.ts            # Audit log helpers
│   └── index.ts
├── tsconfig.json
└── package.json
```

---

### 5.4 `packages/config-core` — Phase 1

**Responsibilities:**
- environment variable loading and validation
- runtime configuration schema
- environment-specific configuration (local, staging, production)
- configuration error reporting at startup

**Dependency rule:** May only import from `shared-types`.

**Internal structure:**
```
packages/config-core/
├── src/
│   ├── schema.ts           # Config schema and validation
│   ├── loader.ts           # Environment variable loader
│   ├── environments.ts     # Per-environment defaults
│   └── index.ts
├── tsconfig.json
└── package.json
```

---

### 5.5 `packages/storage-layer` — Phase 1

**Responsibilities:**
- all database access via Prisma ORM
- all object storage operations (upload, download, delete)
- schema definitions and migration management
- no business logic — pure data access

**Dependency rule:** May import from `shared-types`, `model-core`, `logging-core`, and `config-core`.

**Internal structure:**
```
packages/storage-layer/
├── prisma/
│   ├── schema.prisma       # Database schema (single source of truth)
│   └── migrations/         # Migration history
├── src/
│   ├── db/
│   │   ├── client.ts
│   │   ├── users.ts
│   │   ├── projects.ts
│   │   ├── files.ts
│   │   ├── revisions.ts
│   │   └── diagnostics.ts
│   ├── object-storage/
│   │   └── r2.ts           # Cloudflare R2 client
│   └── index.ts
├── tsconfig.json
└── package.json
```

---

### 5.6 `packages/auth-core` — Phase 1

**Responsibilities:**
- JWT issuance, refresh, and revocation
- password hashing (bcrypt)
- role definitions and capability mapping
- centralized permission checks — no permission logic lives outside this package
- rate limiting utilities

**Roles:**
- `Admin`
- `StandardUser`
- `Viewer`

**Dependency rule:** May import from `shared-types`, `logging-core`, `config-core`, and `storage-layer`.

**Internal structure:**
```
packages/auth-core/
├── src/
│   ├── jwt.ts              # Token issuance and verification
│   ├── password.ts         # Hashing and comparison
│   ├── roles.ts            # Role definitions and capability map
│   ├── permissions.ts      # Central permission check functions
│   └── index.ts
├── tsconfig.json
└── package.json
```

---

### 5.7 `packages/billing-core` — Phase 1 (foundation)

**Responsibilities:**
- Stripe customer and subscription creation
- subscription plan definitions
- entitlement state checks (feature gating)
- Stripe webhook event handling
- billing portal redirect URL generation

**Must not:** affect or be imported by model processing packages.

**Dependency rule:** May import from `shared-types`, `logging-core`, `config-core`, and `storage-layer`.

**Internal structure:**
```
packages/billing-core/
├── src/
│   ├── stripe.ts           # Stripe client setup
│   ├── plans.ts            # Plan definitions and entitlement rules
│   ├── entitlement.ts      # Feature gate check functions
│   ├── webhooks.ts         # Stripe webhook handler
│   └── index.ts
├── tsconfig.json
└── package.json
```

---

### 5.8 `packages/parser-adapter` — Phase 1

**Responsibilities:**
- accepts `.sysml` source text
- runs the SysML v2 parser
- emits `ParseResult` per `model-core` contract
- manages Parse Job lifecycle (`PENDING` → `RUNNING` → `COMPLETED` / `FAILED` / `SUPERSEDED`)
- SysML v2 grammar is a versioned, swappable asset
- runs in `apps/worker` for large models; inline for small models

**Dependency rule:** May import from `shared-types`, `model-core`, `logging-core`, `config-core`, and `storage-layer`.

**Internal structure:**
```
packages/parser-adapter/
├── grammars/
│   └── sysml-v2.grammar    # Versioned SysML v2 grammar file
├── src/
│   ├── parser.ts           # Core parse function
│   ├── job.ts              # Parse Job lifecycle management
│   ├── normalizer.ts       # Raw parse tree → normalized model
│   ├── diagnostics.ts      # Diagnostic extraction
│   └── index.ts
├── tsconfig.json
└── package.json
```

---

### 5.9 `packages/validation-core` — Phase 1 (foundation)

**Responsibilities:**
- defines and runs validation rules against parsed models
- produces `ValidationResult` per `model-core` contract
- rule registry — rules are independently registered and testable
- deterministic and reproducible output
- designed for future rule-pack extensions

**Must not:** import from `parser-adapter` — consumes `ParseResult`, not the adapter directly.

**Dependency rule:** May import from `shared-types`, `model-core`, and `logging-core`.

**Internal structure:**
```
packages/validation-core/
├── src/
│   ├── runner.ts           # Runs all registered rules
│   ├── registry.ts         # Rule registration
│   ├── rules/              # One file per validation rule
│   │   ├── element-names.ts
│   │   └── ...
│   ├── issue.ts            # Issue construction helpers
│   └── index.ts
├── tsconfig.json
└── package.json
```

---

### 5.10 `packages/viewer-core` — Phase 1 (limited subset)

**Responsibilities:**
- transforms a `ParseResult` into a `RenderViewModel`
- Phase 1 supports: block definitions, basic relationships, simple hierarchical structures
- reports unsupported constructs explicitly — never silently omits them
- read-only output — no diagram editing in Phase 1
- basic automatic layout engine

**Must not:** import from `parser-adapter` or `validation-core`.

**Dependency rule:** May import from `shared-types`, `model-core`, and `logging-core`.

**Internal structure:**
```
packages/viewer-core/
├── src/
│   ├── transformer.ts      # ParseResult → RenderViewModel
│   ├── layout.ts           # Basic automatic layout engine
│   ├── unsupported.ts      # Unsupported construct detection and reporting
│   ├── renderers/
│   │   ├── block.ts
│   │   └── relationship.ts
│   └── index.ts
├── tsconfig.json
└── package.json
```

---

### 5.11 `packages/mcp-adapter` — Phase 1 (foundation)

**Responsibilities:**
- exposes MCP-compliant tool endpoints
- authenticates all tool requests via API key (separate from user JWT)
- Phase 1 tools: `list_projects`, `get_file`, `list_files`, `get_diagnostics`
- all tools call existing service functions — no direct DB access
- logs all tool invocations for audit

**Dependency rule:** May import from `shared-types`, `model-core`, `logging-core`, `auth-core`, and `storage-layer`.

**Internal structure:**
```
packages/mcp-adapter/
├── src/
│   ├── registry.ts         # Tool registration map
│   ├── tools/
│   │   ├── list-projects.ts
│   │   ├── get-file.ts
│   │   ├── list-files.ts
│   │   └── get-diagnostics.ts
│   ├── auth.ts             # API key validation
│   ├── audit.ts            # Tool invocation logging
│   └── index.ts
├── tsconfig.json
└── package.json
```

---

## 6. Services Directory (Reserved — Not Phase 1)

The `services/` directory reserves space for future microservices.

```
services/
├── simulation-service/     # Phase 5 — execution engine
├── ai-analysis-service/    # Phase 3 — AI correction and analysis
└── analytics-service/      # Future — usage analytics
```

Phase 1 does not deploy these services. The directory structure is reserved so future extraction does not require reorganizing the repository.

---

## 7. Infrastructure Directory

```
infrastructure/
├── docker/                 # Dockerfiles for each app
├── terraform/              # Cloud infrastructure as code
├── kubernetes/             # K8s manifests (future scaling)
└── deployment/             # Deployment scripts and runbooks
```

Phase 1 uses Docker for local development and Render/Vercel for hosting. Terraform and Kubernetes configs are prepared for later migration to AWS.

---

## 8. Tests Directory

Cross-package integration and end-to-end tests live at the root level — not inside individual packages.

```
tests/
├── integration/            # Tests spanning multiple packages (e.g. parse → validate → render)
├── e2e/                    # Full user workflow tests against running apps
└── fixtures/               # Shared .sysml test files and expected outputs
```

Unit tests for individual packages live inside each package's own `src/` or `__tests__/` folder.

---

## 9. Dependency Rules

The following matrix defines what each package may import. Violations are caught by ESLint import rules.

```
Package            | shared | model | logging | config | storage | auth | billing | parser | valid. | viewer | mcp | apps/*
-------------------|--------|-------|---------|--------|---------|------|---------|--------|--------|--------|-----|-------
shared-types       |   —    |  No   |   No    |   No   |   No    |  No  |   No    |   No   |   No   |   No   | No  |  No
model-core         |  Yes   |   —   |   No    |   No   |   No    |  No  |   No    |   No   |   No   |   No   | No  |  No
logging-core       |  Yes   |  No   |    —    |   No   |   No    |  No  |   No    |   No   |   No   |   No   | No  |  No
config-core        |  Yes   |  No   |   No    |    —   |   No    |  No  |   No    |   No   |   No   |   No   | No  |  No
storage-layer      |  Yes   |  Yes  |   Yes   |  Yes   |    —    |  No  |   No    |   No   |   No   |   No   | No  |  No
auth-core          |  Yes   |  No   |   Yes   |  Yes   |   Yes   |   —  |   No    |   No   |   No   |   No   | No  |  No
billing-core       |  Yes   |  No   |   Yes   |  Yes   |   Yes   |  No  |    —    |   No   |   No   |   No   | No  |  No
parser-adapter     |  Yes   |  Yes  |   Yes   |  Yes   |   Yes   |  No  |   No    |    —   |   No   |   No   | No  |  No
validation-core    |  Yes   |  Yes  |   Yes   |   No   |   No    |  No  |   No    |   No   |    —   |   No   | No  |  No
viewer-core        |  Yes   |  Yes  |   Yes   |   No   |   No    |  No  |   No    |   No   |   No   |    —   | No  |  No
mcp-adapter        |  Yes   |  Yes  |   Yes   |   No   |   Yes   |  Yes |   No    |   No   |   No   |   No   |  —  |  No
apps/api           |  Yes   |  Yes  |   Yes   |  Yes   |   Yes   |  Yes |   Yes   |  Yes   |  Yes   |  Yes   | Yes |   —
apps/worker        |  Yes   |  Yes  |   Yes   |  Yes   |   Yes   |  No  |   No    |  Yes   |  Yes   |   No   | No  |   —
apps/web           |  Yes   |  Yes  |   No    |   No   |   No    |  No  |   No    |   No   |   No   |  Yes   | No  |   —
```

**Key rules summary:**
1. No circular dependencies
2. `shared-types`, `model-core`, `logging-core`, `config-core` depend on nothing internal
3. `viewer-core` and `validation-core` never import `parser-adapter` — they consume `ParseResult`, not the adapter
4. `apps/web` never imports `storage-layer`, `auth-core`, or `billing-core`
5. `billing-core` never imports model processing packages
6. `apps/api` is the only place that assembles all packages together
7. Infrastructure code never imports domain packages
8. Packages never depend on apps

---

## 10. Naming Conventions

### Packages
- kebab-case: `model-core`, `auth-core`, `parser-adapter`
- descriptive of responsibility, not technology

### Files
- kebab-case: `parse-job.ts`, `validation-issue.ts`
- one primary export per file where practical

### TypeScript
- interfaces: PascalCase — `ParseResult`, `ValidationIssue`
- types: PascalCase — `UserRole`, `ParseJobStatus`
- enums: PascalCase with PascalCase values — `ParseJobStatus.Completed`
- functions: camelCase — `createParseJob`, `checkEntitlement`
- constants: SCREAMING_SNAKE_CASE — `MAX_FILE_SIZE_MB`

### API routes
- kebab-case segments: `/api/v1/parse-jobs`, `/api/v1/projects/{id}/files`
- plural nouns for collections
- versioned prefix: `/api/v1/`

### Database tables (Prisma)
- snake_case: `source_revision`, `parse_job`, `validation_result`

### Environment variables
- SCREAMING_SNAKE_CASE with service prefix: `DATABASE_URL`, `R2_BUCKET_NAME`, `STRIPE_SECRET_KEY`

---

## 11. Configuration Files

### `turbo.json` — Turborepo pipeline
```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "test": {
      "dependsOn": ["^build"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    }
  }
}
```

### `package.json` (root) — Workspace definition
```json
{
  "name": "mbse-tool",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ]
}
```

### `tsconfig.base.json` — Shared TypeScript config
All packages extend this. Sets `strict: true`, `moduleResolution: bundler`, and shared compiler options.

### `.eslintrc.base.js` — Shared ESLint config
Includes `eslint-plugin-import` configured to enforce the dependency matrix in Section 9.

---

## 12. Environment Variables

All environment variables are defined in `.env.example` at the root.
Each app/package reads only the variables it needs.
Never commit `.env` files — use `.env.example` as the template.

| Variable | Used by | Description |
|---|---|---|
| `DATABASE_URL` | `storage-layer` | Supabase PostgreSQL connection string |
| `R2_ACCOUNT_ID` | `storage-layer` | Cloudflare R2 account ID |
| `R2_ACCESS_KEY_ID` | `storage-layer` | R2 access key |
| `R2_SECRET_ACCESS_KEY` | `storage-layer` | R2 secret key |
| `R2_BUCKET_NAME` | `storage-layer` | R2 bucket name |
| `JWT_SECRET` | `auth-core` | Secret for JWT signing |
| `JWT_EXPIRES_IN` | `auth-core` | Token expiry (e.g. `7d`) |
| `STRIPE_SECRET_KEY` | `billing-core` | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | `billing-core` | Stripe webhook signing secret |
| `API_BASE_URL` | `apps/web` | Backend API base URL |
| `MCP_API_KEY_SALT` | `mcp-adapter` | Salt for MCP API key hashing |
| `WORKER_QUEUE_URL` | `apps/worker` | Job queue connection URL |
| `NODE_ENV` | all | `development`, `staging`, or `production` |

---

## 13. CI/CD Pipeline

### GitHub Actions workflows

**`ci.yml`** — runs on every pull request
- install dependencies
- typecheck all packages
- lint all packages
- run all unit and integration tests
- build all packages

**`deploy-staging.yml`** — runs on merge to `main`
- run CI pipeline
- run database migrations against staging DB
- deploy `apps/api` to Render (staging)
- deploy `apps/worker` to Render (staging)
- deploy `apps/web` to Vercel (staging)

**`deploy-production.yml`** — runs on release tag (`v*`)
- run CI pipeline
- run database migrations against production DB
- deploy `apps/api` to Render (production)
- deploy `apps/worker` to Render (production)
- deploy `apps/web` to Vercel (production)

---

## 14. Local Development Setup

### Prerequisites
- Node.js 20+
- npm 10+
- Docker (for local PostgreSQL and MinIO)

### Setup steps

```bash
# 1. Clone the repository
git clone https://github.com/mhlscvk/mbse-tool.git
cd mbse-tool

# 2. Install all dependencies
npm install

# 3. Copy environment template and fill in local values
cp .env.example .env

# 4. Start local infrastructure (Postgres + MinIO for object storage)
docker compose up -d

# 5. Run database migrations
npm run db:migrate

# 6. Start all apps in development mode
npm run dev
```

### Common scripts (run from root via Turborepo)
```bash
npm run build         # Build all packages and apps
npm run dev           # Start all apps in watch mode
npm run lint          # Lint all packages
npm run typecheck     # Type-check all packages
npm run test          # Run all unit tests
npm run test:int      # Run integration tests
npm run db:migrate    # Run Prisma migrations
npm run db:studio     # Open Prisma Studio
```

---

## 15. Docs Folder

The `/docs` folder contains all architecture and planning documents.

| File | Status | Purpose |
|---|---|---|
| `phase-1-architecture.md` | Done | Main Phase 1 architecture reference |
| `phase-1-architecture-refinement.md` | Done | Artifact hierarchy, permissions, observability gaps |
| `repository-structure.md` | Done | This document |
| `domain-model.md` | Next | Core entities and data model |
| `api-spec.md` | Next | API contracts and endpoint catalog |
| `ui-architecture.md` | Next | Frontend structure and state design |
| `validation-strategy.md` | Next | Validation rules and issue taxonomy |
| `mcp-strategy.md` | Next | MCP tool contracts and AI safety policy |
| `phase-1-iteration-plan.md` | Next | Build order and increment plan |

All documents must be kept current with the implementation. If an architectural decision changes, update the relevant document in the same pull request.

---

## 16. Phase 1 Implementation Focus

Phase 1 active development targets:

**Apps:**
- `apps/web`
- `apps/api`
- `apps/worker`

**Packages:**
- `packages/shared-types`
- `packages/model-core`
- `packages/logging-core`
- `packages/config-core`
- `packages/storage-layer`
- `packages/auth-core`
- `packages/billing-core`
- `packages/parser-adapter`
- `packages/validation-core`
- `packages/viewer-core`
- `packages/mcp-adapter`

**Reserved for later phases:**
- `services/simulation-service` — Phase 5
- `services/ai-analysis-service` — Phase 3
- `packages/ai-correction` — Phase 3
- `packages/audit-log` — Phase 3

---

## 17. Summary

This repository structure ensures:

- **Modular design** — each package has a single, clearly bounded responsibility
- **Enforced dependency rules** — the matrix in Section 9 prevents architectural drift
- **Scalable architecture** — worker, API, and frontend scale independently
- **Clean separation of concerns** — domain logic stays in packages, orchestration in apps
- **Predictable development workflow** — one module at a time, spec before implementation
- **Future-ready** — reserved directories and packages for Phase 2–5 without restructuring
- **Compatibility with Claude Code** — module-by-module development sessions map directly to package boundaries
