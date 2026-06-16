interface Props {
  downloads: Array<{ name: string; size: number }>;
  totalBytes: number;
  onReset: () => void;
}

const SECTION_H2_CLS = 'mb-6 font-sans text-2xl font-light uppercase tracking-wide';
const CARD_CLS = 'rounded-lg border border-[var(--hds-border)] bg-[var(--hds-card)] p-4 shadow-sm sm:p-6';
const OUTLINE_BUTTON_CLS =
  'rounded-lg border border-[var(--hds-border)] bg-[var(--hds-card)] px-5 py-2.5 text-sm font-medium ' +
  'hover:bg-[var(--hds-muted)] focus:ring-4 focus:ring-[var(--hds-ring)] focus:outline-none';

function prettyBytes (n: number): string {
  if (n > 1_000_000) return Math.round(n / 1_000_000) + ' MB';
  if (n > 1_000) return Math.round(n / 1_000) + ' KB';
  return n + ' bytes';
}

export function ScreenDone ({ downloads, totalBytes, onReset }: Props) {
  return (
    <section className='space-y-6 max-w-2xl w-full mx-auto'>
      <h2 className={SECTION_H2_CLS}>Backup complete</h2>
      <p className='text-sm'>
        Your data has been downloaded. <strong>Save the ZIP files together</strong> — restore reads
        them as one bundle. The last ZIP includes <code className='font-mono'>sync-state.json</code>
        {' '}and <code className='font-mono'>hds-manifest.json</code>; keep them alongside the
        others and upload <code className='font-mono'>sync-state.json</code> next time you visit
        this page to make the next backup incremental.
      </p>

      <div className={CARD_CLS}>
        <h3 className='mb-3 text-lg font-normal italic'>
          {downloads.length} ZIP file{downloads.length === 1 ? '' : 's'} — {prettyBytes(totalBytes)} total
        </h3>
        <ul className='text-xs font-mono space-y-1'>
          {downloads.map((d) => (
            <li key={d.name}>{d.name} <span className='text-[var(--hds-muted-foreground)]'>({prettyBytes(d.size)})</span></li>
          ))}
        </ul>
      </div>

      <button type='button' onClick={onReset} className={OUTLINE_BUTTON_CLS}>
        Start a new backup
      </button>
    </section>
  );
}
