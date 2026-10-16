import { test, expect } from '../../fixtures';

test.describe('Smoke — Home', () => {
  test('loads successfully with the hero heading', async ({ homePage }) => {
    const response = await homePage.open();

    expect(response?.status()).toBe(200);
    await expect(homePage.heroHeading).toBeVisible();
  });

  test('hero "Learn more" leads to Technology', async ({ homePage }) => {
    await homePage.open();

    await expect(homePage.heroCta).toBeVisible();
    await expect(homePage.heroCta).toHaveAttribute('href', '/technology');
  });

  test('"Partner With Us" leads to Contact', async ({ homePage }) => {
    await homePage.open();

    await expect(homePage.partnerCta).toHaveAttribute('href', '/contact');
  });

  test('loads without JavaScript errors', async ({ homePage, pageErrors }) => {
    await homePage.open();

    expect(pageErrors, pageErrors.join('\n')).toEqual([]);
  });

  test('sends no analytics or form writes during a visit', async ({ homePage, page, blockedWrites }) => {
    const leaked: string[] = [];
    page.on('requestfinished', (request) => {
      if (request.method() !== 'GET' && !new URL(request.url()).hostname.endsWith('houserx.com')) {
        leaked.push(`${request.method()} ${request.url()}`);
      }
    });

    await homePage.open();
    await page.waitForLoadState('networkidle');

    expect(blockedWrites).toEqual([]);
    // Cloudflare Turnstile and reCAPTCHA handshakes are allowed: they are anti-bot checks, not data writes.
    expect(leaked.filter((url) => !/challenges\.cloudflare\.com|google\.com\/recaptcha/.test(url))).toEqual([]);
  });
});
