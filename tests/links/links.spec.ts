import type { APIRequestContext } from '@playwright/test';
import { test, expect, expectKnownIssue } from '../../fixtures';
import { BASE_URL, PAGES } from '../../data/pages';

const HTTP_ERROR_THRESHOLD = 400;
const LINK_REQUEST_TIMEOUT_MS = 15_000;
const MAX_PARALLEL_REQUESTS = 8;
// These sites block automated requests (e.g. LinkedIn returns 999), so check them by hand.
const BOT_BLOCKING_HOSTS = ['linkedin.com', 'instagram.com', 'facebook.com', 'x.com', 'twitter.com'];

function isBotBlocking(url: string): boolean {
  const host = new URL(url).hostname;
  return BOT_BLOCKING_HOSTS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`));
}

/** Every http(s) <a href> in the server-rendered HTML, resolved, without fragments, deduplicated. */
function extractLinks(html: string, pageUrl: string): string[] {
  const hrefs = [...html.matchAll(/<a\s[^>]*?href="([^"]*)"/gi)].map(([, href]) => href.replace(/&amp;/g, '&'));
  const urls = hrefs.flatMap((href) => {
    try {
      const url = new URL(href, pageUrl);
      url.hash = '';
      return url.protocol.startsWith('http') ? [url.href] : [];
    } catch {
      return [];
    }
  });
  return [...new Set(urls)].filter((url) => !isBotBlocking(url));
}

// All tests in this file run in one worker, so the header and footer links shared by every page are
// requested once per run, not once per page. Keeps the daily load on the live site down.
const statusCache = new Map<string, Promise<number>>();

function linkStatus(request: APIRequestContext, url: string): Promise<number> {
  let status = statusCache.get(url);
  if (!status) {
    status = request
      .get(url, { maxRedirects: 5, failOnStatusCode: false, timeout: LINK_REQUEST_TIMEOUT_MS })
      .then((res) => res.status())
      .catch(() => 0);
    statusCache.set(url, status);
  }
  return status;
}

for (const target of PAGES) {
  test(`Links — ${target.name}: no broken links`, async ({ request }) => {
    expectKnownIssue(target, 'broken-links');
    // No browser needed: Webflow renders every link server-side.
    const pageUrl = new URL(target.path, BASE_URL).href;
    const page = await request.get(pageUrl);
    expect(page.status(), `status of ${pageUrl}`).toBe(200);
    const links = extractLinks(await page.text(), pageUrl);

    const results: { url: string; status: number }[] = [];
    for (let i = 0; i < links.length; i += MAX_PARALLEL_REQUESTS) {
      const batch = links.slice(i, i + MAX_PARALLEL_REQUESTS);
      results.push(...(await Promise.all(batch.map(async (url) => ({ url, status: await linkStatus(request, url) })))));
    }
    const broken = results
      .filter(({ status }) => status === 0 || status >= HTTP_ERROR_THRESHOLD)
      .map(({ url, status }) => `${status || 'unreachable'} ${url}`);

    expect(broken, `broken links:\n${broken.join('\n')}`).toEqual([]);
  });
}
