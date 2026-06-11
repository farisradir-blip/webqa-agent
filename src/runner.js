import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser, openAndProbe, VIEWPORTS } from './browser.js';
import { resolveGoal } from './standards/goals.js';
import { aggregate } from './scoring.js';
import { auditPerformance } from './audits/performance.js';
import { auditAccessibility } from './audits/accessibility.js';
import { auditSeo } from './audits/seo.js';
import { auditBestPractices } from './audits/bestPractices.js';
import { auditResponsive } from './audits/responsive.js';
import { auditMotion } from './audits/motion.js';
import { auditStress } from './audits/stress.js';
import { renderMarkdown } from './report/markdown.js';

function normaliseUrl(input) {
  if (!/^https?:\/\//i.test(input)) return `https://${input}`;
  return input;
}

/**
 * Run a full QA audit on a single URL.
 *
 * @param {string} url
 * @param {object} options
 * @param {string} [options.goal='generic']
 * @param {boolean} [options.headless=true]
 * @param {boolean} [options.stress=true]
 * @param {number}  [options.concurrency=20]
 * @param {number}  [options.requests=200]
 * @param {string}  [options.outDir]  where to write report + screenshots
 * @param {(msg:string)=>void} [options.onProgress]
 * @returns {Promise<object>} structured result (also written to disk if outDir)
 */
export async function runAudit(url, options = {}) {
  const {
    goal: goalName = 'generic',
    headless = true,
    stress = true,
    concurrency = 20,
    requests = 200,
    timeout = 45000,
    outDir,
    onProgress = () => {},
  } = options;

  url = normaliseUrl(url);
  const goal = resolveGoal(goalName);
  const startedAt = new Date().toISOString();
  const t0 = Date.now();

  let screenshotDir;
  if (outDir) {
    screenshotDir = path.join(outDir, 'screenshots');
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const browser = await launchBrowser({ headless });
  const categories = {};
  let primaryProbe;

  try {
    onProgress('Loading page (desktop)…');
    primaryProbe = await openAndProbe(browser, url, VIEWPORTS.desktop, { timeout });
    if (primaryProbe.navError && !primaryProbe.response) {
      throw new Error(`Could not load ${url}: ${primaryProbe.navError}`);
    }

    onProgress('Measuring performance & Core Web Vitals…');
    const performance = await auditPerformance(primaryProbe, goal);
    categories.performance = performance;

    onProgress('Scanning accessibility (axe-core)…');
    categories.accessibility = await auditAccessibility(primaryProbe);

    onProgress('Checking SEO & metadata…');
    categories.seo = await auditSeo(primaryProbe, goal);

    onProgress('Checking security headers & best practices…');
    categories.bestPractices = await auditBestPractices(primaryProbe);

    onProgress('Evaluating motion & animation quality…');
    categories.motion = await auditMotion(primaryProbe, performance);

    // Close the desktop probe before opening responsive contexts.
    await primaryProbe.context.close().catch(() => {});

    onProgress('Testing responsive layout (mobile/tablet/desktop)…');
    categories.responsive = await auditResponsive(browser, url, { screenshotDir, timeout });
  } finally {
    await browser.close().catch(() => {});
  }

  if (stress) {
    onProgress(`Running stress test (${requests} requests @ ${concurrency} concurrent)…`);
    categories.stress = await auditStress(url, { concurrency, requests });
  }

  // Aggregate.
  const verdict = aggregate(categories, goal.weights);
  const allFindings = [];
  for (const cat of Object.values(categories)) {
    if (cat?.findings) allFindings.push(...cat.findings);
  }

  const durationMs = Date.now() - t0;
  const result = {
    url,
    goal: { key: goal.key, label: goal.label, weights: goal.weights },
    startedAt,
    durationMs,
    verdict,
    categories,
    allFindings,
    summary: {
      overall: verdict.overall,
      grade: verdict.grade,
      worldClass: verdict.worldClass,
      scores: Object.fromEntries(Object.entries(categories).map(([k, c]) => [k, c?.score ?? null])),
      counts: countBySeverity(allFindings),
    },
  };

  if (outDir) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(result, null, 2));
    fs.writeFileSync(path.join(outDir, 'report.md'), renderMarkdown(result));
    result.reportPaths = {
      json: path.join(outDir, 'report.json'),
      markdown: path.join(outDir, 'report.md'),
      screenshots: screenshotDir,
    };
  }

  return result;
}

function countBySeverity(findings) {
  const c = { critical: 0, serious: 0, moderate: 0, minor: 0, info: 0 };
  for (const f of findings) if (c[f.severity] != null) c[f.severity]++;
  return c;
}

export { renderMarkdown };
export { resolveGoal, listGoals } from './standards/goals.js';
