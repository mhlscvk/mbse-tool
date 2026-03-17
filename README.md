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
│   ├── api-server/        # REST API: auth, projects, files, AI assistant (port 3003)
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
| PostgreSQL | localhost:5432 | TCP |

---

## Prerequisites

- [Node.js](https://nodejs.org/) >= 20.10.0
- [pnpm](https://pnpm.io/) >= 9.x (`npm install -g pnpm`)
- [Docker](https://www.docker.com/) (for PostgreSQL)
- Anthropic API key (for AI Assistant feature)
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
6. **AI Assistant** — click the AI button in the toolbar for Claude-powered suggestions

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
- `first start;` / `then terminate;` — start and terminate nodes (filled circle / X-circle)
- `fork` / `join` — thick horizontal bar nodes
- `merge` / `decide` — diamond nodes
- `then X;` — succession from previous declaration to X
- `then fork fork1;` / `then decide decision1;` — combined declaration + succession
- `first X then Y;` — explicit succession
- `if guard then action;` — conditional succession with `[guard]` label
- `perform action` / `exhibit state` — shown in definition compartments
- All flows visible in nested view inside action/state definitions

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
| State | Rounded-corner rectangle | Rounded-corner rectangle |
| Package | Tab-rectangle | Tab-rectangle |
| Fork / Join | Thick horizontal bar | — |
| Merge / Decide | Diamond | — |
| Start | Filled circle (auto-created from `first start;`) | — |
| Terminate | X-circle (auto-created from `then terminate;`) | — |

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

### AI Assistant

- Powered by Claude Opus 4.6 via Anthropic API
- Streams explanations and suggestions in real time
- Proposes precise line/column edits with diff preview
- **Apply** button patches the Monaco editor directly

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
- **Rate limiting** on auth endpoints (10 attempts / 15 min), registration (5 / hour), and API routes (100 / min)
- **JWT HS256** with explicit algorithm enforcement to prevent algorithm confusion attacks
- **Timing-safe login** — bcrypt always runs even for non-existent users
- **File name sanitization** — path separators and null bytes stripped, length limited to 255
- **Email normalization** — lowercase + trim before lookup
- **Input validation** — Zod schemas on auth routes, file routes, and AI assistant requests
- **Content size limits** — 100KB default JSON body, 10MB for file content, 2MB for AI requests
- **WebSocket hardening** — 10MB max payload, per-IP connection limits, per-connection rate limiting, input type validation, sanitized error messages
- **Parser size limit** — 2MB max source input to prevent DoS via parsing
- **HTTPS enforcement** in production with x-forwarded-proto redirect
- **Error sanitization** — internal error details and stack traces hidden in production

### Security Checklist for Production

- [ ] Generate a strong JWT secret: `openssl rand -hex 32`
- [ ] Use unique database credentials (not default `password`)
- [ ] Store secrets via environment injection (not `.env` files in deployment)
- [ ] Use `wss://` and `https://` for all service URLs
- [ ] Set `ALLOWED_ORIGINS` to your production domain only
- [ ] Configure `trust proxy` if behind a reverse proxy

---

## Features

### Implemented
- [x] Full SysML v2.0 parser (30+ definition/usage types, all operators, action flow)
- [x] Action flow diagrams (start, terminate, fork, join, merge, decide, successions, guards)
- [x] OMG-compliant graphical notation (node shapes, edge styles per spec Section 8.2.3)
- [x] Nested containment view with ELK compound layout
- [x] Tree view (flat BDD) with ELK orthogonal edge routing
- [x] Monaco editor with SysML syntax highlighting and diagnostics
- [x] Element panel with step-by-step collapse, visibility toggles, saved views
- [x] Multi-select (shift+drag rubber-band, ctrl+click) with batch hide via right-click
- [x] Edge click navigation to source code
- [x] .sysml file upload (button + drag & drop)
- [x] AI Assistant (Claude Opus 4.6, streaming, propose_edit tool)
- [x] User auth: email/password + Google OAuth + email verification
- [x] Security hardening: helmet, rate limiting, HTTPS, Zod validation, WebSocket limits, error sanitization
- [x] Automated tests: 167 vitest tests (parser, transformer, robustness, security)
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
| AI | Anthropic Claude API (@anthropic-ai/sdk) |
| Backend | Node.js, Express, tsx |
| Security | Helmet, express-rate-limit, bcrypt, Zod |
| Auth | JWT + bcrypt + email verification + Google OAuth |
| Database | PostgreSQL 16 + Prisma ORM |
| Email | Nodemailer (Gmail SMTP) |
| Deployment | Nginx, Let's Encrypt SSL, PM2, Hetzner VPS |
| Monorepo | pnpm workspaces + Turborepo |
| Testing | Vitest (167 tests: parser, transformer, robustness, security) |

---

## Testing

```bash
# Run all tests
cd packages/diagram-service && pnpm test

# Watch mode
cd packages/diagram-service && pnpm test:watch
```

**Coverage:** 167 tests across 5 test suites:

- **Parser tests** (58): core/extended definitions, usages, specialization operators, packages, imports, action flow, control nodes, relationships, directed features, diagnostics
- **Parser robustness tests** (53): empty/minimal inputs, malformed syntax, special characters, large inputs, comment edge cases, imports, diagnostic quality, source ranges, connection edge cases, rapid parsing, input size limits, control flow
- **Parser security tests** (13): XSS vectors, DoS resistance, path traversal, input type safety, error message sanitization
- **Transformer tests** (20): node shapes, keyword display, compartments, edges, empty inputs
- **Transformer robustness tests** (23): empty/minimal models, node structure validation, labels, edge CSS classes, compartments, control nodes, performance, full pipeline integration

---

## Project Links

- Live: https://systemodel.com
- Repository: https://github.com/mhlscvk/mbse-tool
- SysML v2.0 Specification: https://www.omg.org/spec/SysML/2.0
