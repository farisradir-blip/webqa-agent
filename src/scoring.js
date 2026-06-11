/**
 * Turns raw measurements + findings into 0-100 category scores, an overall
 * score, a letter grade, and a world-class verdict.
 */
import { WORLD_CLASS } from './standards/goals.js';

/** Linear score for a single metric against its good/poor band. */
export function scoreMetric(value, spec) {
  if (value == null || Number.isNaN(value)) return null;
  const { good, poor, lowerBetter } = spec;
  if (lowerBetter) {
    if (value <= good) return 100;
    if (value >= poor) return 0;
    return Math.round(100 * (poor - value) / (poor - good));
  }
  if (value >= good) return 100;
  if (value <= poor) return 0;
  return Math.round(100 * (value - poor) / (good - poor));
}

export function letterGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * @param {Record<string, {score:number|null}>} categories  audit results keyed by category
 * @param {Record<string, number>} weights  per-goal weights
 */
export function aggregate(categories, weights) {
  let sum = 0;
  let weightTotal = 0;
  for (const [key, weight] of Object.entries(weights)) {
    const cat = categories[key];
    if (!cat || cat.score == null) continue;
    sum += cat.score * weight;
    weightTotal += weight;
  }
  const overall = weightTotal ? Math.round(sum / weightTotal) : 0;

  const failedFloors = Object.entries(WORLD_CLASS.floors).filter(
    ([key, floor]) => (categories[key]?.score ?? 0) < floor,
  );
  const worldClass = overall >= WORLD_CLASS.overall && failedFloors.length === 0;

  return {
    overall,
    grade: letterGrade(overall),
    worldClass,
    failedFloors: failedFloors.map(([key, floor]) => ({ key, floor, score: categories[key]?.score ?? 0 })),
  };
}

// Severity ordering for sorting findings in the report.
export const SEVERITY_RANK = { critical: 0, serious: 1, moderate: 2, minor: 3, info: 4 };

export function sortFindings(findings) {
  return [...findings].sort(
    (a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9),
  );
}
