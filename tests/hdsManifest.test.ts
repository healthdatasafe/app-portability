import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildManifest, fetchDataModelCommit, MODEL_VERSION_URL } from '../src/lib/hdsManifest';

describe('hdsManifest', () => {
  describe('buildManifest', () => {
    it('produces a well-shaped manifest', () => {
      const m = buildManifest({
        deploymentUrl: 'https://portability.hds.ngo',
        dataModelCommit: 'abcdef0',
        totalBytes: 12345
      });
      expect(m.format).toBe('hds-portability-manifest');
      expect(m.formatVersion).toBe(1);
      expect(m.deploymentUrl).toBe('https://portability.hds.ngo');
      expect(m.dataModelCommit).toBe('abcdef0');
      expect(m.totalBytes).toBe(12345);
      expect(typeof m.appPortabilityVersion).toBe('string');
      expect(m.appPortabilityVersion.length).toBeGreaterThan(0);
      expect(new Date(m.backupCompletedAt).toString()).not.toBe('Invalid Date');
    });

    it('serializes to JSON cleanly', () => {
      const m = buildManifest({
        deploymentUrl: 'https://x',
        dataModelCommit: null,
        totalBytes: 0,
        apiEndpoint: 'https://t@u.api.example/'
      });
      const json = JSON.stringify(m);
      const back = JSON.parse(json);
      expect(back.dataModelCommit).toBeNull();
      expect(back.apiEndpoint).toBe('https://t@u.api.example/');
    });
  });

  describe('fetchDataModelCommit', () => {
    beforeEach(() => {
      vi.unstubAllGlobals();
    });

    it('returns the commit when fetch succeeds', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => ({
        ok: true,
        json: async () => ({ commit: 'deadbeef', commitShort: 'dead' })
      })));
      const commit = await fetchDataModelCommit();
      expect(commit).toBe('deadbeef');
      expect((globalThis.fetch as any).mock.calls[0][0]).toBe(MODEL_VERSION_URL);
    });

    it('falls back to commitShort when commit is missing', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => ({
        ok: true,
        json: async () => ({ commitShort: 'abc1234' })
      })));
      expect(await fetchDataModelCommit()).toBe('abc1234');
    });

    it('returns null when fetch is not ok', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })));
      expect(await fetchDataModelCommit()).toBeNull();
    });

    it('returns null when fetch throws (network down)', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
      expect(await fetchDataModelCommit()).toBeNull();
    });
  });
});
