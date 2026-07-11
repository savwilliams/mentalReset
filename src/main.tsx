import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/app/App';
import { IndexedDBUnavailableError, initDataLayer } from '@/lib/db/init';
import { ensureAnonymousAuth } from '@/lib/firebase/auth';
import { initFirebase } from '@/lib/firebase';
import '@/styles/globals.css';

function renderStorageError(root: HTMLElement, message: string): void {
  root.innerHTML = `
    <main style="font-family: system-ui, sans-serif; padding: 1.5rem; max-width: 32rem; margin: 0 auto;">
      <h1 style="font-size: 1.25rem; margin-bottom: 0.5rem;">Local storage unavailable</h1>
      <p style="color: #475569; line-height: 1.5;">${message}</p>
    </main>
  `;
}

async function bootstrap(): Promise<void> {
  initFirebase();
  // Anonymous auth on first launch; failures must not block offline use (AC-2 / AC-3).
  await ensureAnonymousAuth();

  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found');
  }

  try {
    await initDataLayer();
  } catch (error) {
    if (error instanceof IndexedDBUnavailableError || error instanceof Error) {
      renderStorageError(
        rootElement,
        error instanceof IndexedDBUnavailableError
          ? error.message
          : 'Unable to initialize offline storage.',
      );
      return;
    }
    throw error;
  }

  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
