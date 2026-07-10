import { expect, test } from '../fixtures/test';
import {
  countSessionsInIndexedDB,
  getAllSessionSummariesFromIndexedDB,
  getAllTasksFromIndexedDB,
  seedTasksInIndexedDB,
} from '../fixtures/indexeddb';
import { SEED_TASKS } from '../fixtures/tasks';
import {
  AbandonDialog,
  BrainDumpPage,
  IdlePage,
  PrioritizationPage,
  ReleasePage,
  SortingPage,
  StartReviewPage,
  SummaryPage,
  TimeEstimationPage,
} from '../pages';

async function reloadFromIdle(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /mentalreset/i })).toBeVisible();
}

test.describe('session flow', () => {
  test('happy path: IDLE → full session → Summary → IDLE', async ({ page }) => {
    const idle = new IdlePage(page);
    const brainDump = new BrainDumpPage(page);
    const sorting = new SortingPage(page);
    const prioritization = new PrioritizationPage(page);
    const timeEstimation = new TimeEstimationPage(page);
    const release = new ReleasePage(page);
    const summary = new SummaryPage(page);

    await test.step('start session from IDLE', async () => {
      await idle.startSession();
      await brainDump.expectVisible();
    });

    await test.step('brain dump thoughts', async () => {
      await brainDump.addThought('Finish report');
      await brainDump.addThought('Call dentist');
      await brainDump.addThought('Learn guitar someday');
      await brainDump.addThought('Worry about rain');
      await brainDump.addThought('Buy private island');
      await expect(brainDump.continueButton).toBeEnabled();
      await brainDump.continue();
    });

    await test.step('sort every thought', async () => {
      await sorting.expectVisible();
      await sorting.resolveAsTask(); // Finish report
      await sorting.resolveAsTask(); // Call dentist
      await sorting.resolveAsTask(); // Learn guitar someday
      await sorting.resolveAsRelease(); // Worry about rain
      await sorting.resolveAsTask(); // Buy private island
      await expect(sorting.continueButton).toBeEnabled();
      await sorting.continue();
    });

    await test.step('prioritize actionable items', async () => {
      await prioritization.expectVisible();
      await prioritization.assignToday(); // Finish report
      await prioritization.assignSoon(); // Call dentist
      await prioritization.assignLater(); // Learn guitar someday
      await prioritization.assignCanDoWithout(); // Buy private island
      await expect(prioritization.continueButton).toBeEnabled();
      await prioritization.continue();
    });

    await test.step('estimate TODAY and SOON only', async () => {
      await timeEstimation.expectVisible();
      await expect(timeEstimation.currentTask).toContainText('Finish report');
      await expect(timeEstimation.currentTask).not.toContainText('Learn guitar someday');
      await timeEstimation.selectPreset(30);

      await expect(timeEstimation.currentTask).toContainText('Call dentist');
      await expect(page.getByText(/learn guitar someday/i)).toHaveCount(0);
      await timeEstimation.selectPreset(15);

      await expect(timeEstimation.continueButton).toBeEnabled();
      await timeEstimation.continue();
    });

    await test.step('release discarded items', async () => {
      await release.expectVisible();
      await expect(release.releaseList).toContainText('Worry about rain');
      await expect(release.canDoWithoutList).toContainText('Buy private island');
      await release.releaseAll();
      await expect(release.releasedState).toBeVisible();
      await expect(release.continueButton).toBeEnabled();
      await release.continue();
    });

    await test.step('summary then finish back to IDLE', async () => {
      await summary.expectVisible();
      await expect(summary.summaryRegion).toContainText('3 tasks created');
      await expect(summary.summaryRegion).toContainText('45 min');
      await expect(summary.summaryRegion).toContainText('2 items released');
      await summary.finish();

      await expect(idle.heading).toBeVisible();
      await expect(idle.startButton).toBeVisible();
    });

    await test.step('persist summary and clear ephemeral session data', async () => {
      await expect
        .poll(async () => countSessionsInIndexedDB(page), { timeout: 5_000 })
        .toBe(0);

      const summaries = await getAllSessionSummariesFromIndexedDB(page);
      expect(summaries).toHaveLength(1);
      expect(summaries[0]).toMatchObject({
        tasksCreated: 3,
        releasedCount: 2,
        estimatedTimeTotal: 45,
      });
      expect(JSON.stringify(summaries[0])).not.toMatch(/worry about rain/i);
      expect(JSON.stringify(summaries[0])).not.toMatch(/buy private island/i);

      const tasks = await getAllTasksFromIndexedDB(page);
      const taskTexts = tasks.map((task) => task.text);
      expect(taskTexts).toEqual(
        expect.arrayContaining(['Finish report', 'Call dentist', 'Learn guitar someday']),
      );
      expect(taskTexts).not.toContain('Worry about rain');
      expect(taskTexts).not.toContain('Buy private island');

      const finishReport = tasks.find((task) => task.text === 'Finish report');
      const callDentist = tasks.find((task) => task.text === 'Call dentist');
      const learnGuitar = tasks.find((task) => task.text === 'Learn guitar someday');
      expect(finishReport).toMatchObject({ category: 'TODAY', estimatedMinutes: 30 });
      expect(callDentist).toMatchObject({ category: 'SOON', estimatedMinutes: 15 });
      expect(learnGuitar).toMatchObject({ category: 'LATER' });
      expect(learnGuitar?.estimatedMinutes).toBeUndefined();
    });
  });

  test('brain dump gates Continue and supports add/edit/delete', async ({ page }) => {
    const idle = new IdlePage(page);
    const brainDump = new BrainDumpPage(page);

    await idle.startSession();
    await brainDump.expectVisible();
    await expect(brainDump.continueButton).toBeDisabled();

    await brainDump.addThought('Draft outline');
    await expect(brainDump.thoughtCard(/draft outline/i)).toBeVisible();
    await expect(brainDump.continueButton).toBeEnabled();

    await brainDump.editThought(/draft outline/i, 'Polish outline');
    await expect(brainDump.thoughtCard(/polish outline/i)).toBeVisible();
    await expect(brainDump.thoughtCard(/draft outline/i)).toHaveCount(0);

    await brainDump.deleteThought(/polish outline/i);
    await expect(brainDump.thoughtList).toHaveCount(0);
    await expect(brainDump.continueButton).toBeDisabled();

    await brainDump.addThought('Ready to sort');
    await expect(brainDump.continueButton).toBeEnabled();
  });

  test('sorting requires every thought resolved before Continue', async ({ page }) => {
    const idle = new IdlePage(page);
    const brainDump = new BrainDumpPage(page);
    const sorting = new SortingPage(page);

    await idle.startSession();
    await brainDump.expectVisible();
    await brainDump.addThought('First thought');
    await brainDump.addThought('Second thought');
    await brainDump.continue();

    await sorting.expectVisible();
    await expect(sorting.continueButton).toBeDisabled();
    await expect(sorting.currentThought).toContainText('First thought');

    await sorting.resolveAsTask();
    await expect(sorting.continueButton).toBeDisabled();
    await expect(sorting.currentThought).toContainText('Second thought');

    await sorting.resolveAsRelease();
    await expect(sorting.continueButton).toBeEnabled();
    await expect(page.getByText(/all thoughts are sorted/i)).toBeVisible();
  });

  test('CAN_DO_WITHOUT never creates a task and counts toward release', async ({ page }) => {
    const idle = new IdlePage(page);
    const brainDump = new BrainDumpPage(page);
    const sorting = new SortingPage(page);
    const prioritization = new PrioritizationPage(page);
    const release = new ReleasePage(page);
    const summary = new SummaryPage(page);

    await idle.startSession();
    await brainDump.addThought('Optional distraction');
    await brainDump.continue();

    await sorting.resolveAsTask();
    await sorting.continue();

    await prioritization.assignCanDoWithout();
    // No TODAY/SOON tasks → machine skips Time Estimation.
    await prioritization.continue();

    await release.expectVisible();
    await expect(release.canDoWithoutList).toContainText('Optional distraction');
    await release.releaseAll();
    await expect(release.releasedState).toBeVisible();
    await release.continue();

    await summary.expectVisible();
    await expect(summary.summaryRegion).toContainText('0 tasks created');
    await expect(summary.summaryRegion).toContainText('1 item released');
    await summary.finish();

    await expect(idle.heading).toBeVisible();

    await expect
      .poll(async () => (await getAllTasksFromIndexedDB(page)).length, { timeout: 5_000 })
      .toBe(0);

    const summaries = await getAllSessionSummariesFromIndexedDB(page);
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      tasksCreated: 0,
      releasedCount: 1,
      estimatedTimeTotal: 0,
    });
    expect(JSON.stringify(summaries[0])).not.toMatch(/optional distraction/i);
  });

  test('released items are not recoverable after Finish', async ({ page }) => {
    const idle = new IdlePage(page);
    const brainDump = new BrainDumpPage(page);
    const sorting = new SortingPage(page);
    const prioritization = new PrioritizationPage(page);
    const release = new ReleasePage(page);
    const summary = new SummaryPage(page);

    await idle.startSession();
    await brainDump.addThought('Keep this task');
    await brainDump.addThought('Let this go');
    await brainDump.continue();

    await sorting.resolveAsTask();
    await sorting.resolveAsRelease();
    await sorting.continue();

    await prioritization.assignLater();
    // LATER-only → skip Time Estimation straight to Release.
    await prioritization.continue();

    await release.expectVisible();
    await expect(release.releaseList).toContainText('Let this go');
    await release.releaseAll();
    await expect(release.releasedState).toBeVisible();
    await expect(page.getByText(/let this go/i)).toHaveCount(0);
    await release.continue();

    await summary.finish();
    await expect(idle.heading).toBeVisible();

    await expect
      .poll(async () => countSessionsInIndexedDB(page), { timeout: 5_000 })
      .toBe(0);

    const tasks = await getAllTasksFromIndexedDB(page);
    expect(tasks.map((task) => task.text)).toEqual(['Keep this task']);
    expect(tasks.map((task) => task.text)).not.toContain('Let this go');

    const summaries = await getAllSessionSummariesFromIndexedDB(page);
    expect(summaries).toHaveLength(1);
    expect(JSON.stringify(summaries)).not.toMatch(/let this go/i);
  });

  test('Save for Later tasks never auto-appear; opt-in only', async ({ page }) => {
    const idle = new IdlePage(page);
    const startReview = new StartReviewPage(page);
    const brainDump = new BrainDumpPage(page);
    const abandon = new AbandonDialog(page);
    const laterTask = SEED_TASKS.laterTask();

    await seedTasksInIndexedDB(page, [laterTask]);
    await reloadFromIdle(page);

    await idle.startSession();
    await startReview.expectVisible();
    await expect(startReview.taskCheckbox(/plan weekend trip/i)).toBeVisible();
    await expect(startReview.taskCheckbox(/plan weekend trip/i)).not.toBeChecked();

    await startReview.skip();
    await brainDump.expectVisible();
    await expect(page.getByText(laterTask.text)).not.toBeVisible();

    await page.getByRole('button', { name: /leave session/i }).click();
    await abandon.expectOpen();
    await abandon.confirm();
    await expect(idle.heading).toBeVisible();

    await idle.startSession();
    await startReview.expectVisible();
    await startReview.selectAndContinue(/plan weekend trip/i);
    await brainDump.expectVisible();
    await expect(brainDump.thoughtCard(/plan weekend trip/i)).toBeVisible();
  });

  test('release respects reduced-motion preference', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });

    const idle = new IdlePage(page);
    const brainDump = new BrainDumpPage(page);
    const sorting = new SortingPage(page);
    const prioritization = new PrioritizationPage(page);
    const release = new ReleasePage(page);

    await idle.startSession();
    await brainDump.addThought('Something to release');
    await brainDump.continue();

    await sorting.resolveAsRelease();
    await sorting.continue();

    await prioritization.expectVisible();
    await expect(page.getByText(/no actionable items to prioritize/i)).toBeVisible();
    await prioritization.continue();

    // No estimable tasks → Release (Time Estimation skipped).
    await release.expectVisible();
    await expect(release.releaseList).toContainText('Something to release');
    await release.releaseAll();

    // With reduced motion, discard is immediate — assert UI state, not a fixed timeout.
    await expect(release.releasedState).toBeVisible();
    await expect(release.continueButton).toBeEnabled();
    await expect(release.releaseList).toHaveCount(0);
    await expect(page.getByText(/something to release/i)).toHaveCount(0);
  });
});
