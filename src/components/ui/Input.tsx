import { useId, type InputHTMLAttributes } from 'react';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

export function Input({ label, error, id, className = '', ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className="w-full">
      {label ? (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-[length:var(--font-size-label)] font-medium text-[var(--color-text-primary)]"
        >
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={`min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-[length:var(--font-size-input)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] transition-colors duration-[var(--duration-fast)] ease-[var(--ease-default)] focus-visible:border-[var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none ${className}`.trim()}
        {...props}
      />
      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 text-[length:var(--font-size-label)] text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
