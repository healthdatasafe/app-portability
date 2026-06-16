/*
 * Ported (TS) from pryv/pryv-account-backup-webapp v0.7.0
 *   src/lib/LocalStorageStateStore.js (BSD-3-Clause).
 *
 * Persists kv state + per-category work refs under a single localStorage
 * key. Mirrors the FolderStateStore interface from @pryv/account-backup so
 * the orchestrator drives both flavors uniformly.
 *
 * Cross-session incremental depends on export() / import(): the run-end ZIP
 * carries an exported `sync-state.json` (kv only); the subject keeps it and
 * uploads it back at the start of the next run to seed the store.
 */

const FORMAT = 'pryv-account-backup-sync-state';
const FORMAT_VERSION = 1;

export interface SyncStateSnapshot {
  format: typeof FORMAT;
  formatVersion: typeof FORMAT_VERSION;
  toolVersion: string | null;
  createdAt: string;
  kv: Record<string, unknown>;
}

export interface BackupRef {
  key: string;
  done?: boolean;
  [extra: string]: unknown;
}

interface StoreInternal {
  kv: Record<string, unknown>;
  refs: Record<string, BackupRef[]>;
}

export class LocalStorageStateStore {
  static readonly FORMAT = FORMAT;
  static readonly FORMAT_VERSION = FORMAT_VERSION;
  static readonly KEY_PREFIX = 'pryv-account-backup:state:';

  private readonly key: string;
  private state: StoreInternal;

  constructor (apiEndpoint: string) {
    if (!apiEndpoint) throw new Error('LocalStorageStateStore requires an apiEndpoint');
    this.key = LocalStorageStateStore.KEY_PREFIX + apiEndpoint;
    this.state = this._load();
  }

  private _load (): StoreInternal {
    const empty: StoreInternal = { kv: {}, refs: {} };
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return empty;
      const parsed = JSON.parse(raw);
      if (parsed == null || typeof parsed !== 'object') return empty;
      // Pre-v0.7.0 entries were flat kv objects. Hoist into `kv` on load.
      if (parsed.kv == null && parsed.refs == null) {
        return { kv: parsed, refs: {} };
      }
      return {
        kv: parsed.kv && typeof parsed.kv === 'object' ? parsed.kv : {},
        refs: parsed.refs && typeof parsed.refs === 'object' ? parsed.refs : {}
      };
    } catch {
      // Corrupted or quota'd — start fresh; the backup will fall back to
      // the initial-fetch path.
      return empty;
    }
  }

  // ─── Key/value state ───

  async get (k: string): Promise<unknown> { return this.state.kv[k]; }

  async set (k: string, v: unknown): Promise<void> {
    this.state.kv[k] = v;
    await this.flush();
  }

  async getAll (): Promise<Record<string, unknown>> { return { ...this.state.kv }; }

  async flush (): Promise<void> {
    localStorage.setItem(this.key, JSON.stringify(this.state));
  }

  // ─── Per-category ref tracking ───

  async pushRef (category: string, ref: BackupRef): Promise<void> {
    if (ref == null || typeof ref.key !== 'string') {
      throw new Error('StateStore.pushRef requires ref.key (string)');
    }
    const list = this.state.refs[category] || (this.state.refs[category] = []);
    if (list.some((r) => r.key === ref.key)) return;
    list.push({ ...ref, done: false });
    await this.flush();
  }

  async listPending (category: string): Promise<BackupRef[]> {
    const list = this.state.refs[category] || [];
    return list.filter((r) => !r.done).map((r) => ({ ...r }));
  }

  async markDone (category: string, refKey: string): Promise<void> {
    const list = this.state.refs[category] || [];
    const found = list.find((r) => r.key === refKey);
    if (found) {
      found.done = true;
      await this.flush();
    }
  }

  async clearCategory (category: string): Promise<void> {
    if (this.state.refs[category]) {
      delete this.state.refs[category];
      await this.flush();
    }
  }

  // ─── Portable export / import ───

  async export (): Promise<SyncStateSnapshot> {
    return {
      format: FORMAT,
      formatVersion: FORMAT_VERSION,
      toolVersion: (this.state.kv.toolVersion as string | undefined) ?? null,
      createdAt: new Date().toISOString(),
      kv: { ...this.state.kv }
    };
  }

  async import (data: unknown): Promise<void> {
    if (data == null || (data as SyncStateSnapshot).format !== FORMAT) {
      throw new Error('StateStore.import: unrecognized format (expected ' + FORMAT + ')');
    }
    const snap = data as SyncStateSnapshot;
    if (snap.formatVersion !== FORMAT_VERSION) {
      throw new Error('StateStore.import: unsupported formatVersion ' +
        snap.formatVersion + ' (expected ' + FORMAT_VERSION + ')');
    }
    this.state.kv = (snap.kv && typeof snap.kv === 'object') ? { ...snap.kv } : {};
    await this.flush();
  }

  /** Enumerate all sync-state snapshots present in this browser. */
  static listAllSnapshots (): Array<{ apiEndpoint: string; kv: Record<string, unknown>; refsPending: number }> {
    const out: Array<{ apiEndpoint: string; kv: Record<string, unknown>; refsPending: number }> = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(LocalStorageStateStore.KEY_PREFIX)) continue;
      try {
        const raw = localStorage.getItem(key);
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed == null) continue;
        const kv = parsed.kv || parsed; // hoist pre-v0.7.0 flat layout
        const refs: Record<string, BackupRef[]> = parsed.refs || {};
        let pending = 0;
        for (const cat of Object.keys(refs)) {
          for (const r of refs[cat] || []) if (!r.done) pending++;
        }
        out.push({
          apiEndpoint: key.slice(LocalStorageStateStore.KEY_PREFIX.length),
          kv: kv || {},
          refsPending: pending
        });
      } catch { /* skip unreadable */ }
    }
    return out;
  }

  static dropSnapshot (apiEndpoint: string): void {
    localStorage.removeItem(LocalStorageStateStore.KEY_PREFIX + apiEndpoint);
  }
}
