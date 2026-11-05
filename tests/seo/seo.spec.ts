import { test, expect, expectCheck, blockMedia, knownIssueTags } from '../../fixtures';
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

    // One page load per page, shared by every check below. Each check stays its own test so known issues and
    // the report stay per check, but none of them reloads the page or waits on a tag that isn't there.
    test.beforeAll(async ({ browser }) => {
      const page = await browser.newPage();
      try {
        await installWriteGuard(page);
        await blockMedia(page);
        const response = await page.goto(target.path);
        // Without this, an error or challenge page would be audited instead, and every check would report on it.
        expect(response?.status(), `status of ${target.path}`).toBe(200);
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
      } finally {
        await page.close();
      }
    });

    test('has exactly one <h1>', knownIssueTags(target.path, 'single-h1'), () => {
      expectCheck(target, 'single-h1', facts.h1Count, (count) => {
        expect(count, 'number of <h1>').toBe(1);
      });
    });

    test('title is present, page-specific and not too long', knownIssueTags(target.path, 'title-length'), () => {
      const { title } = facts;
      expectCheck(target, 'title-length', title.length, (length) => {
        expect(length, `title: "${title}"`).toBeGreaterThan(0);
        expect.soft(title, 'title is just the brand name').not.toBe('House Rx');
        expect.soft(length, `title is ${length} chars`).toBeLessThanOrEqual(TITLE_MAX);
      });
    });

    test('meta description has a sensible length', knownIssueTags(target.path, 'meta-description'), () => {
      const desc = facts.metaDescription;
      expectCheck(target, 'meta-description', desc === null ? null : desc.length, (length) => {
        expect(length ?? 0, 'meta description missing').toBeGreaterThan(0);
        expect.soft(length).toBeGreaterThanOrEqual(META_DESCRIPTION_MIN);
        expect.soft(length, `"${desc}"`).toBeLessThanOrEqual(META_DESCRIPTION_MAX);
      });
    });

    test('has a canonical URL', knownIssueTags(target.path, 'canonical'), () => {
      expectCheck(target, 'canonical', facts.canonicalCount, (count) => {
        expect(count, 'number of <link rel="canonical">').toBe(1);
      });
    });

    test('declares the page language', knownIssueTags(target.path, 'html-lang'), () => {
      expectCheck(target, 'html-lang', facts.lang, (lang) => {
        expect(lang, '<html lang>').toMatch(/^[a-z]{2}(-[A-Z]{2})?$/);
      });
    });

    test('has Open Graph title, description and image', knownIssueTags(target.path, 'open-graph'), () => {
      expectCheck(target, 'open-graph', facts.openGraph, (openGraph) => {
        expect(openGraph, 'number of each Open Graph tag').toEqual({ 'og:title': 1, 'og:description': 1, 'og:image': 1 });
      });
    });

    test('has valid JSON-LD structured data', knownIssueTags(target.path, 'json-ld'), () => {
      expectCheck(target, 'json-ld', facts.jsonLd.length, (count) => {
        expect(count, 'JSON-LD blocks').toBeGreaterThan(0);
        for (const block of facts.jsonLd) {
          expect(() => JSON.parse(block), 'invalid JSON-LD').not.toThrow();
        }
      });
    });

    test('is not blocked from indexing', () => {
      expect(facts.robots.join(' ')).not.toContain('noindex');
    });
  });
}
