export type ThemePreference = 'system' | 'light' | 'dark';

export interface UserSettings {
  id: string;
  notificationsEnabled: boolean;
  theme?: ThemePreference;
  updatedAt: number;
}

export const DEFAULT_USER_SETTINGS: Omit<UserSettings, 'id'> = {
  notificationsEnabled: false,
  theme: 'system',
  updatedAt: Date.now(),
};
