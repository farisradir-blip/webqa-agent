import { AxeBuilder } from '@axe-core/playwright';

const IMPACT_WEIGHT = { critical: 12, serious: 6, moderate: 3, minor: 1 };
const IMPACT_SEVERITY = { critical: 'critical', serious: 'serious', moderate: 'moderate', minor: 'minor' };

/**
 * Deep accessibility scan via axe-core (WCAG 2.1 A/AA). Score starts at 100 and
 * is reduced by weighted, node-count-scaled violations.
 */
export async function auditAccessibility({ page }) {
  let results;
  try {
    results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();
  } catch (e) {
    return { score: null, findings: [{ severity: 'info', category: 'accessibility', title: 'Accessibility scan could not run', detail: e.message, fix: 'Ensure the page is reachable and fully rendered.' }], violations: [] };
  }

  let penalty = 0;
  const findings = [];
  const violations = [];
  for (const v of results.violations) {
    const nodes = v.nodes.length;
    const weight = IMPACT_WEIGHT[v.impact] || 1;
    penalty += weight * Math.min(nodes, 5); // diminishing returns past 5 instances
    violations.push({ id: v.id, impact: v.impact, nodes, help: v.help });
    findings.push({
      severity: IMPACT_SEVERITY[v.impact] || 'minor',
      category: 'accessibility',
      title: `${v.help} (${nodes} element${nodes === 1 ? '' : 's'})`,
      detail: v.description,
      fix: `${v.helpUrl}${v.nodes[0]?.failureSummary ? '\n      • ' + v.nodes[0].failureSummary.replace(/\n/g, ' ') : ''}`,
    });
  }

  const score = Math.max(0, Math.round(100 - penalty));
  return {
    score,
    findings,
    violations,
    passes: results.passes.length,
    incomplete: results.incomplete.length,
  };
}
