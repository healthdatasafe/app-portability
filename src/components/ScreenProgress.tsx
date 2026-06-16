import { RESOURCE_STEPS, type StepId, type StepStatus } from '../services/backupRunner';

interface Props {
  status: string;
  stepStatuses: Record<StepId, { status: StepStatus; label?: string }>;
  zipsReady: Array<{ name: string; size: number }>;
}

function statusIcon (status: StepStatus): string {
  switch (status) {
    case 'pending': return '○';
    case 'active': return '◐';
    case 'done': return '●';
    case 'skipped': return '—';
  }
}

export function ScreenProgress ({ status, stepStatuses, zipsReady }: Props) {
  return (
    <section className='space-y-6 max-w-2xl w-full mx-auto' aria-live='polite'>
      <h2 className='text-2xl font-bold'>Backup in progress</h2>
      <p className='text-sm text-muted-foreground'>{status}</p>

      <ol className='space-y-1 text-sm'>
        {RESOURCE_STEPS.map((step) => {
          const s = stepStatuses[step.id] ?? { status: 'pending' as const };
          return (
            <li
              key={step.id}
              className={
                'flex items-center gap-3 px-3 py-2 rounded-md ' +
                (s.status === 'active' ? 'bg-primary/10 font-medium' : '') +
                (s.status === 'done' ? ' text-muted-foreground' : '') +
                (s.status === 'skipped' ? ' opacity-50' : '')
              }
            >
              <span className='font-mono text-base w-5 text-center' aria-hidden='true'>
                {statusIcon(s.status)}
              </span>
              <span className='flex-1'>{step.label}</span>
              {s.label && <span className='text-xs text-muted-foreground'>{s.label}</span>}
            </li>
          );
        })}
      </ol>

      {zipsReady.length > 0 && (
        <div>
          <h3 className='text-sm font-medium mb-2'>Downloads</h3>
          <ul className='text-xs font-mono space-y-1'>
            {zipsReady.map((z) => (
              <li key={z.name}>{z.name} <span className='text-muted-foreground'>({prettyBytes(z.size)})</span></li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function prettyBytes (n: number): string {
  if (n > 1_000_000) return Math.round(n / 1_000_000) + ' MB';
  if (n > 1_000) return Math.round(n / 1_000) + ' KB';
  return n + ' bytes';
}
