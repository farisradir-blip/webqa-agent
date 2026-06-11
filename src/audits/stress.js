import { scoreMetric } from '../scoring.js';
import { STRESS } from '../standards/goals.js';

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return Math.round(sorted[idx]);
}

/**
 * Lightweight load/stress test. Fires `requests` HTTP GETs at the URL with a
 * fixed `concurrency`, measuring latency distribution, error rate and
 * throughput. Defaults are deliberately modest — only stress sites you own.
 */
export async function auditStress(url, { concurrency = 20, requests = 200, timeoutMs = 15000 } = {}) {
  const latencies = [];
  let errors = 0;
  let done = 0;
  const statusCounts = {};
  const start = Date.now();

  async function worker() {
    while (done < requests) {
      done++;
      const t0 = performance.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, { signal: controller.signal, redirect: 'follow', headers: { 'User-Agent': 'webqa-agent/1.0 stress-test' } });
        // Drain the body so the connection completes realistically.
        await res.arrayBuffer().catch(() => {});
        const ms = performance.now() - t0;
        latencies.push(ms);
        statusCounts[res.status] = (statusCounts[res.status] || 0) + 1;
        if (res.status >= 500) errors++;
      } catch {
        errors++;
        latencies.push(performance.now() - t0);
      } finally {
        clearTimeout(timer);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, requests) }, () => worker());
  await Promise.all(workers);

  const totalMs = Date.now() - start;
  const sorted = latencies.slice().sort((a, b) => a - b);
  const errorRate = requests ? (errors / requests) * 100 : 0;
  const measured = {
    requests,
    concurrency,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: Math.round(sorted[sorted.length - 1] || 0),
    errorRate: Number(errorRate.toFixed(2)),
    rps: Number((requests / (totalMs / 1000)).toFixed(1)),
    statusCounts,
  };

  const p95Score = scoreMetric(measured.p95, STRESS.p95);
  const errScore = scoreMetric(measured.errorRate, STRESS.errorRate);
  const score = Math.round((p95Score + errScore) / 2);

  const findings = [];
  if (measured.errorRate > STRESS.errorRate.poor)
    findings.push({ severity: 'critical', category: 'stress',
      title: `${measured.errorRate}% of requests failed under load`,
      detail: `At concurrency ${concurrency} the server returned errors/timeouts. It will buckle during a traffic spike.`,
      fix: 'Add caching/CDN in front, increase server workers/connection limits, add rate limiting + graceful degradation, and scale horizontally.' });
  else if (measured.errorRate > 0)
    findings.push({ severity: 'serious', category: 'stress',
      title: `${measured.errorRate}% error rate under load`,
      detail: 'Some requests failed when concurrency rose.', fix: 'Investigate 5xx/timeouts; tune server concurrency and add caching.' });

  if (measured.p95 > STRESS.p95.poor)
    findings.push({ severity: 'serious', category: 'stress',
      title: `p95 latency is ${measured.p95}ms under load`,
      detail: `95% of users wait under ${measured.p95}ms when the site is busy — too slow.`,
      fix: 'Add full-page/edge caching, optimise slow endpoints and DB queries, and serve static assets from a CDN.' });

  return { score, measured, findings };
}
