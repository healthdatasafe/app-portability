/*
 * Local declarations for the pryv-account-backup method modules imported by
 * src/services/backupRunner.ts. The package (v0.7.1) ships plain CommonJS with
 * no .d.ts; these mirror the JSDoc signatures in its src/methods/*.js.
 *
 * Every download/toJSONFile takes a node-style `callback (err)` and an
 * optional `log (msg)`.
 */

declare namespace PryvAccountBackup {
  interface Connection { endpoint: string; token: string }

  /** Storage adapter (BrowserBlobZipStorageWriter in this app). */
  interface StorageWriter {
    openWriteStream (relPath: string): unknown;
    exists? (relPath?: string): boolean;
    describeTarget? (): string;
  }

  /** Work-queue adapter (LocalStorageStateStore in this app). */
  interface StateStore {
    listPending (category: string): Promise<unknown[]>;
    markDone (category: string, refKey: string): Promise<void>;
  }

  type Callback = (err?: Error) => void;
  type Log = (msg: string) => void;
}

declare module 'pryv-account-backup/src/methods/api-resources.js' {
  interface ToJSONFileParams {
    writer: PryvAccountBackup.StorageWriter;
    resource: string;
    connection: PryvAccountBackup.Connection;
    extraFileName?: string;
    filename?: string;
    /** Awaited before the callback fires; its result is ignored. */
    onParsed?: (doc: any) => unknown;
  }
  const apiResources: {
    toJSONFile (params: ToJSONFileParams, callback: PryvAccountBackup.Callback, log?: PryvAccountBackup.Log): void;
  };
  export default apiResources;
}

declare module 'pryv-account-backup/src/methods/events-chunked.js' {
  export function download (
    connection: PryvAccountBackup.Connection,
    writer: PryvAccountBackup.StorageWriter,
    options: {
      includeTrashed?: boolean;
      modifiedSince?: number | null;
      runStartedAt?: number;
      fromTime?: number;
      toTime?: number;
      chunkMonths?: number;
      onEvents?: (events: any[]) => unknown;
    },
    callback: PryvAccountBackup.Callback,
    log?: PryvAccountBackup.Log
  ): void;
}

declare module 'pryv-account-backup/src/methods/audit-as-events.js' {
  export function download (
    connection: PryvAccountBackup.Connection,
    writer: PryvAccountBackup.StorageWriter,
    options: { includeTrashed?: boolean; modifiedSince?: number | null },
    callback: PryvAccountBackup.Callback,
    log?: PryvAccountBackup.Log
  ): void;
}

declare module 'pryv-account-backup/src/methods/accesses-history.js' {
  export function download (
    connection: PryvAccountBackup.Connection,
    writer: PryvAccountBackup.StorageWriter,
    accessesArray: any[],
    callback: PryvAccountBackup.Callback,
    log?: PryvAccountBackup.Log
  ): void;
}

declare module 'pryv-account-backup/src/methods/attachments.js' {
  export const CATEGORY: string;
  export function download (
    connection: PryvAccountBackup.Connection,
    writer: PryvAccountBackup.StorageWriter,
    stateStore: PryvAccountBackup.StateStore,
    options: { concurrency?: number },
    callback: PryvAccountBackup.Callback,
    log?: PryvAccountBackup.Log
  ): void;
}

declare module 'pryv-account-backup/src/methods/hf-data.js' {
  export const CATEGORY: string;
  export function download (
    connection: PryvAccountBackup.Connection,
    writer: PryvAccountBackup.StorageWriter,
    stateStore: PryvAccountBackup.StateStore,
    options: { concurrency?: number },
    callback: PryvAccountBackup.Callback,
    log?: PryvAccountBackup.Log
  ): void;
}

declare module 'pryv-account-backup/src/methods/webhooks-export.js' {
  export const CATEGORY: string;
  export function download (
    connection: PryvAccountBackup.Connection,
    writer: PryvAccountBackup.StorageWriter,
    stateStore: PryvAccountBackup.StateStore,
    options: { concurrency?: number },
    callback: PryvAccountBackup.Callback,
    log?: PryvAccountBackup.Log
  ): void;
}
