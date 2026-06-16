#!/usr/bin/env bash
# Deploy app-portability to production (portability.hds.ngo) via
# healthdatasafe/app-portability-prod repo (main branch + /docs).
# Adapted from hds-webapp/scripts/deploy-prod.sh.
set -euo pipefail

scriptsFolder=$(cd $(dirname "$0"); pwd)
cd "$scriptsFolder/.."

MAIN_BRANCH="main"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH" != "$MAIN_BRANCH" ]; then
  echo "ERROR: Deploy only allowed from '$MAIN_BRANCH' (current: $BRANCH)."
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: Working tree is not clean."
  git status --short
  exit 1
fi

if [ ! -d distprod/.git ]; then
  echo "ERROR: distprod/ is not set up. Run 'npm run setup' first."
  exit 1
fi

# Workspace rule: pull origin/main first AND verify locally before deploy.
echo "Pulling origin/main..."
git pull --ff-only origin main

COMMIT_SHORT="$(git rev-parse --short HEAD)"
COMMIT_FULL="$(git rev-parse HEAD)"
echo "Deploying commit $COMMIT_SHORT to production..."

# Reset distprod/ to remote main HEAD so the deploy is idempotent regardless
# of any leftover local state (per feedback_ghpages_deploy.md).
echo "Resetting distprod/ to origin/main..."
git -C distprod fetch origin main
git -C distprod reset --hard origin/main
git -C distprod clean -fdx -e .git -e docs

echo "Building (VITE_HDS_ENV=prod) ..."
VITE_HDS_ENV=prod npm run build
echo "Build OK."

# Sanity-check build output before copying — a silent build failure must not
# overwrite production with an empty bundle.
if [ ! -s dist/index.html ]; then
  echo "ERROR: dist/index.html is missing or empty after build — refusing to deploy."
  exit 1
fi
if ! ls dist/assets/*.js >/dev/null 2>&1; then
  echo "ERROR: no JS bundle in dist/assets/ after build — refusing to deploy."
  exit 1
fi

# Copy build output to distprod/docs/ (prod repo serves from docs/).
rm -rf distprod/docs/*
cp -r dist/* distprod/docs/
echo "portability.hds.ngo" > distprod/docs/CNAME

# Bypass Jekyll on GitHub Pages so dotfiles + JSON are served verbatim.
touch distprod/docs/.nojekyll

# Generate version.json
cat > distprod/docs/version.json << VEOF
{
  "commit": "$COMMIT_FULL",
  "commitShort": "$COMMIT_SHORT",
  "branch": "$MAIN_BRANCH",
  "buildDate": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
VEOF

git -C distprod add -A
if git -C distprod diff --cached --quiet; then
  echo "No changes in distprod/ — nothing to deploy."
  exit 0
fi
git -C distprod commit -m "deploy $COMMIT_SHORT ($COMMIT_FULL)"
git -C distprod push

echo "Deployed $COMMIT_SHORT to production."
echo "Live at: https://portability.hds.ngo"
echo "(First-time deploy: GitHub Pages may need manual validation of the custom domain + Enforce HTTPS.)"
