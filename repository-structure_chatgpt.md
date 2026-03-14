# Repository Structure
## systemodel.com SysML v2 Web Platform

This document defines the repository structure for the systemodel SysML v2 web platform.

The repository uses a **modular monorepo architecture**. All applications and modules live in a single repository but are separated into clear logical components.

The goals of this structure are:

- clear architectural boundaries
- modular development
- scalable architecture
- minimal coupling
- easy testing
- compatibility with Claude Code workflows

---

# 1. Repository Overview

The repository is organized into several top-level directories.

systemodel/
│
├── apps/
├── packages/
├── services/
├── infrastructure/
├── docs/
├── scripts/
├── tests/
├── .github/
│
├── package.json
├── tsconfig.json
└── README.md

Each directory has a specific architectural responsibility.

---

# 2. Applications

The `apps` directory contains deployable applications.

apps/
│
├── web
├── api
└── worker

Each application can run independently.

---

# 2.1 Web Application

Location:

apps/web

Responsibilities:

- browser user interface
- SysML text editor
- graphical viewer
- project management UI
- authentication UI
- billing interface

Structure:

apps/web/
│
├── src/
│   ├── pages/
│   ├── components/
│   ├── features/
│   ├── hooks/
│   ├── services/
│   └── utils/
│
├── public/
└── config/

---

# 2.2 API Application

Location:

apps/api

Responsibilities:

- REST or GraphQL API
- project management
- model processing orchestration
- authentication enforcement
- MCP tool endpoints

Structure:

apps/api/
│
├── src/
│   ├── controllers/
│   ├── routes/
│   ├── services/
│   ├── middleware/
│   ├── validators/
│   └── utils/
│
└── config/

---

# 2.3 Worker Application

Location:

apps/worker

Responsibilities:

- background parsing
- validation jobs
- analysis jobs
- future simulation tasks

Structure:

apps/worker/
│
├── src/
│   ├── jobs/
│   ├── processors/
│   ├── queues/
│   └── utils/

---

# 3. Shared Packages

The `packages` directory contains reusable libraries shared across applications.

packages/
│
├── model-core
├── parser-adapter
├── validation-core
├── viewer-core
├── auth-core
├── billing-core
├── mcp-adapter
├── storage-core
├── logging-core
├── config-core
└── shared-types

Each package has a clearly defined responsibility.

---

# 4. Core Model Package

Location:

packages/model-core

Responsibilities:

- normalized SysML model representation
- model element identifiers
- graph relationships
- model traversal utilities

Important rule:

The model-core package must **not depend on UI or infrastructure code**.

---

# 5. Parser Adapter Package

Location:

packages/parser-adapter

Responsibilities:

- SysML v2 parser integration
- converting `.sysml` source into normalized models
- parser version management
- parse diagnostics generation

Outputs:

- parsed model snapshot
- parse diagnostics

---

# 6. Validation Core Package

Location:

packages/validation-core

Responsibilities:

- deterministic validation rules
- issue detection
- validation rule registry
- rule execution engine

Validation produces structured diagnostics including severity and location.

---

# 7. Viewer Core Package

Location:

packages/viewer-core

Responsibilities:

- convert normalized models into view models
- compute layout structures
- generate rendering metadata

This package does **not directly render graphics**.  
It produces data structures that the frontend renderer can visualize.

---

# 8. Authentication Core Package

Location:

packages/auth-core

Responsibilities:

- authentication helpers
- role evaluation
- permission checks
- token validation

Used by:

- API service
- MCP tools
- background workers

---

# 9. Billing Core Package

Location:

packages/billing-core

Responsibilities:

- plan definitions
- subscription status
- entitlement checks
- billing webhook handling

Billing logic must remain isolated from domain model logic.

---

# 10. MCP Adapter Package

Location:

packages/mcp-adapter

Responsibilities:

- AI tool interface
- model inspection endpoints
- patch proposal handling
- AI action audit logging

Provides safe access for AI systems through controlled tools.

---

# 11. Storage Core Package

Location:

packages/storage-core

Responsibilities:

- database access
- file storage abstraction
- model revision storage
- parsed model persistence

Supports:

- PostgreSQL
- object storage systems

---

# 12. Logging Core Package

Location:

packages/logging-core

Responsibilities:

- structured logging
- event logging
- audit logging
- observability helpers

All services must log through this module.

---

# 13. Config Core Package

Location:

packages/config-core

Responsibilities:

- environment configuration
- runtime settings
- configuration validation

---

# 14. Shared Types

Location:

packages/shared-types

Defines shared data structures used across the system.

Examples:

- API request/response types
- domain entities
- validation result types
- viewer data structures

---

# 15. Services Directory

The `services` directory contains optional future microservices.

services/
│
├── simulation-service
├── ai-analysis-service
└── analytics-service

Phase 1 will not deploy these services but the structure prepares for future scaling.

---

# 16. Infrastructure

Location:

infrastructure/

Contains deployment and infrastructure configuration.

Example structure:

infrastructure/
│
├── docker/
├── terraform/
├── kubernetes/
└── deployment/

---

# 17. Documentation

Location:

docs/

Contains architecture and design documentation.

Recommended files:

docs/
│
├── phase-1-architecture.md
├── repository-structure.md
├── domain-model.md
├── api-spec.md
├── validation-strategy.md
├── mcp-strategy.md
└── iteration-plan.md

---

# 18. Scripts

Location:

scripts/

Contains development and operational scripts.

Examples:

- database setup
- environment initialization
- migration scripts
- build scripts

---

# 19. Tests

Location:

tests/

Structure:

tests/
│
├── integration/
├── e2e/
└── fixtures/

Test categories include:

- parser tests
- validation rule tests
- API contract tests
- permission tests
- MCP tool tests

---

# 20. CI/CD Configuration

Location:

.github/

Contains CI/CD pipeline configurations.

Examples:

- build pipelines
- automated testing
- deployment workflows

---

# 21. Development Rules

All modules must follow these architectural rules.

1. No circular dependencies.
2. Domain logic must stay inside `packages`.
3. Applications may depend on packages.
4. Packages must never depend on applications.
5. Infrastructure code must remain isolated.
6. Shared types must remain lightweight.

---

# 22. Dependency Direction

Allowed dependency direction:

apps  
↓  
packages  
↓  
shared-types  

Infrastructure and services may depend on packages but packages must never depend on infrastructure.

---

# 23. Phase 1 Implementation Focus

Phase 1 development should focus on the following modules:

apps/web  
apps/api  

packages/model-core  
packages/parser-adapter  
packages/validation-core  
packages/viewer-core  
packages/storage-core  
packages/auth-core  
packages/shared-types  

Additional modules can be introduced in later phases.

---

# 24. Summary

This repository structure ensures:

- modular system design
- scalable architecture
- clean separation of concerns
- predictable development workflow
- compatibility with Claude Code development

The structure supports both the **Phase 1 MVP** and future expansion including AI integration, advanced modeling features, and simulation capabilities.
