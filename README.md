# app-portability

User-facing **"Download all my data"** web app for Health Data Safe — the subject-side self-service path for **GDPR Art. 15/20**, **HIPAA §164.524**, and **Swiss nLPD Art. 25**.

Subjects sign in to their HDS account, configure backup options, and download a series of ZIP files containing a portable dump of their account: events, streams, accesses, attachments, audit logs, time-series (HFS) data, and webhooks.

## Status

Phase 2 scaffold (plan [`77-app-portability`](https://github.com/healthdatasafe/_macro/issues)). Login + backup runner ship in Phase 3.

## HTTPS for local development

The dev server runs over HTTPS on a `*.backloop.dev` hostname, which resolves to `127.0.0.1`.
Certificates come from the [`backloop.dev`](https://github.com/perki/backloop.dev-node) package,
installed directly from GitHub rather than npm.

**You need nothing to get started.** With no configuration the package downloads a shared,
self-signed certificate. Install it once per machine by following
<https://backloop.dev/public/>, and the browser warning goes away.

Two things worth knowing:

- **Firefox will not accept it**, because it ignores the system trust store. Use a Chromium-based
  browser, or supply your own certificate.
- **Bring your own certificate** from mkcert, Caddy, a company CA or openssl: point
  `BACKLOOP_DEV_CERT` and `BACKLOOP_DEV_KEY` at the PEM files and nothing is downloaded.

If you are updating an existing checkout, delete the stale copy first. npm does not replace a
package that moved from the registry to a git URL: it leaves the old directory in place while
`npm ls` reports the new version.

```sh
rm -rf node_modules/backloop.dev node_modules/vite-plugin-backloop.dev && npm install
```

## Deployments

- **Dev:** [demo-portability.datasafe.dev](https://demo-portability.datasafe.dev) — gh-pages branch on this repo.
- **Prod:** [portability.hds.ngo](https://portability.hds.ngo) — gh-pages branch on `app-portability-prod` (created in Phase 9).

## What's in the bundle

Modelled on upstream [`pryv/pryv-account-backup-webapp`](https://github.com/pryv/pryv-account-backup-webapp). Each backup run produces a series of ZIP files (default 100 MB each, configurable). Across the ZIPs:

- `account.json`, `streams.json`, `accesses.json`, `accesses-all.json` (deletions + expired), `profile_private.json`, `profile_public.json`
- `events-YYYY-MM.json` (monthly chunks, initial run) OR `events-incremental-<TS>.json` (subsequent runs)
- `audit_logs.json` (via `:_audit:*` store streams)
- `app_profiles/profile_app_<accessId>.json`
- `accesses-history/<accessId>.json` (opt-in)
- `attachments/<eventId>_<fileName>` (opt-in)
- `hf-data/<eventId>.json` (opt-out — time-series)
- `webhooks.json` (opt-out)
- `sync-state.json` (always — cross-session incremental state)
- `backup-index.json` (last ZIP — cross-ZIP file directory)
- **`hds-manifest.json`** (HDS-specific — data-model commit, app version, deployment URL, completion timestamp, total bytes)

The ZIP layout matches the upstream `pryv-account-backup` CLI restore format exactly (apart from the extra `hds-manifest.json`, which the CLI ignores).

## Tech stack

React 19 + Vite + TypeScript strict + Tailwind v4 + [hds-style](https://github.com/healthdatasafe/style-package). Backup logic via the upstream [`pryv-account-backup`](https://github.com/pryv/pryv-account-backup) library (pinned to `v0.7.0`). In-browser ZIP creation via [`fflate`](https://github.com/101arrowz/fflate).

## Permissions / auth

The app takes one of two auth paths:

1. **Username + password (default)** — same flow as upstream `pryv-account-backup-webapp`. The app calls `Pryv.Service.login(username, password, 'hds-app-portability')` which returns a **personal token** with full read access to the subject's account. SMS-MFA accounts cannot use this path — they're directed to the CLI version (same caveat as upstream).
2. **`apiEndpoint` URL** — subjects who already have an `apiEndpoint` URL (carrying a long-lived token) from another HDS app can paste it. Also accepted as a `?apiEndpoint=...` query parameter on return from an auth-flow redirect (HDS pattern, plan 77 D4). The query parameter is scrubbed from `window.location` immediately and cached in `sessionStorage` only — never logged to New Relic, never written outside `sessionStorage`.

Resources read by the backup (per upstream `pryv-account-backup` library v0.7.0):

| Resource | Endpoint(s) | Always / Optional |
|---|---|---|
| Account metadata | `account.get` | always |
| Streams | `streams.get` (`state=all` if "include trashed") | always |
| Accesses | `accesses.get` (twice — current + `includeDeletions=true&includeExpired=true`) | always |
| Profile | `profile/private.get`, `profile/public.get` | always |
| Audit log | events on `:_audit:*` streams | always |
| Events | `events.get` (monthly chunks, incremental via `modifiedSince`) | always |
| Per-app profiles | `profile/app.get` per app-type access | always |
| Access history | `accesses.get` per access (O(N) extra calls) | **opt-in** |
| Attachments | `events.getAttachment` per `event.attachments[]` | **opt-in** |
| HFS series data | `events/<id>/series` per `series:*` event | **opt-out** (on by default) |
| Webhooks | `webhooks.get` per access | **opt-out** (on by default) |

The personal token grants full read; no scope narrowing is requested. This matches upstream — narrowing would break ref-tee'ing (the orchestrator discovers attachment / series / webhook refs during the events / accesses fetches and needs the same token to drain them).

## Development

```bash
npm run setup      # install deps + prepare gh-pages dist/ checkout
npm run dev        # local dev (HTTPS via backloop.dev — for Pryv auth callbacks)
npm run dev:raw    # plain http://localhost (skips backloop)
npm run lint
npm run typecheck
npm test
npm run build      # produces dist/ for gh-pages deploy
```

Node `>= 24` required (workspace standard).

## Deployment

Manual gh-pages deploy:

```bash
npm run deploy     # dev → demo-portability.datasafe.dev
```

Prod deploy (after Phase 9):

```bash
bash scripts/deploy-prod.sh   # prod → portability.hds.ngo (separate -prod repo)
```

## Monitoring

New Relic Browser agent injected at build time via the `newrelicBrowser()` Vite plugin. Entity names:
- Dev: `hds-dev-portability`
- Prod: `hds-prod-portability`

Both must be wired into the `hds-dev` / `hds-prod` alert policies with email destination `tech.newrelic@healthdatasafe.org` **before** the first deploy (workspace directive — installed agent ≠ active alerting).

## Compliance references

- [`compliance-matrix`](https://github.com/healthdatasafe/compliance-matrix) — three-layer rows for GDPR Art. 15/20, HIPAA §164.524, Swiss nLPD Art. 25 cite this app as the HDS-layer self-service path.
- `compliance-internal` (private) — `gdpr/procedures/data-subject-rights.md` and `hipaa/procedures/individual-right-of-access.md` reference this app under "Self-service path"; operator-mediated path remains as fallback.

## License

BSD-3-Clause. Acknowledges upstream [`pryv/pryv-account-backup`](https://github.com/pryv/pryv-account-backup) (BSD-3-Clause) and [`pryv/pryv-account-backup-webapp`](https://github.com/pryv/pryv-account-backup-webapp) (BSD-3-Clause).
