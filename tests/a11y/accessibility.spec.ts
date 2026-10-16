import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '../../fixtures';
import { knownIssuesFor } from '../../data/known-issues';
import { PAGES } from '../../data/pages';

for (const target of PAGES) {
  test.describe(`Accessibility — ${target.name}`, () => {
    // Webflow interactions fade and slide sections in on scroll. Audit the resting page.
    test.use({ reducedMotion: 'reduce', skipMedia: true });

    test.beforeEach(async ({ basePage, page }) => {
      await basePage.open(target.path);
      // Blog posts load in after the page and fade in; scanning mid-transition reports false contrast failures.
      await page.waitForLoadState('networkidle');
    });

    // Known axe rules are subtracted instead of marking the whole test as an expected failure,
    // so a new violation on a page that already has known issues still fails the build.
    test('no WCAG 2.2 AA violations beyond known issues (axe)', async ({ page }) => {
      const known = knownIssuesFor(target.path, 'axe');
      for (const issue of known) {
        test.info().annotations.push({ type: 'known issue', description: `${issue.id}: ${issue.title}` });
      }
      const knownRules = new Set(known.flatMap((issue) => issue.axeRules ?? []));

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        // The reCAPTCHA iframe is Google's markup, not the site's.
        .exclude('iframe[src*="recaptcha"]')
        .analyze();

      const unexpected = results.violations
        .filter((v) => !knownRules.has(v.id))
        .map((v) => `[${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} element(s))`);
      expect(unexpected, 'new axe violations').toEqual([]);

      const observed = new Set(results.violations.map((v) => v.id));
      const resolved = known
        .filter((issue) => issue.axeRules?.every((rule) => !observed.has(rule)))
        .map((issue) => `${issue.id}: ${issue.title}`);
      expect.soft(resolved, 'known issues no longer observed: close them in known-issues.ts and FINDINGS.md').toEqual([]);
    });

    test('every image has an alt attribute', async ({ page }) => {
      const missing = await page.locator('img:not([alt])').evaluateAll((imgs) =>
        imgs.map((img) => (img as HTMLImageElement).src),
      );
      expect(missing, `images without alt:\n${missing.join('\n')}`).toEqual([]);
    });
  });
}
