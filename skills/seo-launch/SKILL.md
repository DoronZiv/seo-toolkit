---
name: seo-launch
description: >
  This skill should be used after a website ships its first production deploy
  to wire up the full SEO and AI-search discoverability stack. Triggers when
  the user asks for "SEO setup", "submit my site to Google", "Search Console",
  "Bing Webmaster", "IndexNow", "Google Analytics 4", "GA4 setup", "Google
  Business Profile", "Maps listing", "local SEO", "AI search visibility", or
  "ChatGPT search". Covers GSC + Bing + IndexNow + GA4 + GBP + share-preview
  metadata + dynamic OG fallback patterns. Tool-agnostic.
metadata:
  version: "0.1.0"
---

# SEO Launch — production discoverability stack

After deploy. One walkthrough. Six surfaces. Battle-tested gotchas.

## Order of operations (start to finish: ~90 min owner-time + async waits)

1. **Google Search Console** (10 min + verification) — domain or URL-prefix
2. **Bing Webmaster Tools** (5 min — auto-import from GSC)
3. **IndexNow** (15 min — key file + ping endpoint + GitHub Action)
4. **Google Analytics 4** (10 min — property + wire gtag into root layout)
5. **Google Business Profile** (10 min + 5-14 day postcard OR 24-72h video)
6. **Share-preview metadata polish + OG fallback** (15 min)

Skip any that don't apply (e.g., no local business → skip step 5).

Start step 1 first. The postcard/video wait in step 5 runs async; don't block
on it.

---

## Step 1 — Google Search Console

Sets the foundation: GSC is where Google decides what to index and how it
ranks. Without this, nothing else matters.

### 1.1 Pick property type

- **Domain** (`sc-domain:example.com`) — covers all subdomains and protocols.
  Requires DNS TXT verification at the registrar. Use if you control DNS.
- **URL prefix** (`https://www.example.com`) — covers only that exact prefix.
  Easier verification (HTML meta tag injected into the site `<head>`). Use
  if DNS access is awkward.

Recommend **Domain** for most projects. URL prefix for shared-hosting / no
DNS access scenarios.

### 1.2 Verify

For DNS verification: paste the `google-site-verification=...` TXT record
into the registrar (GoDaddy / Cloudflare / Route53). Propagation 5-30 min.

For HTML tag: ask the user for the `content="..."` string from Search Console,
inject as `<meta name="google-site-verification" content="...">` in the site's
root `<head>` (Next.js: `app/layout.js` metadata.verification.google).
Deploy, then click Verify in GSC.

### 1.3 Submit sitemap

GSC sidebar → Indexing → Sitemaps → enter `sitemap.xml`. Within 24-48h Google
crawls. Status changes from "Pending" to "Success" when accepted.

### 1.4 Request indexing on key pages

Top search bar in GSC → paste each priority URL → click "Request indexing".
Use for homepage(s) + top 3-5 pages. Skips Google's normal crawl queue.

See `references/gsc-walkthrough.md` for screenshot-walkthrough version.

---

## Step 2 — Bing Webmaster Tools

Bing's index powers Bing.com + Microsoft Copilot + ChatGPT Search + DuckDuckGo
+ Yahoo + Ecosia. **A single 5-minute import unlocks all of them.**

Open `https://www.bing.com/webmasters` → sign in with Google (same account
as GSC). Pick "Import sites from Google Search Console" → select the verified
property → Import. Verification is automatic (Bing trusts your GSC ownership).

Once imported: sidebar → Sitemaps → submit `sitemap.xml`. Sidebar → IndexNow
→ enable + generate API key (we use it in Step 3).

See `references/bing-import.md` for details + AI-search surface coverage.

---

## Step 3 — IndexNow + auto-ping CI

IndexNow notifies Bing/Yandex/Copilot/ChatGPT-Search **within seconds** of
content changes instead of waiting days for a crawl. Free.

### 3.1 Verification file

Bing's IndexNow page shows an API key (long hex string). Host it at the site
root: `/public/{key}.txt` containing just the key as plain text. After
deploy, hit `https://yoursite.com/{key}.txt` — should return the key. Click
Verify in Bing.

### 3.2 API endpoint (`/api/indexnow`)

Build a POST endpoint that pings IndexNow with a list of URLs. Auth via
header secret. See `references/indexnow-setup.md` for the full Next.js
edge route template.

### 3.3 GitHub Action — auto-ping on every deploy

Add a workflow that runs after push to main:
1. Waits 120 seconds for the hosting platform to finish building.
2. Fetches `sitemap.xml` from the live site.
3. Extracts URLs via `grep -oP '(?<=<loc>)[^<]+'` + `jq`.
4. POSTs them to `/api/indexnow` with the secret header.

Workflow YAML template in `references/indexnow-setup.md`. **CRITICAL:** add
the secret to GitHub repo secrets (Settings → Secrets and variables → Actions
→ New secret) with the EXACT name the workflow expects.

---

## Step 4 — Google Analytics 4

Live traffic + behaviour analytics. Wire once, see real-time visitors
forever.

### 4.1 Create property

`https://analytics.google.com` → Admin → Create Property. Name `[Site]`,
timezone (e.g. `Israel (GMT+02:00)`), currency (e.g. `ILS`). Industry:
Technology / closest match. Pick **Web** as platform. Stream URL: the live
site. Enhanced measurement: ON (auto-tracks scrolls, clicks, downloads).

Note the **Measurement ID** that starts with `G-`.

### 4.2 Wire into root layout

Use `next/script` (or framework equivalent) with `afterInteractive` strategy
so analytics doesn't block first paint. Pattern in `references/ga4-wiring.md`.

Verify: visit the live site, then GA4 → Reports → Realtime → should see
"1 user in last 30 minutes" with your country dot within 30 seconds.

---

## Step 5 — Google Business Profile (optional, if local visibility matters)

Puts the business on Google Maps + into the local 3-pack for searches like
"AI automation Israel".

Open `https://business.google.com` → Manage now. Business name. Category
(primary: closest match). Service area or physical address.

**Verification:**
- **Postcard** (5-14 days mail) — historical default
- **Video** (24-72h review) — increasingly the only option for service-area
  businesses. Film 30-60s showing: workspace, the site URL on screen, the
  business email inbox (Outlook/Gmail), and a face shot saying your name +
  business + country

Full filming script + shot list in `references/gbp-walkthrough.md`.

While verification pends: fill business description (bilingual welcome),
hours, photos (logo + og image + workspace), services list.

---

## Step 6 — Share-preview metadata polish + dynamic OG fallback

Every share of the site URL on WhatsApp / LinkedIn / Facebook / Slack /
iMessage / Telegram uses the OG meta. Polish:

- `og:image` 1200x630 PNG, under 300KB, `og:image:width` + `og:image:height`
  declared, `og:image:type=image/png`, `og:image:alt` per-locale and
  descriptive
- `twitter:card=summary_large_image`
- `og:url` absolute, `og:site_name`, `og:locale` per-locale
- JSON-LD Organization + WebSite + (optional) LocalBusiness with full
  PNG logo (not SVG — broader scraper support)

After publish, force re-scrape:
- Facebook debugger → "Scrape Again"
- LinkedIn post inspector → "Inspect"
- WhatsApp adds `?v=2` query string to bust cache

### Dynamic OG renderer pattern + fallback

If using a dynamic OG renderer (Next.js `opengraph-image.js` + Satori): **wrap
it in try/catch and redirect to the static `/og.png` on any error.** Pattern
in `references/og-fallback-pattern.md`. Skip this defensive pattern at your
peril — the failure mode is silent and Facebook caches the broken response
for ~7 days.

---

## Surfaces unlocked at the end of this skill

| Surface | Powered by |
|---|---|
| Google Search | GSC + sitemap |
| Bing.com | Bing Webmaster + sitemap |
| Microsoft Copilot | Bing index |
| ChatGPT Search | Bing index |
| DuckDuckGo, Yahoo, Ecosia | Bing index |
| Yandex | IndexNow protocol |
| Google Maps + local pack | Google Business Profile |
| Real-time analytics | GA4 |
| WhatsApp/LinkedIn/Facebook share previews | OG metadata + static fallback |

Every push from then on auto-pings IndexNow → every blog post / page change
indexed within seconds across all the Bing-powered surfaces.

---

## Gotchas (read once)

- **WOFF2 dies in @vercel/og** — Satori only accepts TTF/OTF. If using
  dynamic OG fonts, bundle a static-weight TTF.
- **Cross-OS Write tool can pad with NULL bytes** — corrupts JS files
  silently. On Cowork/WSL setups, use bash heredoc for short overwrites.
- **PowerShell `Remove-Item "app/[locale]/..."` silently no-ops** — brackets
  are wildcards. Use `-LiteralPath`.
- **Vercel `Cache-Control: max-age=31536000`** on dynamic routes caches
  broken responses for a year. Set `must-revalidate` or use 302 redirects.
- **GBP video verification needs a face shot** — without it, ~30%
  resubmission rate. Always include 5 seconds of "I'm [Name], owner of
  [Business], in [Country]" on camera.

See `references/` directory for deep-dive walkthroughs of each surface.
