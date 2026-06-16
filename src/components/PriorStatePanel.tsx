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

const CARD_CLS = 'rounded-lg border border-[var(--hds-border)] bg-[var(--hds-card)] p-4 shadow-sm sm:p-6';
const LABEL_CLS = 'mb-2 block text-sm font-medium';
const LINK_BUTTON_CLS = 'text-xs text-[var(--hds-primary)] hover:underline';

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
      <div className={CARD_CLS}>
        <p className='text-sm text-[var(--hds-muted-foreground)]'>
          No prior sync state found in this browser. A full backup will run. To
          resume from a prior run, upload a <code className='font-mono'>sync-state.json</code> below.
        </p>
        <label className='mt-4 block'>
          <span className={LABEL_CLS}>Resume from a prior <code className='font-mono'>sync-state.json</code> (optional)</span>
          <input
            id='sync-state-upload-empty'
            name='sync-state-upload'
            type='file'
            accept='application/json,.json'
            className='block w-full text-sm'
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

  return (
    <div className='space-y-3'>
      {uploadedSyncState != null && (
        <div className={CARD_CLS + ' border-[var(--hds-primary)]/30 bg-[var(--hds-primary)]/5'}>
          <h3 className='mb-2 text-lg font-normal italic'>Uploaded sync state</h3>
          <dl className='text-xs grid grid-cols-2 gap-x-3 gap-y-1'>
            <dt className='text-[var(--hds-muted-foreground)]'>Tool version</dt>
            <dd>{uploadedSyncState.toolVersion ?? '—'}</dd>
            <dt className='text-[var(--hds-muted-foreground)]'>Created at</dt>
            <dd>{uploadedSyncState.createdAt ?? '—'}</dd>
            <dt className='text-[var(--hds-muted-foreground)]'>Last run at</dt>
            <dd>{fmtTime(uploadedSyncState.kv?.lastRunAt)}</dd>
            <dt className='text-[var(--hds-muted-foreground)]'>Events fetched up to</dt>
            <dd>{fmtTime(uploadedSyncState.kv?.['events.lastModifiedSince'])}</dd>
            <dt className='text-[var(--hds-muted-foreground)]'>Audit fetched up to</dt>
            <dd>{fmtTime(uploadedSyncState.kv?.['audit.lastModifiedSince'])}</dd>
          </dl>
          <p className='text-xs text-[var(--hds-muted-foreground)] mt-2'>
            This will seed the store at login and supersede any matching browser state.
          </p>
          <button type='button' onClick={onClearUpload} className={'mt-2 ' + LINK_BUTTON_CLS}>
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
              CARD_CLS +
              (isForgotten ? ' border-[var(--hds-destructive)]/40 bg-[var(--hds-destructive)]/5 opacity-70' : '')
            }
          >
            <h3 className='mb-2 text-lg font-normal italic break-all'>
              Saved state — <span className='font-mono text-sm'>{s.apiEndpoint}</span>
            </h3>
            {isForgotten
              ? (
                <p className='text-xs text-[var(--hds-muted-foreground)]'>Will be cleared at login.</p>
                )
              : (
                <dl className='text-xs grid grid-cols-2 gap-x-3 gap-y-1'>
                  <dt className='text-[var(--hds-muted-foreground)]'>Tool version</dt>
                  <dd>{(s.kv.toolVersion as string | undefined) ?? '—'}</dd>
                  <dt className='text-[var(--hds-muted-foreground)]'>Last run at</dt>
                  <dd>{fmtTime(s.kv.lastRunAt)}</dd>
                  <dt className='text-[var(--hds-muted-foreground)]'>Events fetched up to</dt>
                  <dd>{fmtTime(s.kv['events.lastModifiedSince'])}</dd>
                  <dt className='text-[var(--hds-muted-foreground)]'>Audit fetched up to</dt>
                  <dd>{fmtTime(s.kv['audit.lastModifiedSince'])}</dd>
                  <dt className='text-[var(--hds-muted-foreground)]'>Pending refs</dt>
                  <dd>{s.refsPending} (will be re-discovered)</dd>
                </dl>
                )}
            <button
              type='button'
              onClick={() => { onToggleForget(s.apiEndpoint); refresh(); }}
              className={'mt-2 ' + LINK_BUTTON_CLS}
            >
              {isForgotten ? 'Keep' : 'Reset (clear this state)'}
            </button>
          </div>
        );
      })}

      <label className='block'>
        <span className={LABEL_CLS}>Resume from a prior <code className='font-mono'>sync-state.json</code> (optional)</span>
        <input
          id='sync-state-upload'
          name='sync-state-upload'
          type='file'
          accept='application/json,.json'
          className='block w-full text-sm'
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
