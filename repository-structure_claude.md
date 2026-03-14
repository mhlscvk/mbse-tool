# Repository Structure — systemodel.com SysML v2 Web Platform

---

## 1. Purpose

This document defines the monorepo layout, package ownership, naming conventions, dependency rules, and configuration structure for `systemodel.com`.

It is the authoritative reference for:
- where code lives
- what each package is responsible for
- what a package may and may not depend on
- how the repository is configured and built

All contributors and Claude Code sessions must follow this structure.

---

## 2. Monorepo Tooling

The repository uses **Turborepo** as the monorepo build system.

**Why Turborepo:**
- incremental builds (only rebuilds what changed)
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
│   └── api/                        # Fastify backend API
│
├── packages/
│   ├── shared-types/               # Common types, errors, config, utilities
│   ├── model-core/                 # SysML model interfaces and contracts
│   ├── storage-layer/              # Prisma ORM + object storage client
│   ├── auth-core/                  # JWT, roles, permissions
│   ├── billing-core/               # Stripe integration, entitlement model
│   ├── parser-adapter/             # SysML v2 parser integration
│   ├── validation-core/            # Validation rules and diagnostic model
│   ├── viewer-core/                # Model-to-view transformation
│   └── mcp-adapter/                # MCP tool gateway
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
- import from `storage-layer`
- contain business logic — all logic lives in the API

**Internal structure:**
```
apps/web/
├── src/
│   ├── pages/              # Route-level page components
│   ├── components/         # Shared UI components
│   ├── features/           # Feature-scoped modules (editor, viewer, auth, projects)
│   ├── api/                # API client functions (typed, generated from OpenAPI)
│   ├── hooks/              # Shared React hooks
│   ├── store/              # Global state (if needed)
│   └── main.tsx            # App entry point
├── public/                 # Static assets
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

### 4.2 `apps/api` — Backend API

**Technology:** Fastify, Node.js, TypeScript

**Responsibilities:**
- expose all platform capabilities through a versioned REST API
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
│   ├── plugins/            # Fastify plugins (auth middleware, error handler, logger)
│   ├── middleware/         # Request validation, rate limiting
│   ├── openapi/            # OpenAPI spec generation
│   └── server.ts           # Server entry point
├── tsconfig.json
└── package.json
```

**API versioning:** All routes are prefixed `/api/v1/...`

---

## 5. Packages

### 5.1 `packages/shared-types` — Phase 1

**Responsibilities:**
- common TypeScript types used across all packages and apps
- error models and error codes
- configuration schema types
- logging utility types
- constants

**Dependency rule:** May not import from any other internal package.

**Internal structure:**
```
packages/shared-types/
├── src/
│   ├── errors.ts           # Error classes and error codes
│   ├── config.ts           # Config schema types
│   ├── logger.ts           # Structured log types and logger factory
│   └── index.ts            # Public exports
├── tsconfig.json
└── package.json
```

---

### 5.2 `packages/model-core` — Phase 1

**Responsibilities:**
- defines the central TypeScript interfaces for all SysML model artifacts
- interfaces only — no implementation
- versioned: breaking changes require a new interface version

**Key interfaces:**
- `SysMLDocument` — top-level model container
- `ModelElement` — base type for all SysML elements
- `ParseResult` — output of the parser adapter
- `ParseJob` — parse job lifecycle record (`PENDING`, `RUNNING`, `COMPLETED`, `FAILED`, `SUPERSEDED`)
- `ValidationResult` — diagnostic output of the validation module
- `ValidationIssue` — individual issue with ID, severity, message, location, category
- `RenderViewModel` — view-ready transformation of a parsed model

**Dependency rule:** May only import from `shared-types`.

**Internal structure:**
```
packages/model-core/
├── src/
│   ├── document.ts         # SysMLDocument, ModelElement
│   ├── parse.ts            # ParseResult, ParseJob
│   ├── validation.ts       # ValidationResult, ValidationIssue
│   ├── render.ts           # RenderViewModel
│   └── index.ts
├── tsconfig.json
└── package.json
```

---

### 5.3 `packages/storage-layer` — Phase 1

**Responsibilities:**
- all database access via Prisma ORM
- all object storage operations (upload, download, delete)
- schema definitions and migration management
- no business logic — pure data access

**Dependency rule:** May import from `shared-types` and `model-core` only.

**Internal structure:**
```
packages/storage-layer/
├── prisma/
│   ├── schema.prisma       # Database schema (single source of truth)
│   └── migrations/         # Migration history
├── src/
│   ├── db/                 # Prisma client and repository functions
│   │   ├── client.ts
│   │   ├── users.ts
│   │   ├── projects.ts
│   │   ├── files.ts
│   │   ├── revisions.ts
│   │   └── diagnostics.ts
│   ├── object-storage/     # S3/R2 client and file operations
│   │   └── r2.ts
│   └── index.ts
├── tsconfig.json
└── package.json
```

---

### 5.4 `packages/auth-core` — Phase 1

**Responsibilities:**
- JWT issuance, refresh, and revocation
- password hashing (bcrypt)
- role definition and permission checks
- rate limiting utilities
- centralized authorization — no permission logic lives outside this package

**Dependency rule:** May import from `shared-types` and `storage-layer`.

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

**Roles defined here:**
- `Admin`
- `StandardUser`
- `Viewer`

---

### 5.5 `packages/billing-core` — Phase 1 (foundation)

**Responsibilities:**
- Stripe customer and subscription creation
- subscription plan definitions
- entitlement state checks (feature gating)
- Stripe webhook event handling
- billing portal redirect URL generation

**Dependency rule:** May import from `shared-types` and `storage-layer`.

**Must not:** affect or be imported by model processing packages.

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

### 5.6 `packages/parser-adapter` — Phase 1

**Responsibilities:**
- accepts `.sysml` source text
- runs the SysML v2 parser
- emits `ParseResult` (normalized model + diagnostics) per `model-core` contract
- manages Parse Job lifecycle states
- SysML v2 grammar is a versioned, swappable asset

**Dependency rule:** May import from `shared-types`, `model-core`, and `storage-layer`.

**Must not:** be imported by `viewer-core` or `validation-core` directly — both consume `ParseResult`, not the adapter.

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

### 5.7 `packages/validation-core` — Phase 1 (foundation)

**Responsibilities:**
- defines validation rules for parsed models
- produces `ValidationResult` per `model-core` contract
- rules are deterministic and reproducible
- each rule is independently testable
- designed for future rule-pack extensions

**Dependency rule:** May import from `shared-types` and `model-core` only. Must not import from `parser-adapter`.

**Internal structure:**
```
packages/validation-core/
├── src/
│   ├── runner.ts           # Runs all registered rules against a ParseResult
│   ├── rules/              # One file per validation rule
│   │   ├── element-names.ts
│   │   └── ...
│   ├── issue.ts            # Issue construction helpers
│   └── index.ts
├── tsconfig.json
└── package.json
```

---

### 5.8 `packages/viewer-core` — Phase 1 (limited subset)

**Responsibilities:**
- transforms a `ParseResult` (normalized model) into a `RenderViewModel`
- supports a limited SysML v2 subset in Phase 1 (block definitions, basic relationships)
- reports unsupported constructs explicitly — never silently omits them
- read-only output — no diagram editing in Phase 1
- basic automatic layout

**Dependency rule:** May import from `shared-types` and `model-core` only. Must not import from `parser-adapter` or `validation-core`.

**Internal structure:**
```
packages/viewer-core/
├── src/
│   ├── transformer.ts      # ParseResult → RenderViewModel
│   ├── layout.ts           # Basic automatic layout engine
│   ├── unsupported.ts      # Unsupported construct detection and reporting
│   ├── renderers/          # Per-element render logic
│   │   ├── block.ts
│   │   └── relationship.ts
│   └── index.ts
├── tsconfig.json
└── package.json
```

---

### 5.9 `packages/mcp-adapter` — Phase 1 (foundation)

**Responsibilities:**
- exposes MCP-compliant tool endpoints
- authenticates and scopes all tool requests via API key
- Phase 1 tools: `list_projects`, `get_file`, `list_files`, `get_diagnostics`
- all tools call existing API service functions — no direct DB access
- logs all tool invocations for audit

**Dependency rule:** May import from `shared-types`, `model-core`, `auth-core`, and `storage-layer`.

**Internal structure:**
```
packages/mcp-adapter/
├── src/
│   ├── registry.ts         # Tool registration map
│   ├── tools/              # One file per tool
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

## 6. Dependency Rules

The following matrix defines what each package may import from. Violations must be caught by ESLint import rules.

```
Package                 | shared-types | model-core | storage-layer | auth-core | billing-core | parser-adapter | validation-core | viewer-core | mcp-adapter | apps/*
------------------------|-------------|------------|---------------|-----------|--------------|----------------|-----------------|-------------|-------------|-------
shared-types            |      —      |     No     |      No       |    No     |      No      |       No       |       No        |     No      |     No      |  No
model-core              |     Yes     |     —      |      No       |    No     |      No      |       No       |       No        |     No      |     No      |  No
storage-layer           |     Yes     |    Yes     |      —        |    No     |      No      |       No       |       No        |     No      |     No      |  No
auth-core               |     Yes     |     No     |     Yes       |    —      |      No      |       No       |       No        |     No      |     No      |  No
billing-core            |     Yes     |     No     |     Yes       |    No     |      —       |       No       |       No        |     No      |     No      |  No
parser-adapter          |     Yes     |    Yes     |     Yes       |    No     |      No      |       —        |       No        |     No      |     No      |  No
validation-core         |     Yes     |    Yes     |      No       |    No     |      No      |       No       |       —         |     No      |     No      |  No
viewer-core             |     Yes     |    Yes     |      No       |    No     |      No      |       No       |       No        |     —       |     No      |  No
mcp-adapter             |     Yes     |    Yes     |     Yes       |   Yes     |      No      |       No       |       No        |     No      |     —       |  No
apps/api                |     Yes     |    Yes     |     Yes       |   Yes     |     Yes      |      Yes       |      Yes        |    Yes      |    Yes      |  —
apps/web                |     Yes     |    Yes     |      No       |    No     |      No      |       No       |       No        |    Yes      |     No      |  —
```

**Key rules:**
- `shared-types` depends on nothing
- `model-core` depends only on `shared-types`
- `viewer-core` and `validation-core` depend only on `model-core` — never on `parser-adapter`
- `apps/web` never imports `storage-layer`, `auth-core`, or `billing-core`
- `billing-core` never imports model processing packages
- `apps/api` is the only place that assembles all packages together

---

## 7. Naming Conventions

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

## 8. Configuration Files

### `turbo.json` — Turborepo pipeline
Defines build, dev, lint, and test task pipelines and their dependency order.

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

### `tsconfig.base.json` — Shared TypeScript config
All packages extend this. Sets `strict: true`, `moduleResolution: bundler`, and path aliases.

### `.eslintrc.base.js` — Shared ESLint config
Includes `eslint-plugin-import` configured to enforce the dependency rules in Section 6.

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

---

## 9. Environment Variables

All environment variables are defined in `.env.example` at the root.
Each app/package reads only the variables it needs.
Never commit `.env` files — use `.env.example` as the template.

### Required variables — Phase 1

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
| `API_BASE_URL` | `apps/web` | Backend API URL |
| `MCP_API_KEY_SALT` | `mcp-adapter` | Salt for API key hashing |

---

## 10. CI/CD Pipeline

### GitHub Actions workflows

**`ci.yml`** — runs on every pull request
- install dependencies
- typecheck all packages
- lint all packages
- run all tests
- build all packages

**`deploy-staging.yml`** — runs on merge to `main`
- run CI pipeline
- deploy `apps/api` to Render (staging)
- deploy `apps/web` to Vercel (staging)
- run database migrations against staging DB

**`deploy-production.yml`** — runs on release tag (`v*`)
- run CI pipeline
- deploy `apps/api` to Render (production)
- deploy `apps/web` to Vercel (production)
- run database migrations against production DB

---

## 11. Local Development Setup

### Prerequisites
- Node.js 20+
- npm 10+
- Docker (for local PostgreSQL and MinIO)

### Setup steps

```bash
# 1. Clone the repository
git clone https://github.com/mhlscvk/mbse-tool.git
cd mbse-tool

# 2. Install dependencies
npm install

# 3. Copy environment template
cp .env.example .env
# Fill in local values

# 4. Start local infrastructure (Postgres + MinIO)
docker compose up -d

# 5. Run database migrations
npm run db:migrate

# 6. Start all apps in development mode
npm run dev
```

### Per-package scripts (via Turborepo)
```bash
npm run build       # Build all packages
npm run dev         # Start all apps in watch mode
npm run lint        # Lint all packages
npm run typecheck   # Type-check all packages
npm run test        # Run all tests
```

---

## 12. Docs Folder

The `/docs` folder contains all architecture and planning documents.

| File | Purpose |
|---|---|
| `phase-1-architecture.md` | Main Phase 1 architecture reference |
| `phase-1-architecture-refinement.md` | Architecture gap-fill: artifact hierarchy, permissions, observability |
| `repository-structure.md` | This document |
| `domain-model.md` | Core entities and data model (next) |
| `api-spec.md` | API contracts and endpoint catalog (next) |
| `ui-architecture.md` | Frontend structure and state design (next) |
| `validation-strategy.md` | Validation rules and issue taxonomy (next) |
| `mcp-strategy.md` | MCP tool contracts and AI safety policy (next) |
| `phase-1-iteration-plan.md` | Build order and sprint/increment plan (next) |

All documents in `/docs` must be kept current with the implementation. If an architectural decision changes, update the relevant document in the same pull request.

---

## 13. Future Package Additions

The following packages are planned for later phases. Their locations are reserved.

| Package | Phase | Purpose |
|---|---|---|
| `packages/ai-correction` | Phase 3 | AI patch proposal and approval workflow |
| `packages/simulation-core` | Phase 5 | Simulation engine interface and execution |
| `packages/diagram-ibد` | Phase 2 | IBD diagram transformer |
| `packages/audit-log` | Phase 3 | Structured audit trail for AI and user actions |

When adding a new package: create the folder, add `package.json` and `tsconfig.json`, register it in the root workspace, and update this document.
