# Changelog

## 0.1.0 — 2026-06-16

Initial release. Live at <https://portability.hds.ngo> (dev: <https://demo-portability.datasafe.dev>).

### What it is

A user-facing self-service web app for **GDPR Art. 15 / Art. 20**, **HIPAA §164.524**, and **Swiss nLPD Art. 25 / Art. 28**. Subjects sign in to their HDS account and download a portable copy of everything in their account (events, streams, accesses, attachments, audit log, time-series, webhooks) as a series of ZIP files.

Modelled on upstream [`pryv/pryv-account-backup-webapp`](https://github.com/pryv/pryv-account-backup-webapp) (BSD-3-Clause, vanilla JS) — reimplemented in the HDS frontend convention and reusing the upstream [`pryv-account-backup`](https://github.com/pryv/pryv-account-backup) library (pinned to `v0.7.0`) for the actual fetcher / restore-format logic.

### Tech stack

- React 19 + Vite + TypeScript strict + Tailwind v4 + [hds-style](https://github.com/healthdatasafe/style-package).
- ESLint (neostandard + semicolons), Vitest + @testing-library/react.
- New Relic Browser agent injected at build time (`hds-dev-portability` / `hds-prod-portability`).

### Lib layer (TS ports from upstream BSD-3-Clause)

- `lib/BrowserBlobZipStorageWriter.ts` — in-memory ZIP fragmentation with a cross-ZIP `backup-index.json` directory in the final ZIP.
- `lib/LocalStorageStateStore.ts` — endpoint-namespaced kv + per-category refs + portable `export()` / `import()` for cross-session incremental.
- `lib/hdsManifest.ts` — HDS-specific provenance manifest written into the final ZIP alongside `backup-index.json`: data-model commit (resolved from `model.datasafe.dev/version.json`), app version, deployment URL, completion timestamp, total bytes.
- `lib/node-stub.ts` — empty stub for Node built-ins (fs / path / https / http / crypto / stream) referenced by upstream at module-eval but never called in the browser. Mirrors upstream's esbuild alias approach via a Vite `resolve.alias`.

### Backup orchestrator

`services/backupRunner.ts` — adapted from upstream `app.js runBackup()`. Pure callback-driven (no DOM coupling). Drives the upstream resource fetchers (`api-resources`, `events-chunked`, `audit-as-events`, `accesses-history`, `attachments`, `hf-data`, `webhooks-export`) and ref-tees attachment / series / webhook refs into the state store from the event + accesses streams.

### Auth

`services/auth.ts` — email-or-username resolver mirroring `hds-webapp` / `app-web-auth3-hds`: if the identifier contains `@`, look it up via `<register>/<email>/uid` and call `Pryv.Service.login(username, password)` with the returned uid. SMS-MFA accounts are redirected to the upstream CLI tool (same caveat as upstream).

Service-info URL is environment-aware (no UI exposure): hostnames under `*.hds.ngo` use `https://reg.api.datasafe.dev/service/info`; everything else uses `https://demo.datasafe.dev/reg/service/info`. Override via `?serviceInfoUrl=` for testing other operators.

### UI

Four screens — Login / Progress / Done / Error — plus a `PriorStatePanel` that replicates the upstream pre-login sync-state UI (resume from prior run, forget endpoints, upload `sync-state.json`). Aligned with the HDS style guide ([style.datasafe.dev](https://style.datasafe.dev)) — CSS-var theming, `shadow-sm` cards, uppercase + `font-light` + `tracking-wide` section headings, primary button + focus rings.

### Tests

29 tests pass: LocalStorageStateStore (12), BrowserBlobZipStorageWriter (7), hdsManifest (6), App (4).

### Manual E2E test plan (run against a populated demo account)

1. Sign in with a demo user that has events + attachments + at least one app-type access.
2. Confirm all 8 progress steps render — `metadata`, `audit`, `events`, `app-profiles`, `access-history` (opt-in → skipped on default), `attachments` (opt-in → skipped on default), `hf-data` (opt-out → on by default), `webhooks` (opt-out → on by default).
3. Toggle each opt-in/opt-out and verify the corresponding step runs / skips accordingly.
4. Confirm one or more ZIP files download (default 100 MB chunk).
5. Open the LAST ZIP and verify it contains: `backup-index.json`, `sync-state.json`, `hds-manifest.json` (with non-null `dataModelCommit`).
6. Re-run with the downloaded `sync-state.json` uploaded — the events / audit steps should fetch only the delta (`events-incremental-<TS>.json` rather than monthly chunks).
7. Confirm NR `PageView` arrives within 30 min (verify on an unfiltered device — many dev machines' DNS blocks `bam.eu01.nr-data.net`).
