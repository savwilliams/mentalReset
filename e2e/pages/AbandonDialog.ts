import type { Locator, Page } from '@playwright/test';

export class AbandonDialog {
  readonly page: Page;
  readonly dialog: Locator;
  readonly confirmButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dialog = page.getByRole('dialog', { name: /leave this session/i });
    this.confirmButton = this.dialog.getByRole('button', { name: /^leave session$/i });
    this.cancelButton = this.dialog.getByRole('button', { name: /keep going/i });
  }

  async expectOpen(): Promise<void> {
    await this.dialog.waitFor({ state: 'visible' });
  }

  async confirm(): Promise<void> {
    await this.confirmButton.click();
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
  }
}
