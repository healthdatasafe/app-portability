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

# Refuse a HEAD behind origin/main: a stale checkout would roll the deploy back (B-2026-11-06-2).
git fetch -q origin main
read -r AHEAD BEHIND <<< "$(git rev-list --left-right --count HEAD...origin/main)"
if [ "$BEHIND" != "0" ]; then
  echo "ERROR: HEAD is $BEHIND commit(s) behind origin/main. Run: git pull --ff-only origin main"
  exit 1
fi
if [ "$AHEAD" != "0" ]; then
  echo "WARNING: HEAD is $AHEAD commit(s) ahead of origin/main (not pushed)."
fi

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

# A push is not a deploy: wait until the site serves it (B-2026-11-06-12).
"$scriptsFolder/verify-pages.sh" healthdatasafe/app-portability demo-portability.datasafe.dev "$(git rev-parse HEAD)" "$COMMIT"

echo "Deployed to gh-pages (commit: $COMMIT_SHORT)"
echo "Live at: https://demo-portability.datasafe.dev"
