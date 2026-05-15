# Phase 0 Deployment Runbook

Production deployment of the renderer-refactor Phase 0 foundation
to the Hetzner VPS (systemodel.com, 65.109.134.254).

Phase 0 adds infrastructure (IR types, view registry, feature-flag
plumbing, wedge with silent fallback, observability) but does not
change user-visible behavior — every flag defaults off, so every
request still flows through the legacy `transformToBDD` pipeline.
The deploy still needs care because it adds a Prisma migration
(`User.featureFlags JSONB?`) and three new tests packages depend on
the regenerated Prisma client.

## 1. Pre-flight check (≈5 minutes)

Run locally before SSHing to production.

- `pnpm --filter @systemodel/diagram-service test` → 619 passing
- `pnpm --filter @systemodel/api-server test` → 340 passing
- `pnpm --filter @systemodel/web-client test` → 128 passing
- Total: **1087 passing**, three packages tsc clean
- `git ls-files packages/api-server/prisma/migrations/20260515200000_add_user_feature_flags/`
  must list `migration.sql`
- `docs/phase-0-bundle-delta.txt` confirms 0 KB gzip delta vs baseline

## 2. Backup

SSH to Hetzner, dump PostgreSQL before any migration:

```bash
ssh root@65.109.134.254
mkdir -p ~/backup
docker exec systemodel-db pg_dump -U postgres systemodel \
  > ~/backup/pre-phase0-$(date +%Y%m%d-%H%M%S).sql
ls -la ~/backup/pre-phase0-*.sql        # confirm non-empty
```

The dump should be several MB (10 production users + projects +
files + audit logs). A near-empty file means the dump failed
silently — stop and diagnose before proceeding.

## 3. Deploy sequence

Order is critical: `prisma generate` must run **before** `pnpm build`
or the TypeScript compile fails on the new `User.featureFlags`
field.

```bash
cd /opt/systemodel
git pull origin master
pnpm install --frozen-lockfile

cd packages/api-server
npx prisma generate
npx prisma migrate deploy

cd /opt/systemodel
pnpm build
pm2 reload ecosystem.config.cjs --update-env
```

`prisma migrate deploy` should report:

```
Applying migration `20260515200000_add_user_feature_flags`
```

If it doesn't, the migration is already applied (rerunning is safe)
or the `_prisma_migrations` table is in an inconsistent state.
Stop and surface the output before continuing.

## 4. Automated smoke test

```bash
curl -s https://systemodel.com/api/health | jq .   # status: "ok"
curl -s https://systemodel.com/api/ready  | jq .   # status: "ok"

pm2 logs --lines 50 --nostream                     # no errors in last 30s

docker exec systemodel-db psql -U postgres -d systemodel \
  -c "\d users" | grep featureFlags                # featureFlags | jsonb

# If INTERNAL_API_TOKEN is not yet configured, skip:
curl -s http://localhost:3002/internal/renderer-stats | jq .
```

The `featureFlags | jsonb` line proves the migration landed in
the actual database, not just in `_prisma_migrations`.

## 5. Hand-off to Platform Owner

Browser smoke test (login, open diagram, inspect WebSocket frame
for `_meta.rendererUsed`) is **not** the deploying agent's job.
Report back with:

- Deploy success / failure
- Migration outcome
- Smoke-test results
- "Browser smoke test sırası geldi" to the Platform Owner

## Rules — what NOT to do

- Do not run a browser smoke test as the deploying agent.
- If migration fails mid-flight, **stop** before any rollback —
  ask Platform Owner before destructive remediation.
- Production data (user files, settings, project rows) must not be
  modified. The only DB change in Phase 0 is the additive
  `featureFlags` column.
- Do not skip the backup. The migration is additive and reversible
  in theory, but the dump is the safety net.

## Rollback (only if migration fails)

```bash
# Restore from the pre-deploy dump
docker exec -i systemodel-db psql -U postgres -d systemodel \
  < ~/backup/pre-phase0-<timestamp>.sql

# Roll the code back
cd /opt/systemodel
git reset --hard <pre-phase0-commit-sha>
pnpm install --frozen-lockfile
cd packages/api-server && npx prisma generate
cd /opt/systemodel && pnpm build
pm2 reload ecosystem.config.cjs --update-env
```

Get explicit Platform Owner approval before running any of this.
