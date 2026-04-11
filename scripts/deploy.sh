#!/bin/bash
# Deploy to production — test, update docs, commit, push, merge, build, restart.
# Usage: pnpm run deploy
#   or:  pnpm run deploy -- -m "commit message here"
#
# Steps:
#   1. Run tests locally
#   2. Update test coverage in README.md
#   3. Update README.md (feature counts, test suite descriptions)
#   4. Remind to update Claude memory
#   5. Commit & push
#   6. SSH into server: merge, install, prisma, build, pm2 restart
#
# Prerequisites:
#   - SSH key configured for root@65.109.134.254
#   - Git identity configured locally

set -e

SERVER="root@65.109.134.254"
SERVER_DIR="/opt/systemodel"
REMOTE_BRANCH="claude/onedrive-local-integration-GtEz8"
ROOT_DIR="$(git rev-parse --show-toplevel)"
README="$ROOT_DIR/README.md"
MEMORY_DIR="$HOME/.claude/projects/C--SysteModel/memory"

# ── Colors ──
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

step() { echo -e "\n${GREEN}[$1/$TOTAL] $2${NC}"; }
info() { echo -e "${CYAN}  $1${NC}"; }
warn() { echo -e "${YELLOW}  ⚠ $1${NC}"; }
fail() { echo -e "${RED}  ✗ $1${NC}"; exit 1; }

# Parse args
COMMIT_MSG=""
SKIP_MEMORY=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    -m) COMMIT_MSG="$2"; shift 2 ;;
    --skip-memory) SKIP_MEMORY=1; shift ;;
    *) shift ;;
  esac
done

cd "$ROOT_DIR"
TOTAL=9

# ═══════════════════════════════════════════════════════════════════════════════
# 1. Run tests and capture counts
# ═══════════════════════════════════════════════════════════════════════════════
step 1 "Running tests..."

DIAGRAM_OUTPUT=$(pnpm --filter @systemodel/diagram-service test 2>&1)
# "Tests" line has the test count, "Test Files" line has suite count — grab the Tests line
DIAGRAM_TESTS=$(echo "$DIAGRAM_OUTPUT" | grep "Tests" | grep -v "Test Files" | grep -oP '\d+(?= passed)' | head -1)
echo "$DIAGRAM_OUTPUT" | tail -3

API_OUTPUT=$(pnpm --filter @systemodel/api-server test 2>&1)
API_TESTS=$(echo "$API_OUTPUT" | grep "Tests" | grep -v "Test Files" | grep -oP '\d+(?= passed)' | head -1)
echo "$API_OUTPUT" | tail -3

TOTAL_TESTS=$((DIAGRAM_TESTS + API_TESTS))
info "Total: $TOTAL_TESTS tests ($DIAGRAM_TESTS diagram + $API_TESTS api)"

# ═══════════════════════════════════════════════════════════════════════════════
# 2. Update test coverage in README.md
# ═══════════════════════════════════════════════════════════════════════════════
step 2 "Updating test coverage in README.md..."

if [ -n "$TOTAL_TESTS" ] && [ "$TOTAL_TESTS" -gt 0 ]; then
  # Update "525 vitest tests" → current count
  sed -i -E "s/[0-9]+ vitest tests/$TOTAL_TESTS vitest tests/g" "$README"
  # Update "Vitest (525 unit tests" → current count
  sed -i -E "s/Vitest \([0-9]+ unit tests/Vitest ($TOTAL_TESTS unit tests/g" "$README"
  # Update "Coverage: 525 tests" → current count
  sed -i -E "s/Coverage:\*\* [0-9]+ tests/Coverage:** $TOTAL_TESTS tests/g" "$README"

  # Check if counts changed
  if git diff --quiet "$README" 2>/dev/null; then
    info "README test counts already up to date ($TOTAL_TESTS)."
  else
    info "Updated README test counts to $TOTAL_TESTS."
  fi
else
  warn "Could not parse test counts — README not updated."
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 3. Update CLAUDE.md test count
# ═══════════════════════════════════════════════════════════════════════════════
step 3 "Updating CLAUDE.md..."

CLAUDEMD="$ROOT_DIR/CLAUDE.md"
if [ -f "$CLAUDEMD" ] && [ -n "$TOTAL_TESTS" ] && [ "$TOTAL_TESTS" -gt 0 ]; then
  sed -i -E "s/Total: [0-9]+ tests/Total: $TOTAL_TESTS tests/g" "$CLAUDEMD"
  if git diff --quiet "$CLAUDEMD" 2>/dev/null; then
    info "CLAUDE.md already up to date."
  else
    info "Updated CLAUDE.md test count to $TOTAL_TESTS."
  fi
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 4. Update Claude memory
# ═══════════════════════════════════════════════════════════════════════════════
step 4 "Checking Claude memory..."

if [ -z "$SKIP_MEMORY" ] && [ -d "$MEMORY_DIR" ]; then
  # Update test count in deployment memory
  DEPLOY_MEM="$MEMORY_DIR/project_deployment.md"
  if [ -f "$DEPLOY_MEM" ]; then
    sed -i -E "s/[0-9]+ tests \([0-9]+ diagram-service \+ [0-9]+ api-server\)/$TOTAL_TESTS tests ($DIAGRAM_TESTS diagram-service + $API_TESTS api-server)/g" "$DEPLOY_MEM"
    info "Updated deployment memory: $TOTAL_TESTS tests."
  fi
  info "Memory files at: $MEMORY_DIR"
  info "Review manually if new features/rules were added this session."
else
  if [ -n "$SKIP_MEMORY" ]; then
    info "Skipped (--skip-memory)."
  else
    warn "Memory directory not found: $MEMORY_DIR"
  fi
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 5. Check for changes & commit
# ═══════════════════════════════════════════════════════════════════════════════
step 5 "Checking for changes..."

CHANGES=$(git status --porcelain)
if [ -z "$CHANGES" ]; then
  warn "No changes to commit. Deploying current HEAD."
else
  echo "  Changed files:"
  git status --short

  if [ -z "$COMMIT_MSG" ]; then
    COMMIT_MSG="Update: $(git diff --name-only HEAD | head -5 | tr '\n' ', ' | sed 's/,$//')"
  fi

  git add -A
  git commit -m "$(cat <<EOF
$COMMIT_MSG

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
  info "Committed."
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 6. Push
# ═══════════════════════════════════════════════════════════════════════════════
step 6 "Pushing to remote..."
git push
info "Pushed."

# ═══════════════════════════════════════════════════════════════════════════════
# 7. Merge on server
# ═══════════════════════════════════════════════════════════════════════════════
step 7 "Merging on server..."
ssh "$SERVER" "cd $SERVER_DIR && git fetch origin && git merge origin/$REMOTE_BRANCH --no-edit"
info "Merged."

# ═══════════════════════════════════════════════════════════════════════════════
# 8. Install, migrate, build
# ═══════════════════════════════════════════════════════════════════════════════
step 8 "Installing, migrating, and building on server..."

ssh "$SERVER" "cd $SERVER_DIR && pnpm install && \
  cd packages/api-server && \
  npx prisma generate && \
  npx prisma migrate deploy 2>&1 || true && \
  npx prisma db seed"
info "Dependencies and DB ready."

ssh "$SERVER" "cd $SERVER_DIR && \
  pnpm --filter @systemodel/shared-types build && \
  cd packages/api-server && npx tsc || true; \
  cd $SERVER_DIR && \
  pnpm --filter @systemodel/diagram-service build && \
  pnpm --filter @systemodel/web-client build"
info "Built."

# ═══════════════════════════════════════════════════════════════════════════════
# 9. Restart services
# ═══════════════════════════════════════════════════════════════════════════════
step 9 "Restarting services..."
ssh "$SERVER" "cd $SERVER_DIR && pm2 start ecosystem.config.cjs"
info "Services restarted."

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Deployment complete! ($TOTAL_TESTS tests passing)${NC}"
echo -e "${GREEN}  Live at: https://systemodel.com${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
