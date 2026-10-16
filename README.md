# houserx-site-audit

Automated checks and a running list of recommendations for <https://www.houserx.com> (Webflow).

## Setup

```bash
npm install
npx playwright install chromium
cp .env.example .env   # optional: BASE_URL defaults to production
```

`BASE_URL` in `.env` picks the site under test (e.g. the `*.webflow.io` staging domain). A `BASE_URL` set in the shell wins over `.env`: `BASE_URL=https://houserx.webflow.io npm test`.

## Run

| Command | Checks |
|---------|--------|
| `npm test` | everything |
| `npm run test:seo` | h1, title, meta description, canonical, `<html lang>`, Open Graph, JSON-LD, robots |
| `npm run test:a11y` | axe WCAG 2.2 AA scan, image alt attributes |
| `npm run test:links` | broken links on each page |
| `npm run test:content` | placeholder text (lorem ipsum, CMS template leaks) and links that go nowhere (`href="#"`) |
| `npm run test:mobile` | horizontal overflow on Pixel 7, full-page screenshots in `screenshots/`, mobile menu |
| `npm run test:visual` | home hero compared against the baseline in `tests/visual.spec.ts-snapshots/` (refresh with `test:visual:update`) |
| `npm run test:e2e` | contact and home lead forms: labels, required fields, validation, reCAPTCHA gate |
| `npm run test:ui` | Playwright UI mode |
| `npm run typecheck` | `tsc` over the whole suite |
| `npm run report` | open the HTML report from the last run |

Failing tests are findings, not bugs in the suite. Log them in [FINDINGS.md](FINDINGS.md), then add the check to that page's `knownIssues` in [targets.ts](targets.ts) so the run goes green and the test turns red again once the site is fixed.

## CI (GitHub Actions)

[.github/workflows/site-audit.yml](.github/workflows/site-audit.yml) runs the full suite daily at 06:00 UTC, on push to `main`, on pull requests, and on demand (Actions → Site audit → Run workflow, optionally with a different `base_url`). It uses the `mcr.microsoft.com/playwright:v1.64.0-noble` image; keep it in sync with `@playwright/test`, which is pinned to `1.64.0` (with an `overrides` entry so `@axe-core/playwright` shares the same `playwright-core`).

**Visual baselines** are per OS: `-darwin.png` locally, `-linux.png` in CI. Refresh both after an intentional site change: `npm run test:visual:update` and `npm run test:visual:update:linux` (needs Docker).

## Structure

```
targets.ts          pages under audit and their known defects
fixtures.ts         page objects, pageErrors, write guard (auto)
page-objects/       one class per page or shared component
network/
  endpoints.ts      Webflow form API, tracker hosts
  writeGuard.ts     aborts form writes and all analytics / ad pixels
reporters/
  summary-table.ts  results table printed after every run (Known defect = expected test.fail)
tests/
  *.spec.ts         audits: SEO, a11y, links, content, mobile, visual
  smoke/            home, navigation, 404
  e2e/              forms
```

## Testing against production

The suite runs against the live site of a healthcare company, so it must never write to it or skew its data:

- **Write guard**: an auto fixture aborts every non-GET request to Webflow's form API (`webflow.com/api/v1/form/**`). Aborted requests are exposed as `blockedWrites`.
- **Trackers**: Google Analytics / Ads / Tag Manager, Meta Pixel and LinkedIn Insight are aborted outright, so test runs never count as visits, conversions or retargeting audiences.
- **Forms are never submitted.** Submit stays disabled until reCAPTCHA is solved by a human; the suite does not try to bypass it. Testing the success state needs a staging copy without reCAPTCHA.
- Test data uses `example.com` addresses and `555-0100` numbers. Never enter real patient information.

## Add a page

Append it to `PAGES` in [targets.ts](targets.ts). Every audit check runs against every listed page.
