/*
 * Backup orchestrator — adapted from pryv/pryv-account-backup-webapp v0.7.0
 *   src/app.js runBackup() (BSD-3-Clause).
 *
 * Differences from upstream:
 *  - Wrapped in a class with progress callbacks (no DOM coupling).
 *  - HDS-specific `hds-manifest.json` emission alongside the upstream
 *    `backup-index.json` (per plan 77 D9).
 *  - Accepts either a username+password (matches upstream MFA caveat) or
 *    a pre-built apiEndpoint URL (HDS auth-flow return path, plan 77 D4).
 */

import * as pryv from 'pryv';
// @ts-expect-error — JS module without bundled .d.ts
import apiResources from 'pryv-account-backup/src/methods/api-resources.js';
// @ts-expect-error — JS module without bundled .d.ts
import * as eventsChunked from 'pryv-account-backup/src/methods/events-chunked.js';
// @ts-expect-error — JS module without bundled .d.ts
import * as auditAsEvents from 'pryv-account-backup/src/methods/audit-as-events.js';
// @ts-expect-error — JS module without bundled .d.ts
import * as accessesHistory from 'pryv-account-backup/src/methods/accesses-history.js';
// @ts-expect-error — JS module without bundled .d.ts
import * as attachments from 'pryv-account-backup/src/methods/attachments.js';
// @ts-expect-error — JS module without bundled .d.ts
import * as hfData from 'pryv-account-backup/src/methods/hf-data.js';
// @ts-expect-error — JS module without bundled .d.ts
import * as webhooksExport from 'pryv-account-backup/src/methods/webhooks-export.js';

import { BrowserBlobZipStorageWriter } from '../lib/BrowserBlobZipStorageWriter';
import { LocalStorageStateStore, type SyncStateSnapshot } from '../lib/LocalStorageStateStore';
import { buildManifest, fetchDataModelCommit } from '../lib/hdsManifest';
import { resolveUsernameFromEmail } from './auth';
import { strToU8 } from 'fflate';

export const APP_ID = 'hds-app-portability';
const SYNC_STATE_FILE = 'sync-state.json';
const HDS_MANIFEST_FILE = 'hds-manifest.json';
const TOOL_VERSION = '0.7.0'; // matches upstream pryv-account-backup pin

export const RESOURCE_STEPS = [
  { id: 'metadata', label: 'Account, streams, profile, accesses' },
  { id: 'audit', label: 'Audit log' },
  { id: 'events', label: 'Events' },
  { id: 'app-profiles', label: 'Per-app profiles' },
  { id: 'access-history', label: 'Per-access version history' },
  { id: 'attachments', label: 'Attachments' },
  { id: 'hf-data', label: 'High-frequency series data' },
  { id: 'webhooks', label: 'Webhooks' }
] as const;

export type StepId = typeof RESOURCE_STEPS[number]['id'];
export type StepStatus = 'pending' | 'active' | 'done' | 'skipped';

export interface BackupOptions {
  // Auth — username-or-email + password. The username field also accepts an
  // email; resolveUsernameFromEmail looks it up against the registration host
  // (mirrors hds-webapp / app-web-auth3-hds).
  serviceInfoUrl: string;
  username: string;
  password: string;

  // Configuration
  zipSizeMb: number;
  includeTrashed: boolean;
  includeAttachments: boolean;
  includeHfData: boolean;
  includeWebhooks: boolean;
  includeAccessHistory: boolean;

  // Optional uploaded sync-state from a prior run
  uploadedSyncState?: SyncStateSnapshot | null;

  // The set of apiEndpoints the user chose to forget (pre-login)
  forgottenEndpoints?: Set<string>;
}

export interface BackupCallbacks {
  onStatus?: (msg: string) => void;
  onStepStatus?: (id: StepId, status: StepStatus, label?: string) => void;
  onZipReady?: (info: { name: string; size: number }) => void;
}

interface PryvConnection {
  endpoint: string;
  apiEndpoint: string;
  token: string;
  // apiOne etc. exist but we don't call them directly here.
  [k: string]: unknown;
}

/** Run a single backup pass. Throws on auth failure or fetch errors. */
export async function runBackup (
  opts: BackupOptions,
  cb: BackupCallbacks = {}
): Promise<{ downloads: Array<{ name: string; size: number }>; totalBytes: number }> {
  cb.onStatus?.('Connecting…');

  const connection = await establishConnection(opts);

  const apiEndpoint = connection.endpoint || connection.apiEndpoint;

  // Apply pre-login choices: forget-then-import-then-default.
  if (opts.forgottenEndpoints?.has(apiEndpoint)) {
    LocalStorageStateStore.dropSnapshot(apiEndpoint);
  }
  const state = new LocalStorageStateStore(apiEndpoint);
  if (opts.uploadedSyncState != null) {
    await state.import(opts.uploadedSyncState);
    cb.onStatus?.('Seeded store from uploaded sync-state.json.');
  }

  const writer = new BrowserBlobZipStorageWriter({
    zipSizeMb: opts.zipSizeMb,
    onZipReady: (info) => cb.onZipReady?.(info)
  });

  const runStartedAt = Math.floor(Date.now() / 1000);
  const priorRunAt = (await state.get('lastRunAt')) as number | undefined;
  const eventsModifiedSince = priorRunAt
    ? ((await state.get('events.lastModifiedSince')) as number | null)
    : null;
  const auditModifiedSince = priorRunAt
    ? ((await state.get('audit.lastModifiedSince')) as number | null)
    : null;

  // Carry-over refs from a prior interrupted run get re-discovered via the
  // streams below; clear them so phantom pending refs don't linger.
  await Promise.all([
    state.clearCategory('attachment'),
    state.clearCategory('series-event'),
    state.clearCategory('webhook')
  ]);

  // Step 1 — metadata + ref tee
  cb.onStepStatus?.('metadata', 'active');
  await fetchMetadata(connection, writer, state, opts, cb);
  cb.onStepStatus?.('metadata', 'done');

  // Step 2 — audit
  await runStep('audit', cb, () => callbackify(
    (auditAsEvents as any).download,
    connection, writer,
    { includeTrashed: opts.includeTrashed, modifiedSince: auditModifiedSince }
  ));

  // Step 3 — events with onEvents tee for attachment + series-event refs
  await runStep('events', cb, () => callbackify(
    (eventsChunked as any).download,
    connection, writer,
    {
      includeTrashed: opts.includeTrashed,
      modifiedSince: eventsModifiedSince,
      runStartedAt,
      onEvents: (events: any[]) => pushEventRefs(state, events)
    }
  ));

  // Step 4 — per-app profiles
  cb.onStepStatus?.('app-profiles', 'active');
  await fetchAppProfiles(connection, writer, cb);
  cb.onStepStatus?.('app-profiles', 'done');

  // Step 5 — per-access history (opt-in)
  if (opts.includeAccessHistory) {
    await runStep('access-history', cb, () => callbackify(
      (accessesHistory as any).download,
      connection, writer,
      writer.__accessesArray || []
    ));
  } else {
    cb.onStepStatus?.('access-history', 'skipped', 'opt-in: not requested');
  }

  // Step 6 — attachments drain (opt-in)
  if (opts.includeAttachments) {
    await runStep('attachments', cb, () => callbackify(
      (attachments as any).download,
      connection, writer, state, {}
    ));
  } else {
    cb.onStepStatus?.('attachments', 'skipped', 'opt-in: not requested');
  }

  // Step 7 — HFS series drain (opt-out)
  if (opts.includeHfData) {
    await runStep('hf-data', cb, () => callbackify(
      (hfData as any).download,
      connection, writer, state, {}
    ));
  } else {
    cb.onStepStatus?.('hf-data', 'skipped', 'opt-out: skipped');
  }

  // Step 8 — webhooks drain (opt-out)
  if (opts.includeWebhooks) {
    await runStep('webhooks', cb, () => callbackify(
      (webhooksExport as any).download,
      connection, writer, state, {}
    ));
  } else {
    cb.onStepStatus?.('webhooks', 'skipped', 'opt-out: skipped');
  }

  // Persist thresholds for the next run
  await state.set('formatVersion', LocalStorageStateStore.FORMAT_VERSION);
  await state.set('toolVersion', TOOL_VERSION);
  await state.set('lastRunAt', runStartedAt);
  await state.set('events.lastModifiedSince', runStartedAt);
  await state.set('audit.lastModifiedSince', runStartedAt);

  // Export the portable sync-state.json into the final ZIP
  const snapshot = await state.export();
  await writeFile(writer, SYNC_STATE_FILE, JSON.stringify(snapshot, null, 2));

  // D9 — HDS-specific provenance manifest, also in the final ZIP
  cb.onStatus?.('Writing hds-manifest.json…');
  const dataModelCommit = await fetchDataModelCommit();
  const totalBytesSoFar = writer.downloads.reduce((acc, d) => acc + d.size, 0);
  const manifest = buildManifest({
    deploymentUrl: typeof window !== 'undefined' ? window.location.origin : '(unknown)',
    dataModelCommit,
    totalBytes: totalBytesSoFar,
    apiEndpoint
  });
  await writeFile(writer, HDS_MANIFEST_FILE, JSON.stringify(manifest, null, 2));

  await writer.finalizeBatch();

  cb.onStatus?.('Done. ' + writer.downloads.length + ' ZIP file(s) downloaded.');
  return {
    downloads: writer.downloads,
    totalBytes: writer.downloads.reduce((acc, d) => acc + d.size, 0)
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────

async function establishConnection (opts: BackupOptions): Promise<PryvConnection> {
  if (!opts.serviceInfoUrl || !opts.username || !opts.password) {
    throw new Error('serviceInfoUrl, username (or email), and password are required.');
  }

  // Resolve email → username via the registration host if the user entered
  // an email (mirrors hds-webapp + app-web-auth3-hds). No-op for bare usernames.
  const username = await resolveUsernameFromEmail(opts.serviceInfoUrl, opts.username);

  const service = new (pryv as any).Service(opts.serviceInfoUrl);
  await service.info();
  const connection = await service.login(username, opts.password, APP_ID);
  if (!connection || !connection.endpoint || !connection.token) {
    throw new Error('Login failed — if your account has MFA enabled, please use the CLI version.');
  }
  return connection;
}

async function fetchMetadata (
  connection: PryvConnection,
  writer: BrowserBlobZipStorageWriter,
  state: LocalStorageStateStore,
  opts: BackupOptions,
  cb: BackupCallbacks
): Promise<void> {
  cb.onStatus?.('Fetching account + streams + accesses + profile…');
  const streamsRes = opts.includeTrashed ? 'streams?state=all' : 'streams';
  const accessesAll = 'accesses?includeDeletions=true&includeExpired=true';

  interface ResourceItem {
    res: string;
    extra?: string;
    captureAs?: string;
    onParsed?: (doc: any) => Promise<void> | void;
  }

  const resources: ResourceItem[] = [
    { res: 'account' },
    { res: streamsRes },
    {
      res: 'accesses',
      captureAs: 'accesses',
      onParsed: (doc) => pushWebhookRefs(state, doc)
    },
    { res: accessesAll, extra: '-all' },
    { res: 'profile/private' },
    { res: 'profile/public' }
  ];

  for (const item of resources) {
    await new Promise<void>((resolve, reject) => {
      (apiResources as any).toJSONFile(
        {
          writer,
          resource: item.res,
          extraFileName: item.extra || '',
          connection,
          onParsed: item.onParsed
        },
        (err?: Error) => err ? reject(err) : resolve(),
        () => { /* progress */ }
      );
    });
    if (item.captureAs === 'accesses') {
      const buf = writer.currentEntries['accesses.json'];
      if (buf) {
        try {
          const parsed = JSON.parse(new TextDecoder().decode(buf));
          writer.__accessesArray = parsed.accesses || [];
        } catch { /* leave undefined */ }
      }
    }
  }
}

async function fetchAppProfiles (
  connection: PryvConnection,
  writer: BrowserBlobZipStorageWriter,
  cb: BackupCallbacks
): Promise<void> {
  cb.onStatus?.('Fetching per-app profiles…');
  const accesses = writer.__accessesArray ?? [];
  for (const access of accesses) {
    if (access.type !== 'app') continue;
    await new Promise<void>((resolve, reject) => {
      (apiResources as any).toJSONFile(
        {
          writer,
          resource: 'profile/app',
          filename: 'app_profiles/profile_app_' + access.id + '.json',
          connection: { endpoint: connection.endpoint, token: access.token }
        },
        (err?: Error) => err ? reject(err) : resolve(),
        () => { /* progress */ }
      );
    });
  }
}

function pushEventRefs (state: LocalStorageStateStore, events: any[]): Promise<unknown[]> {
  return Promise.all(events.map(async (e: any) => {
    if (e && Array.isArray(e.attachments)) {
      for (const att of e.attachments) {
        if (!att || !att.id) continue;
        await state.pushRef('attachment', {
          key: e.id + ':' + att.id,
          eventId: e.id,
          attId: att.id,
          fileName: att.fileName || att.id,
          readToken: att.readToken
        });
      }
    }
    if (e && typeof e.type === 'string' && e.type.indexOf('series:') === 0) {
      await state.pushRef('series-event', { key: e.id, eventId: e.id, type: e.type });
    }
  }));
}

function pushWebhookRefs (state: LocalStorageStateStore, doc: any): Promise<unknown[]> {
  const accesses = Array.isArray(doc.accesses) ? doc.accesses : [];
  return Promise.all(accesses.map(async (a: any) => {
    if (!a || typeof a.token !== 'string' || a.token.length === 0) return;
    await state.pushRef('webhook', { key: a.id, accessId: a.id, token: a.token, type: a.type });
  }));
}

async function runStep (
  id: StepId,
  cb: BackupCallbacks,
  fn: () => Promise<void>
): Promise<void> {
  cb.onStepStatus?.(id, 'active');
  cb.onStatus?.('Fetching ' + id + '…');
  await fn();
  cb.onStepStatus?.(id, 'done');
}

function callbackify (fn: any, ...args: any[]): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    fn(...args, (err: Error | undefined) => err ? reject(err) : resolve(), () => { /* progress */ });
  });
}

async function writeFile (
  writer: BrowserBlobZipStorageWriter,
  relPath: string,
  contents: string
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const ws = writer.openWriteStream(relPath);
    ws.write(strToU8(contents));
    ws.end((err?: unknown) => err ? reject(err) : resolve());
  });
}
