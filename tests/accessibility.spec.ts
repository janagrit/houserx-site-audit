import AxeBuilder from '@axe-core/playwright';
import { test, expect, expectKnownIssue } from '../fixtures';
import { PAGES } from '../targets';

for (const target of PAGES) {
  test.describe(`Accessibility — ${target.name}`, () => {
    // Webflow interactions fade and slide sections in on scroll. Audit the resting page.
    test.use({ reducedMotion: 'reduce' });

    test.beforeEach(async ({ basePage }) => {
      await basePage.open(target.path);
    });

    test('no WCAG 2.2 AA violations (axe)', async ({ page }) => {
      expectKnownIssue(target, 'axe');
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        // The reCAPTCHA iframe is Google's markup, not the site's.
        .exclude('iframe[src*="recaptcha"]')
        .analyze();

      const summary = results.violations.map(
        (v) => `[${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} element(s))`,
      );
      expect(results.violations, summary.join('\n')).toEqual([]);
    });

    test('every image has an alt attribute', async ({ page }) => {
      const missing = await page.locator('img:not([alt])').evaluateAll((imgs) =>
        imgs.map((img) => (img as HTMLImageElement).src),
      );
      expect(missing, `images without alt:\n${missing.join('\n')}`).toEqual([]);
    });
  });
}
