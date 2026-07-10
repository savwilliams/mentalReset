import { expect, test } from '../fixtures/test';
import { getTaskFromIndexedDB, seedSessionSummariesInIndexedDB, seedTasksInIndexedDB } from '../fixtures/indexeddb';
import { SEED_TASKS } from '../fixtures/tasks';
import { IdlePage, SessionHistoryPage, TodaysPlanPage } from '../pages';

async function reloadFromIdle(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /mentalreset/i })).toBeVisible();
}

test.describe('Task management', () => {
  test("Today's Plan from IDLE shows three category sections", async ({ page }) => {
    const idle = new IdlePage(page);
    const plan = new TodaysPlanPage(page);

    await seedTasksInIndexedDB(page, [
      SEED_TASKS.todayTask(),
      SEED_TASKS.soonTask(),
      SEED_TASKS.laterTask(),
    ]);
    await reloadFromIdle(page);

    await idle.openTodaysPlan();
    await expect(plan.heading).toBeVisible();

    await expect(plan.section(/needs attention today/i)).toBeVisible();
    await expect(plan.section(/important if time allows/i)).toBeVisible();
    await expect(plan.section(/save for later/i)).toBeVisible();

    await expect(plan.section(/needs attention today/i)).toContainText('Review project notes');
    await expect(plan.section(/important if time allows/i)).toContainText('Organize desk');
    await expect(plan.section(/save for later/i)).toContainText('Plan weekend trip');
  });

  test('completing a task moves it to Completed and persists after reload', async ({ page }) => {
    const idle = new IdlePage(page);
    const plan = new TodaysPlanPage(page);
    const task = SEED_TASKS.todayTask();

    await seedTasksInIndexedDB(page, [task]);
    await reloadFromIdle(page);

    await idle.openTodaysPlan();
    await plan.taskCheckbox(/review project notes/i).check();

    await expect(plan.section(/completed/i)).toContainText('Review project notes');
    await expect(plan.section(/needs attention today/i)).not.toContainText('Review project notes');

    await reloadFromIdle(page);
    await idle.openTodaysPlan();

    await expect(plan.taskCheckbox(/review project notes/i)).toBeChecked();
    await expect(plan.section(/completed/i)).toContainText('Review project notes');
  });

  test('moving a task updates the UI and Dexie category', async ({ page }) => {
    const idle = new IdlePage(page);
    const plan = new TodaysPlanPage(page);
    const task = SEED_TASKS.moveableTask();

    await seedTasksInIndexedDB(page, [task]);
    await reloadFromIdle(page);

    await idle.openTodaysPlan();
    await plan
      .moveTaskButton('Email team update', /save for later/i)
      .click();

    await expect(plan.section(/save for later/i)).toContainText('Email team update');
    await expect(plan.section(/needs attention today/i)).not.toContainText('Email team update');

    const storedTask = await getTaskFromIndexedDB(page, task.id);
    expect(storedTask?.category).toBe('LATER');
    expect(storedTask?.estimatedMinutes).toBeUndefined();
  });

  test('LATER tasks are not auto-shown in session without opt-in', async ({ page }) => {
    const idle = new IdlePage(page);
    const laterTask = SEED_TASKS.laterTask();

    await seedTasksInIndexedDB(page, [laterTask]);
    await reloadFromIdle(page);

    await idle.startSession();

    await expect(page.getByText(/tasks saved for later/i)).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /plan weekend trip/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /skip for now/i })).toBeVisible();

    await page.getByRole('button', { name: /skip for now/i }).click();
    await expect(page.getByText(/brain dump/i)).toBeVisible();
    await expect(page.getByText(laterTask.text)).not.toBeVisible();
  });

  test('session history shows summary stats and stays read-only', async ({ page }) => {
    const idle = new IdlePage(page);
    const history = new SessionHistoryPage(page);

    await seedSessionSummariesInIndexedDB(page, [
      {
        id: 'summary-1',
        completedAt: new Date('2026-02-15T12:00:00').getTime(),
        tasksCreated: 3,
        releasedCount: 2,
        estimatedTimeTotal: 90,
      },
    ]);
    await reloadFromIdle(page);

    await idle.openSessionHistory();
    await expect(history.heading).toBeVisible();

    await expect(page.getByText(/3 tasks created/i)).toBeVisible();
    await expect(page.getByText(/2 items released/i)).toBeVisible();
    await expect(page.getByText(/1h 30m/i)).toBeVisible();
    await expect(page.getByText(/thought/i)).not.toBeVisible();
    await expect(page.getByRole('checkbox')).toHaveCount(0);
    await expect(page.getByRole('textbox')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /edit/i })).toHaveCount(0);
  });
});
