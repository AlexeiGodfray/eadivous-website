#!/usr/bin/env bash
set -euo pipefail

# Manual deploy fallback. Primary deploy is GitHub Actions (.github/workflows/ci-cd.yml).

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${VPS_HOST:-root@74.208.73.225}"
WEB_ROOT="${VPS_WEB_ROOT:-/var/www/eadivous}"

cd "$ROOT_DIR"

echo "Building production site (root base path)..."
npm run build

echo "Uploading dist/ to ${HOST}:${WEB_ROOT} ..."
rsync -avz --delete \
  --exclude '.DS_Store' \
  "$ROOT_DIR/dist/" \
  "${HOST}:${WEB_ROOT}/"

echo "Uploading nginx config..."
scp "$ROOT_DIR/deploy/nginx.conf" "${HOST}:/tmp/eadivous-nginx.conf"

echo "Done."
echo "If this is the first deploy, run on the VPS:"
echo "  bash /tmp/vps-setup.sh"
echo "Or if nginx is already configured:"
echo "  ssh ${HOST} 'nginx -t && systemctl reload nginx'"
