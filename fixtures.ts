import { isDeepStrictEqual } from 'node:util';
import { test as base, expect, type Page } from '@playwright/test';
import { installWriteGuard, type BlockedWrite } from './network/writeGuard';
import { BasePage } from './page-objects/BasePage';
import { ContactPage } from './page-objects/ContactPage';
import { HomePage } from './page-objects/HomePage';
import { SiteHeader } from './page-objects/SiteHeader';
import { knownDefectFor, type AuditCheck, type CheckObservations } from './data/known-issues';
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
 * Report tags for a check that has a known site defect on this page: `@known-issue` plus each HRX ID.
 * The HTML report shows them as labels in the test list and filters by them on click, so the tests that
 * show a known bug stand out without opening each one. Empty when the page should pass the check.
 */
export function knownIssueTags(path: string, check: AuditCheck): { tag: string[] } {
  const known = knownDefectFor(path, check);
  const ids = [...new Set(known?.issues.map((issue) => `@${issue.id}`) ?? [])];
  return { tag: ids.length > 0 ? ['@known-issue', ...ids] : [] };
}

/** Annotation type that marks a test as covered by a known site defect (read by the summary reporter). */
export const KNOWN_ISSUE_ANNOTATION = 'known issue';

/**
 * Asserts one check on one page. The check always runs for real, so a page with a bug fails, known or not.
 * When data/known-issues.ts covers this check on this page, the test is also annotated with the HRX IDs (shown in
 * the report next to the failure, and counted as "Known bug" in the summary table). If the site no longer matches
 * the recorded value, a second annotation says so: the bug changed or got worse, so confirm it by hand and update
 * `observed`. A known issue whose test passes has been fixed: close it here and in FINDINGS.md.
 */
export function expectCheck<C extends AuditCheck>(
  target: Pick<AuditPage, 'path'>,
  check: C,
  actual: CheckObservations[C],
  assertHealthy: (actual: CheckObservations[C]) => void,
): void {
  const known = knownDefectFor(target.path, check);
  if (known) {
    const { annotations } = test.info();
    for (const issue of known.issues) {
      annotations.push({ type: KNOWN_ISSUE_ANNOTATION, description: `${issue.id}: ${issue.title}` });
    }
    if (!isDeepStrictEqual(actual, known.observed)) {
      annotations.push({
        type: 'known issue changed',
        description: `recorded ${JSON.stringify(known.observed)}, now ${JSON.stringify(actual)}`,
      });
    }
  }
  assertHealthy(actual);
}
