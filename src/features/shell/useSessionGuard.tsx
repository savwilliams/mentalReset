import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { awaitInFlightSessionPersist, useSessionActions } from '@/lib/sessionMachine';
import { useIsSessionActive } from '@/stores/sessionStore';

type PendingAction = {
  run: () => void;
};

type SessionGuardContextValue = {
  isDialogOpen: boolean;
  requestAbandon: (action?: () => void) => void;
  guardShellNavigation: (path: string) => void;
  confirmAbandon: () => Promise<void>;
  cancelAbandon: () => void;
};

const SessionGuardContext = createContext<SessionGuardContextValue | null>(null);

export function SessionGuardProvider({ children }: { children: ReactNode }) {
  const isActive = useIsSessionActive();
  const { abandon } = useSessionActions();
  const navigate = useNavigate();
  const location = useLocation();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const pendingActionRef = useRef<PendingAction | null>(null);
  const historyGuardPushedRef = useRef(false);

  const openDialog = useCallback((action?: () => void) => {
    pendingActionRef.current = action ? { run: action } : null;
    setIsDialogOpen(true);
  }, []);

  const requestAbandon = useCallback(
    (action?: () => void) => {
      if (!isActive) {
        action?.();
        return;
      }
      openDialog(action);
    },
    [isActive, openDialog],
  );

  const guardShellNavigation = useCallback(
    (path: string) => {
      if (!isActive) {
        navigate(path);
        return;
      }
      openDialog(() => navigate(path));
    },
    [isActive, navigate, openDialog],
  );

  const confirmAbandon = useCallback(async () => {
    await awaitInFlightSessionPersist();
    await abandon();
    setIsDialogOpen(false);
    pendingActionRef.current?.run();
    pendingActionRef.current = null;
  }, [abandon]);

  const cancelAbandon = useCallback(() => {
    setIsDialogOpen(false);
    pendingActionRef.current = null;
  }, []);

  useEffect(() => {
    if (!isActive) {
      historyGuardPushedRef.current = false;
      return;
    }

    if (!historyGuardPushedRef.current) {
      window.history.pushState({ sessionGuard: true }, '');
      historyGuardPushedRef.current = true;
    }

    const handlePopState = () => {
      window.history.pushState({ sessionGuard: true }, '');
      openDialog(() => navigate('/'));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isActive, navigate, openDialog]);

  useEffect(() => {
    if (!isActive || location.pathname === '/' || isDialogOpen) {
      return;
    }

    const targetPath = `${location.pathname}${location.search}${location.hash}`;
    navigate('/', { replace: true });
    openDialog(() => navigate(targetPath));
  }, [isActive, isDialogOpen, location.hash, location.pathname, location.search, navigate, openDialog]);

  const value: SessionGuardContextValue = {
    isDialogOpen,
    requestAbandon,
    guardShellNavigation,
    confirmAbandon,
    cancelAbandon,
  };

  return <SessionGuardContext.Provider value={value}>{children}</SessionGuardContext.Provider>;
}

export function useSessionGuard(): SessionGuardContextValue {
  const context = useContext(SessionGuardContext);
  if (!context) {
    throw new Error('useSessionGuard must be used within SessionGuardProvider');
  }
  return context;
}
