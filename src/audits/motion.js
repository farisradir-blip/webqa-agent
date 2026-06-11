/**
 * Motion & animation quality — the part the user specifically cares about.
 * Checks that animation is present but tasteful, respects reduced-motion, is
 * GPU-friendly, and doesn't cause layout shift or jank.
 */
export async function auditMotion({ page }, perfResult) {
  const data = await page.evaluate(() => {
    const all = [...document.querySelectorAll('*')].slice(0, 4000);
    let animatedCount = 0;
    let layoutAnimating = 0;       // animating expensive (non-compositor) properties
    let infiniteAnimations = 0;
    let longTransitions = 0;
    const LAYOUT_PROPS = ['width', 'height', 'top', 'left', 'right', 'bottom', 'margin', 'padding'];

    for (const el of all) {
      const s = getComputedStyle(el);
      const hasAnim = s.animationName && s.animationName !== 'none';
      const hasTrans = s.transitionDuration && s.transitionDuration !== '0s';
      if (hasAnim || hasTrans) animatedCount++;
      if (hasAnim && (s.animationIterationCount === 'infinite')) infiniteAnimations++;

      const transProp = (s.transitionProperty || '') + ' ' + (s.willChange || '');
      if (LAYOUT_PROPS.some((p) => transProp.includes(p)) || transProp.includes('all')) layoutAnimating++;

      const dur = parseFloat(s.transitionDuration) || 0;
      if (dur > 1) longTransitions++;
    }

    // Does the site honour the user's reduced-motion preference anywhere?
    let respectsReducedMotion = false;
    try {
      for (const sheet of document.styleSheets) {
        let rules;
        try { rules = sheet.cssRules; } catch { continue; } // cross-origin
        if (!rules) continue;
        for (const rule of rules) {
          if (rule.media && /prefers-reduced-motion/.test(rule.media.mediaText)) { respectsReducedMotion = true; break; }
        }
        if (respectsReducedMotion) break;
      }
    } catch {}

    return { animatedCount, layoutAnimating, infiniteAnimations, longTransitions, respectsReducedMotion };
  });

  const findings = [];
  let penalty = 0;
  const hasMotion = data.animatedCount > 0;

  if (hasMotion && !data.respectsReducedMotion) {
    penalty += 30;
    findings.push({ severity: 'serious', category: 'motion',
      title: 'Animations ignore prefers-reduced-motion',
      detail: 'The site animates but never checks the OS "reduce motion" setting — an accessibility failure (WCAG 2.3.3) that can trigger nausea/vestibular issues.',
      fix: 'Wrap non-essential animation in @media (prefers-reduced-motion: reduce) { *{animation:none!important;transition:none!important} } or disable it in JS.' });
  }
  if (data.layoutAnimating > 5) {
    penalty += Math.min(25, data.layoutAnimating);
    findings.push({ severity: 'moderate', category: 'motion',
      title: `${data.layoutAnimating} elements animate layout-triggering properties`,
      detail: 'Animating width/height/top/left (or transition: all) forces layout & paint on every frame, causing jank.',
      fix: 'Animate only transform and opacity (compositor-friendly). Replace position/size animations with translate/scale.' });
  }
  if ((perfResult?.measured?.inpProxy || 0) > 300 && hasMotion) {
    penalty += 15;
    findings.push({ severity: 'moderate', category: 'motion',
      title: 'Janky main thread during animation',
      detail: `${perfResult.measured.inpProxy}ms of long tasks means animations likely drop frames.`,
      fix: 'Offload work from the main thread, use the Web Animations API/CSS over JS loops, and add will-change sparingly.' });
  }
  if ((perfResult?.measured?.cls || 0) > 0.1 && hasMotion) {
    penalty += 10;
    findings.push({ severity: 'moderate', category: 'motion',
      title: 'Animation contributes to layout shift',
      detail: 'Entrance animations that change layout add to CLS.',
      fix: 'Animate transform/opacity only and reserve final space before the animation starts.' });
  }
  if (data.infiniteAnimations > 6) {
    penalty += 8;
    findings.push({ severity: 'minor', category: 'motion',
      title: `${data.infiniteAnimations} infinite/looping animations`,
      detail: 'Constant motion distracts users and drains battery.',
      fix: 'Limit looping animations; pause them off-screen with IntersectionObserver.' });
  }
  if (!hasMotion) {
    findings.push({ severity: 'info', category: 'motion',
      title: 'No CSS animation or transitions detected',
      detail: 'Static interfaces feel less polished. This is fine for docs/forms but a missed opportunity for landing/portfolio sites.',
      fix: 'Add subtle, purposeful motion: 150–300ms transitions on hover/focus, gentle entrance fades, and smooth state changes using transform/opacity.' });
  }

  // Sites with no motion shouldn't be punished; they just don't earn the polish bonus.
  const score = hasMotion ? Math.max(0, 100 - penalty) : 85;
  return { score, findings, data, hasMotion };
}
