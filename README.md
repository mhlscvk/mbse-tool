# Systemodel — SysML v2 Web Modeling Platform

A web-based SysML v2 code editor and visualization tool built as a modular monorepo.

---

## Architecture

```
systemodel/
├── packages/
│   ├── shared-types/      # Shared TypeScript interfaces
│   ├── diagram-service/   # SysML text parser → AST → diagram generator (port 3002)
│   ├── api-server/        # REST API: auth, projects, files, AI assistant (port 3003)
│   └── web-client/        # React frontend: Monaco editor + SVG diagram viewer (port 5173)
```

### Service Ports

| Service | URL | Protocol |
|---|---|---|
| Web Client | http://localhost:5173 | HTTP |
| API Server | http://localhost:3003 | HTTP/REST |
| Diagram Service | ws://localhost:3002/diagram | WebSocket |
| PostgreSQL | localhost:5432 | TCP |

---

## Prerequisites

- [Node.js](https://nodejs.org/) >= 20.10.0
- [pnpm](https://pnpm.io/) >= 9.x (`npm install -g pnpm`)
- [Docker](https://www.docker.com/) (for PostgreSQL)
- Anthropic API key (for AI Assistant feature)

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
JWT_SECRET=change-this-to-a-long-random-secret
JWT_EXPIRES_IN=7d
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5173
ANTHROPIC_API_KEY=your-api-key-here
```

**`packages/diagram-service/.env`**
```env
PORT=3002
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5173
```

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

### Start all backends

```bash
node packages/api-server/dist/index.js &
node packages/diagram-service/dist/index.js &
```

### Start the web client

```bash
cd packages/web-client
pnpm dev
```

Open **http://localhost:5173**

---

## Restarting after machine reboot

```bash
# Start the database container
docker start systemodel-db

# Start backends
node packages/api-server/dist/index.js &
node packages/diagram-service/dist/index.js &

# Start frontend
cd packages/web-client && pnpm dev
```

---

## Usage

1. **Register** an account at the login page
2. **Create a project** from the projects page
3. **Create a `.sysml` file** inside the project
4. **Edit** — the nested containment diagram updates live as you type
5. **AI Assistant** — click **✦ AI Assistant** in the toolbar to open Claude-powered suggestions

### Editor features

- Syntax highlighting for SysML v2 keywords
- Real-time diagnostics with quick-fix suggestions (Levenshtein-based)
- Click any diagram node to jump to its source in the editor
- Problems panel (click the status bar error/warning count)

### General View — Nested Containment Diagram

The diagram displays all SysML v2 elements in a nested containment hierarchy using ELK compound layout:

- **Packages** rendered as SysML v2 tab-rectangle containers
- **Definitions** (part def, port def, action def, item def, etc.) shown as sharp-cornered blocks containing their children
- **Usages** (part, port, action, item, attribute, etc.) shown as rounded-corner blocks nested inside their owner
- **In/out/inout parameters** displayed as child blocks with direction badges
- All containment relationships derived from composition edges — every element appears nested inside its parent
- Supports qualified type names (e.g. `Pkg::SubPkg::TypeName`)

**Interaction:**
- Pan, zoom, drag nodes
- **Fit** button to auto-layout and fit all nodes in view
- **Elements panel** — toggle visibility of individual nodes or groups (nested and by-kind views)
- Right-click context menu to hide elements
- Click any node to jump to its source location in the editor
- ELK auto-layout re-runs when nodes are added/removed or sizes change

### AI Assistant

- Powered by Claude Opus 4.6 via Anthropic API
- Streams explanations and suggestions in real time
- Proposes precise line/column edits with a diff preview
- **Apply** button patches the Monaco editor directly
- Requires `ANTHROPIC_API_KEY` in `packages/api-server/.env`

### Example SysML v2 model

```sysml
package VehicleModel {

  item def Fuel;

  port def FuelPort {
    in item fuelIn : Fuel;
  }

  part def Engine {
    port fuelPort : FuelPort;
    action deliver : Drive;
  }

  action def Drive {
    in item throttle : Fuel;
    out item speed : Fuel;
  }

  part def Vehicle {
    part engine : Engine;
    attribute mass : Real = 1500;
  }

  part vehicle : Vehicle;
}
```

---

## Features

### Implemented
- [x] User registration and login (JWT + bcrypt)
- [x] Project and file management (CRUD)
- [x] SysML v2 code editor (Monaco) with syntax highlighting and auto-indent
- [x] Real-time diagnostics with Levenshtein fix suggestions
- [x] SysML v2 parser: all definition and usage types, `in`/`out`/`inout` parameters, qualified type names (`Pkg::Type`)
- [x] Parser supports nested definitions, nested usages, and items inside any definition type
- [x] Live nested containment diagram with ELK compound layout
- [x] SysML v2 graphical notation (tab-rectangle packages, sharp-corner defs, rounded usages)
- [x] All elements displayed in nested hierarchy: definitions retain children, usages nested under owners
- [x] ELK auto-layout (re-runs on node/edge/size changes)
- [x] SVG diagram: pan, zoom, drag nodes
- [x] Element panel: nested view, by-kind grouping, alphabetical sort, real-time visibility toggles
- [x] Standard library nodes shown when referenced
- [x] AI Assistant: Claude Opus 4.6, SSE streaming, propose_edit tool, Apply button
- [x] localStorage persistence for all UI state
- [x] Node click → editor navigation
- [x] PrismaClient singleton — single shared DB connection pool across all routes
- [x] Authorization enforced on all project PATCH/DELETE mutations (ownerId in WHERE clause)
- [x] React memory: timer, drag, and resize listeners cleaned up on component unmount

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
| Diagram renderer | Custom SVG renderer |
| Layout engine | elkjs (Eclipse Layout Kernel) |
| AI | Anthropic Claude API (@anthropic-ai/sdk) |
| Backend API | Node.js, Express |
| Database ORM | Prisma |
| Database | PostgreSQL 16 |
| Auth | JWT + bcrypt |
| Monorepo | pnpm workspaces + Turborepo |

---

## Project Links

- Repository: https://github.com/mhlscvk/mbse-tool
- SysML v2 Specification: https://github.com/Systems-Modeling/SysML-v2-Release
