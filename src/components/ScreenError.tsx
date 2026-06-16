interface Props {
  message: string;
  onReset: () => void;
}

const SECTION_H2_CLS = 'mb-6 font-sans text-2xl font-light uppercase tracking-wide text-[var(--hds-destructive)]';
const CARD_CLS = 'rounded-lg border border-[var(--hds-destructive)] bg-[var(--hds-destructive)]/10 px-4 py-3';
const OUTLINE_BUTTON_CLS =
  'rounded-lg border border-[var(--hds-border)] bg-[var(--hds-card)] px-5 py-2.5 text-sm font-medium ' +
  'hover:bg-[var(--hds-muted)] focus:ring-4 focus:ring-[var(--hds-ring)] focus:outline-none';

export function ScreenError ({ message, onReset }: Props) {
  return (
    <section className='space-y-6 max-w-2xl w-full mx-auto' role='alert'>
      <h2 className={SECTION_H2_CLS}>Something went wrong</h2>
      <div className={CARD_CLS}>
        <p className='text-sm break-words text-[var(--hds-destructive)]'>{message}</p>
      </div>
      <button type='button' onClick={onReset} className={OUTLINE_BUTTON_CLS}>
        Try again
      </button>
    </section>
  );
}
