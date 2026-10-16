import { test, expect } from '../../fixtures';

// Baselines live in tests/visual/__screenshots__/ and are made only in the Playwright Linux container, the same
// image CI runs in, so there is one baseline per screenshot. Fonts render differently on macOS and Windows, so the
// check is skipped there: run it with `npm run test:visual` (Docker), refresh with `npm run test:visual:update`.
const MAX_DIFF_PIXEL_RATIO = 0.01;

// Key pages only: landing, product and conversion. Each is a full ~14 MB load on the live site.
const KEY_PAGES = [
  { name: 'home', path: '/' },
  { name: 'technology', path: '/technology' },
  { name: 'contact', path: '/contact' },
];

test.describe('Visual — above the fold', () => {
  test.skip(process.platform !== 'linux', 'Baselines are Linux-only: use npm run test:visual (Docker)');
  test.use({ reducedMotion: 'reduce' });

  for (const { name, path } of KEY_PAGES) {
    test(`${name} matches the baseline`, async ({ basePage, page }) => {
      await basePage.open(path);
      await page.evaluate(() => document.fonts.ready);

      await expect(page).toHaveScreenshot(`${name}.png`, {
        animations: 'disabled',
        caret: 'hide',
        maxDiffPixelRatio: MAX_DIFF_PIXEL_RATIO,
      });
    });
  }
});
