#!/usr/bin/env bash
set -euo pipefail

# One-time setup: create a deploy key for GitHub Actions and install it on the VPS.
# Usage: ./scripts/setup-deploy-key.sh

KEY_PATH="${1:-$HOME/.ssh/eadivous_deploy}"

if [[ -f "${KEY_PATH}" ]]; then
  echo "Key already exists at ${KEY_PATH}"
else
  ssh-keygen -t ed25519 -C "github-actions-eadivous-deploy" -f "${KEY_PATH}" -N ""
fi

echo
echo "=== Add this public key to the VPS ==="
echo "Run on the VPS (as root):"
echo
echo "  mkdir -p ~/.ssh && chmod 700 ~/.ssh"
echo "  echo '$(cat "${KEY_PATH}.pub")' >> ~/.ssh/authorized_keys"
echo "  chmod 600 ~/.ssh/authorized_keys"
echo
echo "=== Add this private key to GitHub ==="
echo "Repo → Settings → Secrets and variables → Actions → New repository secret"
echo
echo "  Name: VPS_SSH_KEY"
echo "  Value: (contents of ${KEY_PATH})"
echo
echo "Also add these secrets:"
echo "  VPS_HOST = 74.208.73.225"
echo "  VPS_USER = root"
echo
echo "Optional repository variable:"
echo "  VPS_WEB_ROOT = /var/www/eadivous"
echo
echo "Create a GitHub environment named 'production' (Settings → Environments)."
echo "Then push to main to trigger deploy."
