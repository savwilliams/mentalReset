import { DEFAULT_USER_SETTINGS, type UserSettings } from '@/types/settings';

import { db } from '@/lib/db/database';
import { enqueueSettingsSync } from '@/lib/sync/syncEngine';

const LOCAL_SETTINGS_ID = 'local';

export async function getSettings(): Promise<UserSettings> {
  const existing = await db.settings.get(LOCAL_SETTINGS_ID);
  if (existing) {
    return existing;
  }

  const defaults: UserSettings = {
    id: LOCAL_SETTINGS_ID,
    ...DEFAULT_USER_SETTINGS,
    updatedAt: Date.now(),
  };
  await db.settings.put(defaults);
  return defaults;
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  await db.settings.put(settings);
  enqueueSettingsSync();
}
