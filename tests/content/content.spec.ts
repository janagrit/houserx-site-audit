import { test, expect, expectKnownIssue } from '../../fixtures';
import { PAGES } from '../../data/pages';

// Template and CMS leftovers that should never reach visitors.
const PLACEHOLDER_TEXT: readonly RegExp[] = [
  /lorem ipsum/i,
  /The excerpt is here/,
  /^No items found\.?$/m,
];

for (const target of PAGES) {
  test.describe(`Content — ${target.name}`, () => {
    test.use({ reducedMotion: 'reduce', skipMedia: true });

    test.beforeEach(async ({ basePage }) => {
      await basePage.open(target.path);
    });

    test('shows no placeholder or template text', async ({ page }) => {
      expectKnownIssue(target, 'placeholder-text');
      // innerText only includes rendered text, so hidden CMS templates don't count.
      const text = await page.locator('body').innerText();
      const found = PLACEHOLDER_TEXT.filter((pattern) => pattern.test(text)).map(String);
      expect(found, `placeholder text visible: ${found.join(', ')}`).toEqual([]);
    });

    test('has no visible links that go nowhere (href="#")', async ({ page }) => {
      expectKnownIssue(target, 'placeholder-links');
      // Webflow lightboxes and Finsweet click mirrors are JS-driven buttons that use href="#" by design.
      const deadLinks = await page
        .locator('a[href="#"]:not(.w-lightbox):not([fs-mirrorclick-element])')
        .evaluateAll((anchors) =>
          anchors
            .filter((a) => (a as HTMLElement).offsetParent !== null)
            .map(
              (a) =>
                (a as HTMLElement).innerText.trim().replace(/\s+/g, ' ') ||
                a.getAttribute('aria-label') ||
                `.${a.className.split(' ')[0]}`,
            ),
        );
      const counts = deadLinks.reduce<Record<string, number>>(
        (acc, label) => ({ ...acc, [label]: (acc[label] ?? 0) + 1 }),
        {},
      );
      expect(counts, 'links with href="#" (label: count)').toEqual({});
    });
  });
}
