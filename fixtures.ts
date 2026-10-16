import { test as base, expect, type Page } from '@playwright/test';
import { installWriteGuard, type BlockedWrite } from './network/writeGuard';
import { BasePage } from './page-objects/BasePage';
import { ContactPage } from './page-objects/ContactPage';
import { HomePage } from './page-objects/HomePage';
import { SiteHeader } from './page-objects/SiteHeader';
import { knownIssuesFor, type AuditCheck } from './data/known-issues';
import type { AuditPage } from './data/pages';

interface AuditOptions {
  /**
   * Abort image and video downloads. Each page pulls ~14 MB of GIFs that DOM-level checks (SEO, axe, links,
   * content) never look at. Leave off for anything that looks at rendering: visual, mobile, journeys.
   */
  skipMedia: boolean;
}

interface AuditFixtures {
  /** Installs the skipMedia route when the option is on. */
  mediaBlocker: void;
  basePage: BasePage;
  homePage: HomePage;
  contactPage: ContactPage;
  siteHeader: SiteHeader;
  /** Uncaught JavaScript errors thrown by the page during the test. */
  pageErrors: string[];
  /** Writes to production that the auto-installed guard aborted. Always on; see network/writeGuard.ts. */
  blockedWrites: readonly BlockedWrite[];
}

const MEDIA_TYPES = new Set(['image', 'media']);

/**
 * Aborts raster image and video downloads. SVGs (logo, icons, arrows) still load: they weigh almost nothing and
 * without them the header logo has no size and can't be clicked.
 * Register after installWriteGuard: fallback() hands everything else to it.
 */
export async function blockMedia(page: Page): Promise<void> {
  await page.route('**/*', (route) => {
    const request = route.request();
    const isSvg = new URL(request.url()).pathname.toLowerCase().endsWith('.svg');
    return MEDIA_TYPES.has(request.resourceType()) && !isSvg ? route.abort('blockedbyclient') : route.fallback();
  });
}

export const test = base.extend<AuditFixtures & AuditOptions>({
  skipMedia: [false, { option: true }],
  blockedWrites: [async ({ page }, use) => use(await installWriteGuard(page)), { auto: true }],
  // Depends on blockedWrites so the guard is registered first.
  mediaBlocker: [
    async ({ page, skipMedia, blockedWrites: _ }, use) => {
      if (skipMedia) {
        await blockMedia(page);
      }
      await use();
    },
    { auto: true },
  ],
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
 * Marks the current test as an expected failure when data/known-issues.ts covers this check on this page,
 * and tags it with the issue IDs so the HTML report links back to FINDINGS.md.
 * The test turns red once the issue is resolved, signalling the entry can be closed.
 */
export function expectKnownIssue(target: Pick<AuditPage, 'path'>, check: AuditCheck): void {
  const issues = knownIssuesFor(target.path, check);
  for (const issue of issues) {
    test.info().annotations.push({ type: 'known issue', description: `${issue.id}: ${issue.title}` });
  }
  test.fail(issues.length > 0, `Known issue — ${issues.map((issue) => issue.id).join(', ')} (see FINDINGS.md)`);
}
