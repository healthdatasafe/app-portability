interface Props {
  downloads: Array<{ name: string; size: number }>;
  totalBytes: number;
  onReset: () => void;
}

function prettyBytes (n: number): string {
  if (n > 1_000_000) return Math.round(n / 1_000_000) + ' MB';
  if (n > 1_000) return Math.round(n / 1_000) + ' KB';
  return n + ' bytes';
}

export function ScreenDone ({ downloads, totalBytes, onReset }: Props) {
  return (
    <section className='space-y-4 max-w-2xl w-full mx-auto'>
      <h2 className='text-2xl font-bold'>Backup complete</h2>
      <p className='text-sm'>
        Your data has been downloaded. <strong>Save the ZIP files together</strong> — restore reads
        them as one bundle. The last ZIP includes <code className='font-mono'>sync-state.json</code>
        {' '}and <code className='font-mono'>hds-manifest.json</code>; keep them alongside the
        others and upload <code className='font-mono'>sync-state.json</code> next time you visit
        this page to make the next backup incremental.
      </p>

      <div>
        <h3 className='text-sm font-medium mb-2'>{downloads.length} ZIP file(s) — {prettyBytes(totalBytes)} total</h3>
        <ul className='text-xs font-mono space-y-1 border border-border rounded-md p-3 bg-card'>
          {downloads.map((d) => (
            <li key={d.name}>{d.name} <span className='text-muted-foreground'>({prettyBytes(d.size)})</span></li>
          ))}
        </ul>
      </div>

      <button
        type='button'
        onClick={onReset}
        className='rounded-md border border-border px-4 py-2 text-sm hover:bg-accent'
      >
        Start a new backup
      </button>
    </section>
  );
}
