import { describe, it, expect, beforeEach, vi } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { BrowserBlobZipStorageWriter } from '../src/lib/BrowserBlobZipStorageWriter';

const captured: Array<{ name: string; buf: Uint8Array }> = [];
let createObjectURLSpy: any;
let clickSpy: any;

function writeStr (writer: BrowserBlobZipStorageWriter, path: string, contents: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const ws = writer.openWriteStream(path);
    ws.write(contents);
    ws.end((err) => err ? reject(err) : resolve());
  });
}

function writeBytes (writer: BrowserBlobZipStorageWriter, path: string, n: number): Promise<void> {
  const buf = new Uint8Array(n).fill(65);
  return new Promise<void>((resolve, reject) => {
    const ws = writer.openWriteStream(path);
    ws.write(buf);
    ws.end((err) => err ? reject(err) : resolve());
  });
}

describe('BrowserBlobZipStorageWriter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    captured.length = 0;
    // Capture the bytes that would be downloaded — read the blob synchronously
    // via FileReader since URL.createObjectURL only returns a blob: URL.
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      (blob as Blob).arrayBuffer().then((ab) => {
        // Push by reference into the captured array.
        captured[captured.length - 1].buf = new Uint8Array(ab);
      }).catch(() => { /* swallow */ });
      return 'blob:fake';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    // Stub the <a download> click() to also record the filename
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      captured.push({ name: this.download, buf: new Uint8Array(0) });
    });
  });

  it('produces a single ZIP when total size is below threshold', async () => {
    const writer = new BrowserBlobZipStorageWriter({ zipSizeMb: 1 });
    await writeStr(writer, 'account.json', '{"k":1}');
    await writeStr(writer, 'streams.json', '[]');
    await writer.finalizeBatch();
    expect(writer.downloads).toHaveLength(1);
    expect(writer.downloads[0].name).toBe('backup-001.zip');
  });

  it('embeds backup-index.json in the LAST ZIP only', async () => {
    const writer = new BrowserBlobZipStorageWriter({ zipSizeMb: 1 });
    await writeStr(writer, 'account.json', '{"k":1}');
    await writer.finalizeBatch();
    // Wait for blob.arrayBuffer() to resolve
    await new Promise((resolve) => setTimeout(resolve, 50));
    const lastBuf = captured[captured.length - 1].buf;
    const entries = unzipSync(lastBuf);
    expect(Object.keys(entries)).toContain('backup-index.json');
    const index = JSON.parse(strFromU8(entries['backup-index.json']));
    expect(index.format).toMatch(/^pryv-account-backup-webapp\//);
    expect(Array.isArray(index.zips)).toBe(true);
  });

  it('splits across multiple ZIPs when the threshold is exceeded', async () => {
    const writer = new BrowserBlobZipStorageWriter({ zipSizeMb: 1 }); // 1 MB
    // Three ~0.5 MB files → first ZIP holds two, second holds the rest.
    await writeBytes(writer, 'a', 600_000);
    await writeBytes(writer, 'b', 600_000);
    await writeBytes(writer, 'c', 600_000);
    await writer.finalizeBatch();
    expect(writer.downloads.length).toBeGreaterThanOrEqual(2);
  });

  it('does not straddle a file across ZIP boundaries', async () => {
    const writer = new BrowserBlobZipStorageWriter({ zipSizeMb: 1 });
    await writeBytes(writer, 'a', 700_000);
    await writeBytes(writer, 'b', 700_000); // would push over — should start new ZIP
    await writer.finalizeBatch();
    await new Promise((resolve) => setTimeout(resolve, 50));
    // Each captured ZIP must contain whole files (one or two, depending on layout)
    for (const c of captured) {
      const entries = unzipSync(c.buf);
      // Every entry should have non-zero length (no partial fragments)
      for (const path of Object.keys(entries)) {
        if (path === 'backup-index.json') continue;
        expect(entries[path].byteLength).toBeGreaterThan(0);
      }
    }
  });

  it('invokes onZipReady once per finalized ZIP', async () => {
    const onZipReady = vi.fn();
    const writer = new BrowserBlobZipStorageWriter({ zipSizeMb: 1, onZipReady });
    await writeStr(writer, 'one.json', 'x');
    await writer.finalizeBatch();
    expect(onZipReady).toHaveBeenCalledTimes(1);
    expect(onZipReady.mock.calls[0][0]).toMatchObject({ name: 'backup-001.zip' });
  });

  it('passes through __accessesArray for downstream steps', () => {
    const writer = new BrowserBlobZipStorageWriter();
    writer.__accessesArray = [{ id: 'x', type: 'app' }];
    expect(writer.__accessesArray).toHaveLength(1);
  });

  it('createObjectURL + click() invoked per ZIP', async () => {
    const writer = new BrowserBlobZipStorageWriter({ zipSizeMb: 1 });
    await writeStr(writer, 'a.json', 'x');
    await writer.finalizeBatch();
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});
