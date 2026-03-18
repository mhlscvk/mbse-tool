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

### 1. Clone the repository

```bash
git clone https://github.com/mhlscvk/mbse-tool.git
cd mbse-tool
```

### 2. Install monorepo dependencies

```bash
pnpm install
```

### 3. Start PostgreSQL via Docker

```bash
docker run -d \
  --name systemodel-db \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=systemodel \
  -e POSTGRES_USER=postgres \
  -p 5432:5432 \
  postgres:16
```

### 4. Create environment files

**`packages/api-server/.env`**
```env
PORT=3003
DATABASE_URL=postgresql://postgres:password@localhost:5432/systemodel
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

**`packages/web-client/.env`**
```env
VITE_API_URL=http://localhost:3003/api
VITE_DIAGRAM_URL=ws://localhost:3002/diagram
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

> **Note:** In development mode (`NODE_ENV !== 'production'`), email verification is skipped — new users are auto-verified on registration.

### 5. Run database migration

```bash
cd packages/api-server
pnpm db:generate
pnpm db:migrate
cd ../..
```

### 6. Build all packages

```bash
pnpm run build
```

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
docker start systemodel-db
pnpm run dev
```

---

## Production Deployment

The app is deployed at **https://systemodel.com** on a Hetzner VPS.

```
Internet → Nginx (port 80/443, SSL via Let's Encrypt)
              ├─ systemodel.com         → Vite static build (React SPA)
              ├─ systemodel.com/api/*   → api-server (port 3003)
              └─ systemodel.com/diagram → diagram-service WS (port 3002)
```

### Deploy new changes

```bash
git push origin master
ssh root@<VPS_IP> "cd /opt/systemodel && git pull && pnpm install && \
  cd packages/api-server && npx prisma migrate deploy && npx prisma generate && \
  cd ../.. && pnpm run build && pm2 restart all"
```

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

### View Modes

- **Nested View** (default) — compound ELK layout with visual nesting (packages as containers, composition as containment)
- **Tree View** — flat BDD-style layout with all edges visible and ELK orthogonal edge routing
- **Fit** button auto-fits all visible elements to the viewport

---

## SysML v2.0 Language Support

### Supported Constructs

**Core definitions & usages:**
`part`, `attribute`, `connection`, `port`, `action`, `state`, `item`

**Extended definitions & usages:**
`requirement`, `constraint`, `interface`, `enum`, `calc`, `allocation`, `use case`, `analysis case`, `verification case`, `concern`, `view`, `viewpoint`, `rendering`, `metadata`, `occurrence`

**Specialization operators:**

| Operator | Keyword | Meaning |
|---|---|---|
| `:>` | `specializes` | Subclassification (on definitions) |
| `:>` | `subsets` | Subsetting (on usages) |
| `:>>` | `redefines` | Redefinition |
| `::>` | `references` | Reference subsetting |
| `:` | — | Typing (defined by) |

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

**Other supported syntax:**
- `abstract` keyword on definitions
- `ref` keyword for referential parts/items
- `in` / `out` / `inout` directed features
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
| Perform Action | — | Rounded-corner rectangle (`«perform»`) |
| Exhibit State | — | Rounded-corner rectangle (`«exhibit»`) |
| Fork / Join | Thick horizontal bar | — |
| Merge / Decide | Diamond | — |
| Start | Filled circle (auto-created from `first start;`, scoped per container) | — |
| Terminate | X-circle (auto-created from `then terminate;`, scoped per container) | — |

Edge styles per Section 8.2.3:

| Relationship | Line | Source | Target |
|---|---|---|---|
| Subclassification | Solid | — | Hollow triangle |
| Typing (defined by) | Dashed | — | Hollow triangle |
| Subsetting | Solid | — | Open arrow (>) |
| Redefinition | Solid | Vertical bar | Open arrow (>) |
| Ref subsetting | Solid | — | Open arrow (>) |
| Composition | Solid | Filled diamond | — |
| Flow | Solid | — | Filled arrowhead |
| Succession | Solid | — | Open arrowhead |
| Transition | Solid | — | Filled arrowhead |
| Satisfy | Dashed | — | Open arrowhead |
| Verify | Dashed | — | Open arrowhead |
| Allocate | Dashed | — | Open arrowhead |
| Binding | Dashed | — | — |

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

Interactive 7-level tutorial building a Vehicle model from scratch:
1. Part Definitions
2. Attributes
3. Specialization & Composition
4. Subsetting (`:>` on usages)
5. Redefinition (`:>>`)
6. Ports
7. Items

---

## Security

### Implemented

- **Helmet.js** security headers on all HTTP services
- **CORS** origin allowlisting with validation on API server, diagram service, and LSP server
- **Rate limiting** on auth (10/15min), registration (5/hr), API (100/min), AI chat (20/min), MCP (200/min)
- **JWT HS256** with explicit algorithm enforcement to prevent algorithm confusion attacks
- **Timing-safe login** — bcrypt always runs even for non-existent users
- **File name sanitization** — path separators and null bytes stripped, length limited to 255
- **Email normalization** — lowercase + trim before lookup
- **Input validation** — Zod schemas on auth routes, file routes, and AI assistant requests
- **Content size limits** — 100KB default JSON body, 10MB for file content, 2MB for AI requests
- **WebSocket hardening** — 10MB max payload, per-IP connection limits, per-connection rate limiting, input type validation, sanitized error messages
- **Parser size limit** — 2MB max source input to prevent DoS via parsing
- **ELK recursion depth limit** — max 50 levels to prevent stack overflow on deeply nested models
- **Edit distance cap** — O(min(m,n)) space with 100-char string length limit to prevent memory exhaustion
- **Cached tree traversals** — ancestor/descendant lookups memoized per layout to avoid O(n²) routing
- **HTTPS enforcement** in production with x-forwarded-proto redirect
- **Error sanitization** — internal error details and stack traces hidden in production
- **AI key encryption** — AES-256-GCM with per-key IV, stored encrypted in DB, never returned after initial save
- **MCP session limits** — max 5 sessions/user, 500 total, 24h TTL with cleanup
- **Prisma transaction** on concurrent file edits (TOCTOU prevention)
- **Graceful shutdown** — Prisma disconnect on SIGTERM/SIGINT

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
- [x] Full SysML v2.0 parser (30+ definition/usage types, all operators, action flow, state machines)
- [x] Action flow diagrams (start, terminate, fork, join, merge, decide, successions, guards)
- [x] State machine diagrams (state defs, sub-states, transitions, entry/exit/do, parallel, shorthand transitions)
- [x] PerformActionUsage (`«perform»`) and ExhibitStateUsage (`«exhibit»`) as distinct node kinds
- [x] Scoped containment — each action/state container gets its own start/terminate/control nodes
- [x] Boolean guard validation — `if` conditions checked for Boolean type with diagnostics
- [x] If-then-else parsing with dotted guard expressions (`obj.prop.isActive`)
- [x] OMG-compliant graphical notation (node shapes, edge styles per spec Section 8.2.3)
- [x] Orthogonal edge routing in nested view — right-angle paths with obstacle avoidance
- [x] Nested containment view with ELK compound layout
- [x] Tree view (flat BDD) with ELK orthogonal edge routing
- [x] Monaco editor with SysML syntax highlighting and diagnostics
- [x] Element panel with step-by-step collapse, visibility toggles, saved views
- [x] Multi-select (shift+drag rubber-band, ctrl+click) with batch hide via right-click
- [x] Edge click navigation to source code
- [x] .sysml file upload (button + drag & drop)
- [x] AI Chat: hybrid free tier (Haiku) + own-key unlimited (Claude/GPT/Gemini), encrypted key storage
- [x] MCP Server: 8 tools, 3 prompts, real-time subscriptions, Streamable HTTP transport
- [x] MCP access tokens: long-lived, revocable, per-client config generator
- [x] User auth: email/password + Google OAuth + email verification
- [x] Security hardening: helmet, rate limiting, HTTPS, Zod validation, WebSocket limits, error sanitization
- [x] Automated tests: 297 vitest tests (parser, transformer, state machines, robustness, security, audit)
- [x] Project and file CRUD with auto-save
- [x] Training mode (7 levels, progressive SysML v2 tutorial)
- [x] Standard library support (ScalarValues, ISQ, SI — 67 types)
- [x] Production deployment (Nginx, SSL, PM2, Hetzner VPS)

### Planned
- [ ] LSP autocompletion (syside-languageserver integration)
- [ ] Sequence and Activity diagram types
- [ ] Payment and subscription tiers (Stripe)
- [ ] User roles and access control
- [ ] Export to PDF/image
- [ ] Multi-user collaboration

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
| Security | Helmet, express-rate-limit, bcrypt, Zod |
| Auth | JWT + bcrypt + email verification + Google OAuth |
| Database | PostgreSQL 16 + Prisma ORM |
| Email | Nodemailer (Gmail SMTP) |
| Deployment | Nginx, Let's Encrypt SSL, PM2, Hetzner VPS |
| Monorepo | pnpm workspaces + Turborepo |
| Testing | Vitest (297 tests: parser, transformer, state machines, robustness, security, audit) |

---

## Testing

```bash
# Run all tests
cd packages/diagram-service && pnpm test

# Watch mode
cd packages/diagram-service && pnpm test:watch
```

**Coverage:** 297 tests across 9 test suites:

- **Parser tests** (66): core/extended definitions, usages, specialization operators, packages, imports, action flow, control nodes, relationships, directed features, diagnostics, perform/exhibit containment, scoped start/terminate, boolean guard validation, if-then-else, same-named elements in multiple containers
- **Parser state tests** (55): state definitions/usages, entry/exit/do behaviors, initial states, named/anonymous/block/shorthand transitions, accept via/timed triggers, parallel keyword, exhibit state, control nodes in state defs, complete state machine scenarios, spec examples (OnOff1, OnOff5, VehicleStates)
- **Parser audit tests** (34): ReDoS resistance, isParallel false positive prevention, connection dedup correctness, shorthand transitions in state usages, entry/exit/do edge cases, transition components, entry-then succession, no-duplicate-edge verification, regression (action flow, parts, packages, imports, relationships), performance benchmarks
- **Parser robustness tests** (53): empty/minimal inputs, malformed syntax, special characters, large inputs, comment edge cases, imports, diagnostic quality, source ranges, connection edge cases, rapid parsing, input size limits, control flow
- **Parser security tests** (13): XSS vectors, DoS resistance, path traversal, input type safety, error message sanitization
- **Transformer tests** (20): node shapes, keyword display, compartments, edges, empty inputs
- **Transformer state tests** (17): state def/usage cssClasses, exhibit state, entry/exit/do compartment rendering, transition edge type, composition edges, full pipeline
- **Transformer audit tests** (16): sharp/rounded corner compliance, parallel kind text, behavior compartment rendering, transition vs succession edge types, node/edge structure integrity, full spec example pipelines
- **Transformer robustness tests** (23): empty/minimal models, node structure validation, labels, edge CSS classes, compartments, control nodes, performance, full pipeline integration

---

## Project Links

- Live: https://systemodel.com
- Repository: https://github.com/mhlscvk/mbse-tool
- SysML v2.0 Specification: https://www.omg.org/spec/SysML/2.0
