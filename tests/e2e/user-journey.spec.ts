import type { Response } from '@playwright/test';
import { test, expect } from '../../fixtures';
import { NAV_DESTINATIONS } from '../../data/pages';

// One visitor clicking through the site in a single session, the way a real user would:
// Home → every header menu item in turn → logo back to Home → the hero CTAs.
test.describe('E2E — Visitor journey', () => {
  // Opening a page is about navigation, status and content, not images: skip the ~14 MB of GIFs per page.
  test.use({ reducedMotion: 'reduce', skipMedia: true });
  // Nine page loads in a row.
  test.setTimeout(120_000);

  test('clicks through every main page and each one opens', async ({ homePage, siteHeader, page, pageErrors }) => {
    const documentResponses: Response[] = [];
    page.on('response', (response) => {
      if (response.request().isNavigationRequest() && response.frame() === page.mainFrame()) {
        documentResponses.push(response);
      }
    });

    /** The page the visitor just landed on really opened: 200, not the 404 page, a visible heading. */
    const expectPageOpened = async (path: RegExp) => {
      await expect(page).toHaveURL(path);
      expect(documentResponses.at(-1)?.status(), `status of ${page.url()}`).toBe(200);
      await expect(page).not.toHaveTitle(/not found/i);
      await expect(page.getByRole('heading').first()).toBeVisible();
    };

    await test.step('open Home', async () => {
      await homePage.open();
      await expectPageOpened(/\/$/);
      await expect(homePage.heroHeading).toBeVisible();
    });

    for (const { item, path } of NAV_DESTINATIONS) {
      await test.step(`click "${item}" in the header`, async () => {
        await siteHeader.navigateTo(item);
        await expectPageOpened(path);
      });
    }

    await test.step('click the logo to return Home', async () => {
      await siteHeader.goHome();
      await expectPageOpened(/\/$/);
      await expect(homePage.heroHeading).toBeVisible();
    });

    await test.step('click hero "Learn more"', async () => {
      await homePage.heroCta.click();
      await expectPageOpened(/\/technology$/);
    });

    await test.step('return Home and click "Partner With Us"', async () => {
      await siteHeader.goHome();
      await homePage.partnerCta.click();
      await expectPageOpened(/\/contact$/);
    });

    expect(pageErrors, `JavaScript errors during the journey:\n${pageErrors.join('\n')}`).toEqual([]);
  });
});
