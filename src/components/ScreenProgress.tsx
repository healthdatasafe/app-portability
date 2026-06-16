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

const SECTION_H2_CLS = 'mb-6 font-sans text-2xl font-light uppercase tracking-wide';
const CARD_CLS = 'rounded-lg border border-[var(--hds-border)] bg-[var(--hds-card)] p-4 shadow-sm sm:p-6';

export function ScreenProgress ({ status, stepStatuses, zipsReady }: Props) {
  return (
    <section className='space-y-8 max-w-2xl w-full mx-auto' aria-live='polite'>
      <h2 className={SECTION_H2_CLS}>Backup in progress</h2>
      <p className='text-sm text-[var(--hds-muted-foreground)]'>{status}</p>

      <div className={CARD_CLS}>
        <ol className='space-y-1 text-sm'>
          {RESOURCE_STEPS.map((step) => {
            const s = stepStatuses[step.id] ?? { status: 'pending' as const };
            return (
              <li
                key={step.id}
                className={
                  'flex items-center gap-3 px-3 py-2 rounded-md ' +
                  (s.status === 'active' ? 'bg-[var(--hds-muted)] font-medium' : '') +
                  (s.status === 'done' ? ' text-[var(--hds-muted-foreground)]' : '') +
                  (s.status === 'skipped' ? ' opacity-50' : '')
                }
              >
                <span className='font-mono text-base w-5 text-center' aria-hidden='true'>
                  {statusIcon(s.status)}
                </span>
                <span className='flex-1'>{step.label}</span>
                {s.label && <span className='text-xs text-[var(--hds-muted-foreground)]'>{s.label}</span>}
              </li>
            );
          })}
        </ol>
      </div>

      {zipsReady.length > 0 && (
        <div className={CARD_CLS}>
          <h3 className='mb-3 text-lg font-normal italic'>Downloads</h3>
          <ul className='text-xs font-mono space-y-1'>
            {zipsReady.map((z) => (
              <li key={z.name}>{z.name} <span className='text-[var(--hds-muted-foreground)]'>({prettyBytes(z.size)})</span></li>
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
