import { test, expect } from '../fixtures';

// Baselines live in tests/visual.spec.ts-snapshots/, one per OS (fonts render differently): darwin locally, linux in CI.
// After an intentional site change, refresh both: npm run test:visual:update and npm run test:visual:update:linux
const MAX_DIFF_PIXEL_RATIO = 0.01;

test.describe('Visual — Home', () => {
  test.use({ reducedMotion: 'reduce' });

  test('above-the-fold hero matches the baseline', async ({ homePage, page }) => {
    await homePage.open();
    await page.evaluate(() => document.fonts.ready);

    await expect(page).toHaveScreenshot('home-hero.png', {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: MAX_DIFF_PIXEL_RATIO,
    });
  });
});
