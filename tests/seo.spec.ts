import { test, expect, expectKnownIssue } from '../fixtures';
import { PAGES } from '../targets';

const META_DESCRIPTION_MAX = 160;
const META_DESCRIPTION_MIN = 70;
const TITLE_MAX = 65;

for (const target of PAGES) {
  test.describe(`SEO — ${target.name}`, () => {
    test.beforeEach(async ({ basePage }) => {
      await basePage.open(target.path);
    });

    test('has exactly one <h1>', async ({ page }) => {
      expectKnownIssue(target, 'single-h1');
      await expect(page.locator('h1')).toHaveCount(1);
    });

    test('title is present, page-specific and not too long', async ({ page }) => {
      expectKnownIssue(target, 'title-length');
      const title = await page.title();
      expect(title.length, `title: "${title}"`).toBeGreaterThan(0);
      expect.soft(title, 'title is just the brand name').not.toBe('House Rx');
      expect.soft(title.length, `title is ${title.length} chars`).toBeLessThanOrEqual(TITLE_MAX);
    });

    test('meta description has a sensible length', async ({ page }) => {
      expectKnownIssue(target, 'meta-description');
      const desc = (await page.locator('meta[name="description"]').getAttribute('content')) ?? '';
      expect(desc.length, 'meta description missing').toBeGreaterThan(0);
      expect.soft(desc.length).toBeGreaterThanOrEqual(META_DESCRIPTION_MIN);
      expect.soft(desc.length, `"${desc}"`).toBeLessThanOrEqual(META_DESCRIPTION_MAX);
    });

    test('has a canonical URL', async ({ page }) => {
      expectKnownIssue(target, 'canonical');
      await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    });

    test('declares the page language', async ({ page }) => {
      expectKnownIssue(target, 'html-lang');
      await expect(page.locator('html')).toHaveAttribute('lang', /^[a-z]{2}(-[A-Z]{2})?$/);
    });

    test('has Open Graph title, description and image', async ({ page }) => {
      for (const prop of ['og:title', 'og:description', 'og:image']) {
        await expect.soft(page.locator(`meta[property="${prop}"]`), prop).toHaveCount(1);
      }
    });

    test('has valid JSON-LD structured data', async ({ page }) => {
      expectKnownIssue(target, 'json-ld');
      const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
      expect(blocks.length).toBeGreaterThan(0);
      for (const block of blocks) {
        expect(() => JSON.parse(block), 'invalid JSON-LD').not.toThrow();
      }
    });

    test('is not blocked from indexing', async ({ page }) => {
      const robotsTags = await page.locator('meta[name="robots"]').evaluateAll((tags) =>
        tags.map((tag) => tag.getAttribute('content') ?? ''),
      );
      expect(robotsTags.join(' ')).not.toContain('noindex');
    });
  });
}
