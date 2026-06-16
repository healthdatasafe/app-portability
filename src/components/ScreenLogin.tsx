import { useState } from 'react';
import { PriorStatePanel } from './PriorStatePanel';
import type { SyncStateSnapshot } from '../lib/LocalStorageStateStore';
import type { BackupOptions } from '../services/backupRunner';

export interface LoginSubmit extends BackupOptions {}

interface Props {
  serviceInfoUrl: string;
  onSubmit: (opts: LoginSubmit) => void;
}

// Tailwind class fragments aligned with the HDS style guide
// (style.datasafe.dev — see style/src/index.html for canonical shapes).
const INPUT_CLS =
  'block w-full rounded-lg border border-[var(--hds-input)] bg-[var(--hds-card)] p-2.5 text-sm ' +
  'focus:border-[var(--hds-ring)] focus:ring-[var(--hds-ring)] focus:ring-4 focus:outline-none';
const LABEL_CLS = 'mb-2 block text-sm font-medium';
const FIELDSET_CLS = 'space-y-4 rounded-lg border border-[var(--hds-border)] bg-[var(--hds-card)] p-4 shadow-sm sm:p-6';
const PRIMARY_BUTTON_CLS =
  'w-full rounded-lg bg-[var(--hds-primary)] px-5 py-2.5 text-sm font-medium ' +
  'text-[var(--hds-primary-foreground)] hover:opacity-90 focus:ring-4 focus:ring-[var(--hds-ring)] focus:outline-none';
const SECTION_H2_CLS = 'mb-6 font-sans text-2xl font-light uppercase tracking-wide';

export function ScreenLogin ({ serviceInfoUrl, onSubmit }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

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
      serviceInfoUrl,
      username,
      password,
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
    <section className='space-y-8 max-w-2xl w-full mx-auto'>
      <div className='space-y-2'>
        <h2 className={SECTION_H2_CLS}>Download All My Data</h2>
        <p className='text-[var(--hds-muted-foreground)] text-sm'>
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
        <div role='alert' className='rounded-lg border border-[var(--hds-destructive)] bg-[var(--hds-destructive)]/10 px-4 py-3 text-sm text-[var(--hds-destructive)]'>
          {uploadError}
        </div>
      )}

      <form onSubmit={handleSubmit} className='space-y-6' noValidate>
        <fieldset className={FIELDSET_CLS}>
          <legend className='px-2 text-xs font-medium uppercase tracking-wide text-[var(--hds-muted-foreground)]'>Sign in</legend>
          <div>
            <label className={LABEL_CLS} htmlFor='identifier'>Email or username</label>
            <input
              id='identifier' name='identifier'
              type='text' required autoComplete='username'
              autoCapitalize='none' autoCorrect='off' spellCheck={false}
              inputMode='email'
              placeholder='your.email@example.com or username'
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label className={LABEL_CLS} htmlFor='password'>Password</label>
            <input
              id='password' name='password'
              type='password' required autoComplete='current-password'
              value={password} onChange={(e) => setPassword(e.target.value)}
              className={INPUT_CLS}
            />
          </div>
          <p className='text-xs text-[var(--hds-muted-foreground)]'>
            If your account has SMS multi-factor authentication enabled, use the
            {' '}
            <a className='text-[var(--hds-primary)] hover:underline' href='https://github.com/pryv/pryv-account-backup' target='_blank' rel='noreferrer'>
              CLI version
            </a>
            {' '}— this app does not handle MFA challenges.
          </p>
        </fieldset>

        <details className='rounded-lg border border-[var(--hds-border)] bg-[var(--hds-card)] p-4 shadow-sm sm:p-6'>
          <summary className='cursor-pointer text-sm font-medium'>Advanced</summary>
          <div className='mt-4 space-y-4'>
            <div>
              <label className={LABEL_CLS} htmlFor='zipSizeMb'>
                ZIP size — {zipSizeMb} MB per file
              </label>
              <input
                id='zipSizeMb' name='zipSizeMb'
                type='range' min={50} max={2048} step={50} value={zipSizeMb}
                onChange={(e) => setZipSizeMb(parseInt(e.target.value, 10))}
                className='block w-full accent-[var(--hds-primary)]'
              />
            </div>
            <div className='flex items-center gap-2'>
              <input
                id='includeTrashed' name='includeTrashed' type='checkbox'
                className='h-4 w-4 rounded border-[var(--hds-input)] accent-[var(--hds-primary)]'
                checked={includeTrashed} onChange={(e) => setIncludeTrashed(e.target.checked)}
              />
              <label className='text-sm font-medium' htmlFor='includeTrashed'>Include trashed data</label>
            </div>
            <div className='flex items-center gap-2'>
              <input
                id='includeAttachments' name='includeAttachments' type='checkbox'
                className='h-4 w-4 rounded border-[var(--hds-input)] accent-[var(--hds-primary)]'
                checked={includeAttachments} onChange={(e) => setIncludeAttachments(e.target.checked)}
              />
              <label className='text-sm font-medium' htmlFor='includeAttachments'>Include attachments</label>
            </div>
            <div className='flex items-center gap-2'>
              <input
                id='includeHfData' name='includeHfData' type='checkbox'
                className='h-4 w-4 rounded border-[var(--hds-input)] accent-[var(--hds-primary)]'
                checked={includeHfData} onChange={(e) => setIncludeHfData(e.target.checked)}
              />
              <label className='text-sm font-medium' htmlFor='includeHfData'>Include high-frequency series data</label>
            </div>
            <div className='flex items-center gap-2'>
              <input
                id='includeWebhooks' name='includeWebhooks' type='checkbox'
                className='h-4 w-4 rounded border-[var(--hds-input)] accent-[var(--hds-primary)]'
                checked={includeWebhooks} onChange={(e) => setIncludeWebhooks(e.target.checked)}
              />
              <label className='text-sm font-medium' htmlFor='includeWebhooks'>Include webhooks</label>
            </div>
            <div className='flex items-center gap-2'>
              <input
                id='includeAccessHistory' name='includeAccessHistory' type='checkbox'
                className='h-4 w-4 rounded border-[var(--hds-input)] accent-[var(--hds-primary)]'
                checked={includeAccessHistory} onChange={(e) => setIncludeAccessHistory(e.target.checked)}
              />
              <label className='text-sm font-medium' htmlFor='includeAccessHistory'>
                Include per-access version history{' '}
                <span className='text-[var(--hds-muted-foreground)]'>(O(N) extra calls)</span>
              </label>
            </div>
          </div>
        </details>

        <button type='submit' className={PRIMARY_BUTTON_CLS}>
          Start backup
        </button>

        <p className='text-xs text-[var(--hds-muted-foreground)]'>
          Operator security note: the backup contains your account data including any MFA recovery codes.
          Treat the downloaded files as sensitive — transport securely; consider rotating recovery codes
          after disclosure.
        </p>
      </form>
    </section>
  );
}
