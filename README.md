# Systemodel — SysML v2 Web Modeling Platform

A web-based SysML v2 code editor and visualization tool built as a modular monorepo.

**Live:** [https://systemodel.com](https://systemodel.com)

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
- Google OAuth Client ID (for Google Sign-In)
- Gmail app password (for email verification)

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

## Production Deployment

The app is deployed at **https://systemodel.com** on a Hetzner VPS.

```
Internet → Nginx (port 80/443, SSL via Let's Encrypt)
              ├─ systemodel.com         → Vite static build (React SPA)
              ├─ systemodel.com/api/*    → api-server (port 3003)
              └─ systemodel.com/diagram  → diagram-service WS (port 3002)
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

1. **Register** an account — a verification email is sent
2. **Verify** your email by clicking the link
3. **Sign in** with email/password or **Google Sign-In**
4. **Create a project** from the projects page
5. **Create a `.sysml` file** inside the project
6. **Edit** — the diagram updates live as you type
7. **AI Assistant** — click **✦ AI Assistant** in the toolbar for Claude-powered suggestions

### Editor features

- Syntax highlighting for SysML v2 keywords
- Real-time diagnostics with quick-fix suggestions (Levenshtein-based)
- Click any diagram node to jump to its source in the editor
- Problems panel (click the status bar error/warning count)

### General View — Nested & Tree Views

Two switchable diagram views:

**Nested View** (default) — compound ELK layout with visual nesting:
- **Packages** rendered as SysML v2 tab-rectangle containers
- **Definitions** shown as sharp-cornered blocks containing their children
- **Usages** shown as rounded-corner blocks nested inside their owner
- Composition relationships expressed as visual nesting (no composition edges drawn)

**Tree View** — flat BDD-style layout:
- All nodes rendered as separate boxes (no nesting)
- All edges visible including composition (filled diamond markers)
- ELK orthogonal edge routing with proper bend points
- Definitions at top, usages below

**SysML v2 edge notation:**
- Specialization: solid line, hollow triangle at supertype
- Composition: solid line, filled diamond at owner (no arrowhead at target)
- Association: solid line, open arrowhead
- Flow: dashed line, open arrowhead
- Type reference: dashed line, open arrowhead

**Interaction:**
- Pan, zoom, drag nodes
- **Nested / Tree** toggle buttons to switch views
- **Fit** button to auto-layout and fit all nodes in view
- **Elements panel** — toggle visibility of individual nodes or groups
- **Relations panel** — view and toggle edge visibility
- Right-click context menu to hide elements
- Click any node to jump to its source location in the editor

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
- [x] User registration with email verification (nodemailer / Gmail SMTP)
- [x] Google OAuth Sign-In (Google Identity Services)
- [x] JWT authentication with bcrypt password hashing
- [x] Security hardening: helmet, rate limiting, HTTPS enforcement, timing-safe login
- [x] Project and file management (CRUD)
- [x] SysML v2 code editor (Monaco) with syntax highlighting and auto-indent
- [x] Real-time diagnostics with Levenshtein fix suggestions
- [x] SysML v2 parser: all definition and usage types, `in`/`out`/`inout` parameters, qualified type names
- [x] Parser supports nested definitions, nested usages, and items inside any definition type
- [x] Nested containment view with ELK compound layout
- [x] Tree view (flat BDD-style) with ELK orthogonal edge routing
- [x] SysML v2 graphical notation (correct edge markers, node shapes per spec)
- [x] Element panel: nested view, by-kind grouping, Relations tab, visibility toggles
- [x] AI Assistant: Claude Opus 4.6, SSE streaming, propose_edit tool, Apply button
- [x] localStorage persistence for all UI state (view mode, hidden elements, positions)
- [x] Production deployment with Nginx, SSL, PM2

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
| Security | Helmet, express-rate-limit, bcrypt |
| Auth | JWT + bcrypt + email verification + Google OAuth |
| Database ORM | Prisma |
| Database | PostgreSQL 16 |
| Email | Nodemailer (Gmail SMTP) |
| Deployment | Nginx, Let's Encrypt SSL, PM2, Hetzner VPS |
| Monorepo | pnpm workspaces + Turborepo |

---

## Project Links

- Live: https://systemodel.com
- Repository: https://github.com/mhlscvk/mbse-tool
- SysML v2 Specification: https://github.com/Systems-Modeling/SysML-v2-Release
