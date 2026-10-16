import { test, expect, expectKnownIssue, blockMedia } from '../../fixtures';
import { installWriteGuard } from '../../network/writeGuard';
import { PAGES } from '../../data/pages';

const META_DESCRIPTION_MAX = 160;
const META_DESCRIPTION_MIN = 70;
const TITLE_MAX = 65;

/** Everything the SEO checks look at, read from the rendered page in one pass. */
interface SeoFacts {
  h1Count: number;
  title: string;
  metaDescription: string | null;
  canonicalCount: number;
  lang: string | null;
  openGraph: Record<string, number>;
  jsonLd: string[];
  robots: string[];
}

for (const target of PAGES) {
  test.describe(`SEO — ${target.name}`, () => {
    let facts: SeoFacts;

    // One page load per page, shared by every check below. Each check stays its own test so knownIssues and
    // the report stay per check, but none of them reloads the page or waits on a tag that isn't there.
    test.beforeAll(async ({ browser }) => {
      const page = await browser.newPage();
      await installWriteGuard(page);
      await blockMedia(page);
      await page.goto(target.path);
      facts = await page.evaluate(() => {
        const content = (selector: string) => document.querySelector(selector)?.getAttribute('content') ?? null;
        const count = (selector: string) => document.querySelectorAll(selector).length;
        return {
          h1Count: count('h1'),
          title: document.title,
          metaDescription: content('meta[name="description"]'),
          canonicalCount: count('link[rel="canonical"]'),
          lang: document.documentElement.getAttribute('lang'),
          openGraph: Object.fromEntries(
            ['og:title', 'og:description', 'og:image'].map((prop) => [prop, count(`meta[property="${prop}"]`)]),
          ),
          jsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent ?? ''),
          robots: [...document.querySelectorAll('meta[name="robots"]')].map((m) => m.getAttribute('content') ?? ''),
        };
      });
      await page.close();
    });

    test('has exactly one <h1>', () => {
      expectKnownIssue(target, 'single-h1');
      expect(facts.h1Count, 'number of <h1>').toBe(1);
    });

    test('title is present, page-specific and not too long', () => {
      expectKnownIssue(target, 'title-length');
      const { title } = facts;
      expect(title.length, `title: "${title}"`).toBeGreaterThan(0);
      expect.soft(title, 'title is just the brand name').not.toBe('House Rx');
      expect.soft(title.length, `title is ${title.length} chars`).toBeLessThanOrEqual(TITLE_MAX);
    });

    test('meta description has a sensible length', () => {
      expectKnownIssue(target, 'meta-description');
      const desc = facts.metaDescription ?? '';
      expect(desc.length, 'meta description missing').toBeGreaterThan(0);
      expect.soft(desc.length).toBeGreaterThanOrEqual(META_DESCRIPTION_MIN);
      expect.soft(desc.length, `"${desc}"`).toBeLessThanOrEqual(META_DESCRIPTION_MAX);
    });

    test('has a canonical URL', () => {
      expectKnownIssue(target, 'canonical');
      expect(facts.canonicalCount, 'number of <link rel="canonical">').toBe(1);
    });

    test('declares the page language', () => {
      expectKnownIssue(target, 'html-lang');
      expect(facts.lang, '<html lang>').toMatch(/^[a-z]{2}(-[A-Z]{2})?$/);
    });

    test('has Open Graph title, description and image', () => {
      expectKnownIssue(target, 'open-graph');
      expect(facts.openGraph, 'number of each Open Graph tag').toEqual({ 'og:title': 1, 'og:description': 1, 'og:image': 1 });
    });

    test('has valid JSON-LD structured data', () => {
      expectKnownIssue(target, 'json-ld');
      expect(facts.jsonLd.length, 'JSON-LD blocks').toBeGreaterThan(0);
      for (const block of facts.jsonLd) {
        expect(() => JSON.parse(block), 'invalid JSON-LD').not.toThrow();
      }
    });

    test('is not blocked from indexing', () => {
      expect(facts.robots.join(' ')).not.toContain('noindex');
    });
  });
}
