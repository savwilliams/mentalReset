import type { StoreApi } from 'zustand';

export interface PersistController {
  enable: () => void;
  disable: () => void;
  schedule: (options?: { debounceMs?: number }) => void;
  flush: () => Promise<void>;
  awaitInFlight: () => Promise<void>;
}

interface PersistControllerOptions {
  persist: () => Promise<void>;
  debounceMs?: number;
}

export function createPersistController(options: PersistControllerOptions): PersistController {
  let enabled = false;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let inFlightWrite: Promise<void> | null = null;

  const runPersist = () => {
    inFlightWrite = options.persist().finally(() => {
      inFlightWrite = null;
    });
    return inFlightWrite;
  };

  const flush = async () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    if (inFlightWrite) {
      await inFlightWrite;
    }

    await runPersist();
  };

  return {
    enable: () => {
      enabled = true;
    },
    disable: () => {
      enabled = false;
    },
    schedule: (scheduleOptions) => {
      if (!enabled) {
        return;
      }

      const debounceMs = scheduleOptions?.debounceMs ?? options.debounceMs;
      if (debounceMs) {
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }

        debounceTimer = setTimeout(() => {
          debounceTimer = null;
          void runPersist();
        }, debounceMs);
        return;
      }

      void runPersist();
    },
    flush,
    awaitInFlight: async () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
        await runPersist();
      }

      if (inFlightWrite) {
        await inFlightWrite;
      }
    },
  };
}

interface StorePersistOptions<T> {
  shouldPersist: (state: T) => boolean;
  persist: () => Promise<void>;
  debounceMs?: number;
}

export function createStorePersistSubscription<T>(
  store: StoreApi<T>,
  options: StorePersistOptions<T>,
): PersistController {
  const controller = createPersistController({
    persist: options.persist,
    debounceMs: options.debounceMs,
  });

  store.subscribe((state) => {
    if (!options.shouldPersist(state)) {
      return;
    }

    controller.schedule();
  });

  return {
    enable: () => {
      controller.enable();
    },
    disable: () => {
      controller.disable();
    },
    schedule: (scheduleOptions) => controller.schedule(scheduleOptions),
    flush: () => controller.flush(),
    awaitInFlight: () => controller.awaitInFlight(),
  };
}
