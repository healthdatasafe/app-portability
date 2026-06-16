interface Props {
  message: string;
  onReset: () => void;
}

export function ScreenError ({ message, onReset }: Props) {
  return (
    <section className='space-y-4 max-w-2xl w-full mx-auto' role='alert'>
      <h2 className='text-2xl font-bold text-destructive'>Something went wrong</h2>
      <p className='text-sm break-all'>{message}</p>
      <button
        type='button'
        onClick={onReset}
        className='rounded-md border border-border px-4 py-2 text-sm hover:bg-accent'
      >
        Try again
      </button>
    </section>
  );
}
