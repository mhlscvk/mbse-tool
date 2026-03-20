#!/bin/bash
# Local development setup — run once after cloning the repo.
# Usage: pnpm setup  (or: bash scripts/setup.sh)
set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "=== Systemodel Local Setup ==="

# 1. Check prerequisites
echo ""
echo "[1/6] Checking prerequisites..."
for cmd in node pnpm docker; do
  if ! command -v $cmd &> /dev/null; then
    echo "ERROR: $cmd is not installed. Please install it first."
    exit 1
  fi
done
echo "  node $(node -v), pnpm $(pnpm -v), docker $(docker --version | grep -oP '\d+\.\d+\.\d+')"

# 2. Start PostgreSQL via Docker
echo ""
echo "[2/6] Starting PostgreSQL..."
if docker ps --format '{{.Names}}' | grep -q systemodel-db; then
  echo "  Already running."
else
  docker compose up -d
  echo "  Waiting for PostgreSQL to be ready..."
  for i in $(seq 1 30); do
    if docker exec systemodel-db pg_isready -U postgres &> /dev/null; then
      echo "  PostgreSQL ready."
      break
    fi
    if [ "$i" = "30" ]; then
      echo "ERROR: PostgreSQL did not start in time."
      exit 1
    fi
    sleep 1
  done
fi

# 3. Install dependencies
echo ""
echo "[3/6] Installing dependencies..."
pnpm install

# 4. Generate .env files if missing
echo ""
echo "[4/6] Checking .env files..."

if [ ! -f packages/api-server/.env ]; then
  echo "  Creating packages/api-server/.env..."
  AI_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
  cat > packages/api-server/.env <<EOF
PORT=3003
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/systemodel
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5173
AI_ENCRYPTION_KEY=$AI_KEY
ANTHROPIC_API_KEY=
AI_MONTHLY_LIMIT=50
GOOGLE_CLIENT_ID=
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM="Systemodel" <noreply@systemodel.com>
APP_URL=http://localhost:5173
EOF
else
  echo "  packages/api-server/.env exists."
fi

if [ ! -f packages/diagram-service/.env ]; then
  echo "  Creating packages/diagram-service/.env..."
  cat > packages/diagram-service/.env <<EOF
PORT=3002
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5173
EOF
else
  echo "  packages/diagram-service/.env exists."
fi

if [ ! -f packages/lsp-server/.env ]; then
  echo "  Creating packages/lsp-server/.env..."
  cat > packages/lsp-server/.env <<EOF
PORT=3001
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5173
EOF
else
  echo "  packages/lsp-server/.env exists."
fi

# 5. Generate Prisma client and run migrations
echo ""
echo "[5/6] Running database migrations..."
cd packages/api-server
npx prisma generate
npx prisma migrate deploy
cd "$ROOT_DIR"

# 6. Seed database (admin account + examples)
echo ""
echo "[6/6] Seeding database..."
cd packages/api-server
npx prisma db seed
cd "$ROOT_DIR"

echo ""
echo "=== Setup complete! ==="
echo ""
echo "Start the dev server with:  pnpm dev"
echo "Open in browser:            http://localhost:5173"
echo ""
echo "Services:"
echo "  Web Client       http://localhost:5173"
echo "  API Server        http://localhost:3003"
echo "  Diagram Service   ws://localhost:3002/diagram"
echo "  LSP Server        ws://localhost:3001/lsp"
echo "  PostgreSQL        localhost:5432"
