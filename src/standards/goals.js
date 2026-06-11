/**
 * World-class standards, expressed per site goal.
 *
 * Every site is judged against the SAME raw measurements, but the *weight* of
 * each category and the strictness of a few thresholds change depending on what
 * the site is trying to do. A blog lives or dies by SEO and readability; a SaaS
 * dashboard by performance and accessibility; a store by performance + trust.
 *
 * `good` => scores 100. `poor` => scores 0. Values in between are interpolated
 * linearly. Lower-is-better metrics (LCP, CLS, latency) have good < poor.
 */

// Core Web Vitals + weight thresholds shared by every goal (Google 2024 targets).
export const METRICS = {
  lcp:        { label: 'Largest Contentful Paint', unit: 'ms', good: 2500, poor: 4000, lowerBetter: true },
  cls:        { label: 'Cumulative Layout Shift',  unit: '',   good: 0.1,  poor: 0.25, lowerBetter: true },
  inpProxy:   { label: 'Total Blocking (long tasks)', unit: 'ms', good: 200, poor: 600, lowerBetter: true },
  fcp:        { label: 'First Contentful Paint',   unit: 'ms', good: 1800, poor: 3000, lowerBetter: true },
  ttfb:       { label: 'Time To First Byte',       unit: 'ms', good: 800,  poor: 1800, lowerBetter: true },
  weightKb:   { label: 'Total page weight',        unit: 'KB', good: 1600, poor: 4500, lowerBetter: true },
  requests:   { label: 'Total requests',           unit: '',   good: 50,   poor: 120,  lowerBetter: true },
};

// Stress-test acceptance thresholds (latency in ms, error rate as fraction).
export const STRESS = {
  p95:       { label: 'p95 latency under load', unit: 'ms', good: 800, poor: 3000, lowerBetter: true },
  errorRate: { label: 'Error rate under load',  unit: '%',  good: 0,   poor: 5,    lowerBetter: true },
};

// Category weights per goal. They are normalised at scoring time, so they need
// not sum to 100 — they only express *relative* importance.
const GOALS = {
  generic: {
    label: 'Generic website',
    weights: { performance: 25, accessibility: 20, seo: 15, bestPractices: 15, responsive: 15, motion: 5, stress: 5 },
  },
  landing: {
    label: 'Marketing / landing page',
    weights: { performance: 28, accessibility: 16, seo: 18, bestPractices: 12, responsive: 14, motion: 8, stress: 4 },
    notes: 'First impression + fast paint + persuasive motion matter most. Speed is conversion.',
  },
  ecommerce: {
    label: 'E-commerce store',
    weights: { performance: 26, accessibility: 16, seo: 16, bestPractices: 18, responsive: 14, motion: 4, stress: 6 },
    notes: 'Trust (security headers, HTTPS) and speed drive revenue; must survive traffic spikes.',
    overrides: { weightKb: { good: 2000, poor: 5000 } },
  },
  saas: {
    label: 'SaaS application / product',
    weights: { performance: 28, accessibility: 22, seo: 10, bestPractices: 16, responsive: 14, motion: 6, stress: 4 },
    notes: 'Accessibility and interaction performance matter more than marketing SEO.',
    overrides: { inpProxy: { good: 150, poor: 500 } },
  },
  dashboard: {
    label: 'Admin / analytics dashboard',
    weights: { performance: 26, accessibility: 24, seo: 4, bestPractices: 18, responsive: 18, motion: 6, stress: 4 },
    notes: 'Data-dense, keyboard-driven, rarely public-facing. SEO almost irrelevant; a11y critical.',
  },
  blog: {
    label: 'Blog / content / news',
    weights: { performance: 22, accessibility: 22, seo: 26, bestPractices: 12, responsive: 12, motion: 2, stress: 4 },
    notes: 'Discoverability and readability dominate. Structured data and headings are king.',
  },
  portfolio: {
    label: 'Portfolio / creative / agency',
    weights: { performance: 22, accessibility: 16, seo: 12, bestPractices: 12, responsive: 16, motion: 18, stress: 4 },
    notes: 'Motion design and polish are the product, but must not wreck CLS or accessibility.',
    overrides: { inpProxy: { good: 250, poor: 700 } },
  },
  docs: {
    label: 'Documentation site',
    weights: { performance: 22, accessibility: 24, seo: 22, bestPractices: 12, responsive: 14, motion: 2, stress: 4 },
    notes: 'Findability, keyboard navigation, and fast text rendering.',
  },
};

export function resolveGoal(name) {
  const goal = GOALS[name] || GOALS.generic;
  // Merge metric overrides into a per-run metric table.
  const metrics = structuredClone(METRICS);
  if (goal.overrides) {
    for (const [k, v] of Object.entries(goal.overrides)) {
      metrics[k] = { ...metrics[k], ...v };
    }
  }
  return { key: GOALS[name] ? name : 'generic', ...goal, metrics };
}

export function listGoals() {
  return Object.entries(GOALS).map(([key, g]) => ({ key, label: g.label }));
}

// A site is "world-class" only if it clears a high bar overall AND no critical
// category collapses. Excellence everywhere, not an average that hides a hole.
export const WORLD_CLASS = {
  overall: 90,
  floors: { performance: 85, accessibility: 90, bestPractices: 85 },
};
