import AxeBuilder from '@axe-core/playwright';
import { test, expect, expectCheck, knownIssueTags } from '../../fixtures';
import { PAGES } from '../../data/pages';

for (const target of PAGES) {
  test.describe(`Accessibility — ${target.name}`, () => {
    // Webflow interactions fade and slide sections in on scroll. Audit the resting page.
    test.use({ reducedMotion: 'reduce', skipMedia: true });

    test.beforeEach(async ({ basePage, page }) => {
      const response = await basePage.open(target.path);
      expect(response?.status(), `status of ${target.path}`).toBe(200);
      // Blog posts load in after the page and fade in; scanning mid-transition reports false contrast failures.
      await page.waitForLoadState('networkidle');
    });

    // Known issues record how many elements fail each axe rule on each page, so a new violation fails the build
    // even when it falls under a rule that is already known on this page.
    test('no WCAG 2.2 AA violations beyond known issues (axe)', knownIssueTags(target.path, 'axe'), async ({ page }) => {
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        // The reCAPTCHA iframe is Google's markup, not the site's.
        .exclude('iframe[src*="recaptcha"]')
        .analyze();

      const nodesPerRule = Object.fromEntries(results.violations.map((v) => [v.id, v.nodes.length]));
      const details = results.violations.map((v) => `[${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} element(s))`);
      expectCheck(target, 'axe', nodesPerRule, (violations) => {
        expect(violations, `axe violations:\n${details.join('\n')}`).toEqual({});
      });
    });

    test('every image has an alt attribute', async ({ page }) => {
      const missing = await page.locator('img:not([alt])').evaluateAll((imgs) =>
        imgs.map((img) => (img as HTMLImageElement).src),
      );
      expect(missing, `images without alt:\n${missing.join('\n')}`).toEqual([]);
    });
  });
}
