---
name: webqa
description: Audit a website against world-class standards for its goal (landing, ecommerce, saas, dashboard, blog, portfolio, docs) and report exactly what to fix. Runs performance/Core Web Vitals, accessibility (axe-core), SEO, security headers, responsive, motion/animation quality, and a load/stress test. Use when asked to QA, audit, test, grade, harden, or "make a site world-class", check Lighthouse-style quality, or verify a site is production-ready.
---

# webqa — website QA engineer skill

Run a full QA audit on a URL and turn the results into fixes.

## How to run

```bash
npx webqa-agent <url> --goal <goal> --out .webqa-reports --no-stress
```

- Choose `<goal>` to match the site: `landing`, `ecommerce`, `saas`,
  `dashboard`, `blog`, `portfolio`, `docs`, or `generic`.
- For local dev servers (`http://localhost:...`), always pass `--no-stress`.
- For a deployed site you own, drop `--no-stress` to also load-test it
  (`--concurrency 20 --requests 200` by default).

First run only, install the browser: `npx playwright install chromium`.

## Then

1. Read `.webqa-reports/<host>/report.json`.
2. Work the `allFindings` array in severity order (critical → serious →
   moderate). Each item has a `category`, a `title`, a `detail`, and a concrete
   `fix`. Apply the fix to the codebase.
3. Re-run and confirm `verdict.overall` rose and `verdict.worldClass` is the
   goal.
4. Report to the user starting with the grade and the highest-impact fix.

See `agent/AGENT.md` in this package for the full QA loop and the JSON schema.

## CI gate

```bash
npx webqa-agent https://staging.example.com --goal saas --min-score 90 --quiet
```

Exits non-zero if the overall score is below the threshold — wire it into a
GitHub Action to block regressions.
