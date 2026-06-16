import { useState, useEffect, useCallback } from 'react';
import { ScreenLogin, type LoginSubmit } from './components/ScreenLogin';
import { ScreenProgress } from './components/ScreenProgress';
import { ScreenDone } from './components/ScreenDone';
import { ScreenError } from './components/ScreenError';
import { runBackup, RESOURCE_STEPS, type StepId, type StepStatus } from './services/backupRunner';

type Screen =
  | { kind: 'login' }
  | { kind: 'progress' }
  | { kind: 'done'; downloads: Array<{ name: string; size: number }>; totalBytes: number }
  | { kind: 'error'; message: string };

// HDS service-info URLs — must match `dev-deploy/config/apps.yml`:
//   serviceInfoURL:
//     dev:  https://demo.datasafe.dev/reg/service/info
//     prod: https://reg.api.datasafe.dev/service/info
// Selected by hostname at runtime; same build serves either env (no separate
// VITE_HDS_ENV pass needed for this lookup).
const SERVICE_INFO_URL = {
  dev: 'https://demo.datasafe.dev/reg/service/info',
  prod: 'https://reg.api.datasafe.dev/service/info'
} as const;

function resolveServiceInfoUrl (): string {
  if (typeof window === 'undefined') return SERVICE_INFO_URL.dev;
  // `?serviceInfoUrl=…` override (intended for testing other operators).
  const override = new URL(window.location.href).searchParams.get('serviceInfoUrl');
  if (override) return override;
  // Prod hostnames live on `*.hds.ngo` (workspace-wide rule since 2026-06-11
  // — see `project_hds_ngo_domains` memory).
  const host = window.location.hostname;
  if (host.endsWith('.hds.ngo')) return SERVICE_INFO_URL.prod;
  return SERVICE_INFO_URL.dev;
}

type StepMap = Record<StepId, { status: StepStatus; label?: string }>;

function initialStepMap (): StepMap {
  const m = {} as StepMap;
  for (const step of RESOURCE_STEPS) {
    m[step.id] = { status: 'pending' };
  }
  return m;
}

export default function App () {
  const [screen, setScreen] = useState<Screen>({ kind: 'login' });
  const [status, setStatus] = useState('Connecting…');
  const [stepStatuses, setStepStatuses] = useState<StepMap>(initialStepMap);
  const [zipsReady, setZipsReady] = useState<Array<{ name: string; size: number }>>([]);

  const onSubmitLogin = useCallback(async (opts: LoginSubmit) => {
    setStatus('Connecting…');
    setStepStatuses(initialStepMap());
    setZipsReady([]);
    setScreen({ kind: 'progress' });
    try {
      const result = await runBackup(opts, {
        onStatus: setStatus,
        onStepStatus: (id, s, label) =>
          setStepStatuses((prev) => ({ ...prev, [id]: { status: s, label } })),
        onZipReady: (info) => setZipsReady((prev) => [...prev, info])
      });
      setScreen({ kind: 'done', downloads: result.downloads, totalBytes: result.totalBytes });
    } catch (err) {
      console.error('[app-portability] backup failed:', err);
      setScreen({ kind: 'error', message: (err as Error).message ?? String(err) });
    }
  }, []);

  const onReset = useCallback(() => {
    setScreen({ kind: 'login' });
  }, []);

  // Reflect screen-kind in document title for accessibility / tab switching.
  useEffect(() => {
    const titles: Record<Screen['kind'], string> = {
      login: 'HDS — Download all my data',
      progress: 'Backup in progress — HDS',
      done: 'Backup complete — HDS',
      error: 'Backup failed — HDS'
    };
    document.title = titles[screen.kind];
  }, [screen.kind]);

  return (
    <div className='min-h-screen bg-[var(--hds-background)] font-body text-[var(--hds-foreground)] flex flex-col'>
      <nav className='sticky top-0 z-50 border-b border-[var(--hds-border)] bg-[var(--hds-card)]'>
        <div className='mx-auto flex max-w-7xl items-center gap-4 px-4 py-3'>
          <a href='https://www.healthdatasafe.org' target='_blank' rel='noreferrer' className='shrink-0'>
            <img src='./hds-logo.svg' alt='Health Data Safe' className='h-10 logo-light' />
            <img src='./hds-logo-white.svg' alt='Health Data Safe' className='h-10 logo-dark' />
          </a>
          <div className='min-w-0'>
            <h1 className='font-sans text-lg font-light uppercase tracking-wide leading-tight'>
              Download all my data
            </h1>
            <div className='text-xs text-[var(--hds-muted-foreground)] truncate'>
              Self-service data portability · GDPR Art. 15 / 20 · HIPAA §164.524 · Swiss nLPD Art. 25
            </div>
          </div>
        </div>
      </nav>

      <main className='flex-1 mx-auto max-w-7xl w-full px-4 py-8'>
        {screen.kind === 'login' && (
          <ScreenLogin
            serviceInfoUrl={resolveServiceInfoUrl()}
            onSubmit={onSubmitLogin}
          />
        )}
        {screen.kind === 'progress' && (
          <ScreenProgress status={status} stepStatuses={stepStatuses} zipsReady={zipsReady} />
        )}
        {screen.kind === 'done' && (
          <ScreenDone downloads={screen.downloads} totalBytes={screen.totalBytes} onReset={onReset} />
        )}
        {screen.kind === 'error' && (
          <ScreenError message={screen.message} onReset={onReset} />
        )}
      </main>

      <footer className='border-t border-[var(--hds-border)] mt-8'>
        <div className='mx-auto max-w-7xl px-4 py-4 text-xs text-[var(--hds-muted-foreground)]'>
          Health Data Safe · BSD-3-Clause ·{' '}
          <a href='https://github.com/healthdatasafe/app-portability' target='_blank' rel='noreferrer' className='text-[var(--hds-primary)] hover:underline'>
            source
          </a>
          {' '}· powered by{' '}
          <a href='https://github.com/pryv/pryv-account-backup' target='_blank' rel='noreferrer' className='text-[var(--hds-primary)] hover:underline'>
            pryv-account-backup
          </a>
        </div>
      </footer>
    </div>
  );
}
