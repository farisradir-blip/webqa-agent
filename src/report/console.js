import pc from 'picocolors';
import { sortFindings } from '../scoring.js';

const SEV = {
  critical: (s) => pc.bgRed(pc.white(` ${s} `)),
  serious: (s) => pc.red(s),
  moderate: (s) => pc.yellow(s),
  minor: (s) => pc.dim(s),
  info: (s) => pc.blue(s),
};
const CAT_LABEL = {
  performance: 'Performance', accessibility: 'Accessibility', seo: 'SEO',
  bestPractices: 'Security/Best-practices', responsive: 'Responsive', motion: 'Motion', stress: 'Stress',
};

function scoreColor(s) {
  if (s == null) return pc.dim('n/a');
  const txt = `${s}/100`;
  if (s >= 90) return pc.green(txt);
  if (s >= 70) return pc.yellow(txt);
  return pc.red(txt);
}
function barString(s) {
  if (s == null) return '─'.repeat(20);
  const filled = Math.round((s / 100) * 20);
  const b = '█'.repeat(filled) + '░'.repeat(20 - filled);
  if (s >= 90) return pc.green(b);
  if (s >= 70) return pc.yellow(b);
  return pc.red(b);
}

export function renderConsole(result) {
  const { url, goal, verdict, categories, allFindings } = result;
  const out = [];
  out.push('');
  out.push(pc.bold(pc.cyan('  ╭───────────────────────────────────────────────────────────╮')));
  out.push(pc.bold(pc.cyan('  │            webqa-agent · website QA report                │')));
  out.push(pc.bold(pc.cyan('  ╰───────────────────────────────────────────────────────────╯')));
  out.push('');
  out.push(`  ${pc.dim('URL  ')} ${url}`);
  out.push(`  ${pc.dim('Goal ')} ${goal.label}`);
  out.push('');
  const v = verdict.worldClass ? pc.bgGreen(pc.black(' WORLD-CLASS ')) : pc.bgYellow(pc.black(' NEEDS WORK '));
  out.push(`  ${pc.bold('Overall')}  ${scoreColor(verdict.overall)}  ${pc.bold('Grade ' + verdict.grade)}   ${v}`);
  out.push('');
  for (const [key, cat] of Object.entries(categories)) {
    if (!cat) continue;
    const label = (CAT_LABEL[key] || key).padEnd(22);
    out.push(`  ${label} ${barString(cat.score)} ${scoreColor(cat.score)}`);
  }
  out.push('');

  const top = sortFindings(allFindings.filter((f) => f.severity === 'critical' || f.severity === 'serious')).slice(0, 6);
  if (top.length) {
    out.push(pc.bold('  Top priorities:'));
    top.forEach((f, i) => {
      out.push(`   ${i + 1}. ${SEV[f.severity](f.severity.toUpperCase())} ${f.title} ${pc.dim('(' + (CAT_LABEL[f.category] || f.category) + ')')}`);
    });
    out.push('');
  }
  return out.join('\n');
}
