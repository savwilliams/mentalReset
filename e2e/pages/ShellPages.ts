import type { Locator, Page } from '@playwright/test';

export class TodaysPlanPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly backButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /today's plan/i });
    this.backButton = page.getByRole('button', { name: /back to home/i });
  }

  async backToHome(): Promise<void> {
    await this.backButton.click();
  }
}

export class SettingsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly backButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /^settings$/i });
    this.backButton = page.getByRole('button', { name: /back to home/i });
  }

  async backToHome(): Promise<void> {
    await this.backButton.click();
  }
}
