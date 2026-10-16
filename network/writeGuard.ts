import type { Page } from '@playwright/test';
import { isTracker, WRITE_ENDPOINTS } from './endpoints';

export interface BlockedWrite {
  readonly method: string;
  readonly url: string;
}

/**
 * Keeps tests from touching production data:
 * - aborts every non-GET request to a write endpoint (Webflow form submissions, site auth)
 * - aborts every analytics and ad-pixel request, so test runs never show up as visitors or leads
 *
 * Tests that want to observe a write register their own `page.route`, which Playwright runs before
 * this guard because later routes take precedence.
 */
export async function installWriteGuard(page: Page): Promise<readonly BlockedWrite[]> {
  const blocked: BlockedWrite[] = [];

  await page.route(isTracker, (route) => route.abort('blockedbyclient'));

  for (const pattern of WRITE_ENDPOINTS) {
    await page.route(pattern, async (route) => {
      const request = route.request();
      if (request.method() === 'GET') {
        return route.continue();
      }
      blocked.push({ method: request.method(), url: request.url() });
      await route.abort('blockedbyclient');
    });
  }
  return blocked;
}
