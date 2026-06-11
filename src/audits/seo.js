/**
 * SEO & discoverability checklist evaluated against the DOM. Each item carries a
 * weight; the score is the percentage of weighted points earned.
 */
export async function auditSeo({ page, response }, goal) {
  const data = await page.evaluate(() => {
    const meta = (name, attr = 'name') =>
      document.querySelector(`meta[${attr}="${name}"]`)?.getAttribute('content') || null;
    const imgs = [...document.images];
    return {
      title: document.title || null,
      titleLen: (document.title || '').length,
      description: meta('description'),
      canonical: document.querySelector('link[rel="canonical"]')?.href || null,
      lang: document.documentElement.getAttribute('lang') || null,
      viewport: meta('viewport'),
      robots: meta('robots'),
      ogTitle: meta('og:title', 'property') || meta('og:title'),
      ogImage: meta('og:image', 'property') || meta('og:image'),
      twitterCard: meta('twitter:card'),
      h1Count: document.querySelectorAll('h1').length,
      headings: document.querySelectorAll('h1,h2,h3,h4,h5,h6').length,
      imgTotal: imgs.length,
      imgNoAlt: imgs.filter((i) => !i.getAttribute('alt') && i.getAttribute('alt') !== '').length,
      structuredData: document.querySelectorAll('script[type="application/ld+json"]').length,
      wordCount: (document.body?.innerText || '').trim().split(/\s+/).filter(Boolean).length,
    };
  });

  const seoFocused = goal.weights.seo >= 18;
  const checks = [
    { ok: !!data.title, weight: 12, severity: 'critical', title: 'Missing <title>',
      detail: 'No document title for search results or tabs.', fix: 'Add a unique, descriptive <title> of 30–60 characters.' },
    { ok: data.titleLen >= 15 && data.titleLen <= 65, weight: 6, severity: 'moderate', title: `Title length is ${data.titleLen} chars`,
      detail: 'Titles outside ~15–65 chars get truncated or look thin in SERPs.', fix: 'Aim for 30–60 characters with the primary keyword near the front.' },
    { ok: !!data.description, weight: 10, severity: 'serious', title: 'Missing meta description',
      detail: 'Search engines fabricate a snippet when none is provided.', fix: 'Add a 120–160 char meta description summarising the page.' },
    { ok: !!data.canonical, weight: 6, severity: 'moderate', title: 'No canonical URL',
      detail: 'Risk of duplicate-content dilution.', fix: 'Add <link rel="canonical" href="..."> pointing to the preferred URL.' },
    { ok: !!data.lang, weight: 6, severity: 'serious', title: 'No <html lang> attribute',
      detail: 'Hurts both SEO and screen readers.', fix: 'Set <html lang="en"> (or the correct language).' },
    { ok: !!data.viewport, weight: 8, severity: 'serious', title: 'No responsive viewport meta',
      detail: 'Mobile ranking and rendering suffer.', fix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.' },
    { ok: data.h1Count === 1, weight: 8, severity: 'moderate', title: `Found ${data.h1Count} <h1> elements`,
      detail: 'A page should have exactly one top-level heading.', fix: 'Use a single <h1>; demote the rest to <h2>/<h3>.' },
    { ok: !!(data.ogTitle && data.ogImage), weight: 8, severity: 'moderate', title: 'Incomplete Open Graph tags',
      detail: 'Links shared on social/chat render without a rich preview.', fix: 'Add og:title, og:description and og:image (1200×630).' },
    { ok: !!data.twitterCard, weight: 4, severity: 'minor', title: 'No twitter:card meta',
      detail: 'X/Twitter previews fall back to a bare link.', fix: 'Add <meta name="twitter:card" content="summary_large_image">.' },
    { ok: data.imgTotal === 0 || data.imgNoAlt / data.imgTotal < 0.2, weight: 8, severity: 'serious',
      title: `${data.imgNoAlt}/${data.imgTotal} images missing alt text`,
      detail: 'Hurts accessibility and image SEO.', fix: 'Add descriptive alt text to meaningful images; alt="" for decorative ones.' },
    { ok: data.structuredData > 0, weight: seoFocused ? 8 : 4, severity: seoFocused ? 'serious' : 'minor',
      title: 'No structured data (JSON-LD)',
      detail: 'Misses rich results (breadcrumbs, articles, products, FAQ).', fix: 'Add schema.org JSON-LD relevant to the page type.' },
  ];

  let earned = 0, total = 0;
  const findings = [];
  for (const c of checks) {
    total += c.weight;
    if (c.ok) earned += c.weight;
    else findings.push({ severity: c.severity, category: 'seo', title: c.title, detail: c.detail, fix: c.fix });
  }
  const score = total ? Math.round((earned / total) * 100) : 100;
  return { score, findings, data };
}
