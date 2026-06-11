import { scoreMetric } from '../scoring.js';

/**
 * Performance & Core Web Vitals, read from the desktop probe.
 * Returns category score plus per-metric scores and prioritised findings.
 */
export async function auditPerformance({ page }, goal) {
  const vitals = await page.evaluate(() => window.__webqa || {});
  const resourceStats = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const res = performance.getEntriesByType('resource');
    let bytes = nav?.transferSize || 0;
    let count = nav ? 1 : 0;
    const byType = {};
    for (const r of res) {
      bytes += r.transferSize || 0;
      count += 1;
      const t = r.initiatorType || 'other';
      byType[t] = (byType[t] || 0) + (r.transferSize || 0);
    }
    return {
      bytes,
      count,
      ttfb: nav ? Math.round(nav.responseStart) : null,
      byType,
    };
  });

  const measured = {
    lcp: Math.round(vitals.lcp || 0),
    cls: Number((vitals.cls || 0).toFixed(3)),
    inpProxy: Math.round(vitals.longTasks || 0),
    fcp: Math.round(vitals.fcp || 0),
    ttfb: resourceStats.ttfb ?? 0,
    weightKb: Math.round((resourceStats.bytes || 0) / 1024),
    requests: resourceStats.count || 0,
  };

  const metricScores = {};
  for (const key of Object.keys(goal.metrics)) {
    metricScores[key] = { value: measured[key], score: scoreMetric(measured[key], goal.metrics[key]) };
  }

  const valid = Object.values(metricScores).filter((m) => m.score != null);
  const score = valid.length
    ? Math.round(valid.reduce((s, m) => s + m.score, 0) / valid.length)
    : null;

  const findings = [];
  const m = goal.metrics;
  if (measured.lcp > m.lcp.poor)
    findings.push({ severity: 'critical', category: 'performance', title: `LCP is ${measured.lcp}ms (target <${m.lcp.good}ms)`,
      detail: 'The largest element paints far too late. Users perceive the page as slow to load.',
      fix: 'Preload the hero image/font, serve modern formats (AVIF/WebP), set explicit width/height, use a CDN, and remove render-blocking CSS/JS above the fold.' });
  else if (measured.lcp > m.lcp.good)
    findings.push({ severity: 'serious', category: 'performance', title: `LCP is ${measured.lcp}ms (target <${m.lcp.good}ms)`,
      detail: 'Largest contentful paint is slower than the world-class threshold.',
      fix: 'Optimise/compress the LCP image, add fetchpriority="high", and defer non-critical scripts.' });

  if (measured.cls > m.cls.poor)
    findings.push({ severity: 'critical', category: 'performance', title: `CLS is ${measured.cls} (target <${m.cls.good})`,
      detail: `The layout shifts significantly while loading (${vitals.shifts?.length || 0} notable shifts). This feels janky and breaks taps.`,
      fix: 'Reserve space for images/ads/embeds with width+height or aspect-ratio, avoid inserting content above existing content, and preload web fonts with font-display: optional/swap.' });
  else if (measured.cls > m.cls.good)
    findings.push({ severity: 'serious', category: 'performance', title: `CLS is ${measured.cls} (target <${m.cls.good})`,
      detail: 'Visible layout shift during load.', fix: 'Set explicit dimensions on media and reserve space for dynamically injected elements.' });

  if (measured.inpProxy > m.inpProxy.poor)
    findings.push({ severity: 'serious', category: 'performance', title: `${measured.inpProxy}ms of main-thread blocking (long tasks)`,
      detail: 'Heavy JavaScript blocks the main thread, delaying interactivity (poor INP).',
      fix: 'Code-split and lazy-load JS, defer third-party scripts, break up long tasks with scheduler.yield()/setTimeout, and ship less JavaScript.' });

  if (measured.weightKb > m.weightKb.poor)
    findings.push({ severity: 'serious', category: 'performance', title: `Page weight is ${(measured.weightKb / 1024).toFixed(1)}MB`,
      detail: 'The page downloads far more than world-class sites of this type.',
      fix: 'Compress and resize images, enable Brotli/gzip, tree-shake JS bundles, and drop unused libraries/fonts.' });

  if (measured.ttfb > m.ttfb.poor)
    findings.push({ severity: 'moderate', category: 'performance', title: `TTFB is ${measured.ttfb}ms`,
      detail: 'The server takes too long to send the first byte.',
      fix: 'Add edge caching/CDN, cache server responses, and optimise backend/database queries.' });

  return { score, measured, metricScores, findings, byType: resourceStats.byType };
}
