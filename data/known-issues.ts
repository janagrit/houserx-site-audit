import { PAGES } from './pages';

/**
 * Issues observed on the live site. Each ID matches its entry in FINDINGS.md.
 *
 * Every entry records what the check measured on each affected page (`observed`). While the issue is open the
 * check passes only if the site still shows exactly that value. Any difference fails: a new problem on the same
 * check (a second broken link, another axe node, an emptied title) is never hidden behind a known one, and a fix
 * fails too, which is the cue to close the entry here and in FINDINGS.md. To close an issue on one page only,
 * remove that page from `observed`.
 */

/** What each check measures on a page. Known issues record these values; tests compare against them. */
export interface CheckObservations {
  /** Number of <h1> elements. */
  'single-h1': number;
  /** Characters in <title>. */
  'title-length': number;
  /** Characters in the meta description, or null when there is none. */
  'meta-description': number | null;
  /** Number of <link rel="canonical">. */
  canonical: number;
  /** Number of JSON-LD blocks. */
  'json-ld': number;
  /** Count of each Open Graph tag (og:title, og:description, og:image). */
  'open-graph': Readonly<Record<string, number>>;
  /** Value of <html lang>, or null when missing. */
  'html-lang': string | null;
  /** axe rule ID → number of violating elements. */
  axe: Readonly<Record<string, number>>;
  /** Broken link URLs, sorted. */
  'broken-links': readonly string[];
  /** Visible href="#" links: label → count. */
  'placeholder-links': Readonly<Record<string, number>>;
  /** Placeholder patterns found in the visible text. */
  'placeholder-text': readonly string[];
  /** Labels of required contact form fields that have no "*". */
  'contact-required-marker': readonly string[];
}

export type AuditCheck = keyof CheckObservations;

export type Severity = 'high' | 'medium' | 'low';

type IssueFor<C extends AuditCheck> = {
  readonly id: `HRX-${string}`;
  readonly title: string;
  readonly severity: Severity;
  /** Date first observed, YYYY-MM-DD. */
  readonly found: string;
  readonly check: C;
  /** Page path (from data/pages.ts) → the value the check measured there. */
  readonly observed: Readonly<Partial<Record<string, CheckObservations[C]>>>;
};

export type KnownIssue = { [C in AuditCheck]: IssueFor<C> }[AuditCheck];

/** The same observation on each of the given paths (all audited pages by default). */
function onPages<T>(value: T, paths: readonly string[] = PAGES.map((page) => page.path)): Record<string, T> {
  return Object.fromEntries(paths.map((path) => [path, value]));
}

const FOUND = '2026-10-16';

export const KNOWN_ISSUES: readonly KnownIssue[] = [
  { id: 'HRX-001', check: 'broken-links', severity: 'high', found: FOUND,
    title: 'White paper PDF link points to a domain that no longer resolves',
    observed: { '/': ['https://info.shieldshealthsolutions.com/hubfs/Optum%20&%20Shields%20White%20Paper.pdf'] } },
  { id: 'HRX-002', check: 'html-lang', severity: 'high', found: FOUND,
    title: '<html> has no lang attribute',
    observed: onPages(null) },
  { id: 'HRX-002', check: 'axe', severity: 'high', found: FOUND,
    title: '<html> has no lang attribute',
    observed: onPages({ 'html-has-lang': 1 }) },
  { id: 'HRX-003', check: 'axe', severity: 'high', found: FOUND,
    title: 'Footer logo and social icon links have no accessible name',
    // 5 = footer logo + 4 social icons. About adds 15 team and 6 advisor LinkedIn icons and 2 carousel arrows;
    // Patient Stories and the Marin case study have one more unnamed link each.
    observed: { ...onPages({ 'link-name': 5 }), '/about': { 'link-name': 26 },
      '/patient-stories': { 'link-name': 6 }, '/marin-cancer-care': { 'link-name': 6 } } },
  { id: 'HRX-004', check: 'axe', severity: 'medium', found: FOUND,
    title: 'Some text is below the WCAG AA contrast ratio',
    observed: {
      '/': { 'color-contrast': 1 },
      '/technology': { 'color-contrast': 2 },
      '/careers': { 'color-contrast': 14 },
      '/patient-stories': { 'color-contrast': 2 },
      '/testimonials': { 'color-contrast': 1 },
      '/marin-cancer-care': { 'color-contrast': 5 },
    } },
  { id: 'HRX-005', check: 'axe', severity: 'high', found: FOUND,
    title: 'Contact form <select> has no accessible name',
    observed: { '/contact': { 'select-name': 1 } } },
  { id: 'HRX-006', check: 'axe', severity: 'medium', found: FOUND,
    title: 'Embedded video iframe has no title',
    observed: { '/patient-stories': { 'frame-title': 1 } } },
  { id: 'HRX-007', check: 'single-h1', severity: 'medium', found: FOUND,
    title: 'Page has zero or several <h1> elements',
    observed: { '/': 3, '/technology': 2, '/careers': 2, '/blog': 0 } },
  { id: 'HRX-008', check: 'meta-description', severity: 'medium', found: FOUND,
    title: 'No meta description',
    observed: onPages(null, ['/contact', '/patient-stories', '/marin-cancer-care']) },
  { id: 'HRX-009', check: 'meta-description', severity: 'low', found: FOUND,
    title: 'Meta description over 160 characters',
    observed: { '/': 294, '/about': 360, '/technology': 256, '/testimonials': 194 } },
  { id: 'HRX-010', check: 'canonical', severity: 'medium', found: FOUND,
    title: 'No canonical URL',
    observed: onPages(0, ['/', '/technology', '/contact', '/careers', '/blog', '/patient-stories', '/testimonials', '/marin-cancer-care']) },
  { id: 'HRX-011', check: 'json-ld', severity: 'low', found: FOUND,
    title: 'No JSON-LD structured data',
    observed: onPages(0) },
  { id: 'HRX-012', check: 'open-graph', severity: 'low', found: FOUND,
    title: 'Open Graph description or image not set',
    observed: {
      '/contact': { 'og:title': 1, 'og:description': 0, 'og:image': 1 },
      ...onPages({ 'og:title': 1, 'og:description': 0, 'og:image': 0 }, ['/patient-stories', '/marin-cancer-care']),
    } },
  { id: 'HRX-013', check: 'title-length', severity: 'low', found: FOUND,
    title: '<title> is 67 characters (guideline: 65)',
    observed: { '/testimonials': 67 } },
  { id: 'HRX-014', check: 'placeholder-links', severity: 'low', found: FOUND,
    title: 'Scroll arrow is a link to "#" with no label',
    observed: { '/patient-stories': { '.down-arrow': 1 } } },
  { id: 'HRX-015', check: 'contact-required-marker', severity: 'medium', found: FOUND,
    title: 'Two required contact form fields are not marked with *',
    // "field" is the company-type <select>: it has no label at all (HRX-005), so its name is reported.
    observed: { '/contact': ['Phone Number', 'field', 'Where did you hear about us?'] } },
];

export interface KnownDefect<C extends AuditCheck> {
  readonly issues: readonly KnownIssue[];
  /** What the check is expected to measure on this page while the issues are open. */
  readonly observed: CheckObservations[C];
}

/**
 * The known defect for this check on this page, or undefined if the page should pass the check.
 * Several axe issues on one page merge into one rule → count map; any other check allows one issue per page.
 */
export function knownDefectFor<C extends AuditCheck>(path: string, check: C): KnownDefect<C> | undefined {
  const issues = KNOWN_ISSUES.filter((issue) => issue.check === check && path in issue.observed);
  if (issues.length === 0) return undefined;
  const values = issues.map((issue) => issue.observed[path] as CheckObservations[C]);
  if (check === 'axe') {
    return { issues, observed: Object.assign({}, ...values) as CheckObservations[C] };
  }
  if (issues.length > 1) {
    throw new Error(`known-issues.ts: ${issues.map((i) => i.id).join(', ')} all cover "${check}" on ${path}; merge them`);
  }
  return { issues, observed: values[0] as CheckObservations[C] };
}
