import type { ButtonHTMLAttributes } from 'react';

type SecondaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function SecondaryButton({
  className = '',
  type = 'button',
  children,
  ...props
}: SecondaryButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-4 py-2.5 text-base font-medium text-[var(--color-text-primary)] transition-colors duration-[var(--duration-normal)] ease-[var(--ease-default)] hover:bg-[var(--color-surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
