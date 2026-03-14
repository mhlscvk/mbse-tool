# Phase 1 Architecture — systemodel.com SysML v2 Web Platform

## 1. Purpose and Scope

This document defines the recommended architecture for **Phase 1** of the `systemodel.com` web platform.

Phase 1 is the **foundation release** of a modular SysML v2 web application intended to grow over time into a broader modeling, validation, AI-assisted, and simulation-capable engineering platform.

This document focuses on:

- the architectural shape of the first release
- the module structure and boundaries
- the Phase 1 implementation scope
- the technical direction for scalable growth
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

## 3. Phase 1 Objectives

Phase 1 objectives are:

1. Establish the core web platform on `systemodel.com`
2. Support user authentication and a basic role model
3. Create the project and workspace structure
4. Enable `.sysml` file upload, storage, and import workflow
5. Provide basic SysML v2 text editing
6. Provide a first graphical rendering path for a supported subset
7. Define a modular internal architecture for future growth
8. Establish API-first foundations for browser and AI access
9. Create the validation and correction preparation layer
10. Prepare the platform for subscription/payment gating
11. Maintain low operational complexity and clean debuggability

Phase 1 success means a user can:

- sign in
- create a project
- upload or edit a `.sysml` model
- save and validate it
- view diagnostics
- see a first graphical representation for supported structures
- access the platform through well-defined APIs
- operate within a role-aware and extensible architecture

---

## 4. Architectural Principles

The following principles should govern Phase 1 design and implementation.

### 4.1 Modularity First

The platform should be organized into clearly separated modules with narrow responsibilities. Each module should be independently understandable, testable, and replaceable.

### 4.2 Modular Monolith First

Phase 1 should be implemented as a **modular monolith**, not as early microservices. Internal boundaries should be strict, but deployment should remain operationally simple.

### 4.3 API-First

All major capabilities should be exposed through well-defined application APIs. The frontend should consume those APIs rather than bypassing service boundaries.

### 4.4 Model Core as the Center

The normalized SysML model representation should be the central artifact that parsing, validation, rendering, and AI tooling operate on.

### 4.5 Traceable and Revisioned Changes

All model changes should be associated with a revision history and a clear audit trail, especially in preparation for future AI-assisted editing.

### 4.6 Low Memory Usage by Design

The system should avoid loading all model data into all processes. It should use incremental loading, caching, and targeted view materialization where possible.

### 4.7 Extensibility for SysML v2 Evolution

Language support and modeling semantics should be version-aware and adapter-based so parser and validation logic can evolve without breaking the whole platform.

### 4.8 Safe AI Integration

AI should operate through explicit, permission-aware tool contracts and never through uncontrolled direct mutation of model storage.

### 4.9 Deferred Complexity

High-risk areas such as simulation, complete language coverage, rich collaboration, and advanced AI correction should be intentionally deferred until the core platform is stable.

---

## 5. Phase 1 Scope

## 5.1 Included in Phase 1

The following capabilities are in scope for Phase 1.

### Platform Foundation
- web application shell
- environment configuration
- deployment pipeline
- logging and error reporting
- basic operational observability

### Identity and Access
- user registration and sign-in
- session management
- password or external identity provider support
- basic roles and permissions

### Project and File Management
- create and manage projects/workspaces
- upload `.sysml` files
- store model source files
- maintain model revisions

### SysML v2 Text Workflow
- text editor for `.sysml` content
- save and reload workflow
- parse trigger on upload/save
- diagnostics display

### Initial Model Processing
- import pipeline
- parser integration
- normalized internal model representation
- deterministic diagnostics contract

### Initial Graphical Rendering
- a first viewer pipeline for a limited supported subset
- model-to-view transformation
- explicit unsupported-feature handling

### Validation Foundation
- validation interface
- issue representation
- severity categories
- traceable diagnostic output

### MCP / AI Access Foundation
- stable API surface for controlled AI access
- model inspection endpoints/tools
- patch proposal preparation contract

### Payment Readiness
- entitlement-aware architecture
- feature gating concept
- billing-ready account model
- optional minimal subscription integration

## 5.2 Deferred to Later Phases

The following capabilities should **not** be included in Phase 1.

### Advanced Modeling Features
- broad/full SysML v2 language completeness
- semantic-rich editing assistance
- advanced refactoring tools
- collaborative real-time modeling

### Advanced Graphical Features
- rich diagram families
- full layout engine sophistication
- advanced interactive viewpoints
- polished multi-view navigation

### AI Features
- autonomous model correction
- unrestricted agent actions
- advanced assistant workflows
- architecture reasoning automation

### Simulation and Analysis
- execution semantics runtime
- simulation engines
- solver integrations
- computational analysis pipelines

### Enterprise and Scale Features
- organization-wide administration
- advanced billing plans
- enterprise governance/compliance
- multi-region deployment
- advanced tenancy isolation

---

## 6. System Context

Phase 1 operates within the following system context.

### 6.1 Primary Actors

#### End User
A person using the browser application to create, upload, edit, validate, and view SysML v2 models.

#### Paid User
A user with entitlement to premium features, additional projects, or later advanced capabilities.

#### Administrator
A platform operator who can manage system settings, users, plans, and operational visibility.

#### AI Client
An external AI system accessing the platform through MCP-compatible or API-based tool interfaces.

### 6.2 External Systems

#### Identity Provider
Used for account authentication where external login is supported.

#### Payment Provider
Handles checkout, subscriptions, billing events, and entitlement state updates.

#### Database and Storage
Stores users, projects, source files, revisions, diagnostics, and audit data.

#### Hosting Platform
Hosts frontend, backend, and later background workers.

### 6.3 Core Internal Runtime Areas

- browser frontend
- application/API backend
- parser and model processing layer
- validation layer
- rendering/view transformation layer
- storage layer
- AI/MCP adapter layer

---

## 7. Target Solution Architecture

The target Phase 1 architecture is a **web-based modular monolith** with strong internal package boundaries.

### 7.1 Frontend Web Client

The frontend provides:

- authentication flows
- project navigation
- file management UI
- text editing UI
- diagnostics display
- initial model viewer
- account and entitlement surfaces

The frontend should be lightweight and should lazy-load heavier modeling screens where possible.

### 7.2 Backend API / Application Core

The backend application core should act as the orchestration layer for:

- authenticated requests
- project and file lifecycle
- model parsing and validation calls
- revision control
- rendering requests
- entitlement checks
- AI/MCP tool access

This is the central application boundary and should be the main integration surface.

### 7.3 Authentication and Authorization

This module manages:

- user identity
- sessions
- roles
- permission checks
- feature entitlements

Authorization should be centralized rather than embedded throughout other modules.

### 7.4 Payment and Entitlement Foundation

This module should manage:

- plan metadata
- subscription state
- entitlement checks
- webhook event handling
- feature gating decisions

Payment logic should remain isolated from modeling logic.

### 7.5 SysML v2 Import and Parser Module

This module should:

- accept source text or uploaded files
- parse supported SysML v2 syntax
- generate structured diagnostics
- emit a normalized internal model representation

The parser integration should be treated as a replaceable adapter behind a stable contract.

### 7.6 Text Editor Module

The editor module should provide:

- source editing workflow
- save/refresh loop
- diagnostics integration
- file revision awareness

The editor should be treated as a UI-facing capability, separate from the parser internals.

### 7.7 Graphical Viewer Module

This module should:

- consume the normalized model representation
- generate a renderable view model
- support an intentionally limited set of graphical views in Phase 1
- report unsupported constructs explicitly

It should not become coupled to raw parser internals.

### 7.8 Validation and Correction Preparation Module

This module should:

- define validation rules and issue types
- run deterministic checks
- provide issue metadata
- prepare the structure for future correction proposals

AI-assisted correction should later build on this module rather than replace it.

### 7.9 MCP / AI Access Module

This module should expose controlled tools for:

- project inspection
- model retrieval
- diagnostics access
- patch proposal submission
- re-validation requests

It should sit on top of the main API/application contracts and should not directly access storage without policy enforcement.

### 7.10 Storage and Persistence Layer

This layer should store:

- users
- roles
- plans and entitlements
- projects/workspaces
- source files
- model revisions
- diagnostics
- render metadata
- audit logs

Storage should support a clean separation between source text, normalized model state, and derived artifacts.

---

## 8. Module Boundaries and Responsibilities

## 8.1 Frontend Web Client

**Responsibility**
- browser UI and interaction flow

**Inputs**
- authenticated APIs
- render/view data
- diagnostics data

**Outputs**
- user actions
- file edits
- render requests
- patch proposal submissions

**Why independent**
- UI changes frequently and should not destabilize core model logic

**Phase**
- Phase 1

---

## 8.2 Backend API / Application Core

**Responsibility**
- orchestration and policy enforcement

**Inputs**
- frontend requests
- AI/MCP tool calls
- payment events
- parser/validator responses

**Outputs**
- application responses
- revision updates
- diagnostics results
- render outputs

**Why independent**
- preserves a stable system contract across clients

**Phase**
- Phase 1

---

## 8.3 Authentication / Authorization Module

**Responsibility**
- identity, sessions, roles, permissions, entitlements

**Inputs**
- login events
- role assignments
- entitlement states

**Outputs**
- authenticated identity context
- allow/deny decisions

**Why independent**
- security logic must be centrally managed and testable

**Phase**
- Phase 1

---

## 8.4 Payment / Subscription Module

**Responsibility**
- billing state and feature access

**Inputs**
- plan configuration
- subscription events
- payment provider webhooks

**Outputs**
- entitlement state
- billing status
- audit events

**Why independent**
- operationally distinct and safer to isolate

**Phase**
- foundation in Phase 1, expansion later

---

## 8.5 SysML v2 Parser / Import Module

**Responsibility**
- parse source and normalize it

**Inputs**
- `.sysml` source text
- parser configuration/version

**Outputs**
- normalized model representation
- diagnostics
- parse metadata

**Why independent**
- parser behavior will evolve and requires isolated testing and performance tuning

**Phase**
- Phase 1

---

## 8.6 SysML v2 Editor Module

**Responsibility**
- editing workflow and editor-facing integration

**Inputs**
- source text
- diagnostics
- revision state

**Outputs**
- updated source text
- save requests
- parse requests

**Why independent**
- editor UX should evolve independently of backend model logic

**Phase**
- Phase 1

---

## 8.7 Graphical Viewer Module

**Responsibility**
- transform normalized model structures into visual view data

**Inputs**
- normalized model
- rendering options
- supported view type

**Outputs**
- renderable graph/view model
- unsupported-feature indicators

**Why independent**
- rendering complexity differs from parsing and validation

**Phase**
- Phase 1 initial subset, later expanded

---

## 8.8 Validation / Correction Preparation Module

**Responsibility**
- deterministic checks and issue structuring

**Inputs**
- normalized model
- validation rule set

**Outputs**
- issues, severity, location, category, metadata

**Why independent**
- validation rule evolution should not destabilize UI or storage logic

**Phase**
- foundation in Phase 1, AI-assisted correction later

---

## 8.9 MCP / AI Integration Module

**Responsibility**
- controlled AI tool access

**Inputs**
- authenticated tool calls
- model access requests
- patch proposals

**Outputs**
- bounded model data
- diagnostics results
- traceable proposal records

**Why independent**
- AI access requires auditability, rate control, and policy separation

**Phase**
- foundation in Phase 1, feature expansion later

---

## 8.10 Storage / Persistence Layer

**Responsibility**
- durable storage and retrieval

**Inputs**
- application write operations
- revision updates
- audit events

**Outputs**
- queryable state
- version history
- persistent artifacts

**Why independent**
- durable model state is the platform backbone and must remain stable

**Phase**
- Phase 1

---

## 8.11 Simulation Module

**Responsibility**
- future analysis and execution workflows

**Inputs**
- normalized or transformed model data
- simulation configuration

**Outputs**
- analysis/simulation results

**Why independent**
- computationally heavier and semantically separate

**Phase**
- Later phase only

---

## 9. Core Data and Model Strategy

Phase 1 should establish a clean separation between source artifacts, normalized model state, diagnostics, and rendered views.

### 9.1 Source Model

This is the raw `.sysml` text uploaded or edited by the user.

It should be stored as:

- the canonical authored source
- revisioned content
- auditable user-originated data

### 9.2 Normalized Internal Model

This is the application’s structured internal representation of a parsed model.

It should:

- be independent from frontend concerns
- be stable enough for validation and rendering
- be version-aware
- support future parser adapter changes

This normalized model should be the **main shared contract** between parser, validation, and rendering.

### 9.3 Diagnostics

Diagnostics should be represented as structured records with:

- issue ID
- severity
- message
- location/range
- category
- source stage
- related element where available

Diagnostics should be deterministic and reproducible.

### 9.4 Render View Model

The graphical layer should not consume raw source text directly. It should consume a view-oriented transformation of the normalized model.

This allows:

- multiple future view types
- focused rendering performance
- clearer unsupported feature reporting

### 9.5 Revisions and Audit History

All meaningful actions should support traceability, including:

- source changes
- parse outputs
- validation runs
- render requests
- AI proposals
- approval/rejection actions

This is especially important as the platform grows toward AI-assisted editing.

---

## 10. Phase 1 Key Workflows

## 10.1 Sign In and Project Creation

1. User signs in or registers
2. User creates a project/workspace
3. Role and entitlement checks are applied
4. Project metadata is stored
5. User is redirected to the project workspace

## 10.2 Upload or Import `.sysml`

1. User uploads a `.sysml` file
2. System stores the raw source as a revisioned artifact
3. Parser/import module runs
4. Diagnostics are generated
5. Normalized model is created if parsing succeeds sufficiently
6. File status is shown in the UI

## 10.3 Edit and Save Model Text

1. User opens source in editor
2. User modifies text
3. Save action creates a new source revision
4. Parse is triggered
5. Diagnostics are returned
6. Viewer refreshes if renderable content is available

## 10.4 Parse and Return Diagnostics

1. Source enters parser pipeline
2. Parser emits structured parse result
3. Validation layer may run deterministic rules
4. Diagnostics are combined and categorized
5. UI receives an issue list and source mapping

## 10.5 Render Initial Graphical View

1. User requests graphical view
2. Render module loads the normalized model
3. A supported subset is transformed into a view model
4. Unsupported constructs are flagged
5. Viewer displays the result with associated warnings if needed

## 10.6 MCP / AI Access Request

1. AI client connects through permitted tool interface
2. Access is authenticated and scoped
3. Requested project/model data is retrieved
4. Tool receives bounded response
5. Access is logged for audit purposes

## 10.7 Validation of Proposed Correction

1. AI or user submits a proposed patch structure
2. Proposal is stored separately from committed source
3. Validation is run against the proposal
4. Result is displayed to the user
5. User accepts or rejects
6. Accepted changes become a new revision

---

## 11. API and Integration Strategy

Phase 1 should define the application as an API-first platform.

## 11.1 API Categories

### Project and Workspace APIs
- create/list/update projects
- manage membership and roles
- retrieve project metadata

### File and Revision APIs
- upload file
- fetch source
- save source revision
- list revision history

### Parse and Diagnostics APIs
- parse source
- fetch parse results
- fetch diagnostics
- retrieve issue metadata

### Render and View APIs
- request supported view
- retrieve render payload
- fetch unsupported feature notices

### Validation APIs
- run checks
- retrieve issue catalog
- validate proposed patches

### Entitlement and Billing APIs
- fetch plan state
- check feature access
- process subscription updates

### MCP / AI Tool APIs
- inspect project
- inspect model
- retrieve diagnostics
- submit patch proposal
- validate patch
- explain issue context

## 11.2 Integration Principles

- all integrations should go through stable contracts
- the frontend should not depend on parser internals
- AI should not depend on database schema
- payment providers should not affect model logic design
- future simulation should attach through export/transform interfaces

---

## 12. Technology Approach

## 12.1 Repository Style

Use a **monorepo** with explicit package boundaries.

Recommended top-level shape:

- `apps/web`
- `apps/api`
- `packages/model-core`
- `packages/parser-adapter`
- `packages/validation-core`
- `packages/viewer-core`
- `packages/mcp-adapter`
- `packages/auth-core`
- `packages/billing-core`
- `packages/shared-types`
- `docs/`

## 12.2 Implementation Style

Use a **modular monolith** in Phase 1 with package-level separation.

Benefits:
- lower ops complexity
- easier debugging
- simpler local development
- stronger consistency during early model-core iteration

## 12.3 Service Boundaries

Even if deployed together at first, the following logical service boundaries should be maintained:

- identity and entitlement
- project/file management
- model processing
- rendering
- AI tooling
- billing

## 12.4 Plugin and Extension Direction

Prepare internal extension points for:

- parser adapters
- rule packs
- view generators
- export adapters
- AI tools
- future simulation connectors

This allows language and semantics evolution without rewriting the application core.

## 12.5 Memory and Performance Strategy

To keep memory usage low:

- load heavy modules only when needed
- do not materialize entire project state in all requests
- cache normalized model artifacts when useful
- isolate expensive operations for future worker execution
- use selective subgraph extraction for rendering
- keep frontend bundles modular and lazy-loaded

## 12.6 Maintainability Strategy

To improve long-term maintainability:

- enforce module boundaries
- document contracts
- keep architecture documents current
- create regression tests for parse and render results
- centralize permission logic
- avoid hidden cross-module dependencies

---

## 13. Hosting and Deployment Direction

## 13.1 Recommended Phase 1 Hosting Shape

A practical Phase 1 hosting setup is:

- frontend hosting on a modern web deployment platform
- backend application hosted as a persistent service
- managed Postgres for application data
- managed object storage for uploaded files and artifacts
- managed auth for fast startup where appropriate

## 13.2 Recommended Direction

Recommended practical approach:

- host the frontend separately from the backend
- use managed infrastructure where it reduces operational burden
- choose platforms that support a clean path to background workers later
- keep deployment simple in Phase 1

## 13.3 Environments

At minimum define:

- local development
- staging
- production

Each environment should include:

- isolated database/configuration
- controlled secrets
- environment-specific URLs
- deployment and rollback procedures

## 13.4 CI/CD Direction

Set up CI/CD for:

- linting and tests
- package integrity checks
- documentation checks
- staged deployment
- rollback capability

The deployment design should support future separation of worker-based processing without forcing an early distributed architecture.

---

## 14. Development Workflow with Claude Code

Claude Code should be used as a **development assistant**, not as a one-shot product generator.

## 14.1 Work Document-First

Before implementation, create and maintain project documents such as:

- `architecture.md`
- `system-context.md`
- `phase-1-scope.md`
- `repository-structure.md`
- `domain-model.md`
- `api-spec.md`
- `ui-architecture.md`
- `validation-strategy.md`
- `mcp-strategy.md`

## 14.2 Plan Module by Module

Use Claude Code to work through the system in this order:

1. repository structure and architecture guardrails
2. authentication and authorization
3. project and file model
4. parser/import workflow
5. editor integration
6. diagnostics
7. viewer pipeline
8. MCP adapter
9. billing/entitlement foundation

## 14.3 Use Spec-First Delivery

For each module, ask Claude Code to help define:

- purpose
- boundaries
- data contracts
- API shape
- dependencies
- failure modes
- observability needs
- tests

Only then move to scaffolding and implementation.

## 14.4 Review in Small Cycles

After each module:
- compare implementation against the spec
- identify hidden coupling
- review naming and boundaries
- record architecture decisions

## 14.5 Use Claude Code for Debugging and Refactoring

Use Claude Code to:
- inspect failing workflows
- explain coupling problems
- suggest modular refactors
- improve documentation
- generate test ideas
- identify architectural drift

## 14.6 Keep Architecture Artifacts Updated

All meaningful design changes should be reflected in repository documents so Claude Code remains effective across the project lifecycle.

---

## 15. Risks and Mitigations

## 15.1 SysML v2 Complexity

**Risk**  
SysML v2 semantics and syntax are complex, and attempting broad support too early may destabilize the platform.

**Mitigation**  
Support a clearly declared subset in Phase 1. Use parser adapters and version-aware contracts. Separate source storage from normalized model state.

## 15.2 Parser / Editor / Viewer Synchronization

**Risk**  
Source text, normalized model state, diagnostics, and graphical rendering can drift out of sync.

**Mitigation**  
Define the normalized internal model as the shared canonical representation used by validation and rendering.

## 15.3 Graphical Accuracy and Trust

**Risk**  
Users may assume the graphical view is complete or semantically exact even when support is partial.

**Mitigation**  
Explicitly mark supported/unsupported constructs. Keep the source and diagnostics visible beside graphical output.

## 15.4 Future Simulation Pressure

**Risk**  
Simulation demands can distort the architecture too early and overcomplicate Phase 1.

**Mitigation**  
Defer simulation. Define only future-facing extension points and export boundaries.

## 15.5 Modular Versioning Drift

**Risk**  
Parser, validation, and rendering modules may evolve incompatibly.

**Mitigation**  
Version contracts, maintain compatibility metadata, and document supported combinations.

## 15.6 Role and Payment Complexity

**Risk**  
Authorization and entitlement rules may leak across the codebase.

**Mitigation**  
Centralize role checks and plan checks in dedicated authorization/entitlement modules.

## 15.7 AI Correction Reliability

**Risk**  
AI-generated suggestions may be wrong, unsafe, or opaque.

**Mitigation**  
Require traceable proposals, validation before commit, explicit approval flow, and revision history.

## 15.8 Long-Term Maintainability

**Risk**  
Fast MVP implementation may create tight coupling that blocks future phases.

**Mitigation**  
Use a modular monorepo, package boundaries, contract-first design, and regular architecture reviews.

## 15.9 Operational Overreach

**Risk**  
Trying to introduce too many services too early increases deployment and debugging complexity.

**Mitigation**  
Stay with a modular monolith in Phase 1 and extract services only when justified by real load or isolation needs.

---

## 16. Phase 1 Delivery Plan

## Increment 1 — Platform Foundation
Deliver:
- repository structure
- environment setup
- deployment pipeline
- logging and error tracking
- architecture guardrails

## Increment 2 — Identity and Project Shell
Deliver:
- user authentication
- role model
- project/workspace creation
- basic navigation shell

## Increment 3 — File and Revision Management
Deliver:
- `.sysml` upload
- source storage
- revision history
- file retrieval APIs

## Increment 4 — Parser and Diagnostics Foundation
Deliver:
- parser adapter integration
- normalized model output
- diagnostic schema
- parse-on-save flow

## Increment 5 — Text Editing Workflow
Deliver:
- basic editor
- save/refresh loop
- diagnostics integration
- error-aware editing cycle

## Increment 6 — Initial Graphical Viewer
Deliver:
- view transformation pipeline
- limited supported graphical representation
- unsupported-construct handling

## Increment 7 — MCP / AI Access Foundation
Deliver:
- permission-aware model inspection tools
- diagnostics access tools
- proposal submission contract
- audit logging

## Increment 8 — Entitlement / Billing Readiness
Deliver:
- feature gating model
- plan metadata
- subscription-ready account structure
- optional minimal checkout/webhook integration

---

## 17. Acceptance Criteria

Phase 1 is complete when all of the following are true.

### Product Acceptance
- a user can register or sign in
- a user can create a project
- a user can upload or edit a `.sysml` file
- the system stores revisions
- parsing can be triggered reliably
- diagnostics are shown clearly
- supported model content can be rendered graphically
- unsupported content is reported clearly
- role-aware access control is functioning
- API contracts exist for browser and AI-facing operations

### Architecture Acceptance
- module boundaries are documented
- normalized model representation is established
- validation interface exists
- MCP access foundation is defined
- entitlement checks are centralized
- architecture docs are present and aligned with implementation

### Operational Acceptance
- staging and production deployment path exists
- logs and error reporting are available
- environment configuration is controlled
- basic rollback and recovery approach is documented

---

## 18. Recommended Next Repository Documents

After this file, the next recommended documents are:

### `system-context.md`
Defines actors, external systems, context boundaries, and interaction flows.

### `repository-structure.md`
Defines the monorepo layout, package ownership, naming rules, and dependency boundaries.

### `domain-model.md`
Defines core entities such as user, project, file, revision, diagnostic, entitlement, and patch proposal.

### `api-spec.md`
Defines the application API contracts and endpoint categories.

### `ui-architecture.md`
Defines the frontend structure, routes, state ownership, editor/view integration, and lazy-loading strategy.

### `validation-strategy.md`
Defines issue taxonomy, deterministic validation approach, and future rule-pack model.

### `mcp-strategy.md`
Defines AI access policy, tool contracts, audit requirements, and patch proposal workflow.

### `phase-1-iteration-plan.md`
Defines practical implementation order and deliverables for the first development cycle.

---

## 19. Final Recommendation

Phase 1 should be implemented as a **modular monolith in a monorepo** with a strong API-first design and a normalized model core at the center.

The immediate implementation focus should be:

1. platform foundation
2. authentication and roles
3. project and file storage
4. SysML v2 text import/edit
5. parser and diagnostics
6. first graphical rendering pipeline
7. MCP access foundation
8. entitlement-ready architecture

This is the best starting architecture for `systemodel.com` because it is:

- modular enough for future extraction
- simple enough to build and debug now
- scalable in structure without premature infrastructure complexity
- suitable for later AI assistance and simulation growth
- aligned with a staged, architecture-first development workflow using Claude Code