#!/bin/bash
set -e

# Deploy app-portability to gh-pages (dev) → demo-portability.datasafe.dev.
# Adapted from dev-deploy/templates/deploy.sh.

scriptsFolder=$(cd $(dirname "$0"); pwd)
cd "$scriptsFolder/.."

BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ]; then
  echo "ERROR: Must be on 'main' branch to deploy (currently on '$BRANCH')"
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: Working tree is not clean. Commit or stash changes first."
  exit 1
fi

if [ ! -d "dist/.git" ]; then
  echo "ERROR: dist/.git not found. Run 'npm run setup' first."
  exit 1
fi

# Workspace rule: pull origin/main first AND verify locally before deploy.
# (feedback_pull_and_test_local_before_deploy.md)
echo "Pulling origin/main..."
git pull --ff-only origin main

echo "Building..."
npm run build

# Generate version.json — consumed by `curl -s URL/version.json` to
# sanity-check what's serving in prod.
COMMIT=$(git rev-parse HEAD)
COMMIT_SHORT=$(git rev-parse --short HEAD)
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

cat > dist/version.json <<EOF
{
  "commit": "$COMMIT",
  "commitShort": "$COMMIT_SHORT",
  "branch": "main",
  "buildDate": "$BUILD_DATE"
}
EOF

# Bypass Jekyll on GH Pages (so version.json + favicon.svg aren't stripped)
touch dist/.nojekyll

echo "Deploying to gh-pages..."
cd dist
git add -A
if git diff --cached --quiet; then
  echo "No changes to deploy."
  exit 0
fi
git commit -m "Deploy $COMMIT_SHORT"
git push origin gh-pages

echo "Deployed to gh-pages (commit: $COMMIT_SHORT)"
echo "Live at: https://demo-portability.datasafe.dev"
