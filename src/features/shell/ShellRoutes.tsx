import { Navigate, Route, Routes } from 'react-router-dom';

import { SessionHistoryScreen } from '@/features/tasks/screens/SessionHistoryScreen';
import { IdleScreen } from '@/features/shell/screens/IdleScreen';
import { SettingsScreen } from '@/features/shell/screens/SettingsScreen';
import { TodaysPlanScreen } from '@/features/shell/screens/TodaysPlanScreen';

export function ShellRoutes() {
  return (
    <Routes>
      <Route path="/" element={<IdleScreen />} />
      <Route path="/plan" element={<TodaysPlanScreen />} />
      <Route path="/settings" element={<SettingsScreen />} />
      <Route path="/history" element={<SessionHistoryScreen />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
