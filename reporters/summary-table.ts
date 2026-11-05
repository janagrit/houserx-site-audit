import { appendFileSync } from 'node:fs';
import { basename, dirname, relative } from 'node:path';
import type { FullConfig, FullResult, Reporter, Suite, TestCase } from '@playwright/test/reporter';
import { KNOWN_ISSUES, type Severity } from '../data/known-issues';

type Status = 'passed' | 'failed' | 'known' | 'flaky' | 'skipped';

interface TestRow {
  readonly suite: string;
  readonly name: string;
  readonly status: Status;
  readonly bugIds: readonly string[];
  readonly durationMs: number;
  readonly error?: string;
}

interface BugRow {
  readonly id: string;
  readonly title: string;
  readonly severity: Severity | '?';
  failing: number;
  changed: number;
  readonly pages: Set<string>;
  readonly fixedOn: Set<string>;
}

const STATUS: Record<Status, { label: string; color: string; icon: string }> = {
  passed: { label: 'Passed', color: '32', icon: '✅' },
  failed: { label: 'Failed', color: '31;1', icon: '❌' },
  known: { label: 'Known bug', color: '35', icon: '🐞' },
  flaky: { label: 'Flaky', color: '33', icon: '⚠️' },
  skipped: { label: 'Skipped', color: '90', icon: '⏭️' },
};
const STATUS_ORDER: readonly Status[] = ['passed', 'failed', 'known', 'flaky', 'skipped'];

/** Test folder → area name, used as the suite when a test has no describe block. */
const AREAS: Readonly<Record<string, string>> = {
  smoke: 'Smoke',
  links: 'Links',
  a11y: 'Accessibility',
  seo: 'SEO',
  content: 'Content',
  e2e: 'User flows',
  mobile: 'Mobile',
  visual: 'Visual',
};

const SEVERITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2, '?': 3 };
const SEVERITY_COLOR: Record<string, string> = { high: '31', medium: '33', low: '90', '?': '90' };
const SEVERITY_ICON: Record<string, string> = { high: '🔴', medium: '🟠', low: '⚪', '?': '' };

/** Column widths of the per-test table; longer text wraps. */
const SUITE_WIDTH = 28;
const NAME_WIDTH = 52;

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: string, text: string): string => (useColor ? `\x1b[${code}m${text}\x1b[0m` : text);
const stripAnsi = (text: string): string => text.replace(/\x1b\[[0-9;]*m/g, '');
const visibleLength = (text: string): number => stripAnsi(text).length;
const pad = (text: string, width: number, alignRight: boolean): string => {
  const fill = ' '.repeat(Math.max(0, width - visibleLength(text)));
  return alignRight ? fill + text : text + fill;
};
const mdCell = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\|/g, '\\|');

function duration(ms: number): string {
  if (ms < 10_000) return `${(ms / 1000).toFixed(1)}s`;
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  return minutes > 0 ? `${minutes}m ${totalSeconds % 60}s` : `${totalSeconds}s`;
}

/** Splits plain text into lines of at most `width` characters, breaking at spaces where possible. */
function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(' ')) {
    let rest = word;
    while (rest.length > width) {
      if (current) lines.push(current);
      current = '';
      lines.push(rest.slice(0, width));
      rest = rest.slice(width);
    }
    if (!current) current = rest;
    else if (current.length + 1 + rest.length <= width) current += ` ${rest}`;
    else {
      lines.push(current);
      current = rest;
    }
  }
  if (current || lines.length === 0) lines.push(current);
  return lines;
}

interface Column {
  readonly header: string;
  readonly alignRight?: boolean;
  /** Wrap plain-text cells to this width. Painted cells must not exceed it. */
  readonly maxWidth?: number;
}

/** Draws a box table with wrapped cells. A null row draws a separator. */
function boxTable(columns: readonly Column[], rows: readonly (readonly string[] | null)[]): string {
  const wrapped = rows.map((row) =>
    row === null ? null : row.map((cell, i) => (columns[i].maxWidth ? wrap(cell, columns[i].maxWidth) : [cell])),
  );
  const widths = columns.map((col, i) =>
    Math.max(visibleLength(col.header), ...wrapped.flatMap((r) => (r === null ? [] : r[i].map(visibleLength)))),
  );
  const line = (left: string, mid: string, right: string): string =>
    left + widths.map((w) => '─'.repeat(w + 2)).join(mid) + right;
  const renderLine = (cols: readonly string[]): string =>
    '│' + cols.map((c, i) => ` ${pad(c, widths[i], columns[i].alignRight ?? false)} `).join('│') + '│';
  const renderRow = (cells: readonly string[][]): string[] => {
    const height = Math.max(...cells.map((c) => c.length));
    return Array.from({ length: height }, (_, n) => renderLine(cells.map((c) => c[n] ?? '')));
  };
  return [
    line('┌', '┬', '┐'),
    renderLine(columns.map((c) => paint('1', c.header))),
    line('├', '┼', '┤'),
    ...wrapped.flatMap((r) => (r === null ? [line('├', '┼', '┤')] : renderRow(r))),
    line('└', '┴', '┘'),
  ].join('\n');
}

function mdTable(header: readonly string[], rows: readonly (readonly string[])[], alignRight: readonly boolean[]): string[] {
  return [
    `| ${header.join(' | ')} |`,
    `|${alignRight.map((r) => (r ? '---:' : '---')).join('|')}|`,
    ...rows.map((r) => `| ${r.join(' | ')} |`),
  ];
}

/** Same values as the annotation types in fixtures.ts (not imported, so the reporter stays independent of tests). */
const KNOWN_ISSUE_ANNOTATION = 'known issue';
const KNOWN_ISSUE_CHANGED_ANNOTATION = 'known issue changed';

/** Annotations from the test and its last result. Playwright copies runtime ones into both, so drop duplicates. */
function annotationsOf(test: TestCase): { type: string; description?: string }[] {
  const all = [...test.annotations, ...(test.results.at(-1)?.annotations ?? [])];
  const seen = new Set<string>();
  return all.filter((a) => {
    const key = `${a.type}\u0000${a.description ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Status from Playwright's final outcome, so retries collapse to the last attempt. Known bugs fail for real (no
 * `test.fail`): a failing test annotated with a known issue (see expectCheck in fixtures.ts) is a known site bug
 * from FINDINGS.md; any other failure is new.
 */
function statusOf(test: TestCase): Status {
  const outcome = test.outcome();
  if (outcome === 'skipped') return 'skipped';
  if (outcome === 'flaky') return 'flaky';
  if (outcome === 'expected') return 'passed';
  return annotationsOf(test).some((a) => a.type === KNOWN_ISSUE_ANNOTATION) ? 'known' : 'failed';
}

/** Page name from a title such as "Accessibility — Home" or "Links — Home: no broken links". */
function pageOf(test: TestCase): string {
  const describe = test.parent.title;
  const dash = describe.lastIndexOf(' — ');
  if (dash >= 0) return describe.slice(dash + 3);
  // Page in the test title, followed by the check: "Links — Home: no broken links".
  const match = /— (.+?):/.exec(test.title);
  return match ? match[1] : describe || test.title;
}

/**
 * Prints one row per test (suite, test, status, HRX bug, duration) and the totals after every run, then the known
 * site bugs (FINDINGS.md) behind the failures, known bugs whose tests now pass, and details of any new failure.
 * The same goes to the GitHub Actions run page.
 */
export default class SummaryTableReporter implements Reporter {
  private rootDir = process.cwd();
  private rootSuite: Suite | undefined;

  onBegin(config: FullConfig, suite: Suite): void {
    this.rootDir = config.rootDir;
    this.rootSuite = suite;
  }

  printsToStdio(): boolean {
    return false;
  }

  onEnd(result: FullResult): void {
    if (!this.rootSuite) return;
    const tests = this.rootSuite.allTests();
    // `playwright test --list` runs nothing; a table of all-skipped tests would only mislead.
    if (tests.every((test) => test.results.length === 0)) return;

    const rows: TestRow[] = [];
    const bugs = new Map<string, BugRow>();

    for (const test of tests) {
      const status = statusOf(test);
      const annotations = annotationsOf(test);
      const changed = annotations.some((a) => a.type === KNOWN_ISSUE_CHANGED_ANNOTATION);
      const bugIds: string[] = [];

      for (const a of annotations.filter((a) => a.type === KNOWN_ISSUE_ANNOTATION)) {
        const id = (a.description ?? '').split(':')[0].trim();
        const issue = KNOWN_ISSUES.find((i) => i.id === id);
        const bug = bugs.get(id) ?? {
          id,
          title: issue?.title ?? (a.description ?? '').slice(id.length + 1).trim(),
          severity: issue?.severity ?? '?',
          failing: 0,
          changed: 0,
          pages: new Set<string>(),
          fixedOn: new Set<string>(),
        };
        if (status === 'known') {
          bug.failing += 1;
          bug.pages.add(pageOf(test));
          if (changed) bug.changed += 1;
          bugIds.push(id);
        } else if (status === 'passed') {
          bug.fixedOn.add(pageOf(test));
        }
        bugs.set(id, bug);
      }

      const folder = basename(dirname(relative(this.rootDir, test.location.file)));
      const project = test.parent.project()?.name ?? '';
      const suite = test.parent.title || AREAS[folder] || folder;
      const lastError = test.results.at(-1)?.error?.message?.split('\n').find((line) => line.trim());
      rows.push({
        suite: project === 'mobile' && !/mobile/i.test(suite) ? `${suite} (mobile)` : suite,
        name: test.title,
        status,
        bugIds,
        durationMs: test.results.reduce((sum, r) => sum + r.duration, 0),
        error: status === 'failed' ? stripAnsi(lastError ?? 'no error message') : undefined,
      });
    }

    const bugList = [...bugs.values()].sort(
      (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.id.localeCompare(b.id),
    );

    const out = ['', this.renderTests(rows), '', ...this.renderTotals(result, rows, bugList)];
    if (bugList.some((b) => b.failing > 0)) out.push('', paint('1', 'Known site bugs (FINDINGS.md)'), this.renderBugs(bugList));
    const fixed = this.fixedLines(bugList);
    if (fixed.length > 0) out.push('', paint('32;1', 'Passing now (fixed?)'), ...fixed.map((l) => `  ${l}`));
    const failures = rows.filter((r) => r.status === 'failed');
    if (failures.length > 0) out.push('', this.renderFailures(failures));
    process.stdout.write(`${out.join('\n')}\n`);

    const stepSummary = process.env.GITHUB_STEP_SUMMARY;
    if (stepSummary) {
      appendFileSync(stepSummary, this.renderMarkdown(result, rows, bugList));
    }
  }

  private count(rows: readonly TestRow[], status: Status): number {
    return rows.filter((r) => r.status === status).length;
  }

  private renderTests(rows: readonly TestRow[]): string {
    return boxTable(
      [
        { header: 'Test Suite', maxWidth: SUITE_WIDTH },
        { header: 'Test Name', maxWidth: NAME_WIDTH },
        { header: 'Status' },
        { header: 'Bug' },
        { header: 'Duration', alignRight: true },
      ],
      rows.map((r) => [
        r.suite,
        r.name,
        paint(STATUS[r.status].color, STATUS[r.status].label),
        r.bugIds.length > 0 ? paint('35', r.bugIds.join(' ')) : '',
        duration(r.durationMs),
      ]),
    );
  }

  private renderTotals(result: FullResult, rows: readonly TestRow[], bugs: readonly BugRow[]): string[] {
    const ok = result.status === 'passed';
    const banner = ok ? paint('42;30', ' PASS ') : paint('41;37', ` ${result.status.toUpperCase()} `);
    const openBugs = bugs.filter((b) => b.failing > 0).length;
    const known = this.count(rows, 'known');
    return [
      `${banner} ${paint('1', `Total: ${rows.length}`)} in ${duration(result.duration)}`,
      paint('32', `Passed: ${this.count(rows, 'passed')}`),
      paint('31', `Failed (new): ${this.count(rows, 'failed')}`),
      paint('35', `Known bugs: ${known}${known > 0 ? ` tests on ${openBugs} issue(s)` : ''}`),
      ...(this.count(rows, 'flaky') > 0 ? [paint('33', `Flaky: ${this.count(rows, 'flaky')}`)] : []),
      paint('90', `Skipped: ${this.count(rows, 'skipped')}`),
    ];
  }

  private renderBugs(bugs: readonly BugRow[]): string {
    return boxTable(
      [
        { header: 'ID' },
        { header: 'Severity' },
        { header: 'Issue', maxWidth: 50 },
        { header: 'Tests', alignRight: true },
        { header: 'Pages', maxWidth: 40 },
      ],
      bugs
        .filter((b) => b.failing > 0)
        .map((b) => [
          paint('1', b.id),
          paint(SEVERITY_COLOR[b.severity], b.severity),
          b.title + (b.changed > 0 ? ' (changed)' : ''),
          String(b.failing),
          [...b.pages].join(', '),
        ]),
    );
  }

  private fixedLines(bugs: readonly BugRow[]): string[] {
    return bugs
      .filter((b) => b.fixedOn.size > 0)
      .map((b) => `${b.id} passes on ${[...b.fixedOn].join(', ')}: confirm the fix, then update data/known-issues.ts and FINDINGS.md`);
  }

  private renderFailures(failures: readonly TestRow[]): string {
    const lines = failures.map((f, i) => `  ${i + 1}. ${paint('1', `${f.suite} › ${f.name}`)}\n     ${paint('31', f.error ?? '')}`);
    return `${paint('31;1', 'New failures (not in FINDINGS.md)')}\n${lines.join('\n')}`;
  }

  /** The same report as Markdown for the GitHub Actions run page; the long per-test table is collapsible. */
  private renderMarkdown(result: FullResult, rows: readonly TestRow[], bugs: readonly BugRow[]): string {
    const icon = result.status === 'passed' ? '✅' : '❌';
    const open = bugs.filter((b) => b.failing > 0);
    const fixed = this.fixedLines(bugs);
    const failures = rows.filter((r) => r.status === 'failed');
    const lines = [
      `## ${icon} Site audit: ${result.status} in ${duration(result.duration)}`,
      '',
      `Target: ${process.env.BASE_URL ?? 'https://www.houserx.com'}`,
      '',
      ...mdTable(
        ['Total', ...STATUS_ORDER.map((s) => `${STATUS[s].icon} ${STATUS[s].label}`)],
        [[`**${rows.length}**`, ...STATUS_ORDER.map((s) => String(this.count(rows, s)))]],
        [true, true, true, true, true, true],
      ),
      '',
      ...(failures.length > 0
        ? [
            '### ❌ New failures (not in FINDINGS.md)',
            '',
            ...mdTable(
              ['Test Suite', 'Test Name', 'Error'],
              failures.map((f) => [mdCell(f.suite), mdCell(f.name), `\`${mdCell((f.error ?? '').slice(0, 160))}\``]),
              [false, false, false],
            ),
            '',
          ]
        : []),
      ...(open.length > 0
        ? [
            '### 🐞 Known site bugs (FINDINGS.md)',
            '',
            ...mdTable(
              ['ID', 'Severity', 'Issue', 'Tests', 'Pages'],
              open.map((b) => [
                `**${b.id}**`,
                `${SEVERITY_ICON[b.severity]} ${b.severity}`,
                mdCell(b.title) + (b.changed > 0 ? ' ⚠️ changed' : ''),
                String(b.failing),
                mdCell([...b.pages].join(', ')),
              ]),
              [false, false, false, true, false],
            ),
            '',
          ]
        : []),
      ...(fixed.length > 0 ? ['### ✅ Passing now (fixed?)', '', ...fixed.map((l) => `- ${l}`), ''] : []),
      '<details><summary>All tests</summary>',
      '',
      ...mdTable(
        ['Test Suite', 'Test Name', 'Status', 'Bug', 'Duration'],
        rows.map((r) => [
          mdCell(r.suite),
          mdCell(r.name),
          `${STATUS[r.status].icon} ${STATUS[r.status].label}`,
          r.bugIds.join(' '),
          duration(r.durationMs),
        ]),
        [false, false, false, false, true],
      ),
      '',
      '</details>',
      '',
    ];
    return `${lines.join('\n')}\n`;
  }
}
