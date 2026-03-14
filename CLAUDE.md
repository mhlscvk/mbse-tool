# Claude.md — Phase 1 Planning Prompt for a SysML v2 Web Application

You are acting as a **senior solution architect, product planner, and modular systems engineering advisor**.  
Your task is to help me plan, define, and structure the **first phase** of a web-based SysML v2 application that will later expand in multiple phases.

## Project Context

I want to build a **web application on systemodel.com** with the following long-term vision:

- The application shall **read `.sysml` files** and display them **graphically**
- It shall allow **SysML v2 coding/editing**
- It shall provide **SysML v2 graphical representations**
- It shall be **web-based**
- It shall allow **user login**
- It shall support **payments**
- It shall support **different user types / roles**
- It shall use **SysML v2 as the core language**
- It shall be accessible to **artificial intelligence via MCP**
- It shall be able to help **correct models**
- It shall be developed **step by step**
- It shall support future **advanced model views**
- It shall support future **simulation capabilities**
- The language fundamentals and modeling/simulation approach should be **updatable in a modular way**
- Each module should be:
  - independently developable
  - easy to debug and fix
  - low in memory usage
  - scalable
  - cleanly separable from other modules

## Important Development Constraint

This application must be developed **using Claude Code as the implementation assistant**, but I do **not** want direct coding in this step.  
I want **planning, architecture, staged development strategy, module definition, and implementation guidance only**.

Do **not** jump straight into writing source code unless explicitly requested later.

## Main Goal of This Prompt

Help me define the **best practical approach** to set up and develop this website in a **modular, scalable, phased architecture**.

This is **Phase 1 only**.  
Future phases will be added later.

## What I Want You to Produce

Please create a structured response with the following sections:

### 1. Executive Summary
Give a concise summary of the recommended approach for building this application.

### 2. Phase-Based Development Roadmap
Define a **step-by-step development roadmap**, starting with **Phase 1** and briefly showing how later phases could evolve.

Requirements:
- Clearly state that this is **the first phase of development**
- Show what belongs in:
  - **Phase 1: core foundation / MVP**
  - **Later phases: advanced views, simulation, AI-assisted correction, deeper integrations**
- Explain why this phased approach is the best fit

### 3. Phase 1 Scope Definition
Define what should be included in **Phase 1 only**.

Phase 1 should focus on the essential foundation, such as:
- web platform foundation
- user authentication
- user roles/types
- basic payment readiness or payment integration foundation
- SysML v2 file ingestion/import
- basic SysML v2 text editing
- initial graphical rendering approach
- modular architecture foundation
- API/MCP accessibility foundation
- model validation/correction preparation layer

Also identify what should **not** be included in Phase 1 and should be delayed to later phases.

### 4. Recommended Modular Architecture
Propose a **modular system architecture** for the application.

Break the platform into modules such as, if appropriate:
- frontend web client
- backend API
- authentication/authorization
- payment module
- SysML v2 parser/import module
- SysML v2 editor module
- graphical rendering/viewer module
- model validation/correction module
- MCP/AI integration module
- storage/database layer
- simulation module for later phases

For each module, explain:
- its purpose
- why it should be independent
- how modularity helps updates, debugging, and memory efficiency
- which modules belong in Phase 1 vs later phases

### 5. Scalable Technical Approach
Recommend the overall technical approach for a web application like this.

Address:
- frontend/backend separation or monorepo approach
- plugin/module-oriented design
- service boundaries
- API-first design
- extensibility for future SysML v2 language updates
- support for future simulation capabilities
- support for AI/MCP access
- strategies for keeping memory usage low
- strategies for maintainability and easier bug fixing

### 6. Hosting and Deployment Recommendation
Answer this practical question:

**What approach should I take to set up this website, and which hosting service should I use? Is there an integrated system with Claude Code?**

In your answer:
- Recommend suitable hosting/deployment options for this kind of modular web platform
- Compare options briefly
- Consider frontend hosting, backend hosting, database hosting, storage, and scaling
- Mention whether there is any real “integrated hosting system” with Claude Code, or whether Claude Code should instead be treated as a development assistant in the workflow
- Be realistic and do not invent nonexistent native integrations
- If direct Claude Code hosting integration does not exist, propose the best practical workflow

### 7. Recommended Development Workflow Using Claude Code
Explain how I should use **Claude Code step by step** during development without asking it to generate the whole product at once.

Describe a workflow such as:
- architecture definition
- module-by-module planning
- spec writing
- scaffold generation
- review cycles
- debugging support
- refactoring guidance
- documentation generation
- test planning
- phased expansion

Make the workflow suitable for a large modular product.

### 8. MCP and AI Accessibility Strategy
Explain how the application should be designed so that:
- AI systems can access it through **MCP**
- AI can inspect and help correct models
- model correction is controlled, traceable, and safe
- future AI-assisted modeling features can be added cleanly

### 9. Risks and Design Warnings
List the biggest risks in this project, especially around:
- SysML v2 complexity
- parser/editor/view synchronization
- graphical representation accuracy
- simulation expansion
- modular versioning
- payment/user-role complexity
- AI correction reliability
- long-term maintainability

For each risk, provide a practical mitigation strategy.

### 10. Concrete Recommendation
End with a **clear recommended starting approach**:
- what I should build first
- what stack style I should adopt
- what hosting direction is best
- how to organize the first implementation phase on systemodel.com

## Output Style Requirements

- Be highly structured
- Use clear headings
- Be practical, not vague
- Think like a real software architect planning a serious product
- Do not write source code
- Do not produce placeholder fluff
- Make reasonable assumptions where needed
- Explicitly label items as **Phase 1** vs **Later Phase**
- Emphasize **modularity, scalability, low memory usage, maintainability, and staged development**
- Keep the recommendations realistic for actual implementation

## Final Instruction

Treat this as a **real architecture and development planning task** for the first release of a SysML v2 web platform on **systemodel.com**, designed to grow into a more advanced modeling and simulation environment over time.
