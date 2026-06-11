# 🧪 webqa-agent

> An autonomous **QA engineer for websites**. Point it at a URL, tell it what the
> site is _for_, and it audits the site against **world-class standards**, puts
> it under load, and tells the developer — or the AI that built it — **exactly
> what to change** to make it world-class.

[![npm](https://img.shields.io/npm/v/webqa-agent.svg)](https://www.npmjs.com/package/webqa-agent)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](#requirements)

It is **two things in one**:

1. **A CLI / library** you can add to any site or CI pipeline.
2. **An AI agent skill** — hand `agent/AGENT.md` (or the Claude Code skill) to
   Claude, Cursor, Windsurf, Copilot, Cline… and it will run the audit and fix
   the site for you, looping until it's world-class.

---

## What it checks

| Category | What it measures |
|---|---|
| ⚡ **Performance** | Core Web Vitals — LCP, CLS, INP proxy (long tasks), FCP, TTFB, page weight, request count |
| ♿ **Accessibility** | Full **axe-core** scan (WCAG 2.1 A/AA), weighted by impact |
| 🔍 **SEO** | Title, meta, canonical, `lang`, viewport, headings, Open Graph, structured data, alt text |
| 🔒 **Security & best practices** | HTTPS, HSTS, CSP, X-Frame-Options, mixed content, console errors, failed requests |
| 📱 **Responsive** | Renders at mobile / tablet / desktop; horizontal overflow, 44px tap targets, readable fonts + screenshots |
| 🎬 **Motion & animation** | `prefers-reduced-motion` support, compositor-friendly properties, animation-driven jank & layout shift |
| 🔥 **Stress / load** | Concurrent load test → p50/p95/p99 latency, error rate, throughput |

Every site is scored against the **same measurements**, but the **weighting
adapts to its goal** — a blog is judged mostly on SEO + readability, a dashboard
on accessibility + performance, a store on speed + trust. A site is only labelled
**world-class** when it scores ≥ 90 overall **and** clears hard floors on
performance, accessibility, and best practices (no hidden weak spot).

---

## Quick start

```bash
# 1. Install (once)
npm install -g webqa-agent
npx playwright install chromium      # downloads the headless browser

# 2. Audit a deployed site
webqa https://your-site.com --goal landing

# 3. Audit a local dev server (skip the load test)
webqa http://localhost:3000 --goal saas --no-stress
```

You get a colour scorecard in the terminal **and** three artefacts in
`.webqa-reports/<host>/`:

- `report.md` — developer-facing, prioritised list of fixes
- `report.json` — machine-readable, for AI agents & dashboards
- `screenshots/` — mobile, tablet, desktop

### One-off, no install

```bash
npx webqa-agent https://your-site.com --goal ecommerce
```

---

## Goals

Pick the one that matches the site (`--goal`):

`landing` · `ecommerce` · `saas` · `dashboard` · `blog` · `portfolio` · `docs` · `generic`

---

## CLI options

```
webqa <url> [options]

  -g, --goal <goal>          site goal (default: generic)
  -o, --out <dir>            output dir (default: .webqa-reports/<host>)
      --no-stress            skip the load/stress test
  -c, --concurrency <n>      stress: concurrent requests (default: 20)
  -r, --requests <n>         stress: total requests (default: 200)
      --headed               run the browser visibly
      --json                 print full JSON to stdout
      --min-score <n>        exit non-zero if overall < n  (CI gate)
      --quiet                suppress progress logs
```

---

## Use it from an AI agent

This is the "give it to the AI that builds your site" path.

- **Claude Code:** copy `agent/claude-skill/` into your project's `.claude/skills/webqa/`,
  then say _"audit this site with webqa and fix it until it's world-class."_
- **Cursor / Windsurf / Copilot / Cline:** add `agent/AGENT.md` to the project
  (or paste it into the chat). The agent will run `npx webqa-agent`, read
  `report.json`, and apply the `fix` for every finding in severity order, looping
  until `verdict.worldClass === true`.

The JSON every finding carries:

```jsonc
{
  "severity": "critical",
  "category": "performance",
  "title": "LCP is 5200ms (target <2500ms)",
  "detail": "The largest element paints far too late…",
  "fix": "Preload the hero image/font, serve AVIF/WebP, set width/height…"
}
```

---

## Use it programmatically

```js
import { runAudit } from 'webqa-agent';

const result = await runAudit('https://example.com', {
  goal: 'landing',
  stress: false,
});

console.log(result.verdict);          // { overall, grade, worldClass, ... }
for (const f of result.allFindings) {
  if (f.severity === 'critical') console.log(f.title, '→', f.fix);
}
```

---

## CI quality gate

```yaml
- run: npx webqa-agent https://staging.example.com --goal saas --min-score 90 --quiet
```

A ready-made GitHub Action lives in
[`.github/workflows/example-qa.yml`](.github/workflows/example-qa.yml).

---

## Requirements

- Node.js ≥ 18
- Chromium via Playwright (`npx playwright install chromium`)
- Only stress-test sites **you own or are authorised to test**.

---

## How scoring works

Each category yields a 0–100 score. Metric scores interpolate linearly between a
**good** threshold (100) and a **poor** threshold (0) — the same Core Web Vitals
bands Google uses. The overall score is a goal-weighted average. See
[`src/standards/goals.js`](src/standards/goals.js) for every threshold and
weight; they're all editable in one place.

---

## License

MIT © farisradir
