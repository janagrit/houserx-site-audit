import { test, expect, expectKnownIssue } from '../fixtures';
import { PAGES } from '../targets';

const HTTP_ERROR_THRESHOLD = 400;
const LINK_REQUEST_TIMEOUT_MS = 15_000;
const MAX_PARALLEL_REQUESTS = 8;
// These sites block automated requests (e.g. LinkedIn returns 999), so check them by hand.
const BOT_BLOCKING_HOSTS = ['linkedin.com', 'instagram.com', 'facebook.com', 'x.com', 'twitter.com'];

function isBotBlocking(url: string): boolean {
  const host = new URL(url).hostname;
  return BOT_BLOCKING_HOSTS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`));
}

for (const target of PAGES) {
  test(`Links — ${target.name}: no broken links`, async ({ basePage, page, request }) => {
    expectKnownIssue(target, 'broken-links');
    await basePage.open(target.path);
    const hrefs = await page.locator('a[href]').evaluateAll((anchors) =>
      anchors.map((a) => (a as HTMLAnchorElement).href),
    );
    const uniqueHttpLinks = [...new Set(hrefs.map((href) => href.split('#')[0]))].filter(
      (href) => href.startsWith('http') && !isBotBlocking(href),
    );

    const check = async (url: string) => {
      const res = await request
        .get(url, { maxRedirects: 5, failOnStatusCode: false, timeout: LINK_REQUEST_TIMEOUT_MS })
        .catch(() => null);
      return { url, status: res?.status() ?? 0 };
    };
    const results: { url: string; status: number }[] = [];
    for (let i = 0; i < uniqueHttpLinks.length; i += MAX_PARALLEL_REQUESTS) {
      results.push(...(await Promise.all(uniqueHttpLinks.slice(i, i + MAX_PARALLEL_REQUESTS).map(check))));
    }
    const broken = results
      .filter(({ status }) => status === 0 || status >= HTTP_ERROR_THRESHOLD)
      .map(({ url, status }) => `${status} ${url}`);

    expect(broken, `broken links:\n${broken.join('\n')}`).toEqual([]);
  });
}
