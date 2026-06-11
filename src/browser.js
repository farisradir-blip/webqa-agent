import { chromium, devices } from 'playwright';

// Injected before any page script runs so the observers catch the very first
// paint and layout shift. Results land on window.__webqa.
const VITALS_PROBE = `
window.__webqa = { lcp: 0, cls: 0, longTasks: 0, fcp: 0, shifts: [] };
(function () {
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        window.__webqa.lcp = e.renderTime || e.loadTime || e.startTime || window.__webqa.lcp;
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (e) {}
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (!e.hadRecentInput) {
          window.__webqa.cls += e.value;
          if (e.value > 0.01) window.__webqa.shifts.push(Number(e.value.toFixed(4)));
        }
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch (e) {}
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__webqa.longTasks += e.duration;
    }).observe({ type: 'longtask', buffered: true });
  } catch (e) {}
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.name === 'first-contentful-paint') window.__webqa.fcp = e.startTime;
      }
    }).observe({ type: 'paint', buffered: true });
  } catch (e) {}
})();
`;

export const VIEWPORTS = {
  mobile:  { name: 'mobile',  width: 390,  height: 844,  isMobile: true,  ...devices['iPhone 13']?.viewport && {} },
  tablet:  { name: 'tablet',  width: 820,  height: 1180, isMobile: true },
  desktop: { name: 'desktop', width: 1440, height: 900,  isMobile: false },
};

export async function launchBrowser({ headless = true } = {}) {
  return chromium.launch({ headless, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
}

/**
 * Open a page at one viewport, navigate, settle, and collect a rich context
 * object the audits can all read from without re-navigating.
 */
export async function openAndProbe(browser, url, viewport, { timeout = 45000 } = {}) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile,
    hasTouch: viewport.isMobile,
    deviceScaleFactor: viewport.isMobile ? 2 : 1,
    userAgent: viewport.isMobile
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
      : undefined,
  });
  await context.addInitScript(VITALS_PROBE);

  const page = await context.newPage();
  const consoleErrors = [];
  const failedRequests = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 300));
  });
  page.on('requestfailed', (req) => {
    failedRequests.push({ url: req.url(), error: req.failure()?.errorText });
  });

  const started = Date.now();
  let response = null;
  let navError = null;
  try {
    response = await page.goto(url, { waitUntil: 'load', timeout });
  } catch (e) {
    navError = e.message;
  }

  // Encourage lazy content + LCP candidates, then let the network settle.
  try {
    await page.evaluate(async () => {
      await new Promise((r) => {
        let y = 0;
        const step = () => {
          window.scrollTo(0, y);
          y += window.innerHeight;
          if (y < document.body.scrollHeight && y < 20000) setTimeout(step, 120);
          else { window.scrollTo(0, 0); setTimeout(r, 200); }
        };
        step();
      });
    });
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  } catch (e) { /* page may have torn down */ }

  return { context, page, response, navError, consoleErrors, failedRequests, navMs: Date.now() - started };
}
