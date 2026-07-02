import { create } from 'zustand';

interface SyncStoreState {
  isOnline: boolean;
  pendingCount: number;
  lastSyncAt: number | null;
  lastError: string | null;
}

interface SyncStoreActions {
  setOnline: (isOnline: boolean) => void;
  setPendingCount: (count: number) => void;
  setLastSyncAt: (timestamp: number | null) => void;
  setLastError: (error: string | null) => void;
}

type SyncStore = SyncStoreState & SyncStoreActions;

export const useSyncStore = create<SyncStore>((set) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  pendingCount: 0,
  lastSyncAt: null,
  lastError: null,

  setOnline: (isOnline) => set({ isOnline }),
  setPendingCount: (pendingCount) => set({ pendingCount }),
  setLastSyncAt: (lastSyncAt) => set({ lastSyncAt }),
  setLastError: (lastError) => set({ lastError }),
}));

export const useSyncStatus = () =>
  useSyncStore((store) => ({
    isOnline: store.isOnline,
    pendingCount: store.pendingCount,
    lastSyncAt: store.lastSyncAt,
    lastError: store.lastError,
  }));

export function initSyncStore(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const setOnline = useSyncStore.getState().setOnline;
  window.addEventListener('online', () => setOnline(true));
  window.addEventListener('offline', () => setOnline(false));
}
