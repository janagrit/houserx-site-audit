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

/** Annotation type that marks a test as covered by a known site defect (read by the summary reporter). */
export const KNOWN_ISSUE_ANNOTATION = 'known issue';

/**
 * Asserts one check on one page.
 * - No known issue in data/known-issues.ts: runs `assertHealthy`.
 * - Known issue: `actual` must equal the value recorded for this page, exactly. A new problem on the same check
 *   fails instead of hiding behind the known one, and so does a fix (close the entry). The test is tagged with the
 *   issue IDs so the HTML report and the summary table link back to FINDINGS.md.
 */
export function expectCheck<C extends AuditCheck>(
  target: Pick<AuditPage, 'path'>,
  check: C,
  actual: CheckObservations[C],
  assertHealthy: (actual: CheckObservations[C]) => void,
): void {
  const known = knownDefectFor(target.path, check);
  if (!known) {
    assertHealthy(actual);
    return;
  }
  for (const issue of known.issues) {
    test.info().annotations.push({ type: KNOWN_ISSUE_ANNOTATION, description: `${issue.id}: ${issue.title}` });
  }
  const ids = known.issues.map((issue) => issue.id).join(', ');
  expect(
    actual,
    `${check} on ${target.path} no longer matches ${ids}. Fixed: close it in known-issues.ts and FINDINGS.md. ` +
      'Changed: confirm by hand, then update `observed` or file a new HRX- issue',
  ).toEqual(known.observed);
}
