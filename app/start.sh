#!/bin/sh
set -a
[ -f .env ] && . .env
set +a
exec node .output/server/index.mjs
