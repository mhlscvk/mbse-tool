# CLAUDE.md

## Project Context

This project is a **web-based SysML v2 modeling platform** that will be developed **step by step**.

The platform is intended to support:
- SysML v2 textual modeling
- graphical model visualization
- user authentication
- payments and user types
- AI access through MCP
- AI-assisted model correction
- advanced model views
- simulation capabilities

However, **this document defines only Phase 1** of the development effort.
Future phases will extend the platform incrementally.

---

## Development Approach

The application must be designed and implemented using a **modular, scalable, and maintainable architecture**.

### Core principles
- Build the system in **independent modules** with clear responsibilities.
- Ensure each module can be **developed, tested, fixed, and deployed independently** where practical.
- Keep coupling low and cohesion high.
- Design the architecture so that **future phases can be added without major rewrites**.
- Minimize memory usage by loading only the data and services needed for the current operation.
- Make it easy to update the SysML v2 language support, modeling approach, and future simulation logic.

### Architectural expectations
- Use a **modular framework** suitable for long-term growth.
- Separate frontend, backend, model-processing, and future AI/simulation concerns.
- Use stable internal interfaces between modules.
- Prefer small, focused components and services over large tightly coupled code units.
- Design for extensibility from the beginning.

---

## Phase Declaration

This is **Phase 1** of the product.

Phase 1 focuses on establishing the **foundation** of the platform.
It should deliver the minimum architecture and core capabilities required to support future phases.

All advanced capabilities such as expanded diagram types, AI-driven correction workflows, MCP tooling expansion, and simulation will be implemented in **later phases**.

The codebase, folder structure, APIs, and core abstractions created in this phase must therefore be prepared for future extension.

---

## Phase 1 Goals

Phase 1 should establish the base platform and core workflow.

### In scope for Phase 1
- Create a **web-based application foundation**.
- Establish the **modular project structure**.
- Implement **user authentication and login**.
- Implement basic **user/account management**.
- Support creation of projects/workspaces.
- Support upload, storage, and retrieval of `.sysml` files.
- Provide a basic **SysML v2 text editor**.
- Enable saving and reopening models.
- Prepare an internal structure for **parsing and model processing**.
- Define the base contracts that future graphical views, AI integration, and simulation modules will use.

### Out of scope for Phase 1
These items are not the focus of this phase and should be treated as future work:
- advanced graphical model views
- rich semantic validation
- full AI correction workflows
- broad MCP tool coverage
- model simulation and execution
- advanced collaboration features
- enterprise scaling features

---

## Phase 1 Architectural Requirement

Phase 1 must be built on a structure that supports later expansion.

The architecture should already anticipate future modules such as:
- parser module
- validation module
- diagram/view module
- MCP gateway module
- AI correction module
- billing/subscription module
- simulation module
- audit/history module

These future modules do not need to be fully implemented in Phase 1, but the architecture should not block them.

---

## Suggested High-Level Module Boundaries

Phase 1 should begin with a structure similar to the following:

- `frontend-web`
  - login pages
  - dashboard
  - project pages
  - SysML editor UI

- `backend-api`
  - authentication APIs
  - project APIs
  - file APIs
  - user/account APIs

- `model-core`
  - shared model abstractions
  - document handling contracts
  - future parser/validation interfaces

- `storage`
  - database access
  - file/object storage access

- `shared`
  - types
  - config
  - utilities
  - error models

This structure can later be extended with additional modules rather than rewritten.

---

## Scalability Requirement

The framework and implementation style must support growth in the following dimensions:
- more users
- more projects
- larger models
- more graphical views
- more AI tooling
- more simulation capability
- more subscription and enterprise features

Scalability should be achieved through:
- clean service boundaries
- stateless APIs where possible
- efficient storage design
- lazy loading of heavy features
- avoiding unnecessary duplication of model data in memory

---

## Maintainability Requirement

To keep the code easy to fix and evolve:
- each module should have a clear purpose
- interfaces should be explicit
- errors should be easy to isolate
- logging and diagnostics should be structured
- code generation through Claude should target small, well-defined units
- modules should be testable independently

---

## Claude Code Guidance

When using Claude Code for implementation:
- work **phase by phase**
- work **module by module**
- define the objective before generating code
- generate only the code needed for the current module
- keep outputs clean, minimal, and maintainable
- avoid generating tightly coupled all-in-one solutions
- prefer extensible abstractions over shortcuts

Claude Code should treat this project as a **multi-phase modular platform**, not as a one-shot prototype.

---

## Statement for Future Phases

This project will continue beyond Phase 1.

Later phases are expected to introduce:
- richer SysML v2 parsing and validation
- graphical model rendering
- advanced viewpoints
- AI access through MCP
- AI-assisted model analysis and correction
- payment and subscription features
- simulation and trace capabilities

Phase 1 must therefore be implemented in a way that makes these later phases easier to add.

---

## Phase 1 Summary

**This document defines the first phase only.**

The priority in this phase is to create a **modular, scalable, and extensible foundation** for a web-based SysML v2 platform.
The system must be structured so that future phases can add advanced modeling, AI, MCP, and simulation capabilities without major architectural change.
