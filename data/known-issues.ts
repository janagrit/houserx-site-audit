/**
 * Issues observed on the live site. Each ID matches its entry in FINDINGS.md.
 *
 * A check covered by a known issue is marked as an expected failure: CI stays green while the issue is open and
 * turns red once it is resolved, which is the cue to close the entry here and in FINDINGS.md.
 * The axe check is finer-grained: it ignores only the listed rule IDs, so a new violation still fails the build.
 */

export type AuditCheck =
  | 'single-h1'
  | 'title-length'
  | 'meta-description'
  | 'canonical'
  | 'json-ld'
  | 'open-graph'
  | 'html-lang'
  | 'axe'
  | 'broken-links'
  | 'placeholder-links'
  | 'placeholder-text'
  | 'contact-required-marker';

export type Severity = 'high' | 'medium' | 'low';

export interface KnownIssue {
  readonly id: `HRX-${string}`;
  readonly title: string;
  readonly severity: Severity;
  /** Date first observed, YYYY-MM-DD. */
  readonly found: string;
  readonly check: AuditCheck;
  /** Paths from data/pages.ts where the issue is observed, or 'all'. */
  readonly pages: readonly string[] | 'all';
  /** For check 'axe': the axe rule IDs this issue accounts for. */
  readonly axeRules?: readonly string[];
}

const FOUND = '2026-10-16';

export const KNOWN_ISSUES: readonly KnownIssue[] = [
  { id: 'HRX-001', check: 'broken-links', severity: 'high', found: FOUND, pages: ['/'],
    title: 'White paper PDF link points to a domain that no longer resolves' },
  { id: 'HRX-002', check: 'html-lang', severity: 'high', found: FOUND, pages: 'all',
    title: '<html> has no lang attribute' },
  { id: 'HRX-002', check: 'axe', severity: 'high', found: FOUND, pages: 'all', axeRules: ['html-has-lang'],
    title: '<html> has no lang attribute' },
  { id: 'HRX-003', check: 'axe', severity: 'high', found: FOUND, pages: 'all', axeRules: ['link-name'],
    title: 'Footer logo and social icon links have no accessible name' },
  { id: 'HRX-004', check: 'axe', severity: 'medium', found: FOUND, axeRules: ['color-contrast'],
    pages: ['/', '/technology', '/careers', '/patient-stories', '/testimonials', '/marin-cancer-care'],
    title: 'Some text is below the WCAG AA contrast ratio' },
  { id: 'HRX-005', check: 'axe', severity: 'high', found: FOUND, pages: ['/contact'], axeRules: ['select-name'],
    title: 'Contact form <select> has no accessible name' },
  { id: 'HRX-006', check: 'axe', severity: 'medium', found: FOUND, pages: ['/patient-stories'], axeRules: ['frame-title'],
    title: 'Embedded video iframe has no title' },
  { id: 'HRX-007', check: 'single-h1', severity: 'medium', found: FOUND, pages: ['/', '/technology', '/careers', '/blog'],
    title: 'Page has zero or several <h1> elements' },
  { id: 'HRX-008', check: 'meta-description', severity: 'medium', found: FOUND,
    pages: ['/contact', '/patient-stories', '/marin-cancer-care'],
    title: 'No meta description' },
  { id: 'HRX-009', check: 'meta-description', severity: 'low', found: FOUND,
    pages: ['/', '/about', '/technology', '/testimonials'],
    title: 'Meta description over 160 characters' },
  { id: 'HRX-010', check: 'canonical', severity: 'medium', found: FOUND,
    pages: ['/', '/technology', '/contact', '/careers', '/blog', '/patient-stories', '/testimonials', '/marin-cancer-care'],
    title: 'No canonical URL' },
  { id: 'HRX-011', check: 'json-ld', severity: 'low', found: FOUND, pages: 'all',
    title: 'No JSON-LD structured data' },
  { id: 'HRX-012', check: 'open-graph', severity: 'low', found: FOUND,
    pages: ['/contact', '/patient-stories', '/marin-cancer-care'],
    title: 'Open Graph description or image not set' },
  { id: 'HRX-013', check: 'title-length', severity: 'low', found: FOUND, pages: ['/testimonials'],
    title: '<title> is 67 characters (guideline: 65)' },
  { id: 'HRX-014', check: 'placeholder-links', severity: 'low', found: FOUND, pages: ['/patient-stories'],
    title: 'Scroll arrow is a link to "#" with no label' },
  { id: 'HRX-015', check: 'contact-required-marker', severity: 'medium', found: FOUND, pages: ['/contact'],
    title: 'Two required contact form fields are not marked with *' },
];

/** Known issues that cover this check on this page. */
export function knownIssuesFor(path: string, check: AuditCheck): KnownIssue[] {
  return KNOWN_ISSUES.filter((issue) => issue.check === check && (issue.pages === 'all' || issue.pages.includes(path)));
}
