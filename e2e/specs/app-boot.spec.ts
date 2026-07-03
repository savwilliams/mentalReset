import { expect, test } from '../fixtures/test';
import { IdlePage } from '../pages';

test.describe('app boot', () => {
  test('renders the idle shell', async ({ page }) => {
    const idle = new IdlePage(page);

    await expect(idle.heading).toBeVisible();
    await expect(idle.tagline).toBeVisible();
    await expect(idle.startButton).toBeVisible();
  });

  test('mobile viewport has no horizontal scroll and primary CTA is at least 44px', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const idle = new IdlePage(page);
    await expect(idle.heading).toBeVisible();

    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(false);

    const ctaBox = await idle.startButton.boundingBox();
    expect(ctaBox?.height).toBeGreaterThanOrEqual(44);
  });
});
