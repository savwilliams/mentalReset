import type { HTMLAttributes } from 'react';

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className = '', children, ...props }: CardProps) {
  return (
    <div
      className={`rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 shadow-sm ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
}
