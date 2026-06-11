/**
 * Security headers, HTTPS, console health, and modern best practices.
 * Reads response headers from the navigation plus runtime signals.
 */
export async function auditBestPractices({ page, response, consoleErrors, failedRequests }) {
  const headers = response ? response.headers() : {};
  const url = page.url();
  const isHttps = url.startsWith('https://');

  const mixedContent = await page.evaluate(() => {
    if (location.protocol !== 'https:') return 0;
    const attrs = ['src', 'href'];
    let count = 0;
    for (const el of document.querySelectorAll('img,script,link,iframe,audio,video,source')) {
      for (const a of attrs) {
        const v = el.getAttribute(a);
        if (v && v.startsWith('http://')) count++;
      }
    }
    return count;
  });

  const checks = [
    { ok: isHttps, weight: 16, severity: 'critical', title: 'Site is not served over HTTPS',
      detail: 'Traffic is unencrypted; browsers flag it as "Not secure".', fix: 'Install a TLS certificate (Let\'s Encrypt is free) and redirect all HTTP to HTTPS.' },
    { ok: mixedContent === 0, weight: 8, severity: 'serious', title: `${mixedContent} mixed-content (http://) resources`,
      detail: 'Insecure subresources on an HTTPS page get blocked or downgrade trust.', fix: 'Serve every asset over HTTPS; add Content-Security-Policy: upgrade-insecure-requests.' },
    { ok: !!headers['strict-transport-security'], weight: 8, severity: 'serious', title: 'No HSTS header',
      detail: 'Without Strict-Transport-Security users can be downgraded to HTTP.', fix: 'Send Strict-Transport-Security: max-age=63072000; includeSubDomains; preload.' },
    { ok: !!headers['content-security-policy'], weight: 8, severity: 'moderate', title: 'No Content-Security-Policy',
      detail: 'A CSP is the strongest defence against XSS and injection.', fix: 'Add a Content-Security-Policy header; start in report-only mode then tighten.' },
    { ok: !!headers['x-content-type-options'], weight: 4, severity: 'moderate', title: 'No X-Content-Type-Options',
      detail: 'Browsers may MIME-sniff responses.', fix: 'Send X-Content-Type-Options: nosniff.' },
    { ok: !!(headers['x-frame-options'] || (headers['content-security-policy'] || '').includes('frame-ancestors')),
      weight: 4, severity: 'moderate', title: 'No clickjacking protection',
      detail: 'The page can be embedded in a malicious iframe.', fix: 'Send X-Frame-Options: DENY or CSP frame-ancestors \'none\'.' },
    { ok: !!headers['referrer-policy'], weight: 3, severity: 'minor', title: 'No Referrer-Policy',
      detail: 'Full referrer URLs may leak to third parties.', fix: 'Send Referrer-Policy: strict-origin-when-cross-origin.' },
    { ok: consoleErrors.length === 0, weight: 6, severity: 'moderate', title: `${consoleErrors.length} console error(s)`,
      detail: consoleErrors.slice(0, 3).join(' | ') || 'JavaScript errors logged at runtime.', fix: 'Fix runtime errors; they often signal broken features or failed third-party scripts.' },
    { ok: failedRequests.length === 0, weight: 5, severity: 'moderate', title: `${failedRequests.length} failed network request(s)`,
      detail: failedRequests.slice(0, 3).map((r) => r.url).join(' | ') || 'Some resources failed to load.', fix: 'Fix 404s/blocked requests; remove references to missing assets.' },
  ];

  let earned = 0, total = 0;
  const findings = [];
  for (const c of checks) {
    total += c.weight;
    if (c.ok) earned += c.weight;
    else findings.push({ severity: c.severity, category: 'bestPractices', title: c.title, detail: c.detail, fix: c.fix });
  }
  const score = total ? Math.round((earned / total) * 100) : 100;
  return { score, findings, headersSeen: Object.keys(headers) };
}
