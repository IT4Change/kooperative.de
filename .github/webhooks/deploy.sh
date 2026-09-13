#!/bin/sh

# Abort on the first failing step. Without this a failed build fell through to
# the pm2 restart, which tore down the running instance and brought it back up
# on a stale (or missing) .output — a broken deploy that reported success.
set -e

# Find current directory & configure paths
SCRIPT_PATH=$(realpath $0)
SCRIPT_DIR=$(dirname $SCRIPT_PATH)
PROJECT_ROOT=$SCRIPT_DIR/../..

TAG=$1

cd $PROJECT_ROOT

if [ -n "$TAG" ]; then
  git fetch --tags
  git checkout "$TAG"
else
  git checkout master
  git pull
fi

## Frontend
FRONTEND_ROOT=$PROJECT_ROOT/app
FRONTEND_SERVICE=$PROJECT_ROOT/.github/webhooks/ecosystem.config.js

cd $FRONTEND_ROOT

### Config
export TZ=UTC

### Install & build (previous version keeps serving during build)
### Full install, no --omit=dev: `nuxt build` is a dev-time step and loads every
### module listed in nuxt.config, two of which (@nuxt/eslint, @nuxt/test-utils)
### are devDependencies. Nothing is saved by omitting them either — the runtime
### never touches node_modules, start.sh runs the standalone Nitro bundle in
### .output, which has its dependencies inlined.
npm ci
npm run build

### A failed build must never reach the restart below. `set -e` covers a non-zero
### exit; this also catches a build that dies without one.
[ -f .output/server/index.mjs ] || { echo "[deploy] build produced no .output -- aborting, previous version stays live"; exit 1; }

### DB migrations (idempotent). Runs before the restart so a failure aborts the
### deploy WITHOUT downtime — the previous version stays live.
### Load .env the same way start.sh does, so the migration hits the exact same DB
### as the running app (e.g. kooperative_db2), not a default.
set -a
# `[ -f .env ] && …` would return non-zero without a .env and, under set -e,
# abort the deploy. An absent .env is legal here — migrate.mjs has defaults.
if [ -f .env ]; then . ./.env; fi
set +a
echo "[deploy] running DB migrations against ${DB_DATABASE:-<default>} on ${DB_HOST:-localhost} …"
node scripts/migrate.mjs || { echo "[deploy] DB migration failed -- aborting, previous version stays live"; exit 1; }

### Restart service. stop/delete fail when the app is not registered yet (first
### deploy on a host), which is not an error — only the start has to succeed.
pm2 stop $FRONTEND_SERVICE || true
pm2 delete $FRONTEND_SERVICE || true
pm2 start $FRONTEND_SERVICE
