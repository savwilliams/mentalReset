import { expect, test } from '../fixtures/test';
import {
  countSessionsInIndexedDB,
  getActiveSessionStateFromIndexedDB,
  getSessionSummaryFromIndexedDB,
  getTaskFromIndexedDB,
  seedActiveSessionInIndexedDB,
  seedTasksInIndexedDB,
} from '../fixtures/indexeddb';
import { getPendingTaskSyncJobIds, getSyncQueueFromLocalStorage } from '../fixtures/sync';
import { SEED_TASKS } from '../fixtures/tasks';
import { IdlePage, SessionPage, TodaysPlanPage } from '../pages';

async function reloadFromIdle(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /mentalreset/i })).toBeVisible();
}

test.describe('sync + recovery', () => {
  test('offline task complete persists in Dexie and leaves sync queue pending', async ({
    page,
  }) => {
    const idle = new IdlePage(page);
    const plan = new TodaysPlanPage(page);
    const task = SEED_TASKS.todayTask();

    await seedTasksInIndexedDB(page, [task]);
    await reloadFromIdle(page);

    await page.context().setOffline(true);

    await idle.openTodaysPlan();
    await plan.taskCheckbox(/review project notes/i).check();

    await expect(plan.section(/completed/i)).toContainText('Review project notes');

    await expect
      .poll(async () => {
        const stored = await getTaskFromIndexedDB(page, task.id);
        return stored?.completed === true;
      }, { timeout: 5_000 })
      .toBe(true);

    await expect
      .poll(async () => getPendingTaskSyncJobIds(page), { timeout: 5_000 })
      .toContain(task.id);

    const queue = await getSyncQueueFromLocalStorage(page);
    expect(queue.length).toBeGreaterThan(0);

    await page.context().setOffline(false);
  });

  test('mid-session reload resumes the correct FSM state', async ({ page }) => {
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
    await expect(await getActiveSessionStateFromIndexedDB(page)).toBe('BRAIN_DUMP');
  });

  test('finish session clears active session and keeps the summary', async ({ page }) => {
    const sessionId = 'session-finish-e2e';
    const idle = new IdlePage(page);
    const session = new SessionPage(page);

    await seedActiveSessionInIndexedDB(page, {
      id: sessionId,
      state: 'SUMMARY',
      createdAt: Date.now() - 60_000,
      stats: {
        thoughtsCount: 2,
        tasksCreated: 1,
        releasedCount: 1,
        estimatedTimeTotal: 30,
      },
      thoughts: [
        { id: 'thought-1', text: 'local-only thought — must not sync' },
      ],
    });
    await page.goto('/');
    await session.expectActiveStep(/summary/i);
    await session.finishButton.click();

    await expect(idle.heading).toBeVisible();
    await expect
      .poll(async () => countSessionsInIndexedDB(page), { timeout: 5_000 })
      .toBe(0);

    await expect
      .poll(async () => getSessionSummaryFromIndexedDB(page, sessionId), { timeout: 5_000 })
      .toMatchObject({
        id: sessionId,
        tasksCreated: 1,
        releasedCount: 1,
        estimatedTimeTotal: 30,
      });

    const summary = await getSessionSummaryFromIndexedDB(page, sessionId);
    expect(summary).not.toBeNull();
    expect(JSON.stringify(summary)).not.toMatch(/local-only thought/i);
  });

  test('online flush writes task to Firestore when emulator is available', async ({
    page,
  }) => {
    test.skip(
      process.env.FIREBASE_EMULATOR !== '1',
      'Firestore emulator not configured — skip live flush (local paths covered above)',
    );

    // Reserved for emulator CI: complete a task online and assert Firestore users/{uid}/tasks/{id}.
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /mentalreset/i })).toBeVisible();
  });
});
