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

# Refuse to build against a node_modules that does not match package-lock.json.
# A dependency bump pulled from git but never `npm install`ed produces a bundle
# linked against the OLD library while the source expects the new one - lint,
# tests and the build all stay green and the only symptom is a white screen in
# the browser, after deploy. (Broke app.hds.ngo 2026-08-25: hds-lib 1.3.4
# installed, 1.5.0 required.) Checks direct dependencies only, so nested
# dev-tool dedupe differences do not cause false alarms.
(node -e '
const fs = require("fs");
let want, have;
try { want = JSON.parse(fs.readFileSync("package-lock.json", "utf8")).packages || {}; } catch (e) { process.exit(0); }
try { have = JSON.parse(fs.readFileSync("node_modules/.package-lock.json", "utf8")).packages || {}; }
catch (e) { console.error("ERROR: node_modules/ is missing or was not installed by npm."); console.error("Run: npm install"); process.exit(1); }
const drift = [], linked = [];
for (const [p, meta] of Object.entries(want)) {
  if (!p || (p.match(/node_modules\//g) || []).length !== 1) continue;
  const got = have[p];
  if (!got) continue;
  const name = p.replace(/^node_modules\//, "");
  if (got.link && !meta.link) { linked.push(name + " -> " + got.resolved); continue; }
  if (meta.version && got.version && meta.version !== got.version) drift.push(name + ": installed " + got.version + ", lockfile wants " + meta.version);
}
if (linked.length) {
  console.error("ERROR: npm-linked dependencies present - the build would not match the lockfile.");
  linked.forEach(function (l) { console.error("  " + l); });
  console.error("Unlink before deploying: npm install");
}
if (drift.length) {
  console.error("ERROR: node_modules is out of sync with package-lock.json - refusing to build a stale bundle.");
  drift.slice(0, 10).forEach(function (d) { console.error("  " + d); });
  if (drift.length > 10) console.error("  ... and " + (drift.length - 10) + " more");
  console.error("Run: npm install");
}
if (linked.length || drift.length) process.exit(1);
')


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
