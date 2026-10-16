import { appendFileSync } from 'node:fs';
import { relative } from 'node:path';
import type { FullConfig, FullResult, Reporter, Suite, TestCase } from '@playwright/test/reporter';

type Bucket = 'passed' | 'failed' | 'flaky' | 'skipped' | 'known';

interface Row {
  readonly group: string;
  counts: Record<Bucket, number>;
  durationMs: number;
}

interface Failure {
  readonly group: string;
  readonly title: string;
  readonly error: string;
}

const COLUMNS: readonly { key: Bucket; label: string; color: string }[] = [
  { key: 'passed', label: 'Passed', color: '32' },
  { key: 'failed', label: 'Failed', color: '31' },
  { key: 'flaky', label: 'Flaky', color: '33' },
  { key: 'known', label: 'Known defect', color: '35' },
  { key: 'skipped', label: 'Skipped', color: '90' },
];

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: string, text: string): string => (useColor ? `\x1b[${code}m${text}\x1b[0m` : text);
const visibleLength = (text: string): number => text.replace(/\x1b\[[0-9;]*m/g, '').length;
const pad = (text: string, width: number, alignRight: boolean): string => {
  const fill = ' '.repeat(Math.max(0, width - visibleLength(text)));
  return alignRight ? fill + text : text + fill;
};
const seconds = (ms: number): string => `${(ms / 1000).toFixed(1)}s`;

/** Maps Playwright's outcome to a table column. Expected failures (`test.fail`) are known site defects. */
function bucketOf(test: TestCase): Bucket {
  const outcome = test.outcome();
  if (outcome === 'skipped') return 'skipped';
  if (outcome === 'flaky') return 'flaky';
  if (outcome === 'unexpected') return 'failed';
  return test.expectedStatus === 'failed' ? 'known' : 'passed';
}

/** Prints a per-file results table, plus failure details, after the run. */
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
    const rows = new Map<string, Row>();
    const failures: Failure[] = [];

    for (const test of this.rootSuite.allTests()) {
      const project = test.parent.project()?.name ?? '';
      const group = `${relative(this.rootDir, test.location.file)}${project ? ` [${project}]` : ''}`;
      const row = rows.get(group) ?? { group, counts: { passed: 0, failed: 0, flaky: 0, skipped: 0, known: 0 }, durationMs: 0 };
      const bucket = bucketOf(test);
      row.counts[bucket] += 1;
      row.durationMs += test.results.reduce((sum, r) => sum + r.duration, 0);
      rows.set(group, row);

      if (bucket === 'failed') {
        const last = test.results.at(-1);
        const error = last?.error?.message?.split('\n').find((line) => line.trim()) ?? 'no error message';
        failures.push({ group, title: test.titlePath().slice(3).join(' › '), error: error.replace(/\x1b\[[0-9;]*m/g, '') });
      }
    }

    const sorted = [...rows.values()].sort((a, b) => a.group.localeCompare(b.group));
    const total: Row = {
      group: 'Total',
      counts: { passed: 0, failed: 0, flaky: 0, skipped: 0, known: 0 },
      durationMs: 0,
    };
    for (const row of sorted) {
      for (const { key } of COLUMNS) total.counts[key] += row.counts[key];
      total.durationMs += row.durationMs;
    }

    process.stdout.write(`\n${this.renderTable(sorted, total)}\n`);
    process.stdout.write(`${this.renderStatus(result, total)}\n`);
    if (failures.length > 0) {
      process.stdout.write(`${this.renderFailures(failures)}\n`);
    }

    const stepSummary = process.env.GITHUB_STEP_SUMMARY;
    if (stepSummary) {
      appendFileSync(stepSummary, this.renderMarkdown(sorted, total, result, failures));
    }
  }

  /** Same table as Markdown for the GitHub Actions run page. */
  private renderMarkdown(rows: readonly Row[], total: Row, result: FullResult, failures: readonly Failure[]): string {
    const icon = result.status === 'passed' ? '✅' : '❌';
    const counts = (row: Row): string => COLUMNS.map(({ key }) => (row.counts[key] > 0 ? row.counts[key] : '·')).join(' | ');
    const lines = [
      `## ${icon} Site audit — ${result.status} (${seconds(result.duration)})`,
      '',
      `Target: ${process.env.BASE_URL ?? 'default'}`,
      '',
      `| Spec | ${COLUMNS.map((c) => c.label).join(' | ')} | Time |`,
      `|---|${COLUMNS.map(() => '---:').join('|')}|---:|`,
      ...rows.map((row) => `| \`${row.group}\` | ${counts(row)} | ${seconds(row.durationMs)} |`),
      `| **Total** | ${counts(total)} | ${seconds(total.durationMs)} |`,
      '',
      ...(total.counts.known > 0 ? [`${total.counts.known} known site defect(s) are tracked in FINDINGS.md.`, ''] : []),
      ...(failures.length > 0
        ? ['### Failures', '', ...failures.map((f) => `- **${f.title}** (\`${f.group}\`): ${f.error.replace(/\|/g, '\\|')}`), '']
        : []),
    ];
    return `${lines.join('\n')}\n`;
  }

  private renderTable(rows: readonly Row[], total: Row): string {
    const header = ['Spec', ...COLUMNS.map((c) => c.label), 'Time'];
    const cells = (row: Row, bold: boolean): string[] => [
      bold ? paint('1', row.group) : row.group,
      ...COLUMNS.map(({ key, color }) => (row.counts[key] > 0 ? paint(color, String(row.counts[key])) : paint('90', '·'))),
      seconds(row.durationMs),
    ];
    const body = rows.map((row) => cells(row, false));
    const footer = cells(total, true);
    const widths = header.map((h, i) => Math.max(visibleLength(h), ...[...body, footer].map((r) => visibleLength(r[i]))));

    const line = (left: string, mid: string, right: string): string =>
      left + widths.map((w) => '─'.repeat(w + 2)).join(mid) + right;
    const renderRow = (cols: readonly string[]): string =>
      '│' + cols.map((c, i) => ` ${pad(c, widths[i], i > 0)} `).join('│') + '│';

    return [
      line('┌', '┬', '┐'),
      renderRow(header.map((h) => paint('1', h))),
      line('├', '┼', '┤'),
      ...body.map(renderRow),
      line('├', '┼', '┤'),
      renderRow(footer),
      line('└', '┴', '┘'),
    ].join('\n');
  }

  private renderStatus(result: FullResult, total: Row): string {
    const ok = result.status === 'passed';
    const label = ok ? paint('42;30', ' PASS ') : paint('41;37', ` ${result.status.toUpperCase()} `);
    const note = total.counts.known > 0 ? `  ${total.counts.known} known site defect(s) tracked in FINDINGS.md` : '';
    return `${label} ${seconds(result.duration)} wall time${note}`;
  }

  private renderFailures(failures: readonly Failure[]): string {
    const lines = failures.map((f, i) => `  ${i + 1}. ${paint('1', f.title)}\n     ${paint('90', f.group)}\n     ${paint('31', f.error)}`);
    return `\n${paint('31;1', 'Failures')}\n${lines.join('\n')}`;
  }
}
