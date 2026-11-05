import { test, expect, expectCheck } from '../../fixtures';
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
      const response = await basePage.open(target.path);
      // Otherwise an error or challenge page would be checked instead and could pass.
      expect(response?.status(), `status of ${target.path}`).toBe(200);
    });

    test('shows no placeholder or template text', async ({ page }) => {
      // innerText only includes rendered text, so hidden CMS templates don't count.
      const text = await page.locator('body').innerText();
      const found = PLACEHOLDER_TEXT.filter((pattern) => pattern.test(text)).map(String);
      expectCheck(target, 'placeholder-text', found, (patterns) => {
        expect(patterns, `placeholder text visible: ${patterns.join(', ')}`).toEqual([]);
      });
    });

    test('has no visible links that go nowhere (href="#")', async ({ page }) => {
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
      expectCheck(target, 'placeholder-links', counts, (labels) => {
        expect(labels, 'links with href="#" (label: count)').toEqual({});
      });
    });
  });
}
