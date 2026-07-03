import type { ButtonHTMLAttributes } from 'react';

type PrimaryCTAProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function PrimaryCTA({ className = '', type = 'button', children, ...props }: PrimaryCTAProps) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-base font-medium text-white transition-colors duration-[var(--duration-normal)] ease-[var(--ease-default)] hover:bg-[var(--color-accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
