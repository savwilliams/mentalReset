import { test as base, expect } from '@playwright/test';

import { blockFirebase } from './firebase';
import { resetAppStorage } from './indexeddb';

const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    await blockFirebase(page);

    const isPersistenceSpec = testInfo.file.endsWith('session-persistence.spec.ts');
    if (!isPersistenceSpec) {
      await resetAppStorage(page);
      await expect(page.getByRole('heading', { name: /mentalreset/i })).toBeVisible();
    }

    await use(page);
  },
});

export { expect, test };
