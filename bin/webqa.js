#!/usr/bin/env node
import { Command } from 'commander';
import pc from 'picocolors';
import path from 'node:path';
import { runAudit } from '../src/runner.js';
import { listGoals } from '../src/standards/goals.js';
import { renderConsole } from '../src/report/console.js';

const program = new Command();

program
  .name('webqa')
  .description('Autonomous website QA engineer — audits a site against world-class standards for its goal and tells you exactly what to fix.')
  .argument('<url>', 'URL of the site/page to audit')
  .option('-g, --goal <goal>', `site goal: ${listGoals().map((g) => g.key).join(', ')}`, 'generic')
  .option('-o, --out <dir>', 'output directory for report.md / report.json / screenshots')
  .option('--no-stress', 'skip the load/stress test')
  .option('-c, --concurrency <n>', 'stress: concurrent requests', (v) => parseInt(v, 10), 20)
  .option('-r, --requests <n>', 'stress: total requests', (v) => parseInt(v, 10), 200)
  .option('--headed', 'run the browser headed (visible)')
  .option('--json', 'print the full JSON result to stdout instead of the pretty report')
  .option('--min-score <n>', 'exit with code 1 if overall score is below this (CI gate)', (v) => parseInt(v, 10))
  .option('--quiet', 'suppress progress logs')
  .action(async (url, opts) => {
    const outDir = opts.out
      ? path.resolve(opts.out)
      : path.resolve(process.cwd(), '.webqa-reports', new URL(/^https?:/.test(url) ? url : `https://${url}`).hostname);

    const onProgress = opts.quiet ? () => {} : (m) => process.stderr.write(pc.dim(`  • ${m}\n`));

    try {
      if (!opts.quiet) process.stderr.write(pc.cyan(`\n  webqa-agent → auditing ${url} as "${opts.goal}"\n\n`));
      const result = await runAudit(url, {
        goal: opts.goal,
        headless: !opts.headed,
        stress: opts.stress,
        concurrency: opts.concurrency,
        requests: opts.requests,
        outDir,
        onProgress,
      });

      if (opts.json) {
        process.stdout.write(JSON.stringify(result, null, 2) + '\n');
      } else {
        process.stdout.write(renderConsole(result) + '\n');
        process.stdout.write(pc.dim(`  Reports written to: ${outDir}\n`));
        process.stdout.write(pc.dim(`    • report.md   (developer-facing, prioritised fixes)\n`));
        process.stdout.write(pc.dim(`    • report.json (machine-readable, for AI agents)\n`));
        process.stdout.write(pc.dim(`    • screenshots/ (mobile, tablet, desktop)\n\n`));
      }

      if (opts.minScore != null && result.verdict.overall < opts.minScore) {
        process.stderr.write(pc.red(`\n  ✗ Overall ${result.verdict.overall} is below --min-score ${opts.minScore}\n\n`));
        process.exit(1);
      }
      process.exit(0);
    } catch (err) {
      process.stderr.write(pc.red(`\n  ✗ ${err.message}\n\n`));
      if (process.env.WEBQA_DEBUG) console.error(err);
      process.exit(2);
    }
  });

program.parseAsync();
