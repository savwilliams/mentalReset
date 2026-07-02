import { create } from 'zustand';

import type { UserSettings } from '@/types/settings';

interface SettingsStoreState {
  settings: UserSettings | null;
  isHydrated: boolean;
}

interface SettingsStoreActions {
  setSettings: (settings: UserSettings) => void;
  markHydrated: () => void;
}

type SettingsStore = SettingsStoreState & SettingsStoreActions;

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: null,
  isHydrated: false,

  setSettings: (settings) => set({ settings }),
  markHydrated: () => set({ isHydrated: true }),
}));

export const useSettings = () => useSettingsStore((store) => store.settings);
export const useSettingsHydrated = () => useSettingsStore((store) => store.isHydrated);

export function getSettingsSnapshot(): UserSettings | null {
  return useSettingsStore.getState().settings;
}

export function hydrateSettingsStore(settings: UserSettings): void {
  const store = useSettingsStore.getState();
  if (store.isHydrated) {
    return;
  }

  useSettingsStore.setState({ settings, isHydrated: true });
}
