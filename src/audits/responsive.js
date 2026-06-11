import path from 'node:path';
import { openAndProbe, VIEWPORTS } from '../browser.js';

/**
 * Cross-device check. Renders the page at mobile / tablet / desktop, looks for
 * horizontal overflow, too-small tap targets, and unreadable font sizes, and
 * saves a screenshot per viewport for the report.
 */
export async function auditResponsive(browser, url, { screenshotDir, timeout } = {}) {
  const findings = [];
  const perViewport = {};
  let penalty = 0;

  for (const vp of [VIEWPORTS.mobile, VIEWPORTS.tablet, VIEWPORTS.desktop]) {
    const probe = await openAndProbe(browser, url, vp, { timeout });
    const { page, context } = probe;
    try {
      const layout = await page.evaluate(() => {
        const docW = document.documentElement.scrollWidth;
        const winW = window.innerWidth;
        const horizontalOverflow = docW - winW;

        // Smallest interactive targets.
        const interactive = [...document.querySelectorAll('a,button,[role="button"],input,select,[onclick]')];
        let tinyTargets = 0;
        for (const el of interactive) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (r.width < 44 || r.height < 44) tinyTargets++;
        }

        // Body text that is too small to read comfortably on the device.
        const textEls = [...document.querySelectorAll('p,li,span,a,td')].slice(0, 400);
        let tinyText = 0;
        for (const el of textEls) {
          if (!el.textContent.trim()) continue;
          const fs = parseFloat(getComputedStyle(el).fontSize);
          if (fs && fs < 12) tinyText++;
        }
        return { horizontalOverflow, tinyTargets, interactive: interactive.length, tinyText };
      });

      let shot = null;
      if (screenshotDir) {
        shot = path.join(screenshotDir, `${vp.name}.png`);
        await page.screenshot({ path: shot, fullPage: false }).catch(() => { shot = null; });
      }
      perViewport[vp.name] = { ...layout, screenshot: shot };

      if (layout.horizontalOverflow > 4) {
        penalty += vp.isMobile ? 22 : 12;
        findings.push({ severity: vp.isMobile ? 'serious' : 'moderate', category: 'responsive',
          title: `Horizontal scroll on ${vp.name} (${layout.horizontalOverflow}px overflow)`,
          detail: 'Content is wider than the screen, forcing sideways scrolling.',
          fix: 'Use max-width:100%, fluid units, flex/grid wrapping, and box-sizing:border-box; avoid fixed pixel widths wider than the viewport.' });
      }
      if (vp.isMobile && layout.tinyTargets > 0) {
        penalty += Math.min(18, layout.tinyTargets * 3);
        findings.push({ severity: 'moderate', category: 'responsive',
          title: `${layout.tinyTargets} tap targets smaller than 44×44px on ${vp.name}`,
          detail: 'Small touch targets are hard to hit and fail WCAG 2.5.5.',
          fix: 'Give interactive elements a minimum 44×44px hit area via padding or min-height/min-width.' });
      }
      if (vp.isMobile && layout.tinyText > 3) {
        penalty += 8;
        findings.push({ severity: 'minor', category: 'responsive',
          title: `${layout.tinyText} elements use font-size < 12px on ${vp.name}`,
          detail: 'Tiny text is hard to read on phones.', fix: 'Use a base body font-size of 16px on mobile.' });
      }
    } finally {
      await context.close().catch(() => {});
    }
  }

  const score = Math.max(0, Math.round(100 - penalty));
  return { score, findings, perViewport };
}
