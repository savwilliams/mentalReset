import type { Locator, Page } from '@playwright/test';

export class IdlePage {
  readonly page: Page;
  readonly heading: Locator;
  readonly tagline: Locator;
  readonly startButton: Locator;
  readonly todaysPlanButton: Locator;
  readonly sessionHistoryButton: Locator;
  readonly settingsButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /mentalreset/i });
    this.tagline = page.getByText(/calm space to reset your mind/i);
    this.startButton = page.getByRole('button', { name: /start mental reset/i });
    this.todaysPlanButton = page.getByRole('button', { name: /today's plan/i });
    this.sessionHistoryButton = page.getByRole('button', { name: /session history/i });
    this.settingsButton = page.getByRole('button', { name: /settings/i });
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
    await this.heading.waitFor({ state: 'visible' });
  }

  async startSession(): Promise<void> {
    await this.startButton.click();
  }

  async openTodaysPlan(): Promise<void> {
    await this.todaysPlanButton.click();
  }

  async openSessionHistory(): Promise<void> {
    await this.sessionHistoryButton.click();
  }

  async openSettings(): Promise<void> {
    await this.settingsButton.click();
  }
}
