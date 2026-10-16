import { test as base, expect } from '@playwright/test';
import { installWriteGuard, type BlockedWrite } from './network/writeGuard';
import { BasePage } from './page-objects/BasePage';
import { ContactPage } from './page-objects/ContactPage';
import { HomePage } from './page-objects/HomePage';
import { SiteHeader } from './page-objects/SiteHeader';
import type { AuditCheck, AuditPage } from './targets';

interface AuditFixtures {
  basePage: BasePage;
  homePage: HomePage;
  contactPage: ContactPage;
  siteHeader: SiteHeader;
  /** Uncaught JavaScript errors thrown by the page during the test. */
  pageErrors: string[];
  /** Writes to production that the auto-installed guard aborted. Always on; see network/writeGuard.ts. */
  blockedWrites: readonly BlockedWrite[];
}

export const test = base.extend<AuditFixtures>({
  blockedWrites: [async ({ page }, use) => use(await installWriteGuard(page)), { auto: true }],
  basePage: async ({ page }, use) => use(new BasePage(page)),
  homePage: async ({ page }, use) => use(new HomePage(page)),
  contactPage: async ({ page }, use) => use(new ContactPage(page)),
  siteHeader: async ({ page }, use) => use(new SiteHeader(page)),
  pageErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await use(errors);
  },
});

export { expect };

/**
 * Marks the current test as an expected failure when the target has a known issue for this check.
 * The test turns red once the site is fixed, signalling the entry can be removed.
 */
export function expectKnownIssue(target: AuditPage, check: AuditCheck): void {
  const finding = target.knownIssues?.[check];
  test.fail(finding !== undefined, `Known site defect — ${finding}`);
}
