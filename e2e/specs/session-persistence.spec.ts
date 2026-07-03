import { expect, test } from '../fixtures/test';
import {
  countSessionsInIndexedDB,
  getActiveSessionStateFromIndexedDB,
  resetAppStorage,
} from '../fixtures/indexeddb';
import { AbandonDialog, IdlePage, SessionPage } from '../pages';

test.describe('session persistence', () => {
  test('reload keeps the active session state', async ({ page }) => {
    await resetAppStorage(page);

    const idle = new IdlePage(page);
    const session = new SessionPage(page);

    await idle.startSession();
    await session.expectActiveStep(/brain dump/i);

    await expect
      .poll(async () => getActiveSessionStateFromIndexedDB(page), { timeout: 5_000 })
      .toBe('BRAIN_DUMP');

    await page.reload();
    await session.expectActiveStep(/brain dump/i);
    await expect(idle.startButton).toHaveCount(0);
  });

  test('abandon clears session data from IndexedDB', async ({ page }) => {
    await resetAppStorage(page);

    const idle = new IdlePage(page);
    const session = new SessionPage(page);
    const dialog = new AbandonDialog(page);

    await idle.startSession();
    await session.expectActiveStep(/brain dump/i);

    await expect
      .poll(async () => countSessionsInIndexedDB(page), { timeout: 5_000 })
      .toBeGreaterThan(0);

    await session.leaveSessionButton.click();
    await dialog.expectOpen();
    await dialog.confirm();

    await expect(idle.heading).toBeVisible();
    await expect
      .poll(async () => countSessionsInIndexedDB(page), { timeout: 5_000 })
      .toBe(0);
  });
});
