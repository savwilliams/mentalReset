import type { Locator, Page } from '@playwright/test';

export class StartReviewPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly continueButton: Locator;
  readonly skipButton: Locator;
  readonly taskList: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByText(/tasks saved for later/i);
    this.continueButton = page.getByRole('button', { name: /^continue$/i });
    this.skipButton = page.getByRole('button', { name: /skip for now/i });
    this.taskList = page.getByRole('list', { name: /save for later tasks/i });
  }

  taskCheckbox(taskText: string | RegExp): Locator {
    return this.page.getByRole('checkbox', { name: taskText });
  }

  async expectVisible(): Promise<void> {
    await this.heading.waitFor({ state: 'visible' });
  }

  async skip(): Promise<void> {
    await this.skipButton.click();
  }

  async selectAndContinue(taskText: string | RegExp): Promise<void> {
    await this.taskCheckbox(taskText).check();
    await this.continueButton.click();
  }
}

export class BrainDumpPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly thoughtInput: Locator;
  readonly addButton: Locator;
  readonly continueButton: Locator;
  readonly thoughtList: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /brain dump/i });
    this.thoughtInput = page.getByLabel(/new thought/i);
    this.addButton = page.getByRole('button', { name: /add thought/i });
    this.continueButton = page.getByRole('button', { name: /^continue$/i });
    this.thoughtList = page.getByRole('list', { name: /session thoughts/i });
  }

  async expectVisible(): Promise<void> {
    await this.heading.waitFor({ state: 'visible' });
  }

  async addThought(text: string): Promise<void> {
    await this.thoughtInput.fill(text);
    await this.addButton.click();
  }

  thoughtCard(text: string | RegExp): Locator {
    return this.thoughtList.getByText(text);
  }

  editButtonFor(text: string | RegExp): Locator {
    return this.thoughtList
      .locator('li')
      .filter({ hasText: text })
      .getByRole('button', { name: /^edit$/i });
  }

  deleteButtonFor(text: string | RegExp): Locator {
    return this.page.getByRole('button', {
      name: new RegExp(
        `delete thought: ${typeof text === 'string' ? text : text.source}`,
        'i',
      ),
    });
  }

  async editThought(from: string | RegExp, to: string): Promise<void> {
    await this.editButtonFor(from).click();
    await this.page.getByLabel(/edit thought/i).fill(to);
    await this.page.getByRole('button', { name: /^save$/i }).click();
  }

  async deleteThought(text: string | RegExp): Promise<void> {
    await this.deleteButtonFor(text).click();
  }

  async continue(): Promise<void> {
    await this.continueButton.click();
  }
}

export class SortingPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly currentThought: Locator;
  readonly actButton: Locator;
  readonly releaseButton: Locator;
  readonly continueButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /^sorting$/i });
    this.currentThought = page.locator('[aria-label="Current thought"]');
    this.actButton = page.getByRole('button', { name: /i can act on this/i });
    this.releaseButton = page.getByRole('button', { name: /i cannot act on this/i });
    this.continueButton = page.getByRole('button', { name: /^continue$/i });
  }

  async expectVisible(): Promise<void> {
    await this.heading.waitFor({ state: 'visible' });
  }

  async resolveAsTask(): Promise<void> {
    await this.actButton.click();
  }

  async resolveAsRelease(): Promise<void> {
    await this.releaseButton.click();
  }

  async continue(): Promise<void> {
    await this.continueButton.click();
  }
}

export class PrioritizationPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly continueButton: Locator;
  readonly todayButton: Locator;
  readonly soonButton: Locator;
  readonly laterButton: Locator;
  readonly canDoWithoutButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /^prioritization$/i });
    this.continueButton = page.getByRole('button', { name: /^continue$/i });
    this.todayButton = page.getByRole('button', { name: /needs attention today/i });
    this.soonButton = page.getByRole('button', { name: /important if time allows/i });
    this.laterButton = page.getByRole('button', { name: /save for later/i });
    this.canDoWithoutButton = page.getByRole('button', { name: /can do without/i });
  }

  async expectVisible(): Promise<void> {
    await this.heading.waitFor({ state: 'visible' });
  }

  async assignToday(): Promise<void> {
    await this.todayButton.click();
  }

  async assignSoon(): Promise<void> {
    await this.soonButton.click();
  }

  async assignLater(): Promise<void> {
    await this.laterButton.click();
  }

  async assignCanDoWithout(): Promise<void> {
    await this.canDoWithoutButton.click();
  }

  async continue(): Promise<void> {
    await this.continueButton.click();
  }
}

export class TimeEstimationPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly continueButton: Locator;
  readonly currentTask: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /^time estimation$/i });
    this.continueButton = page.getByRole('button', { name: /^continue$/i });
    this.currentTask = page.locator('[aria-label="Current task"]');
  }

  async expectVisible(): Promise<void> {
    await this.heading.waitFor({ state: 'visible' });
  }

  presetButton(minutes: number): Locator {
    return this.page.getByRole('button', { name: new RegExp(`^${minutes} min$`, 'i') });
  }

  async selectPreset(minutes: number): Promise<void> {
    await this.presetButton(minutes).click();
  }

  async continue(): Promise<void> {
    await this.continueButton.click();
  }
}

export class ReleasePage {
  readonly page: Page;
  readonly heading: Locator;
  readonly releaseList: Locator;
  readonly canDoWithoutList: Locator;
  readonly releaseAllButton: Locator;
  readonly continueButton: Locator;
  readonly emptyState: Locator;
  readonly releasedState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /^release$/i });
    this.releaseList = page.getByRole('region', { name: /release list/i });
    this.canDoWithoutList = page.getByRole('region', { name: /can do without/i });
    this.releaseAllButton = page.getByRole('button', { name: /release all/i });
    this.continueButton = page.getByRole('button', { name: /^continue$/i });
    this.emptyState = page.getByText(/nothing to release right now/i);
    this.releasedState = page.getByText(/these thoughts have been released/i);
  }

  async expectVisible(): Promise<void> {
    await this.heading.waitFor({ state: 'visible' });
  }

  async releaseAll(): Promise<void> {
    await this.releaseAllButton.click();
  }

  async continue(): Promise<void> {
    await this.continueButton.click();
  }
}

export class SummaryPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly summaryRegion: Locator;
  readonly finishButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /^summary$/i });
    this.summaryRegion = page.getByRole('region', { name: /session summary/i });
    this.finishButton = page.getByRole('button', { name: /finish session/i });
  }

  async expectVisible(): Promise<void> {
    await this.heading.waitFor({ state: 'visible' });
  }

  async finish(): Promise<void> {
    await this.finishButton.click();
  }
}
