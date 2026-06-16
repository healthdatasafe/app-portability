/*
 * D9 — HDS-specific provenance manifest emitted into the FINAL ZIP alongside
 * upstream's `backup-index.json`. Upstream's `pryv-account-backup` CLI
 * restore ignores unknown files, so adding this doesn't break interop.
 *
 * Fields capture the deployment + tooling context so auditors can later
 * verify what data-model schema and app version produced the backup.
 */

import { version as APP_PORTABILITY_VERSION } from '../../package.json';

export interface HDSManifest {
  format: 'hds-portability-manifest';
  formatVersion: 1;
  appPortabilityVersion: string;
  deploymentUrl: string;
  dataModelCommit: string | null;
  backupCompletedAt: string;
  totalBytes: number;
  apiEndpoint?: string;
}

/** URL we fetch to resolve the live data-model commit at backup time. */
export const MODEL_VERSION_URL = 'https://model.datasafe.dev/version.json';

interface ModelVersionResponse {
  commit?: string;
  commitShort?: string;
}

/** Resolve the data-model commit from model.datasafe.dev/version.json.
 *  Returns null if the fetch fails — backup still proceeds, manifest
 *  records `dataModelCommit: null` so auditors see the gap.
 */
export async function fetchDataModelCommit (): Promise<string | null> {
  try {
    const res = await fetch(MODEL_VERSION_URL);
    if (!res.ok) return null;
    const body: ModelVersionResponse = await res.json();
    return body.commit || body.commitShort || null;
  } catch {
    return null;
  }
}

/** Build the manifest object. */
export function buildManifest (params: {
  deploymentUrl: string;
  dataModelCommit: string | null;
  totalBytes: number;
  apiEndpoint?: string;
}): HDSManifest {
  return {
    format: 'hds-portability-manifest',
    formatVersion: 1,
    appPortabilityVersion: APP_PORTABILITY_VERSION,
    deploymentUrl: params.deploymentUrl,
    dataModelCommit: params.dataModelCommit,
    backupCompletedAt: new Date().toISOString(),
    totalBytes: params.totalBytes,
    apiEndpoint: params.apiEndpoint
  };
}
