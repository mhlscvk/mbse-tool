# Systemodel — SysML v2 Web Modeling Platform

A web-based SysML v2 code editor and visualization tool built as a modular monorepo.

---

## Architecture

```
systemodel/
├── packages/
│   ├── shared-types/          # Shared TypeScript interfaces
│   ├── lsp-server/            # SysML v2 Language Server (WebSocket bridge)
│   ├── diagram-service/       # AST → Block Definition Diagram generator
│   ├── api-server/            # REST API: auth, projects, files
│   └── web-client/            # React frontend: Monaco editor + SVG diagram viewer
└── packages/sysml-language-server/   # Cloned externally (see Setup)
```

### Service Ports

| Service | URL | Protocol |
|---|---|---|
| Web Client | http://localhost:5173 | HTTP |
| API Server | http://localhost:3003 | HTTP/REST |
| LSP Server | ws://localhost:3001/lsp | WebSocket |
| Diagram Service | ws://localhost:3002/diagram | WebSocket |
| PostgreSQL | localhost:5432 | TCP |

---

## Prerequisites

- [Node.js](https://nodejs.org/) >= 20.10.0
- [pnpm](https://pnpm.io/) >= 9.x (`npm install -g pnpm`)
- [Docker](https://www.docker.com/) (for PostgreSQL)

---

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/mhlscvk/mbse-tool.git
cd mbse-tool
```

### 2. Clone the SysML v2 Language Server

```bash
git clone --depth=1 https://github.com/sensmetry/sysml-2ls.git packages/sysml-language-server
cd packages/sysml-language-server
pnpm install
cd ../..
```

### 3. Install monorepo dependencies

```bash
pnpm install
```

### 4. Start PostgreSQL via Docker

```bash
docker run -d \
  --name systemodel-db \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=systemodel \
  -e POSTGRES_USER=postgres \
  -p 5432:5432 \
  postgres:16
```

### 5. Create environment files

**`packages/api-server/.env`**
```env
PORT=3003
DATABASE_URL=postgresql://postgres:password@localhost:5432/systemodel
JWT_SECRET=change-this-to-a-long-random-secret
JWT_EXPIRES_IN=7d
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5173
```

**`packages/lsp-server/.env`**
```env
PORT=3001
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5173
```

**`packages/diagram-service/.env`**
```env
PORT=3002
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5173
```

### 6. Run database migration

```bash
cd packages/api-server
pnpm db:generate
pnpm db:migrate
cd ../..
```

### 7. Build backend packages

```bash
pnpm --filter @systemodel/shared-types run build
pnpm --filter @systemodel/api-server run build
pnpm --filter @systemodel/diagram-service run build
pnpm --filter @systemodel/lsp-server run build
```

---

## Running

### Start all backends

```bash
node packages/api-server/dist/index.js &
node packages/diagram-service/dist/index.js &
node packages/lsp-server/dist/index.js &
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
node packages/lsp-server/dist/index.js &

# Start frontend
cd packages/web-client && pnpm dev
```

---

## Usage

1. **Register** an account at the login page
2. **Create a project** from the projects page
3. **Create a `.sysml` file** inside the project
4. **Edit** — the Block Definition Diagram updates live as you type

### Example SysML v2 model

```sysml
package VehicleModel {

  part def Vehicle {
    part engine : Engine;
    part wheels : Wheel;
  }

  part def Engine {
    attribute power : Real;
    attribute type : String;
  }

  part def Wheel {
    attribute radius : Real;
  }

  connection def PowerTransfer {
    end vehicle : Vehicle;
    end engine : Engine;
  }
}
```

---

## Phase 1 Features

- [x] User registration and login (JWT)
- [x] Project and file management
- [x] SysML v2 code editor (Monaco) with syntax highlighting
- [x] Live Block Definition Diagram generation
- [x] Auto-layout via ELK (Eclipse Layout Kernel)
- [x] Diagram pan and zoom
- [x] Autosave (1.5s debounce)
- [x] SysML v2 Language Server bridge (WebSocket)

## Planned (Later Phases)

- [ ] LSP autocompletion and validation (Phase 2)
- [ ] Multiple diagram types: IBD, Sequence, Activity (Phase 2)
- [ ] AI/MCP integration (Phase 2)
- [ ] Payment and subscription tiers (Phase 2)
- [ ] Model correction and suggestions (Phase 2)
- [ ] Simulation capabilities (Phase 3)
- [ ] Multi-user collaboration (Phase 3)
- [ ] Export to PDF/image (Phase 2)

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Editor | Monaco Editor |
| Diagram renderer | Custom SVG (Sprotty-compatible model) |
| Layout engine | elkjs (Eclipse Layout Kernel) |
| Language server | syside-languageserver (Langium/SysML v2) |
| Backend API | Node.js, Express |
| Database ORM | Prisma |
| Database | PostgreSQL |
| Auth | JWT + bcrypt |
| Monorepo | pnpm workspaces + Turborepo |

---

## Project Links

- Repository: https://github.com/mhlscvk/mbse-tool
- SysML v2 Specification: https://github.com/Systems-Modeling/SysML-v2-Release
- Language Server (sysml-2ls): https://github.com/sensmetry/sysml-2ls
