import { expect, test } from '../fixtures/test';
import { AbandonDialog, IdlePage, SessionPage, SettingsPage, TodaysPlanPage } from '../pages';

test.describe('navigation', () => {
  test('navigates shell routes from idle', async ({ page }) => {
    const idle = new IdlePage(page);
    const plan = new TodaysPlanPage(page);
    const settings = new SettingsPage(page);

    await idle.openTodaysPlan();
    await expect(plan.heading).toBeVisible();

    await plan.backToHome();
    await expect(idle.heading).toBeVisible();

    await idle.openSettings();
    await expect(settings.heading).toBeVisible();
  });

  test('starts a session and blocks the shell', async ({ page }) => {
    const idle = new IdlePage(page);
    const session = new SessionPage(page);

    await idle.startSession();
    await session.expectActiveStep(/brain dump/i);

    await expect(idle.todaysPlanButton).toHaveCount(0);
    await expect(idle.settingsButton).toHaveCount(0);
  });

  test('cancelling abandon keeps the current session', async ({ page }) => {
    const idle = new IdlePage(page);
    const session = new SessionPage(page);
    const dialog = new AbandonDialog(page);

    await idle.startSession();
    await session.expectActiveStep(/brain dump/i);

    await page.goto('/plan');
    await dialog.expectOpen();

    await dialog.cancel();
    await expect(dialog.dialog).toBeHidden();
    await session.expectActiveStep(/brain dump/i);
  });

  test('confirming abandon returns to shell and completes navigation', async ({ page }) => {
    const idle = new IdlePage(page);
    const session = new SessionPage(page);
    const dialog = new AbandonDialog(page);
    const plan = new TodaysPlanPage(page);

    await idle.startSession();
    await session.expectActiveStep(/brain dump/i);

    await page.goto('/plan');
    await dialog.expectOpen();
    await dialog.confirm();

    await expect(plan.heading).toBeVisible();
    await expect(session.brainDumpStep).toHaveCount(0);
    await expect(idle.startButton).toHaveCount(0);
  });

  test('deep link to shell route during session shows abandon confirmation', async ({ page }) => {
    const idle = new IdlePage(page);
    const session = new SessionPage(page);
    const dialog = new AbandonDialog(page);

    await idle.startSession();
    await session.expectActiveStep(/brain dump/i);

    await page.goto('/settings');
    await dialog.expectOpen();
    await session.expectActiveStep(/brain dump/i);
  });
});
