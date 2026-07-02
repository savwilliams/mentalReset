import type { Locator, Page } from '@playwright/test';

export class SessionPage {
  readonly page: Page;
  readonly title: Locator;
  readonly brainDumpStep: Locator;
  readonly continueButton: Locator;
  readonly leaveSessionButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.title = page.getByRole('heading', { name: /mental reset/i });
    this.brainDumpStep = page.getByText(/brain dump/i);
    this.continueButton = page.getByRole('button', { name: /continue/i });
    this.leaveSessionButton = page.getByRole('button', { name: /leave session/i });
  }

  async expectActiveStep(stepPattern: RegExp): Promise<void> {
    await this.title.waitFor({ state: 'visible' });
    await this.page.getByText(stepPattern).waitFor({ state: 'visible' });
  }
}
