import { test, expect } from '../../fixtures';
import { PAGES } from '../../data/pages';

for (const { name, path } of PAGES) {
  test(`Mobile — ${name}: no horizontal scroll`, async ({ basePage, page }) => {
    await basePage.open(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `page is ${overflow}px wider than the viewport`).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `screenshots/mobile-${name.replace(/\W+/g, '-')}.png`, fullPage: true });
  });
}

test.describe('Mobile — Navigation', () => {
  test('menu button opens the menu', async ({ homePage, siteHeader }) => {
    await homePage.open();

    await siteHeader.openMobileMenu();

    await expect(siteHeader.menuButton).toHaveAttribute('aria-expanded', 'true');
    await expect(siteHeader.mobileOverlay.getByRole('link', { name: 'Technology', exact: true })).toBeVisible();
  });

  test('menu link navigates to Technology', async ({ homePage, siteHeader, page }) => {
    await homePage.open();
    await siteHeader.openMobileMenu();

    await siteHeader.mobileOverlay.getByRole('link', { name: 'Technology', exact: true }).click();

    await expect(page).toHaveURL(/\/technology$/);
  });
});
