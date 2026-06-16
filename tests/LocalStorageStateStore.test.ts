import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageStateStore } from '../src/lib/LocalStorageStateStore';

const FAKE_ENDPOINT = 'https://token@username.api.example.com/';

describe('LocalStorageStateStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('rejects construction without an apiEndpoint', () => {
    expect(() => new LocalStorageStateStore('')).toThrow(/requires an apiEndpoint/);
  });

  it('round-trips kv values', async () => {
    const s = new LocalStorageStateStore(FAKE_ENDPOINT);
    await s.set('foo', 'bar');
    await s.set('n', 42);
    expect(await s.get('foo')).toBe('bar');
    expect(await s.get('n')).toBe(42);
  });

  it('persists across instances on the same endpoint', async () => {
    const a = new LocalStorageStateStore(FAKE_ENDPOINT);
    await a.set('lastRunAt', 123);
    const b = new LocalStorageStateStore(FAKE_ENDPOINT);
    expect(await b.get('lastRunAt')).toBe(123);
  });

  it('namespaces state by apiEndpoint (no cross-contamination)', async () => {
    const a = new LocalStorageStateStore(FAKE_ENDPOINT);
    await a.set('lastRunAt', 1);
    const b = new LocalStorageStateStore('https://other@example/');
    expect(await b.get('lastRunAt')).toBeUndefined();
  });

  it('pushRef dedupes by key', async () => {
    const s = new LocalStorageStateStore(FAKE_ENDPOINT);
    await s.pushRef('attachment', { key: 'e1:a1', eventId: 'e1', attId: 'a1' });
    await s.pushRef('attachment', { key: 'e1:a1', eventId: 'e1', attId: 'a1' });
    const pending = await s.listPending('attachment');
    expect(pending).toHaveLength(1);
  });

  it('markDone hides a ref from listPending', async () => {
    const s = new LocalStorageStateStore(FAKE_ENDPOINT);
    await s.pushRef('attachment', { key: 'e1:a1', eventId: 'e1' });
    await s.markDone('attachment', 'e1:a1');
    expect(await s.listPending('attachment')).toHaveLength(0);
  });

  it('clearCategory drops only the named category', async () => {
    const s = new LocalStorageStateStore(FAKE_ENDPOINT);
    await s.pushRef('attachment', { key: 'a' });
    await s.pushRef('webhook', { key: 'w' });
    await s.clearCategory('attachment');
    expect(await s.listPending('attachment')).toHaveLength(0);
    expect(await s.listPending('webhook')).toHaveLength(1);
  });

  it('exports a portable snapshot and re-imports it', async () => {
    const a = new LocalStorageStateStore(FAKE_ENDPOINT);
    await a.set('lastRunAt', 1700000000);
    await a.set('events.lastModifiedSince', 1700000000);
    const snap = await a.export();
    expect(snap.format).toBe('pryv-account-backup-sync-state');
    expect(snap.formatVersion).toBe(1);
    expect(snap.kv.lastRunAt).toBe(1700000000);

    localStorage.clear();
    const b = new LocalStorageStateStore(FAKE_ENDPOINT);
    await b.import(snap);
    expect(await b.get('lastRunAt')).toBe(1700000000);
  });

  it('rejects unknown sync-state format', async () => {
    const s = new LocalStorageStateStore(FAKE_ENDPOINT);
    await expect(s.import({ format: 'something-else' })).rejects.toThrow(/unrecognized format/);
  });

  it('rejects unsupported formatVersion', async () => {
    const s = new LocalStorageStateStore(FAKE_ENDPOINT);
    await expect(s.import({
      format: 'pryv-account-backup-sync-state',
      formatVersion: 999
    })).rejects.toThrow(/unsupported formatVersion/);
  });

  it('listAllSnapshots enumerates snapshots across endpoints', async () => {
    const a = new LocalStorageStateStore('https://a@ex/');
    await a.set('lastRunAt', 1);
    const b = new LocalStorageStateStore('https://b@ex/');
    await b.set('lastRunAt', 2);
    const all = LocalStorageStateStore.listAllSnapshots();
    expect(all.map((s) => s.apiEndpoint).sort()).toEqual(['https://a@ex/', 'https://b@ex/']);
  });

  it('dropSnapshot removes a single endpoint snapshot', async () => {
    const a = new LocalStorageStateStore(FAKE_ENDPOINT);
    await a.set('lastRunAt', 1);
    LocalStorageStateStore.dropSnapshot(FAKE_ENDPOINT);
    expect(LocalStorageStateStore.listAllSnapshots()).toHaveLength(0);
  });

  it('handles a corrupted localStorage entry by starting fresh', async () => {
    localStorage.setItem(LocalStorageStateStore.KEY_PREFIX + FAKE_ENDPOINT, 'not-json{{{');
    const s = new LocalStorageStateStore(FAKE_ENDPOINT);
    expect(await s.get('anything')).toBeUndefined();
  });
});
