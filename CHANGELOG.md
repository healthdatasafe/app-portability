# Changelog

## 0.1.0 — 2026-06-16

Initial implementation (Phases 2 + 3 of plan 77).

### Phase 2 — Scaffold

- React 19 + Vite + TypeScript strict + Tailwind v4 + hds-style.
- Dependencies: `hds-lib`, `pryv ^3.4.1`, `pryv-account-backup#v0.7.0` (pinned to upstream tag), `fflate ^0.8.2`.
- ESLint (neostandard + semicolons) + typescript-eslint + react-hooks + react-refresh.
- Vitest + @testing-library/react skeleton.
- New Relic browser snippet stubs (dev + prod) — actual snippets paste in Phase 4 / 9 before first deploy.

### Phase 3 — Core flow

- **Lib layer (TS ports from upstream BSD-3-Clause):**
  - `lib/BrowserBlobZipStorageWriter.ts` — in-memory ZIP fragmentation with cross-ZIP `backup-index.json`.
  - `lib/LocalStorageStateStore.ts` — endpoint-namespaced kv + per-category refs + portable export/import.
  - `lib/hdsManifest.ts` — **D9** HDS provenance manifest (data-model commit from `model.datasafe.dev/version.json`, app version, deployment URL, completion timestamp, total bytes). Emitted into the FINAL ZIP alongside upstream's `backup-index.json` and `sync-state.json`.
  - `lib/node-stub.ts` — empty stub for fs/path/https/http/crypto/stream (Vite alias matches upstream's esbuild approach).
- **Service layer:**
  - `services/backupRunner.ts` — orchestrator adapted from upstream `app.js runBackup()`. Pure callback-driven (no DOM coupling).
  - `services/auth.ts` — read-`?apiEndpoint=` from URL, scrub from history, cache in `sessionStorage` only. Token-in-URL hygiene per **D4**.
- **UI:**
  - 4 screens — Login / Progress / Done / Error.
  - `PriorStatePanel` — replicates upstream's pre-login sync-state UI (resume from prior run, forget endpoints, upload `sync-state.json`).
  - `ScreenLogin` — auth-mode toggle (username+password / apiEndpoint URL), advanced options (chunk size + 5 include/exclude toggles).
- **35 tests pass**: LocalStorageStateStore (12), BrowserBlobZipStorageWriter (7), hdsManifest (6), auth (5), App (5).

### E2E test plan (executed in Phase 5 after dev deploy)

The Phase 3 gate requires a manual run against `demo.datasafe.dev` with non-trivial data. Run this once `demo-portability.datasafe.dev` is live:

1. Sign in with a demo user that has events + attachments + at least one app-type access.
2. Confirm all 8 progress steps render — `metadata`, `audit`, `events`, `app-profiles`, `access-history` (opt-in → skipped on default), `attachments` (opt-in → skipped on default), `hf-data` (opt-out → on by default), `webhooks` (opt-out → on by default).
3. Toggle each opt-in/opt-out and verify the corresponding step runs / skips accordingly.
4. Confirm one or more ZIP files download (depending on data volume + 100 MB default chunk).
5. Open the LAST ZIP and verify it contains: `backup-index.json` (upstream cross-ZIP directory), `sync-state.json` (portable kv state), `hds-manifest.json` (HDS provenance — non-null `dataModelCommit`).
6. Run a second backup with the downloaded `sync-state.json` uploaded — confirm the events / audit steps fetch only the delta (event chunk file named `events-incremental-<TS>.json` rather than monthly chunks).
7. Confirm NR `PageView` arrives within 30 min (verify on an unfiltered device — the dev Mac's DNS blocks NR beacons; see `_claude-memory/troubleshooting.md`).
