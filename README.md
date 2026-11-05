# houserx-site-audit

[![Site audit](https://github.com/janagrit/houserx-site-audit/actions/workflows/site-audit.yml/badge.svg)](https://github.com/janagrit/houserx-site-audit/actions/workflows/site-audit.yml)

**Latest report:** https://janagrit.github.io/houserx-site-audit/ · **Findings:** [FINDINGS.md](FINDINGS.md)

Automated audit of <https://www.houserx.com> (Webflow): SEO, WCAG 2.2 accessibility, links, content, mobile layout,
visual regression and lead forms. Runs daily in CI in about 3–4 minutes, without writing to the live site.

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
| `npm test` | everything (visual is skipped outside Linux, see below) |
| `npm run test:smoke` | home loads, CTAs, no JS errors, no tracker/form traffic, header navigation, 404 |
| `npm run test:e2e` | visitor journey through every main page; contact and home lead forms: labels, required fields, validation, reCAPTCHA present |
| `npm run test:seo` | h1, title, meta description, canonical, `<html lang>`, Open Graph, JSON-LD, robots |
| `npm run test:a11y` | axe WCAG 2.2 AA scan, image alt attributes |
| `npm run test:links` | every link on each page returns a non-error status (HTTP only, each URL once per run) |
| `npm run test:content` | placeholder text (lorem ipsum, CMS template leaks) and links to `#` |
| `npm run test:mobile` | horizontal overflow on Pixel 7, full-page screenshots in `screenshots/`, mobile menu |
| `npm run test:visual` | above-the-fold Home, Technology and Contact vs. baselines (Docker) |
| `npm run test:visual:update` | regenerate visual baselines after an intentional site change (Docker) |
| `npm run test:ui` | Playwright UI mode |
| `npm run typecheck` | `tsc` over the whole suite |
| `npm run report` | open the HTML report from the last run |

A failing check is a site bug. The report labels tests that fail on a confirmed bug `@known-issue` plus its `HRX-` ID (type `@known-issue` in the report's search box to list them); the summary table counts them as *Known bug*, and *Failed* counts only new ones. For a new failure: confirm it by hand, give it the next `HRX-` ID in [FINDINGS.md](FINDINGS.md) and add it to [data/known-issues.ts](data/known-issues.ts) with the value the check measured on each page (`observed`). If a known bug changes, the report adds a *known issue changed* note to the test; when a known bug's test passes, the bug is fixed and its entry can be closed.

## CI (GitHub Actions)

[.github/workflows/site-audit.yml](.github/workflows/site-audit.yml) runs the full suite daily at 06:00 UTC, on push to `main`, on pull requests, and on demand (Actions → Site audit → Run workflow, optionally with a different `base_url`). It uses the `mcr.microsoft.com/playwright:v1.64.0-noble` image; keep it in sync with `@playwright/test`, which is pinned to `1.64.0` (with an `overrides` entry so `@axe-core/playwright` shares the same `playwright-core`).

Every run on `main` publishes the HTML report to [GitHub Pages](https://janagrit.github.io/houserx-site-audit/), pass or fail (needs Settings → Pages → Source: GitHub Actions).

**Visual baselines** are made only in the same Linux container CI uses, so there is one baseline per screenshot in `tests/visual/__screenshots__/`. Fonts render differently on macOS and Windows, so the visual check is skipped there; `npm run test:visual` runs it in Docker.

## Structure

```
data/
  pages.ts          pages under audit, header navigation, BASE_URL
  known-issues.ts   HRX- issues from FINDINGS.md, the checks they cover and the values observed per page
fixtures.ts         page objects, pageErrors, write guard (auto), skipMedia option
page-objects/       one class per page or shared component
network/
  endpoints.ts      Webflow form API, tracker hosts
  writeGuard.ts     aborts form writes and all analytics / ad pixels
reporters/
  summary-table.ts  results table printed after every run (Known bug = failure covered by an HRX- issue)
tests/              one folder per kind of check
  smoke/            page loads, CTAs, navigation, 404
  e2e/              visitor journey, forms and reCAPTCHA presence
  seo/  a11y/  links/  content/  mobile/
  visual/           + __screenshots__/ (Linux baselines)
```

## Design decisions

- **Write guard on by default.** It's a healthcare company's production site: form posts and analytics are aborted for every test, so a run can never create a lead or skew traffic data.
- **CAPTCHA is checked, never touched.** Tests assert reCAPTCHA is present and Submit stays disabled. No test solves, skips or works around it, so the success state of the forms is out of scope.
- **Bugs fail, visibly.** Every test that finds a site bug fails and shows under *Failed* in the report, so the run is red while the site has open issues. Confirmed bugs are labelled with their `HRX-` ID and counted separately as *Known bug* in the summary table, so a new problem still stands out. Checks also fail when the page doesn't load with a 200, so an error or challenge page is never audited in its place.
- **Soft assertions where one test checks several things** (title, meta description, Open Graph), so one run reports every problem on a page instead of stopping at the first.
- **Light on the live site.** One daily run (plus pushes), about 3–4 minutes. DOM-level checks skip the ~14 MB of GIFs per page, SEO loads each page once, and link checking uses plain HTTP with each URL requested once per run.

## Testing against production

The suite runs against the live site of a healthcare company, so it must never write to it or skew its data:

- **Write guard**: an auto fixture aborts every non-GET request to Webflow's form API (`webflow.com/api/v1/form/**`). Aborted requests are exposed as `blockedWrites`.
- **Trackers**: Google Analytics / Ads / Tag Manager, Meta Pixel and LinkedIn Insight are aborted outright, so test runs never count as visits, conversions or retargeting audiences.
- **Forms are never submitted.** Tests only check that reCAPTCHA is present and that Submit stays disabled; they never interact with the CAPTCHA.
- Test data uses `example.com` addresses and `555-0100` numbers. Never enter real patient information.

## Add a page

Append it to `PAGES` in [data/pages.ts](data/pages.ts). Every per-page check runs against it.
