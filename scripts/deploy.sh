#!/usr/bin/env bash
set -euo pipefail

# Deploy script for kooperative.de
# Usage: ./scripts/deploy.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "=== Deploying kooperative.de ==="

# Pull latest code
echo "[1/5] Pulling latest code..."
git pull origin main

# Build Astro frontend
echo "[2/5] Installing frontend dependencies..."
cd "$PROJECT_DIR/frontend"
npm ci

echo "[3/5] Building Astro frontend..."
npm run build

# Copy dist to nginx volume location (already mapped via docker-compose volume)
echo "[4/5] Frontend build complete. Output is in frontend/dist/."

# Rebuild and restart containers if needed
echo "[5/5] Rebuilding and restarting Docker containers..."
cd "$PROJECT_DIR"
docker compose build strapi
docker compose up -d --force-recreate strapi nginx

echo "=== Deployment complete ==="
echo "Site should be available at https://kooperative.de"
