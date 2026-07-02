import type { Page } from '@playwright/test';

const FIREBASE_ROUTE_PATTERNS = [
  '**/*firebaseapp.com/**',
  '**/*firebaseio.com/**',
  '**/*googleapis.com/**',
  '**/*gstatic.com/firebasejs/**',
];

export async function blockFirebase(page: Page): Promise<void> {
  for (const pattern of FIREBASE_ROUTE_PATTERNS) {
    await page.route(pattern, (route) => route.abort());
  }
}
