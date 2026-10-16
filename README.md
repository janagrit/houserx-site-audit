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

A new failing check is a candidate finding. Confirm it by hand, give it the next `HRX-` ID in [FINDINGS.md](FINDINGS.md) and add it to [data/known-issues.ts](data/known-issues.ts): the run goes green, the report tags the test with the ID, and the test turns red again once the site changes.

## CI (GitHub Actions)

[.github/workflows/site-audit.yml](.github/workflows/site-audit.yml) runs the full suite daily at 06:00 UTC, on push to `main`, on pull requests, and on demand (Actions → Site audit → Run workflow, optionally with a different `base_url`). It uses the `mcr.microsoft.com/playwright:v1.64.0-noble` image; keep it in sync with `@playwright/test`, which is pinned to `1.64.0` (with an `overrides` entry so `@axe-core/playwright` shares the same `playwright-core`).

Every run on `main` publishes the HTML report to [GitHub Pages](https://janagrit.github.io/houserx-site-audit/), pass or fail (needs Settings → Pages → Source: GitHub Actions).

**Visual baselines** are made only in the same Linux container CI uses, so there is one baseline per screenshot in `tests/visual/__screenshots__/`. Fonts render differently on macOS and Windows, so the visual check is skipped there; `npm run test:visual` runs it in Docker.

## Structure

```
data/
  pages.ts          pages under audit, header navigation, BASE_URL
  known-issues.ts   HRX- issues from FINDINGS.md and the checks they cover
fixtures.ts         page objects, pageErrors, write guard (auto), skipMedia option
page-objects/       one class per page or shared component
network/
  endpoints.ts      Webflow form API, tracker hosts
  writeGuard.ts     aborts form writes and all analytics / ad pixels
reporters/
  summary-table.ts  results table printed after every run (Known defect = expected test.fail)
tests/              one folder per kind of check
  smoke/            page loads, CTAs, navigation, 404
  e2e/              visitor journey, forms and reCAPTCHA presence
  seo/  a11y/  links/  content/  mobile/
  visual/           + __screenshots__/ (Linux baselines)
```

## Design decisions

- **Write guard on by default.** It's a healthcare company's production site: form posts and analytics are aborted for every test, so a run can never create a lead or skew traffic data.
- **CAPTCHA is checked, never touched.** Tests assert reCAPTCHA is present and Submit stays disabled. No test solves, skips or works around it, so the success state of the forms is out of scope.
- **Known issues don't break the build.** Confirmed findings are expected failures tagged with their `HRX-` ID, so CI stays green and only *new* regressions turn it red; a fixed issue turns its test red too, prompting cleanup. axe subtracts known rules instead, so a new violation on an already-flagged page still fails.
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
