import { createPersistController, createStorePersistSubscription } from '@/lib/db/middleware/dexiePersist';
import {
  persistSessionSnapshot,
  persistSettingsSnapshot,
  persistTaskSnapshot,
} from '@/lib/db/persist';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTaskStore } from '@/stores/taskStore';

export const SESSION_THOUGHT_PERSIST_DEBOUNCE_MS = 300;

export const taskPersist = createStorePersistSubscription(useTaskStore, {
  shouldPersist: (state) => state.isHydrated,
  persist: persistTaskSnapshot,
});

export const settingsPersist = createStorePersistSubscription(useSettingsStore, {
  shouldPersist: (state) => state.isHydrated && state.settings !== null,
  persist: persistSettingsSnapshot,
});

export const sessionPersist = createPersistController({
  persist: persistSessionSnapshot,
  debounceMs: SESSION_THOUGHT_PERSIST_DEBOUNCE_MS,
});

let persistMiddlewareStarted = false;

export function startPersistMiddleware(): void {
  if (persistMiddlewareStarted) {
    return;
  }

  persistMiddlewareStarted = true;
  taskPersist.enable();
  settingsPersist.enable();
  sessionPersist.enable();
}

export function resetPersistMiddlewareForTests(): void {
  persistMiddlewareStarted = false;
  taskPersist.disable();
  settingsPersist.disable();
  sessionPersist.disable();
}
