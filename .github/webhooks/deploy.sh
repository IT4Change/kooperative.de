#!/bin/sh

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
npm ci --omit=dev
npm run build

### DB migrations (idempotent). Runs before the restart so a failure aborts the
### deploy WITHOUT downtime — the previous version stays live.
### Load .env the same way start.sh does, so the migration hits the exact same DB
### as the running app (e.g. kooperative_db2), not a default.
set -a
[ -f .env ] && . ./.env
set +a
echo "[deploy] running DB migrations against ${DB_DATABASE:-<default>} on ${DB_HOST:-localhost} …"
node scripts/migrate.mjs || { echo "[deploy] DB migration failed -- aborting, previous version stays live"; exit 1; }

### Restart service
pm2 stop $FRONTEND_SERVICE
pm2 delete $FRONTEND_SERVICE
pm2 start $FRONTEND_SERVICE
