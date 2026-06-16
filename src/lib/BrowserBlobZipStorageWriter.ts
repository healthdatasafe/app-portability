import { zipSync, strToU8 } from 'fflate';

/*
 * Ported (TS) from pryv/pryv-account-backup-webapp v0.7.0
 *   src/lib/BrowserBlobZipStorageWriter.js (BSD-3-Clause).
 *
 * Accumulates files into in-memory ZIP fragments, triggers a per-ZIP
 * `<a download>` once the accumulated size crosses a threshold, embeds a
 * cross-ZIP `backup-index.json` in the FINAL ZIP. Per Phase D upstream
 * decision: no file straddles ZIP boundaries — when a file would push the
 * current ZIP over the threshold, the current ZIP is finalized FIRST and
 * the file goes into the next ZIP.
 */

export interface BrowserBlobZipStorageWriterOpts {
  zipSizeMb?: number;
  zipPrefix?: string;
  onZipReady?: (info: { name: string; size: number }) => void;
}

interface ZipManifestEntry {
  zip: string;
  files: string[];
}

export interface WriteStreamShim {
  write(chunk: Uint8Array | string): void;
  end(cb?: (err?: unknown) => void): void;
}

export class BrowserBlobZipStorageWriter {
  private readonly zipSizeBytes: number;
  private readonly zipPrefix: string;
  private readonly onZipReady: ((info: { name: string; size: number }) => void) | null;

  // path → Uint8Array (entries pending in the current ZIP)
  currentEntries: Record<string, Uint8Array> = {};
  private currentBytes = 0;
  private zipIndex = 1;
  private zipManifest: ZipManifestEntry[] = [];

  downloads: Array<{ name: string; size: number }> = [];

  // Set by the metadata step's accesses capture; consumed by the
  // per-app-profiles and access-history steps.
  __accessesArray: any[] | undefined;

  constructor (opts: BrowserBlobZipStorageWriterOpts = {}) {
    this.zipSizeBytes = (opts.zipSizeMb ?? 100) * 1024 * 1024;
    this.zipPrefix = opts.zipPrefix ?? 'backup';
    this.onZipReady = opts.onZipReady ?? null;
  }

  /**
   * Per StorageWriter contract: open a writable shim that accumulates
   * chunks into memory; on end(), commit to the current ZIP.
   */
  openWriteStream (relPath: string): WriteStreamShim {
    const chunks: Uint8Array[] = [];
    const addEntry = (buf: Uint8Array) => this._addEntry(relPath, buf);
    return {
      write (chunk: Uint8Array | string) {
        if (typeof chunk === 'string') chunks.push(strToU8(chunk));
        else chunks.push(chunk);
      },
      end (cb?: (err?: unknown) => void) {
        const total = chunks.reduce((acc, c) => acc + c.byteLength, 0);
        const buf = new Uint8Array(total);
        let off = 0;
        for (const c of chunks) { buf.set(c, off); off += c.byteLength; }
        addEntry(buf).then(
          () => cb && cb(),
          (err) => cb && cb(err)
        );
      }
    };
  }

  /** Per StorageWriter contract — browser has no persistent inter-run state at file level. */
  exists (): boolean { return false; }
  describeTarget (): string { return '(browser ZIP downloads)'; }

  private async _addEntry (relPath: string, buf: Uint8Array): Promise<void> {
    const willOverflow = this.currentBytes > 0 &&
      this.currentBytes + buf.byteLength > this.zipSizeBytes;
    if (willOverflow) {
      await this._finalizeCurrentZip(false);
    }
    this.currentEntries[relPath] = buf;
    this.currentBytes += buf.byteLength;
  }

  private async _finalizeCurrentZip (isLast: boolean): Promise<void> {
    if (Object.keys(this.currentEntries).length === 0 && !isLast) return;
    const zipName = this.zipPrefix + '-' + String(this.zipIndex).padStart(3, '0') + '.zip';
    this.zipManifest.push({
      zip: zipName,
      files: Object.keys(this.currentEntries)
    });
    if (isLast) {
      const indexJson = JSON.stringify({
        format: 'pryv-account-backup-webapp/0.7.0',
        zips: this.zipManifest
      }, null, 2);
      this.currentEntries['backup-index.json'] = strToU8(indexJson);
    }
    const zipped = zipSync(this.currentEntries);
    const blob = new Blob([new Uint8Array(zipped)], { type: 'application/zip' });
    this._triggerDownload(blob, zipName);
    this.downloads.push({ name: zipName, size: zipped.byteLength });
    this.onZipReady?.({ name: zipName, size: zipped.byteLength });
    this.currentEntries = {};
    this.currentBytes = 0;
    this.zipIndex += 1;
  }

  private _triggerDownload (blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  /** Finalize any pending ZIP (called when the backup orchestration ends). */
  async finalizeBatch (): Promise<void> {
    await this._finalizeCurrentZip(true);
  }
}
