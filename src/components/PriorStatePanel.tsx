import { useState, useEffect, useCallback } from 'react';
import { LocalStorageStateStore, type SyncStateSnapshot } from '../lib/LocalStorageStateStore';

interface Props {
  uploadedSyncState: SyncStateSnapshot | null;
  forgottenEndpoints: Set<string>;
  onClearUpload: () => void;
  onToggleForget: (apiEndpoint: string) => void;
  onUploadFile: (file: File) => void;
}

interface SnapshotRow {
  apiEndpoint: string;
  kv: Record<string, unknown>;
  refsPending: number;
}

function fmtTime (sec: unknown): string {
  if (typeof sec !== 'number' || !Number.isFinite(sec)) return '—';
  try { return new Date(sec * 1000).toISOString(); } catch { return '—'; }
}

export function PriorStatePanel ({
  uploadedSyncState,
  forgottenEndpoints,
  onClearUpload,
  onToggleForget,
  onUploadFile
}: Props) {
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);

  const refresh = useCallback(() => {
    setSnapshots(LocalStorageStateStore.listAllSnapshots());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  if (snapshots.length === 0 && uploadedSyncState == null) {
    return (
      <p className='text-sm text-muted-foreground'>
        No prior sync state found in this browser. A full backup will run. To
        resume from a prior run, upload a <code className='font-mono'>sync-state.json</code> below.
      </p>
    );
  }

  return (
    <div className='space-y-3'>
      {uploadedSyncState != null && (
        <div className='p-3 rounded-md border border-primary/30 bg-primary/5'>
          <h3 className='font-semibold text-sm mb-2'>Uploaded sync state</h3>
          <dl className='text-xs grid grid-cols-2 gap-x-3 gap-y-1'>
            <dt className='text-muted-foreground'>Tool version</dt>
            <dd>{uploadedSyncState.toolVersion ?? '—'}</dd>
            <dt className='text-muted-foreground'>Created at</dt>
            <dd>{uploadedSyncState.createdAt ?? '—'}</dd>
            <dt className='text-muted-foreground'>Last run at</dt>
            <dd>{fmtTime(uploadedSyncState.kv?.lastRunAt)}</dd>
            <dt className='text-muted-foreground'>Events fetched up to</dt>
            <dd>{fmtTime(uploadedSyncState.kv?.['events.lastModifiedSince'])}</dd>
            <dt className='text-muted-foreground'>Audit fetched up to</dt>
            <dd>{fmtTime(uploadedSyncState.kv?.['audit.lastModifiedSince'])}</dd>
          </dl>
          <p className='text-xs text-muted-foreground mt-2'>
            This will seed the store at login and supersede any matching browser state.
          </p>
          <button
            type='button'
            onClick={onClearUpload}
            className='mt-2 text-xs underline'
          >
            Discard upload
          </button>
        </div>
      )}

      {snapshots.map((s) => {
        const isForgotten = forgottenEndpoints.has(s.apiEndpoint);
        return (
          <div
            key={s.apiEndpoint}
            className={
              'p-3 rounded-md border ' +
              (isForgotten ? 'border-destructive/40 bg-destructive/5 opacity-70' : 'border-border bg-card')
            }
          >
            <h3 className='font-semibold text-sm mb-2 break-all'>
              Saved state — <span className='font-mono'>{s.apiEndpoint}</span>
            </h3>
            {isForgotten
              ? (
                <p className='text-xs text-muted-foreground'>Will be cleared at login.</p>
                )
              : (
                <dl className='text-xs grid grid-cols-2 gap-x-3 gap-y-1'>
                  <dt className='text-muted-foreground'>Tool version</dt>
                  <dd>{(s.kv.toolVersion as string | undefined) ?? '—'}</dd>
                  <dt className='text-muted-foreground'>Last run at</dt>
                  <dd>{fmtTime(s.kv.lastRunAt)}</dd>
                  <dt className='text-muted-foreground'>Events fetched up to</dt>
                  <dd>{fmtTime(s.kv['events.lastModifiedSince'])}</dd>
                  <dt className='text-muted-foreground'>Audit fetched up to</dt>
                  <dd>{fmtTime(s.kv['audit.lastModifiedSince'])}</dd>
                  <dt className='text-muted-foreground'>Pending refs</dt>
                  <dd>{s.refsPending} (will be re-discovered)</dd>
                </dl>
                )}
            <button
              type='button'
              onClick={() => { onToggleForget(s.apiEndpoint); refresh(); }}
              className='mt-2 text-xs underline'
            >
              {isForgotten ? 'Keep' : 'Reset (clear this state)'}
            </button>
          </div>
        );
      })}

      <label className='block text-sm'>
        <span className='text-muted-foreground'>Resume from a prior <code className='font-mono'>sync-state.json</code> (optional)</span>
        <input
          type='file'
          accept='application/json,.json'
          className='mt-1 block w-full text-sm'
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUploadFile(file);
            e.target.value = '';
          }}
        />
      </label>
    </div>
  );
}
