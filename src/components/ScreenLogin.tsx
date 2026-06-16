import { useState } from 'react';
import { PriorStatePanel } from './PriorStatePanel';
import type { SyncStateSnapshot } from '../lib/LocalStorageStateStore';
import type { BackupOptions } from '../services/backupRunner';

export interface LoginSubmit extends BackupOptions {}

interface Props {
  initialApiEndpoint: string | null;
  defaultServiceInfoUrl: string;
  onSubmit: (opts: LoginSubmit) => void;
}

export function ScreenLogin ({ initialApiEndpoint, defaultServiceInfoUrl, onSubmit }: Props) {
  const [serviceInfoUrl, setServiceInfoUrl] = useState(defaultServiceInfoUrl);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [apiEndpoint, setApiEndpoint] = useState(initialApiEndpoint ?? '');
  const [useApiEndpoint, setUseApiEndpoint] = useState<boolean>(initialApiEndpoint != null);

  const [zipSizeMb, setZipSizeMb] = useState(100);
  const [includeTrashed, setIncludeTrashed] = useState(false);
  const [includeAttachments, setIncludeAttachments] = useState(false);
  const [includeHfData, setIncludeHfData] = useState(true);
  const [includeWebhooks, setIncludeWebhooks] = useState(true);
  const [includeAccessHistory, setIncludeAccessHistory] = useState(false);

  const [uploadedSyncState, setUploadedSyncState] = useState<SyncStateSnapshot | null>(null);
  const [forgottenEndpoints, setForgottenEndpoints] = useState<Set<string>>(new Set());
  const [uploadError, setUploadError] = useState<string | null>(null);

  function handleUpload (file: File) {
    setUploadError(null);
    file.text().then((text) => {
      try {
        const parsed = JSON.parse(text);
        if (parsed.format !== 'pryv-account-backup-sync-state') {
          throw new Error('Unrecognized file format (expected pryv-account-backup-sync-state).');
        }
        setUploadedSyncState(parsed);
      } catch (err) {
        setUploadError((err as Error).message ?? String(err));
      }
    });
  }

  function toggleForget (endpoint: string) {
    setForgottenEndpoints((prev) => {
      const next = new Set(prev);
      if (next.has(endpoint)) next.delete(endpoint);
      else next.add(endpoint);
      return next;
    });
  }

  function handleSubmit (e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onSubmit({
      ...(useApiEndpoint
        ? { apiEndpoint }
        : { serviceInfoUrl, username, password }),
      zipSizeMb,
      includeTrashed,
      includeAttachments,
      includeHfData,
      includeWebhooks,
      includeAccessHistory,
      uploadedSyncState,
      forgottenEndpoints
    });
  }

  return (
    <section className='space-y-6 max-w-2xl w-full mx-auto'>
      <div className='space-y-2'>
        <h2 className='text-2xl font-bold'>Download all my data</h2>
        <p className='text-muted-foreground text-sm'>
          Sign in to your Health Data Safe account to download a portable copy of your data —
          events, streams, accesses, attachments, audit logs, time-series, and webhooks. The
          download is delivered as a series of ZIP files you can keep, archive, or forward
          to another service.
        </p>
      </div>

      <PriorStatePanel
        uploadedSyncState={uploadedSyncState}
        forgottenEndpoints={forgottenEndpoints}
        onClearUpload={() => setUploadedSyncState(null)}
        onToggleForget={toggleForget}
        onUploadFile={handleUpload}
      />

      {uploadError && (
        <div role='alert' className='text-sm text-destructive'>{uploadError}</div>
      )}

      <form onSubmit={handleSubmit} className='space-y-4'>
        <div className='flex items-center gap-3 text-sm'>
          <label className='flex items-center gap-2'>
            <input
              type='radio'
              name='auth-mode'
              checked={!useApiEndpoint}
              onChange={() => setUseApiEndpoint(false)}
            />
            Username + password
          </label>
          <label className='flex items-center gap-2'>
            <input
              type='radio'
              name='auth-mode'
              checked={useApiEndpoint}
              onChange={() => setUseApiEndpoint(true)}
            />
            API endpoint URL
          </label>
        </div>

        {!useApiEndpoint
          ? (
            <fieldset className='space-y-3 border border-border rounded-md p-3'>
              <legend className='text-xs px-1 text-muted-foreground'>Credentials</legend>
              <label className='block'>
                <span className='text-sm'>Service info URL</span>
                <input
                  type='url' required value={serviceInfoUrl}
                  onChange={(e) => setServiceInfoUrl(e.target.value)}
                  className='mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
                />
              </label>
              <label className='block'>
                <span className='text-sm'>Username</span>
                <input
                  type='text' required autoComplete='username'
                  value={username} onChange={(e) => setUsername(e.target.value)}
                  className='mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
                />
              </label>
              <label className='block'>
                <span className='text-sm'>Password</span>
                <input
                  type='password' required autoComplete='current-password'
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className='mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
                />
              </label>
              <p className='text-xs text-muted-foreground'>
                If your account has SMS multi-factor authentication enabled, use the
                {' '}
                <a className='underline' href='https://github.com/pryv/pryv-account-backup' target='_blank' rel='noreferrer'>
                  CLI version
                </a>
                {' '}
                — this app does not handle MFA challenges.
              </p>
            </fieldset>
            )
          : (
            <fieldset className='space-y-3 border border-border rounded-md p-3'>
              <legend className='text-xs px-1 text-muted-foreground'>API endpoint</legend>
              <label className='block'>
                <span className='text-sm'>API endpoint URL (carries your token)</span>
                <input
                  type='url' required value={apiEndpoint}
                  onChange={(e) => setApiEndpoint(e.target.value)}
                  placeholder='https://<token>@<username>.api.datasafe.dev/'
                  className='mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono'
                />
              </label>
              <p className='text-xs text-muted-foreground'>
                The API endpoint URL is what other HDS apps store after sign-in. Treat it as
                sensitive — anyone with this URL can read your account.
              </p>
            </fieldset>
            )}

        <details className='border border-border rounded-md p-3'>
          <summary className='cursor-pointer text-sm font-medium'>Advanced</summary>
          <div className='mt-3 space-y-3'>
            <label className='block'>
              <span className='text-sm'>ZIP size — {zipSizeMb} MB per file</span>
              <input
                type='range' min={50} max={2048} step={50} value={zipSizeMb}
                onChange={(e) => setZipSizeMb(parseInt(e.target.value, 10))}
                className='mt-1 block w-full'
              />
            </label>
            <label className='flex items-center gap-2 text-sm'>
              <input type='checkbox' checked={includeTrashed} onChange={(e) => setIncludeTrashed(e.target.checked)} />
              Include trashed data
            </label>
            <label className='flex items-center gap-2 text-sm'>
              <input type='checkbox' checked={includeAttachments} onChange={(e) => setIncludeAttachments(e.target.checked)} />
              Include attachments
            </label>
            <label className='flex items-center gap-2 text-sm'>
              <input type='checkbox' checked={includeHfData} onChange={(e) => setIncludeHfData(e.target.checked)} />
              Include high-frequency series data
            </label>
            <label className='flex items-center gap-2 text-sm'>
              <input type='checkbox' checked={includeWebhooks} onChange={(e) => setIncludeWebhooks(e.target.checked)} />
              Include webhooks
            </label>
            <label className='flex items-center gap-2 text-sm'>
              <input type='checkbox' checked={includeAccessHistory} onChange={(e) => setIncludeAccessHistory(e.target.checked)} />
              Include per-access version history <span className='text-muted-foreground'>(O(N) extra calls)</span>
            </label>
          </div>
        </details>

        <button
          type='submit'
          className='w-full rounded-md bg-primary text-primary-foreground py-2 text-sm font-medium hover:opacity-90'
        >
          Start backup
        </button>

        <p className='text-xs text-muted-foreground'>
          Operator security note: the backup contains your account data including any MFA recovery codes.
          Treat the downloaded files as sensitive — transport securely; consider rotating recovery codes
          after disclosure.
        </p>
      </form>
    </section>
  );
}
