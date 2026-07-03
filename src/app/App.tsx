import { BrowserRouter } from 'react-router-dom';

import { AbandonSessionDialog } from '@/components/ui';
import { ShellRoutes, SessionGuardProvider, useSessionGuard } from '@/features/shell';
import { SessionView } from '@/features/session';
import { useIsSessionActive, useSessionHydrated } from '@/stores/sessionStore';

function AppContent() {
  const isHydrated = useSessionHydrated();
  const isActive = useIsSessionActive();
  const { isDialogOpen, confirmAbandon, cancelAbandon } = useSessionGuard();

  if (!isHydrated) {
    return null;
  }

  return (
    <>
      {isActive ? <SessionView /> : <ShellRoutes />}
      <AbandonSessionDialog
        open={isDialogOpen}
        onConfirm={() => {
          void confirmAbandon();
        }}
        onCancel={cancelAbandon}
      />
    </>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <SessionGuardProvider>
        <AppContent />
      </SessionGuardProvider>
    </BrowserRouter>
  );
}
