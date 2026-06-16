import { useState, useEffect, useCallback } from 'react';
import { ScreenLogin, type LoginSubmit } from './components/ScreenLogin';
import { ScreenProgress } from './components/ScreenProgress';
import { ScreenDone } from './components/ScreenDone';
import { ScreenError } from './components/ScreenError';
import { runBackup, RESOURCE_STEPS, type StepId, type StepStatus } from './services/backupRunner';
import { consumeAuthFromUrl, clearStoredApiEndpoint } from './services/auth';

type Screen =
  | { kind: 'login'; initialApiEndpoint: string | null }
  | { kind: 'progress' }
  | { kind: 'done'; downloads: Array<{ name: string; size: number }>; totalBytes: number }
  | { kind: 'error'; message: string };

// Best-effort default: HDS demo service-info URL. Subjects can override.
const DEFAULT_SERVICE_INFO_URL = 'https://demo.datasafe.dev/reg/service/info';

type StepMap = Record<StepId, { status: StepStatus; label?: string }>;

function initialStepMap (): StepMap {
  const m = {} as StepMap;
  for (const step of RESOURCE_STEPS) {
    m[step.id] = { status: 'pending' };
  }
  return m;
}

export default function App () {
  const [screen, setScreen] = useState<Screen>(() => ({
    kind: 'login',
    initialApiEndpoint: consumeAuthFromUrl()?.apiEndpoint ?? null
  }));
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
    clearStoredApiEndpoint();
    setScreen({ kind: 'login', initialApiEndpoint: null });
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
    <div className='min-h-screen bg-background text-foreground flex flex-col'>
      <header className='border-b border-border px-6 py-3 bg-card flex items-center gap-4'>
        <a href='https://www.healthdatasafe.org' target='_blank' rel='noreferrer' className='shrink-0'>
          <img src='./hds-logo.svg' alt='HDS' className='h-10 logo-light' />
          <img src='./hds-logo-white.svg' alt='HDS' className='h-10 logo-dark' />
        </a>
        <div className='min-w-0'>
          <h1 className='text-xl font-bold leading-tight'>HDS — Download all my data</h1>
          <div className='text-xs text-muted-foreground truncate'>
            Self-service data portability — GDPR Art. 15 / 20 · HIPAA §164.524 · Swiss nLPD Art. 25
          </div>
        </div>
      </header>

      <main className='flex-1 px-6 py-8'>
        {screen.kind === 'login' && (
          <ScreenLogin
            initialApiEndpoint={screen.initialApiEndpoint}
            defaultServiceInfoUrl={DEFAULT_SERVICE_INFO_URL}
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

      <footer className='border-t border-border px-6 py-3 text-xs text-muted-foreground'>
        Health Data Safe · BSD-3-Clause ·{' '}
        <a href='https://github.com/healthdatasafe/app-portability' target='_blank' rel='noreferrer' className='underline'>
          source
        </a>
        {' '}· powered by{' '}
        <a href='https://github.com/pryv/pryv-account-backup' target='_blank' rel='noreferrer' className='underline'>
          pryv-account-backup
        </a>
      </footer>
    </div>
  );
}
