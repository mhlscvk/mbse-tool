# Systemodel — SysML v2 Web Modeling Platform

A web-based SysML v2 code editor and visualization tool with full OMG SysML v2.0 graphical notation compliance, built as a modular monorepo.

**Live:** [https://systemodel.com](https://systemodel.com)

**Spec reference:** [OMG SysML v2.0 (formal/2025-09-03)](https://www.omg.org/spec/SysML/2.0)

---

## Architecture

```
systemodel/
├── packages/
│   ├── shared-types/      # Shared TypeScript interfaces (AST, diagram model, API types)
│   ├── diagram-service/   # SysML v2 text parser → AST → diagram generator (port 3002)
│   ├── api-server/        # REST API: auth, projects, files, AI chat, MCP server (port 3003)
│   ├── lsp-server/        # Language Server Protocol bridge (port 3001)
│   └── web-client/        # React frontend: Monaco editor + SVG diagram viewer (port 5173)
```

### API Server Internal Architecture

The api-server uses a **service-layer architecture** for easy development:

```
api-server/src/
├── config/                # Centralized configuration
│   ├── constants.ts       # All magic numbers (rate limits, file sizes, TTLs)
│   └── schemas.ts         # Shared Zod schemas (email, password, provider)
├── lib/                   # Shared utilities
│   ├── errors.ts          # AppError classes + asyncHandler wrapper
│   └── auth-helpers.ts    # isAdmin(), assertProjectAccess(), assertWriteAccess()
├── services/              # Business logic (no Express dependency)
│   └── file-ops.ts        # Unified file CRUD — used by REST, AI tools, AND MCP
├── middleware/             # Express middleware (auth, error handling)
├── routes/                # Thin HTTP handlers: validate → call service → respond
├── ai/                    # LLM provider adapters, tool definitions, encryption
└── mcp/                   # Model Context Protocol server, tools, resources, prompts
```

**Key principle:** Business logic lives in `services/`. Route handlers, AI tools, and MCP tools all call the same service functions — zero duplication. All routes use `asyncHandler` (no manual try/catch) and throw typed `AppError` instances.

### Service Ports

| Service | URL | Protocol |
|---|---|---|
| Web Client | http://localhost:5173 | HTTP |
| API Server | http://localhost:3003 | HTTP/REST |
| Diagram Service | ws://localhost:3002/diagram | WebSocket |
| LSP Server | ws://localhost:3001/lsp | WebSocket |
| MCP Server | http://localhost:3003/mcp | Streamable HTTP |
| PostgreSQL | localhost:5432 | TCP |

---

## Prerequisites

- [Node.js](https://nodejs.org/) >= 20.10.0
- [pnpm](https://pnpm.io/) >= 9.x (`npm install -g pnpm`)
- [Docker](https://www.docker.com/) (for PostgreSQL)
- Anthropic API key (optional — for free-tier AI chat)
- Google OAuth Client ID (for Google Sign-In)
- Gmail app password (for email verification in production)

---

## Setup

### Quick Setup (Recommended)

```bash
git clone https://github.com/mhlscvk/mbse-tool.git
cd mbse-tool
pnpm run local-setup
```

This single command handles everything: Docker PostgreSQL, dependency installation, `.env` file generation (with random secrets), Prisma client generation, database migrations, and seeding (admin account + example projects).

> **Prerequisites:** Node.js >= 20.10.0, pnpm >= 9.x, Docker

### Manual Setup

<details>
<summary>Click to expand manual setup steps</summary>

#### 1. Clone and install

```bash
git clone https://github.com/mhlscvk/mbse-tool.git
cd mbse-tool
pnpm install
```

#### 2. Start PostgreSQL via Docker

```bash
docker compose up -d
```

#### 3. Create environment files

**`packages/api-server/.env`**
```env
PORT=3003
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/systemodel
JWT_SECRET=<generate with: openssl rand -hex 32>
JWT_EXPIRES_IN=7d
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5173
ANTHROPIC_API_KEY=your-api-key-here
AI_MONTHLY_LIMIT=50
AI_ENCRYPTION_KEY=<generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
APP_URL=http://localhost:5173
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-gmail-app-password
SMTP_FROM="Systemodel" <noreply@systemodel.com>
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

**`packages/diagram-service/.env`**
```env
PORT=3002
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5173
```

**`packages/lsp-server/.env`**
```env
PORT=3001
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5173
```

**`packages/web-client/.env`**
```env
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

> **Note:** In development mode (`NODE_ENV !== 'production'`), email verification is skipped — new users are auto-verified on registration.

#### 4. Run database migration and seed

```bash
cd packages/api-server
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
cd ../..
```

The seed creates a system user, an admin account, and the Examples project with 79 SysML files across 9 subprojects (including 39 OMG standard library files). It is idempotent — safe to run multiple times.

</details>

---

## Running

### Development (all services)

```bash
pnpm run dev
```

This starts all services concurrently via Turborepo. Alternatively, start individually:

```bash
# Terminal 1 — API Server
cd packages/api-server && npx tsx src/index.ts

# Terminal 2 — Diagram Service
cd packages/diagram-service && npx tsx src/index.ts

# Terminal 3 — Web Client
cd packages/web-client && pnpm dev
```

Open **http://localhost:5173**

### Production

```bash
pnpm run build
node packages/api-server/dist/index.js &
node packages/diagram-service/dist/index.js &
cd packages/web-client && pnpm preview
```

---

## Restarting after machine reboot

```bash
docker compose up -d
pnpm run dev
```

## Stopping

```bash
# Stop dev server (Windows)
taskkill //F //IM node.exe

# Stop PostgreSQL
docker stop systemodel-db
```

---

## Production Deployment

The app is deployed at **https://systemodel.com** on a Hetzner VPS.

```
Internet → Nginx (port 80/443, SSL via Let's Encrypt)
              ├─ systemodel.com         → Vite static build (React SPA)
              ├─ systemodel.com/api/*   → api-server (port 3003)
              ├─ systemodel.com/lsp     → lsp-server WS (port 3001)
              └─ systemodel.com/diagram → diagram-service WS (port 3002)
```

### Deploy new changes

```bash
git push origin master
ssh root@<VPS_IP>
cd /opt/systemodel && git pull && pnpm install
cd packages/api-server && npx prisma generate && npx prisma migrate deploy && npx prisma db seed
cd /opt/systemodel && pnpm build
pm2 start ecosystem.config.cjs
bash scripts/health-check.sh
```

> **Notes:**
> - Always use `pm2 start ecosystem.config.cjs` (not `pm2 restart all`) to ensure correct `cwd` for dotenv.
> - The api-server build may exit with code 2 due to pre-existing TS warnings — JS files are still emitted.
> - If a migration fails with "column already exists", resolve it with: `npx prisma migrate resolve --applied <migration_name>`

### Examples Project

Example `.sysml` files are stored in `packages/api-server/prisma/examples/` as a directory tree (version-controlled). The seed script imports them on first run and skips existing subprojects on subsequent runs.

When an admin edits example files via the web UI, changes are automatically synced back to the `prisma/examples/` directory on disk. Admins can also force-reset all examples from disk via Settings > Admin > Sync Examples.

---

## Usage

1. **Register** an account (auto-verified in dev, email verification in production)
2. **Sign in** with email/password or **Google Sign-In**
3. **Create a project** from the projects page
4. **Create a `.sysml` file** or **upload existing `.sysml` files** (button or drag & drop)
5. **Edit** — the diagram updates live as you type
6. **AI Chat** — click the AI button in the toolbar to chat with AI (free tier or your own API key)
7. **MCP Connection** — go to Settings to connect external AI clients (Claude Desktop, Cursor, VS Code)

---

## Diagram Interaction

### Multi-Select & Batch Hide

- **Shift+drag** on the diagram background draws a rubber-band selection rectangle
- **Ctrl/Cmd+click** on individual nodes to add/remove from the selection
- **Click** on the background to clear all selection
- **Right-click** on any selected element (or the background while items are selected) to show "Hide N selected items"
- Selected nodes and their connecting edges highlight in yellow
- Edges between selected nodes are auto-selected

### Saved Views

- In the **Views** tab of the Element Panel, save the current visibility state as a named view
- **Load** restores a saved view's visibility settings
- **Update** overwrites a saved view with the current state (shows brief "Updated" confirmation)
- **Rename** or **Delete** views as needed
- **Show All (reset)** restores full visibility

### Standard Views (per OMG SysML v2.0 spec Section 9.2.20)

| View | Short | What it shows | Hides |
|---|---|---|---|
| **General View** | GV | Everything: defs, usages, all edges | Nothing (default) |
| **Interconnection View** | IV | Parts, ports (boundary nodes), connections, interfaces, flows | Defs (standalone), actions, states, successions |
| **Action Flow View** | AFV | Actions, cases, use cases, parameters, control nodes, successions, flows | Parts, structural defs, orphan nodes with no connections |
| **State Transition View** | STV | States, transitions, entry/do/exit | Actions, parts, ports, orphan nodes with no connections |
| **Sequence View** | SEQ | Lifelines (parts) with containment groups, messages (sync/async/flow), activation bars, SD frame | Non-message elements |
| **Grid View** | GRD | Relationship matrix (satisfy, verify, allocate, flow) | N/A (tabular) |
| **Browser View** | BRW | Hierarchical tree of all model elements | N/A (tree) |
| **Geometry View** | GEO | 3D spatial visualization (placeholder) | N/A |

- **View selector** — toolbar buttons `[ GV | IV | AFV | STV | SEQ | GRD | BRW | GEO ]` switch between standard views
- **Port boundary rendering** — port usages render as small squares on part boundaries in IV and AFV, with directional arrows (in=inward green, out=outward orange, inout/none=horizontal line)
- **Action parameter rendering** — in/out/inout items on action usages render as small boundary squares in AFV only
- **Orphan removal** — nodes with no connections to other visible content are hidden in AFV and STV
- **IV is always nested** — per spec 8.2.3.11, IV uses compound layout (no tree option)
- **Dynamic legend** — shows only relevant node/edge types per active view

### Layout Modes

- **Nested View** (default) — compound ELK layout with visual nesting (packages as containers, composition as containment)
- **Tree View** — flat BDD-style layout with all edges visible and ELK orthogonal edge routing
- **Fit** button auto-fits all visible elements to the viewport

---

## SysML v2.0 Language Support

### Supported Constructs

**Core definitions & usages:**
`part`, `attribute`, `connection`, `port`, `action`, `state`, `item`

**Extended definitions & usages:**
`requirement`, `constraint`, `interface`, `enum`, `calc`, `allocation`, `case` (def + usage), `use case` (def + usage), `analysis case` (def + usage), `verification case` (def + usage), `concern`, `view`, `viewpoint`, `rendering`, `metadata`, `flow`, `occurrence`, `individual` (with `isIndividual` flag), `snapshot`, `timeslice` (portionKind)

**Action subtypes (P1):**
`send ... to`, `accept`, `if { }`, `assign := `, `while loop`, `for ... in`, `include use case`, `assert constraint`, `event occurrence`, `message of X from A to B`

**Membership types (P3):**
`subject`, `actor`, `stakeholder`, `objective`, `expose`, `render`

**Connector/port specializations (P2):**
`port def X conjugates Y` (ConjugatedPortDefinition with conjugation edges)

**Specialization operators:**

| Operator | Keyword | Meaning |
|---|---|---|
| `:>` | `specializes` | Subclassification (on definitions) — inherits all features |
| `:>` | `subsets` | Subsetting (on usages) — feature chain targets supported (`parents.siblings`) |
| `:>>` | `redefines` | Redefinition — feature chain targets supported |
| `::>` | `references` | Reference subsetting |
| `=>` | `crosses` | Crossing — cross-feature relationship |
| `:` | `defined by` | Typing |

**Inherited & derived features:**
- Inherited features shown with `^` prefix in compartments (toggle via "Inherited" button)
- Derived features shown with `/` prefix (`derived attribute speed : Real`)
- `ref` features use noncomposite membership (open diamond per spec)

**Behavioral / Action flow:**
- `first start;` / `then terminate;` — start and terminate nodes (filled circle / X-circle), scoped per container
- `fork` / `join` — thick horizontal bar nodes
- `merge` / `decide` — diamond nodes
- `then X;` — succession from previous declaration to X (open arrowhead)
- `then fork fork1;` / `then decide decision1;` — combined declaration + succession
- `first X then Y;` — explicit succession
- `if guard then action;` — conditional succession with `[guard]` label (guard must be Boolean — warns if not)
- `if guard then action1; else action2;` — conditional with else branch, creates `[guard]` and `[else]` edges
- Dotted guard expressions: `if obj.prop.isActive then ...`
- `perform action X { ... }` — creates `«perform»` container node with nested flow elements
- `exhibit state X { ... }` — creates `«exhibit»` container node with nested flow elements
- Each action container (`action def`, `action`, `perform action`, `action : Type`) gets its own scoped `start`, `terminate`, and control nodes — same names in different containers are separate elements
- Succession (open arrowhead) is distinct from flow (filled arrowhead) per SysML v2 spec
- Orthogonal edge routing in nested view — all relationship lines use right-angle paths

**State machines (per OMG SysML v2.0 spec Section 7.18):**
- `state def Name { ... }` / `state def Name parallel { ... }` — state definitions with optional `parallel` keyword
- Sub-states: `state off;`, `state starting;`, `state on;` nested inside state defs/usages
- `entry action name;` / `entry;` / `do action name;` / `exit action name;` — state behaviors shown in compartment
- `entry; then off;` — initial state succession from entry action to first state (start → off)
- `first X;` inside state def — marks initial state (creates start → X succession)
- Named transitions: `transition t1 first source accept TriggerName if guard do effect then target;`
- Anonymous transitions: `transition first source accept Trigger then target;`
- Shorthand transitions (per spec 7.18.3): `accept TriggerName then target;` — source inferred from lexically previous state
- `accept Trigger via portName then target;` — receiver port syntax
- `accept after 5[min] then target;` — timed trigger syntax
- Block-form transitions: `transition t1 { first source; accept Trigger; then target; }`
- Transition edges use filled arrowheads (distinct from succession open arrowheads)
- Fork/join/merge/decide control nodes work inside state defs

**Relationships:**
- `satisfy` / `verify` / `allocate` / `bind`
- `connect X to Y` / `flow from X to Y`

**Packages & Namespaces (per spec Section 7.2):**
- `package Name { ... }` / `package 'Quoted Name' { ... }` — namespace containers
- `public import ISQ::TorqueValue;` / `private import ScalarValues::*;` — visibility-prefixed imports
- `alias Car for Automobile;` / `alias Torque for ISQ::TorqueValue;` — alias declarations
- Single-quoted names supported everywhere: `part def 'My Vehicle';`, `part 'my car' : Vehicle;`
- Multi-level qualified names: `ISQ::TorqueValue`, `Pkg::SubPkg::Type`

**Other supported syntax:**
- `abstract` keyword on definitions
- `derived` keyword on usages (prefixed with `/` in compartments)
- `ref` keyword for referential parts/items (noncomposite/open diamond membership)
- `in` / `out` / `inout` directed features
- Feature chains: `item x :> parents.siblings.children` (dot-separated targets for subsetting/redefinition)
- `comment Comment1 /* body */` — named comment (folded-corner note shape)
- `comment about Target /* body */` — annotation with `«annotate»` dashed edge
- `/* block comment */` — anonymous comment element (visible in diagram)
- `// line note` — stripped (not part of model)
- `import Pkg::*` / `import Pkg::Type`
- Multiplicity: `[4]`, `[1..*]`, `[*]` (shown in compartments)
- Enum values, `subject` inside requirements, `doc` strings
- Qualified type names: `Pkg::SubPkg::TypeName`
- Standard libraries: ScalarValues, ISQBase, ISQ, SI, Quantities (67 types)

### Graphical Notation (OMG SysML v2.0 Compliant)

Node shapes per Section 8.2.3 of the spec:

| Element | Definition Shape | Usage Shape |
|---|---|---|
| Part, Attribute, Item, Port, Connection, Interface, Allocation, Calc, Enum, Requirement, View, Viewpoint, Rendering, Metadata | Square-corner rectangle | Rounded-corner rectangle |
| State | Square-corner rectangle | Rounded-corner rectangle |
| Package | Tab-rectangle | Tab-rectangle |
| Comment | Folded-corner note (yellow) | — |
| Send Action | — | Convex pentagon (arrow → shape) |
| Accept Action | — | Concave pentagon (notched ← shape) |
| Perform Action | — | Rounded-corner rectangle (`«perform»`) |
| Exhibit State | — | Rounded-corner rectangle (`«exhibit»`) |
| Fork / Join | Thick horizontal bar | — |
| Merge / Decision | Diamond | — |
| Start | Filled circle (auto-created from `first start;`, scoped per container) | — |
| Done | Bull's-eye (filled circle in open circle) | — |
| Terminate | X-circle (auto-created from `then terminate;`, scoped per container) | — |

Edge styles per Section 8.2.3:

| Relationship | Line | Source | Target |
|---|---|---|---|
| Subclassification | Solid | — | Hollow triangle |
| Typing (defined by) | Dashed | — | Hollow triangle |
| Subsetting | Solid | — | Open arrow (>) |
| Redefinition | Solid | Vertical bar | Open arrow (>) |
| Ref subsetting | Solid | — | Open arrow (>) |
| Crossing | Solid | — | Open arrow (>) |
| Composition | Solid | Filled diamond | — |
| Noncomposite | Solid | Open diamond | — |
| Flow | Solid | — | Filled arrowhead |
| Succession | Solid | — | Open arrowhead |
| Transition | Solid | — | Filled arrowhead |
| Satisfy | Dashed | — | Open arrowhead |
| Verify | Dashed | — | Open arrowhead |
| Allocate | Dashed | — | Open arrowhead |
| Binding | Dashed | Open circle | Open circle |
| Conjugation | Dashed | — | Open arrow |
| Annotate | Dashed | — | — |

### Example SysML v2 Model

```sysml
package VehicleSystem {

  part def Vehicle {
    attribute mass : Real;
    part eng : Engine;
    part wheel[4] : Wheel;
    port fuelPort : FuelPort;
  }

  part def Engine {
    attribute horsepower : Real;
  }

  part def Wheel {
    attribute diameter : Real;
  }

  part def PoweredVehicle :> Vehicle {
    part frontWheel :> wheel;
  }

  part def SmallVehicle :> Vehicle {
    part smallEng :>> eng;
  }

  port def FuelPort {
    in item fuelIn : Fuel;
  }

  item def Fuel;

  requirement def MassRequirement {
    doc /* The vehicle mass shall not exceed 2000 kg. */
    subject vehicle : Vehicle;
  }

  enum def FuelKind {
    enum gasoline;
    enum diesel;
    enum electric;
  }

  action def ProvidePower {
    first start;
    then fork fork1;
    then generateTorque;
    then amplifyTorque;

    action generateTorque;
      then join1;
    action amplifyTorque;
      then join1;

    join join1;
    then decide checkOutput;
      if sufficient then deliver;
      if insufficient then retry;

    action deliver;
      then merge1;
    action retry;
      then merge1;

    merge merge1;
      then terminate;
  }
}
```

---

## Editor Features

- **Light theme** — clean light-theme UI across editor, diagram, element panel, and all views
- **Syntax highlighting** for all SysML v2 keywords
- **Real-time diagnostics** with Levenshtein-based fix suggestions
- **Click any diagram node or edge** to jump to its source in the editor
- **Problems panel** — click the status bar error/warning count
- **Auto-save** — debounced 1.5s after each edit

### Element Panel

- **Nested tab**: step-by-step collapse/expand (one depth level per click)
- **By Kind tab**: elements grouped by type
- **Relations tab**: edge visibility toggles grouped by relationship type
- **Views tab**: save, load, update, rename, and delete named visibility presets
- Show all / Hide all / per-element toggle checkboxes

### AI Chat (Hybrid)

- **Free tier** — 50 messages/month using Claude Haiku (server-side key, no setup needed)
- **Own key** — unlimited, any model (Claude Sonnet/Opus, GPT-4o, Gemini) — key encrypted with AES-256-GCM, stored server-side
- Multi-provider: Anthropic, OpenAI, Google Gemini
- Streaming responses with tool call visualization
- AI can read, edit, create, delete, and search SysML files via tools

### MCP Server

External AI clients (Claude Desktop, Cursor, VS Code, Windsurf) connect to systemodel via the Model Context Protocol.

- **Endpoint:** `/mcp` (Streamable HTTP transport)
- **Auth:** JWT or long-lived MCP access tokens (created in Settings)
- **8 tools:** list_projects, list_files, read_file, create_file, update_file, apply_edit, delete_file, search_files
- **3 prompts:** review-sysml, explain-element, generate-sysml
- **Resources:** SysML v2 syntax reference, dynamic file resources (subscribable)
- **Real-time:** file change notifications pushed to connected MCP clients

### Training Mode

Interactive 22-level tutorial building a Vehicle model from scratch:
1. Part Definitions — 6. Composition
7. Ports — 9. Enumerations
10. Actions — 11. States
12. Requirements — 13. Constraints & Calculations
14. Packages & Imports — 15. Advanced Concepts
16. Flows & Messages — 17. Perform & Exhibit
18. Comments & Documentation — 19. Conjugated Ports & Interfaces
20. Conditional Guards & Control Flow
21. Occurrences & Events — 22. Individual, Snapshot & Timeslice

---

## Security

### Implemented

- **Helmet.js** security headers on all HTTP services (API server + LSP server)
- **Content Security Policy** — strict CSP directives (default-src 'self', script/connect/frame allowlists)
- **HSTS** — Strict-Transport-Security with preload, 1-year max-age
- **CORS** origin allowlisting with validation on API server, diagram service, and LSP server
- **WebSocket CSRF protection** — `verifyClient` origin validation on both LSP and Diagram WebSocket servers
- **MCP CORS** — restricted to allowed origins; desktop apps (no Origin header) permitted
- **Rate limiting** on auth (10/15min), registration (5/hr), forgot/reset password (10/15min), API (100/min), AI chat (20/min), MCP (200/min)
- **JWT HS256** with explicit algorithm enforcement to prevent algorithm confusion attacks
- **Timing-safe login** — bcrypt always runs even for non-existent users
- **Email enumeration prevention** — /register returns identical response for existing/new accounts
- **File name enforcement** — `.sysml` extension enforced server-side (all extensions stripped, `.sysml` appended), path separators and null bytes stripped, length limited to 255
- **Email normalization** — lowercase + trim before lookup
- **Input validation** — Zod schemas on all routes; validation errors return 400 (not 500)
- **Content size limits** — 100KB default JSON body, 10MB for file content, 2MB for AI requests
- **WebSocket hardening** — 10MB max payload, per-IP connection limits (10 LSP / 20 Diagram), global connection cap (50 LSP), per-connection message rate limiting (120/min), buffer accumulation cap (50MB), Content-Length validation, input type validation, sanitized error messages
- **Parser size limit** — 2MB max source input to prevent DoS via parsing
- **ELK recursion depth limit** — max 50 levels to prevent stack overflow on deeply nested models
- **Edit distance cap** — O(min(m,n)) space with 100-char string length limit to prevent memory exhaustion
- **Cached tree traversals** — ancestor/descendant lookups memoized per layout to avoid O(n²) routing
- **HTTPS enforcement** in production with x-forwarded-proto redirect
- **Error sanitization** — internal error details (Prisma, stack traces, file paths) never leaked in any environment
- **AI key encryption** — AES-256-GCM with per-key IV, stored encrypted in DB, never returned after initial save
- **MCP session limits** — max 5 sessions/user, 500 total, 24h TTL with cleanup
- **SSE token isolation** — SSE endpoints use purpose-limited 60-second JWTs (not full session tokens) to prevent token exposure in query strings
- **Prisma transaction** on concurrent file edits (TOCTOU prevention)
- **Trust proxy** — `app.set('trust proxy', 1)` in production so `req.ip` reflects real client IP behind Nginx, enabling correct rate-limit keying
- **Graceful shutdown** — Prisma disconnect on SIGTERM/SIGINT
- **IDOR protection** — all resource endpoints enforce ownership checks; 404 returned for unauthorized access (no information leakage)
- **Admin project visibility** — admins no longer see other users' personal projects in the normal project listing; cross-user visibility is restricted to read-only admin endpoints (Settings > Admin)
- **SysML file naming** — `.sysml` extension enforced server-side on create and rename; root package declaration auto-updated on rename

### Security Checklist for Production

- [ ] Generate a strong JWT secret: `openssl rand -hex 32`
- [ ] Use unique database credentials (not default `password`)
- [ ] Store secrets via environment injection (not `.env` files in deployment)
- [ ] Generate AI_ENCRYPTION_KEY: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- [ ] Use `wss://` and `https://` for all service URLs
- [ ] Set `ALLOWED_ORIGINS` to your production domain only
- [ ] Configure `trust proxy` if behind a reverse proxy

---

## Features

### Implemented
- [x] Full SysML v2.0 parser (95 node kinds, 100% spec metaclass coverage — 93/93 from OMG SysML v2.0 XMI)
- [x] Action flow diagrams (start, terminate, fork, join, merge, decide, successions, guards)
- [x] State machine diagrams (state defs, sub-states, transitions, typed entry/exit/do with compartment display, parallel, shorthand transitions)
- [x] PerformActionUsage (`«perform»`) and ExhibitStateUsage (`«exhibit»`) as nested child nodes with compartment display
- [x] Entry/do/exit as compartment text in GV + graphical nodes (`<<entry action>>`, `<<do action>>`, `<<exit action>>`) in STV
- [x] ELK-computed orthogonal edge routing for transitions inside state machine containers (all view modes)
- [x] Edge label placement with candidate-based collision avoidance (perpendicular offsets, node obstacle detection, deterministic greedy placement)
- [x] STV start circle replaced by entry action node when entry action exists
- [x] Scoped containment — each action/state container gets its own start/terminate/control nodes
- [x] Boolean guard validation — `if` conditions checked for Boolean type with diagnostics
- [x] If-then-else parsing with dotted guard expressions (`obj.prop.isActive`)
- [x] OMG-compliant graphical notation per spec 8.2.3 (send pentagon, accept pentagon, use case ellipse, requirement icon, decision diamond, ref dashed, ^inherited prefix, dashed dependency edges)
- [x] Orthogonal edge routing in nested view — right-angle paths with obstacle avoidance
- [x] Nested containment view with ELK compound layout
- [x] Occurrence subtypes: `individual def/usage`, `snapshot`, `timeslice` with `isIndividual`/`portionKind` fields
- [x] Sequence View with SD frame, containment groups, activation bars, message types (sync/async/flow/return), right-click Go to Code
- [x] All 8 SysML v2 Standard Views per spec 9.2.20: GV, IV, AFV, STV, SEQ (lifeline/message SVG), GRD (relationship matrix), BRW (hierarchical tree), GEO (placeholder)
- [x] Tree view (flat BDD) with ELK orthogonal edge routing
- [x] Monaco editor with SysML syntax highlighting and diagnostics
- [x] Element panel with step-by-step collapse, visibility toggles, saved views
- [x] Multi-select (shift+drag rubber-band, ctrl+click) with batch hide via right-click
- [x] Edge click navigation to source code
- [x] .sysml file upload (button + drag & drop)
- [x] AI Chat: hybrid free tier (Haiku) + own-key unlimited (Claude/GPT/Gemini), encrypted key storage
- [x] MCP Server: 8 tools, 3 prompts, real-time subscriptions, Streamable HTTP transport
- [x] MCP access tokens: long-lived, revocable, per-client config generator
- [x] MCP Desktop integration: Claude Desktop edits trigger real-time diff highlighting, undo/redo, accept/revert in web UI via SSE events with source tracking
- [x] User auth: email/password + Google OAuth + email verification + forgot password (email reset link)
- [x] Settings page with tabbed layout (Account / AI Provider / MCP / Enterprises / Admin / Bug Reports), password change form
- [x] Admin panel: sync Examples from disk, read-only cross-user visibility (all users, personal projects, file content viewer) in Settings > Admin
- [x] Security hardening: helmet, CSP, HSTS, rate limiting, HTTPS, Zod validation, WebSocket CSRF/limits, error sanitization
- [x] Security audit: 36 live penetration tests (SQL/NoSQL injection, XSS, IDOR, JWT forgery, CORS, WebSocket CSRF, path traversal, ReDoS, rate limiting, header injection, prototype pollution, verb tampering)
- [x] Light theme with consistent cursor visibility (three-layer black cursor fix for Monaco editor)
- [x] Recent files navigation (header dropdown, last 10 files, localStorage persist) and quick file switcher in editor
- [x] Automated tests: 863 vitest tests across 36 suites (parser, transformer, view filters, WebSocket, state machines, robustness, security, audit, theme store, recent files, sysml helpers, cursor fix, line diff, MCP events, AI tools, encryption, providers, ID generator, startup ops, element locks, notifications, startup invitations, admin routes, edge label placement, label overlap resolution, OMG vehicle model validation)
- [x] Project and file CRUD with auto-save, rename, download, delete (context menu)
- [x] Nested projects (3-level hierarchy with collapsible tree)
- [x] System "Examples" project (read-only for users, admin-editable with auto-sync to disk, 76 files across 9 subprojects including 39 OMG standard library files)
- [x] Admin can edit/create/delete files in system projects; changes sync to `prisma/examples/` on disk
- [x] "Copy to My Project" for example files (right-click context menu)
- [x] Automated local setup script (`pnpm run local-setup`) — Docker, deps, env, migrations, seed in one command
- [x] Single-quoted names, alias declarations, visibility-prefixed imports, `ref` keyword
- [x] Comment declarations (`comment`, `doc`, `/* */`), folded-corner note shape, `«annotate»` edges
- [x] Legend toggle (show/hide via Relations tab checkbox)
- [x] Training mode (22 levels, 133 tasks — part defs through individual/snapshot/timeslice)
- [x] OMG standard libraries integrated: Systems Library (16 files), Quantities & Units (9 files, ISQ/SI), 6 Domain Libraries (14 files)
- [x] TypeScript types auto-generated from OMG JSON Schema (ptc/25-04-32): 175 metaclasses, 7 enum types
- [x] Official OMG SimpleVehicleModel (ptc/25-04-31) used as parser validation fixture (557 nodes, 805 connections, 0 errors)
- [x] Typed redefines (`part x : Type redefines y`), unnamed redefines (`part redefines x[4]`), post-type multiplicity
- [x] Conjugated ports (`port p : ~PortDef`), conjugated port definitions (`port def X conjugates Y`), binding connections (open circle markers)
- [x] Succession flow, message, and flow payload edges (`succession flow`, `message of Payload`)
- [x] Port usages as boundary squares on parts in IV + AFV (in=green inward, out=orange outward, inout/none=horizontal line)
- [x] Action parameters (in/out/inout items) as boundary squares on action usages in AFV only
- [x] Port/action definitions render as nested containers (not boundary squares)
- [x] File naming enforcement: `.sysml` extension auto-appended, wrong extensions stripped, root package name auto-updated on rename
- [x] Admin read-only cross-user visibility: Settings > Admin shows all users, their personal projects, and file contents (view-only, no edit/delete)
- [x] Pre-commit hook runs all test suites (api-server, diagram-service, web-client) before allowing commit
- [x] Orphan node removal in AFV and STV (iterative control node chain pruning)
- [x] Use case, analysis case, verification case usage parsing and rendering
- [x] Inherited features display with `^` prefix (toggle via "Inherited" button), multi-level and diamond inheritance, redefined exclusion
- [x] Derived features with `/` prefix (`derived attribute speed : Real`)
- [x] Noncomposite feature membership (open diamond for `ref` features per spec)
- [x] Crossing operator (`=>` / `crosses`) parsing and rendering
- [x] Feature chains with dot notation (`item x :> parents.siblings.children`)
- [x] Full directed item keywords (`«in item»`, `«out item»` instead of abbreviated `«in»`, `«out»`)
- [x] Default editor/diagram split 35/65 for better diagram visibility
- [x] Production deployment (Nginx, SSL, PM2, Hetzner VPS)

**Project Structure & Access Control:**
- [x] Three project types: System (read-only), Startup (enterprise, team-isolated), User (personal)
- [x] Startup (Enterprise) model with member management (CRUD, role assignment)
- [x] Startup roles: Site Admin (global), Startup Admin (per-startup), Startup User (member)
- [x] Startup isolation: users only see projects from their own startups
- [x] Custom display IDs for all entities (PRJ-ENT-NUMERIC-X4P72, FIL-8D21K, ELM-54PQ9, NTF-99321)
- [x] Element-level check-out/check-in (not file-level locking)
- [x] Lock request notification system (request lock holder to release)
- [x] Audit logging for all check-out/check-in operations
- [x] Force check-in for admins (Site Admin / Startup Admin)

### Planned
- [ ] LSP autocompletion (syside-languageserver integration)
- [ ] Sequence and Activity diagram types
- [ ] Payment and subscription tiers (Stripe)
- [ ] Export to PDF/image
- [ ] Multi-user real-time collaboration (WebSocket-based)
- [ ] Element lock status display in diagram UI (available/checked-out/read-only indicators)

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Editor | Monaco Editor |
| Diagram | Custom SVG renderer + elkjs (Eclipse Layout Kernel) |
| AI Chat | Anthropic, OpenAI, Google Gemini (multi-provider, AES-256-GCM encrypted keys) |
| MCP | @modelcontextprotocol/sdk (Streamable HTTP) |
| Backend | Node.js, Express, tsx |
| Security | Helmet, CSP, HSTS, express-rate-limit, bcrypt, Zod, WebSocket origin validation |
| Auth | JWT + bcrypt + email verification + Google OAuth |
| Database | PostgreSQL 16 + Prisma ORM |
| Email | Nodemailer (Gmail SMTP) |
| Deployment | Nginx, Let's Encrypt SSL, PM2, Hetzner VPS |
| Monorepo | pnpm workspaces + Turborepo |
| Testing | Vitest (863 unit tests across 27 suites) + 36 live penetration tests |

---

## Testing

```bash
# Run all tests
pnpm --filter @systemodel/api-server test
pnpm --filter @systemodel/diagram-service test

# Watch mode
cd packages/diagram-service && pnpm test:watch
```

**Coverage:** 863 tests across 27 test suites:

**Diagram Service** (477 tests across 13 suites):
- **Parser tests** (109): core/extended definitions, usages, specialization operators, packages, imports, action flow, control nodes, relationships, directed features, diagnostics, perform/exhibit containment, scoped start/terminate, boolean guard validation, if-then-else, same-named elements in multiple containers, derived features, noncomposite membership, crossing operator, feature chains, use case/analysis case/verification case usages
- **Parser new features tests** (32): conjugated ports, binding connections, succession flow, message payloads, port boundary rendering, action parameter rendering, feature chains
- **Parser state tests** (55): state definitions/usages, entry/exit/do behaviors, initial states, named/anonymous/block/shorthand transitions, accept via/timed triggers, parallel keyword, exhibit state, control nodes in state defs, complete state machine scenarios, spec examples (OnOff1, OnOff5, VehicleStates)
- **Parser audit tests** (34): ReDoS resistance, isParallel false positive prevention, connection dedup correctness, shorthand transitions in state usages, entry/exit/do edge cases, transition components, entry-then succession, no-duplicate-edge verification, regression (action flow, parts, packages, imports, relationships), performance benchmarks
- **Parser robustness tests** (53): empty/minimal inputs, malformed syntax, special characters, large inputs, comment edge cases, imports, diagnostic quality, source ranges, connection edge cases, rapid parsing, input size limits, control flow
- **Parser security tests** (13): XSS vectors, DoS resistance, path traversal, input type safety, error message sanitization
- **Transformer tests** (32): node shapes, keyword display, graphical children behavior, edges, empty inputs, AFV pin cloning from defs into usages, flow retargeting to pins, compartment hiding
- **Transformer new features tests** (29): abstract keyword, analysis/verification keywords, directed item full keywords, state def shape, entry/do/exit graphical nodes, state behavior compartments, succession flow/message edges, use case shape, ref dashed border, inherited features (basic, multi-level, diamond, redefined exclusion, `^` prefix, `__inherited__` IDs), derived `/` prefix, port/action boundary rules
- **Transformer state tests** (17): state def/usage cssClasses, exhibit state, entry/exit/do compartment rendering, transition edge type, composition edges, full pipeline
- **Transformer audit tests** (16): sharp/rounded corner compliance, parallel kind text, behavior compartment rendering, transition vs succession edge types, node/edge structure integrity, full spec example pipelines
- **Transformer robustness tests** (23): empty/minimal models, node structure validation, labels, edge CSS classes, compartments, control nodes, performance, full pipeline integration
- **View filter tests** (47): GV pass-through, IV structural filtering, AFV behavioral filtering, STV state filtering, cross-view consistency, graph ID tagging, empty model handling, edge kind validation, applyViewFilter direct API, orphan removal (AFV/STV), control node chain pruning, package preservation, use case types in AFV, use case exclusion from STV
- **WebSocket server tests** (17): origin verification (accept/reject/empty/multi-origin/case-sensitive), viewType protocol (default/requested/invalid/filtering), empty content clear, rate limiting, security hardening (malformed JSON, error sanitization, invalid fields, oversized messages, concurrent connections)

**Web Client** (55 tests across 3 suites):
- **Theme store tests** (20): dark/light theme definitions, key completeness, toggle/setMode operations, invalid mode rejection, CSS color format validation, XSS vector scanning, security merge validation
- **Recent files store tests** (13): add/remove/clear operations, 10-entry cap, deduplication, CUID ID acceptance, path traversal rejection, XSS ID rejection, special character rejection
- **SysML helpers tests** (22): SysML text parsing utilities, element extraction, name resolution

**API Server** (200 tests across 13 suites):
- **AI encryption tests** (14): AES-256-GCM encrypt/decrypt round-trip, ciphertext tampering detection, IV uniqueness, key masking format, empty/special character handling
- **AI tools tests** (12): tool execution with mocked Prisma, access control enforcement, 10MB content size limits, file name sanitization, search query bounds, unknown tool handling
- **AI providers tests** (5): tool schema validation, required parameter enforcement across all providers
- **Auth middleware tests** (12): JWT verification, missing/malformed tokens, expired tokens, wrong secret, role extraction, requireAdmin enforcement
- **Error middleware tests** (4): ZodError → 400, AppError status propagation, 500+ error message sanitization, internal detail leakage prevention
- **CSRF middleware tests** (13): Content-Type enforcement for POST/PUT/PATCH/DELETE, DELETE-without-body passthrough, MCP endpoint exemption, text/event-stream allowance
- **ID generator tests** (16): display ID formats (PRJ/FIL/ELM/NTF), uniqueness verification, owner ref truncation, ambiguous character exclusion (I/O/0/1), startup ID sequencing
- **Startup ops tests** (23): startup CRUD, member add/update/remove, slug conflict detection, role-based access (SITE_ADMIN/STARTUP_ADMIN/STARTUP_USER), write access enforcement
- **Element lock ops tests** (18): check-out/check-in lifecycle, exclusive locking, same-user re-checkout rejection, cross-user lock blocking, force check-in, TOCTOU (P2002), file-project validation, element name sanitization, audit log creation, lock status queries
- **Notification ops tests** (15): lock request creation, holder/requester validation, self-notification prevention, cooldown dedup, project access check, list/filter notifications, mark read, mark all read, unread count
- **Startup invitations tests** (10): invitation CRUD, email-based invitations, role assignment, duplicate prevention, revocation
- **File ops tests** (42): sanitizeFileName (strip/truncate/empty), assertContentSize (limits, UTF-8), listFiles, getFile, readFileWithOwnerCheck (owner match/deny), createFile (sanitize, events, oversized), updateFileContent, renameFile, deleteFile, moveFile, applyEdit (mid-file edit, access denied, line/column range errors, empty file), searchFiles (case-insensitive, result cap, line truncation)
- **Auth helpers tests** (16): isAdmin (case-insensitive, undefined), assertProjectAccess (system/USER/STARTUP projects, owner/admin/member/non-member access, fallback), assertWriteAccess (NotFound/Forbidden/allowed)

---

## Project Links

- Live: https://systemodel.com
- Repository: https://github.com/mhlscvk/mbse-tool
- SysML v2.0 Specification: https://www.omg.org/spec/SysML/2.0
