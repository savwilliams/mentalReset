import type { ReactNode } from 'react';

type ScreenProps = {
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  header?: ReactNode;
  className?: string;
};

export function Screen({ title, children, footer, header, className = '' }: ScreenProps) {
  return (
    <div
      className={`flex min-h-dvh w-full max-w-lg flex-col overflow-x-hidden bg-[var(--color-surface)] mx-auto ${className}`.trim()}
    >
      <header className="shrink-0 px-[var(--spacing-screen-x)] pt-[var(--spacing-screen-y)]">
        {header}
        {title ? (
          <h1 className="text-[length:var(--font-size-heading)] font-medium text-[var(--color-text-primary)]">
            {title}
          </h1>
        ) : null}
      </header>

      <main className="flex flex-1 flex-col px-[var(--spacing-screen-x)] py-[var(--spacing-section)]">{children}</main>

      {footer ? (
        <footer className="sticky bottom-0 shrink-0 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--spacing-screen-x)] py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {footer}
        </footer>
      ) : null}
    </div>
  );
}
