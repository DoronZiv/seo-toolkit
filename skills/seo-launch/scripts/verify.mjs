#!/usr/bin/env node
// seo-toolkit verify: audit a live site for the SEO and AI-search basics.
// Zero dependencies, Node 18+. Read-only: GET requests only.
//
//   node verify.mjs <url> [--indexnow-key=KEY] [--page=/path ...] [--sample=8] [--json]
//
// Exit code 1 if any check is FAIL, else 0.

const VERSION = '0.2.0';
const UA = `seo-toolkit-verify/${VERSION}`;
const TIMEOUT_MS = 15000;
const AI_BOTS = ['gptbot', 'oai-searchbot', 'chatgpt-user', 'claudebot', 'perplexitybot', 'google-extended', 'ccbot'];

function parseArgs(list) {
  const o = { pages: [], sample: 8, json: false, key: null, url: null, help: false };
  for (const a of list) {
    if (a === '--json') o.json = true;
    else if (a === '-h' || a === '--help') o.help = true;
    else if (a.startsWith('--indexnow-key=')) o.key = a.slice('--indexnow-key='.length).trim();
    else if (a.startsWith('--page=')) o.pages.push(a.slice('--page='.length));
    else if (a.startsWith('--sample=')) o.sample = Math.max(0, parseInt(a.slice('--sample='.length), 10) || 0);
    else if (!a.startsWith('--') && !o.url) o.url = a;
  }
  return o;
}

const opts = parseArgs(process.argv.slice(2));
if (opts.help || !opts.url) {
  console.log('usage: node verify.mjs <url> [--indexnow-key=KEY] [--page=/path ...] [--sample=8] [--json]');
  process.exit(opts.help ? 0 : 2);
}

const base = new URL(/^https?:\/\//i.test(opts.url) ? opts.url : `https://${opts.url}`);
const origin = base.origin;
const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);

let siteHost = base.host; // host the homepage finally lands on (apex may redirect to www)

const results = [];
const add =(status, id, msg, page = '/') => results.push({ status, id, page, msg });

async function get(url, { redirect = 'follow' } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { redirect, signal: ctl.signal, headers: { 'user-agent': UA, accept: '*/*' } });
    const body = Buffer.from(await res.arrayBuffer());
    return { ok: true, status: res.status, headers: res.headers, url: res.url || url, redirected: res.redirected, body };
  } catch (e) {
    return { ok: false, error: e.cause?.code || e.message };
  } finally {
    clearTimeout(timer);
  }
}

const decode = (s) =>
  String(s).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

function attrsOf(tag) {
  const out = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  for (const m of tag.slice(1).matchAll(re)) out[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? '');
  return out;
}
const tagsOf = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map((m) => attrsOf(m[0]));

function parseRobots(text) {
  const groups = [];
  const sitemaps = [];
  let cur = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const i = line.indexOf(':');
    if (!line || i < 0) continue;
    const k = line.slice(0, i).trim().toLowerCase();
    const v = line.slice(i + 1).trim();
    if (k === 'sitemap') sitemaps.push(v);
    else if (k === 'user-agent') {
      if (!cur || !lastWasAgent) {
        cur = { agents: [], rules: [] };
        groups.push(cur);
      }
      cur.agents.push(v.toLowerCase());
      lastWasAgent = true;
      continue;
    } else if (cur && (k === 'disallow' || k === 'allow')) cur.rules.push({ k, v });
    lastWasAgent = false;
  }
  return { groups, sitemaps };
}

const blocksAll = (groups, agent) =>
  groups
    .filter((g) => g.agents.includes(agent))
    .some((g) => g.rules.some((r) => r.k === 'disallow' && r.v === '/') && !g.rules.some((r) => r.k === 'allow' && r.v === '/'));

const locsOf = (xml) =>
  [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)].map((m) => decode(m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim())).filter(Boolean);

const kb = (n) => `${(n / 1024).toFixed(0)}KB`;
const sample = (arr, n) => {
  if (arr.length <= n) return arr;
  const step = (arr.length - 1) / (n - 1 || 1);
  return Array.from({ length: n }, (_, i) => arr[Math.round(i * step)]);
};

// ---------- site-level checks ----------

async function checkSite() {
  if (base.protocol === 'https:' && !isLocal) {
    const r = await get(`http://${base.host}/`, { redirect: 'manual' });
    if (!r.ok) add('INFO', 'https-redirect', `port 80 not reachable (${r.error}), fine if HTTPS-only`);
    else if ([301, 308].includes(r.status) && /^https:/i.test(r.headers.get('location') || '')) add('PASS', 'https-redirect', `http redirects to https (${r.status})`);
    else if ([302, 303, 307].includes(r.status)) add('WARN', 'https-redirect', `http to https redirect is temporary (${r.status}), use 301/308`);
    else if (r.status === 200) add('FAIL', 'https-redirect', 'http serves content without redirecting to https (duplicate site)');
    else add('WARN', 'https-redirect', `http answered ${r.status}`);
  }

  const robots = await get(`${origin}/robots.txt`);
  let sitemapUrls = [`${origin}/sitemap.xml`];
  const robotsText = robots.ok && robots.status === 200 ? robots.body.toString('utf8') : '';
  if (!robotsText || /^\s*</.test(robotsText)) {
    add('WARN', 'robots', robots.ok ? `/robots.txt missing (HTTP ${robots.status}) or not plain text` : `robots.txt unreachable: ${robots.error}`);
  } else {
    const { groups, sitemaps } = parseRobots(robotsText);
    if (blocksAll(groups, '*')) add('FAIL', 'robots', 'robots.txt has "User-agent: *" with "Disallow: /" (whole site blocked)');
    else {
      add('PASS', 'robots', `robots.txt ok${sitemaps.length ? `, ${sitemaps.length} Sitemap line(s)` : ', no Sitemap line (add one)'}`);
      const blocked = AI_BOTS.filter((b) => blocksAll(groups, b));
      if (blocked.length) add('WARN', 'robots-ai', `AI crawlers blocked: ${blocked.join(', ')} (invisible to those AI answers)`);
      else add('PASS', 'robots-ai', 'no AI crawler is blocked');
    }
    if (sitemaps.length) sitemapUrls = sitemaps;
  }

  const sm = await get(sitemapUrls[0]);
  if (!sm.ok || sm.status !== 200) {
    add('FAIL', 'sitemap', `${sitemapUrls[0]} not reachable (${sm.ok ? `HTTP ${sm.status}` : sm.error})`);
  } else {
    const xml = sm.body.toString('utf8');
    let urls = [];
    if (/<sitemapindex/i.test(xml)) {
      const kids = locsOf(xml).slice(0, 5);
      for (const k of kids) {
        const c = await get(k);
        if (c.ok && c.status === 200) urls.push(...locsOf(c.body.toString('utf8')));
      }
      add('INFO', 'sitemap-index', `sitemap index with ${locsOf(xml).length} child sitemap(s), read first ${kids.length}`);
    } else urls = locsOf(xml);

    if (!urls.length) add('FAIL', 'sitemap', 'sitemap has no <loc> entries (empty or not valid XML)');
    else {
      add('PASS', 'sitemap', `${urls.length} URL(s) in sitemap`);
      if (urls.length > 50000) add('WARN', 'sitemap-size', 'more than 50,000 URLs in one sitemap, split it');
      const foreign = urls.filter((u) => { try { return new URL(u).host !== siteHost; } catch { return true; } });
      if (foreign.length) add('WARN', 'sitemap-host', `${foreign.length} URL(s) not on ${siteHost}, e.g. ${foreign[0]}`);

      if (opts.sample > 0) {
        const picks = sample(urls, Math.min(opts.sample, urls.length));
        const bad = [];
        const redir = [];
        for (let i = 0; i < picks.length; i += 4) {
          const batch = await Promise.all(picks.slice(i, i + 4).map(async (u) => [u, await get(u, { redirect: 'manual' })]));
          for (const [u, r] of batch) {
            if (!r.ok) bad.push(`${u} (${r.error})`);
            else if (r.status >= 300 && r.status < 400) redir.push(`${u} (${r.status})`);
            else if (r.status !== 200) bad.push(`${u} (${r.status})`);
          }
        }
        if (bad.length) add('FAIL', 'sitemap-urls', `${bad.length}/${picks.length} sampled URLs do not return 200: ${bad.slice(0, 3).join(', ')}`);
        else if (redir.length) add('WARN', 'sitemap-urls', `${redir.length}/${picks.length} sampled URLs redirect: ${redir.slice(0, 3).join(', ')} (list the final URL)`);
        else add('PASS', 'sitemap-urls', `${picks.length} sampled URLs all return 200`);
      }
    }
  }

  if (opts.key) {
    const k = await get(`${origin}/${encodeURIComponent(opts.key)}.txt`);
    if (k.ok && k.status === 200 && k.body.toString('utf8').trim() === opts.key) add('PASS', 'indexnow', 'IndexNow key file serves the key');
    else add('FAIL', 'indexnow', `/${opts.key}.txt must return exactly the key (got ${k.ok ? `HTTP ${k.status}` : k.error})`);
  } else add('INFO', 'indexnow', 'skipped, pass --indexnow-key=KEY to check the key file');

  const notFound = await get(`${origin}/__seo-toolkit-404-check-${Date.now()}`);
  if (!notFound.ok) add('WARN', '404', `404 probe failed: ${notFound.error}`);
  else if ([404, 410].includes(notFound.status)) add('PASS', '404', `unknown URL returns ${notFound.status}`);
  else if (notFound.status === 200) add('WARN', '404', 'unknown URL returns 200 (soft 404, Google flags these)');
  else add('INFO', '404', `unknown URL returns ${notFound.status}`);

  const llms = await get(`${origin}/llms.txt`);
  if (llms.ok && llms.status === 200 && !/^\s*</.test(llms.body.toString('utf8'))) add('PASS', 'llms', '/llms.txt present');
  else add('INFO', 'llms', 'no /llms.txt (optional, helps some AI crawlers)');
}

// ---------- page-level checks ----------

async function checkPage(path, isHome) {
  const P = (s, id, m) => add(s, id, m, path);
  const r = await get(new URL(path, origin).href);
  if (!r.ok) return P('FAIL', 'page', `unreachable: ${r.error}`);
  if (r.status !== 200) {
    P('FAIL', 'status', `HTTP ${r.status}`);
    return;
  }
  const finalUrl = new URL(r.url);
  if (r.redirected) P('INFO', 'redirect', `redirected to ${finalUrl.href}`);
  if (!(r.headers.get('content-type') || '').includes('html')) return P('INFO', 'html', 'not an HTML page, skipped');

  const html = r.body.toString('utf8');
  const metas = tagsOf(html, 'meta');
  const links = tagsOf(html, 'link');
  const meta = (n) => metas.find((m) => (m.name || m.property || '').toLowerCase() === n)?.content?.trim();

  const noindexHeader = /noindex/i.test(r.headers.get('x-robots-tag') || '');
  const noindexMeta = metas.some((m) => ['robots', 'googlebot'].includes((m.name || '').toLowerCase()) && /noindex/i.test(m.content || ''));
  if (noindexHeader || noindexMeta) P('FAIL', 'noindex', `page is noindex (${noindexHeader ? 'X-Robots-Tag header' : 'meta robots'}), Google will drop it`);
  else P('PASS', 'noindex', 'indexable');

  const title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim());
  if (!title) P('FAIL', 'title', 'missing <title>');
  else if (title.length > 65 || title.length < 10) P('WARN', 'title', `title is ${title.length} chars (aim 10-65): "${title.slice(0, 70)}"`);
  else P('PASS', 'title', `"${title}"`);

  const desc = meta('description');
  if (!desc) P('WARN', 'description', 'missing meta description');
  else if (desc.length < 50 || desc.length > 170) P('WARN', 'description', `description is ${desc.length} chars (aim 50-170)`);
  else P('PASS', 'description', `${desc.length} chars`);

  const canon = links.find((l) => (l.rel || '').toLowerCase().split(/\s+/).includes('canonical'))?.href;
  if (!canon) P('WARN', 'canonical', 'missing <link rel="canonical">');
  else {
    try {
      const c = new URL(canon);
      if (!isLocal && c.host !== siteHost) P('WARN', 'canonical', `canonical points to another host: ${canon}`);
      else P('PASS', 'canonical', canon);
    } catch {
      P('WARN', 'canonical', `canonical is not an absolute URL: ${canon}`);
    }
  }

  P(/<html[^>]*\blang=/i.test(html) ? 'PASS' : 'WARN', 'lang', /<html[^>]*\blang=/i.test(html) ? '<html lang> set' : '<html> has no lang attribute');
  P(meta('viewport') ? 'PASS' : 'WARN', 'viewport', meta('viewport') ? 'viewport meta set' : 'missing viewport meta (mobile-first indexing)');

  const h1s = (html.match(/<h1\b/gi) || []).length;
  if (h1s === 1) P('PASS', 'h1', 'exactly one <h1>');
  else if (h1s === 0) P('WARN', 'h1', 'no <h1> in served HTML (client-rendered? crawlers may not see it)');
  else P('WARN', 'h1', `${h1s} <h1> elements, use one`);

  const ogMissing = ['og:title', 'og:description', 'og:image', 'og:url', 'twitter:card'].filter((n) => !meta(n));
  if (ogMissing.length) P('WARN', 'share-tags', `missing: ${ogMissing.join(', ')}`);
  else P('PASS', 'share-tags', 'og:title, og:description, og:image, og:url, twitter:card all set');

  const og = meta('og:image');
  if (og) {
    let ogUrl;
    try {
      ogUrl = new URL(og, finalUrl);
    } catch {
      P('FAIL', 'og-image', `og:image is not a valid URL: ${og}`);
    }
    if (ogUrl) {
      if (!/^https?:\/\//i.test(og)) P('WARN', 'og-image-url', 'og:image is relative, use an absolute URL');
      const img = await get(ogUrl.href);
      const ct = img.ok ? img.headers.get('content-type') || '' : '';
      if (!img.ok) P('FAIL', 'og-image', `og:image unreachable: ${img.error}`);
      else if (img.status !== 200) P('FAIL', 'og-image', `og:image returns HTTP ${img.status}`);
      else if (!ct.startsWith('image/')) P('FAIL', 'og-image', `og:image content-type is "${ct}", not an image`);
      else if (img.body.length === 0) P('FAIL', 'og-image', `og:image is a 0-byte ${ct} response (silent renderer failure, social platforms cache it)`);
      else if (img.body.length > 300 * 1024) P('WARN', 'og-image', `og:image is ${kb(img.body.length)}, over 300KB (WhatsApp may skip it)`);
      else P('PASS', 'og-image', `${ct}, ${kb(img.body.length)}${img.redirected ? ', served via redirect (fallback active)' : ''}`);
      if (!meta('og:image:width') || !meta('og:image:height')) P('WARN', 'og-image-size', 'og:image:width / og:image:height not declared');
    }
  }

  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  if (!blocks.length) P('WARN', 'jsonld', 'no JSON-LD structured data');
  else {
    const types = [];
    const issues = [];
    for (const b of blocks) {
      try {
        const data = JSON.parse(b);
        const nodes = Array.isArray(data) ? data : data['@graph'] || [data];
        if (!Array.isArray(data) && !data['@context']) issues.push('block without @context');
        for (const n of nodes) {
          const t = [].concat(n?.['@type'] || []);
          types.push(...t);
          if (t.some((x) => /Organization|LocalBusiness/.test(x))) {
            const logo = typeof n.logo === 'string' ? n.logo : n.logo?.url;
            if (logo && /\.svg(\?|$)/i.test(logo)) issues.push('Organization logo is SVG (use PNG)');
          }
        }
      } catch (e) {
        issues.push(`invalid JSON: ${e.message}`);
      }
    }
    const invalid = issues.some((i) => i.startsWith('invalid JSON'));
    P(invalid ? 'FAIL' : issues.length ? 'WARN' : 'PASS', 'jsonld', `${[...new Set(types)].join(', ') || 'no @type'}${issues.length ? `; ${issues.join('; ')}` : ''}`);
  }

  if (isHome) {
    const ga = html.match(/googletagmanager\.com\/gtag\/js\?id=([A-Z0-9-]+)/i)?.[1] || html.match(/\bG-[A-Z0-9]{8,}\b/)?.[0] || html.match(/\bGTM-[A-Z0-9]+\b/)?.[0];
    if (ga) P('PASS', 'analytics', `Google tag found (${ga})`);
    else P('INFO', 'analytics', 'no GA4/GTM tag in served HTML (ignore if you use other analytics)');
  }
}

// ---------- run ----------

const home = await get(`${origin}/`);
if (!home.ok) {
  add('FAIL', 'homepage', `${origin} unreachable: ${home.error}`);
} else {
  siteHost = new URL(home.url).host;
  if (siteHost !== base.host) add('INFO', 'host', `${base.host} redirects to ${siteHost}, comparing sitemap and canonical against ${siteHost}`);
  await checkSite();
  await checkPage('/', true);
  for (const p of opts.pages) await checkPage(p.startsWith('/') ? p : `/${p}`, false);
}

const count = (s) => results.filter((r) => r.status === s).length;
if (opts.json) {
  console.log(JSON.stringify({ site: origin, version: VERSION, summary: { pass: count('PASS'), warn: count('WARN'), fail: count('FAIL'), info: count('INFO') }, results }, null, 2));
} else {
  console.log(`seo-toolkit verify ${VERSION}: ${origin}\n`);
  let page = null;
  for (const r of results) {
    const scope = ['host', 'sitemap', 'robots', 'https-redirect', 'indexnow', '404', 'llms'].some((p) => r.id.startsWith(p)) ? 'site' : r.page;
    if (scope !== page) {
      page = scope;
      console.log(scope === 'site' ? '[site]' : `[page ${scope}]`);
    }
    console.log(`  ${r.status.padEnd(4)}  ${r.id.padEnd(15)} ${r.msg}`);
  }
  console.log(`\n${count('PASS')} pass, ${count('WARN')} warn, ${count('FAIL')} fail, ${count('INFO')} info`);
}
process.exit(count('FAIL') ? 1 : 0);
