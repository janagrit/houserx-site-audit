import { test, expect } from '../../fixtures';
import { NAV_DESTINATIONS } from '../../data/pages';

test.describe('Smoke — Navigation (desktop)', () => {
  test.use({ skipMedia: true });

  for (const { item, path } of NAV_DESTINATIONS) {
    test(`"${item}" opens its page`, async ({ homePage, siteHeader, page }) => {
      await homePage.open();

      await siteHeader.navigateTo(item);

      await expect(page).toHaveURL(path);
      await expect(page.getByRole('heading').first()).toBeVisible();
    });
  }

  test('unknown URL shows the 404 page', async ({ basePage, page }) => {
    const response = await basePage.open('/this-page-does-not-exist');

    expect(response?.status()).toBe(404);
    await expect(page).toHaveTitle(/not found/i);
  });
});
