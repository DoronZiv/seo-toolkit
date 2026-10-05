---
name: seo-launch
description: >
  Use after a website's first production deploy, or when a live site is not
  getting indexed or shows broken share previews. Audits the live site with a
  script (robots, sitemap, noindex, canonical, OG image bytes, JSON-LD,
  IndexNow key), then fixes what fails and sets up IndexNow auto-ping on every
  deploy. Hands the owner-only steps (Search Console, Bing, GA4, Business
  Profile) over as numbered clicks. Triggers on "SEO setup", "submit my site
  to Google", "Search Console", "Bing Webmaster", "IndexNow", "GA4 setup",
  "Google Business Profile", "why is my site not indexed", "share preview
  broken", "AI search visibility".
metadata:
  version: "0.2.0"
---

# SEO Launch

Two kinds of work. Do not mix them up:

- Claude can check and build: audit the live site, fix code, add IndexNow.
- Only the owner can do: clicks inside Google and Bing accounts, DNS records.
  Give those as numbered clicks (see `references/owner-steps.md`), never as prose.

## 1. Audit first

Run the verifier from this skill's directory (the base directory is shown when
the skill loads). Needs Node 18+, no install, read-only:

```
node scripts/verify.mjs https://www.example.com
node scripts/verify.mjs https://www.example.com --indexnow-key=KEY --page=/about --page=/blog
```

It checks: http to https redirect, robots.txt (whole-site block, AI crawlers),
sitemap (parses, sampled URLs return 200, hosts match), soft 404, llms.txt,
and per page: noindex, title, description, canonical, lang, viewport, h1,
share tags, og:image (reachable, real image type, not 0 bytes, under 300KB),
JSON-LD (parses, logo not SVG), Google tag. Exit code 1 if any FAIL.

Report the result as FAIL first, then WARN. Ignore INFO. Do not start the
owner steps until there are no FAIL lines.

## 2. Fix what the audit found

| Check | Usual cause and fix |
|---|---|
| noindex | Staging flag or env var left on in production. Remove it, redeploy. |
| robots | `Disallow: /` copied from staging. AI crawlers blocked: ask the owner if that is intended. |
| sitemap, sitemap-urls | Stale or generated at build time. List final URLs only (no redirects, no 404s). |
| sitemap-host | Sitemap uses another host than the live one (www vs apex, or a preview domain). |
| og-image | 0 bytes or wrong type: see `references/og-fallback.md`. |
| canonical | Must be absolute, same host as the live site, one per page. |
| jsonld | Fix invalid JSON first. Organization logo must be PNG, not SVG. |
| 404 | Unknown URLs return 200. Make the not-found page return a real 404. |

Re-run the verifier after each batch of fixes until FAIL is zero.

## 3. IndexNow on every deploy

IndexNow tells Bing, Yandex, Naver, Seznam and Yep about changed URLs within
seconds. Google does not use it. Bing's index also feeds Copilot, DuckDuckGo,
Yahoo and Ecosia, so one ping reaches all of them.

1. Make a key: `openssl rand -hex 16` (8 to 128 chars, letters, digits, dashes). No Bing account needed.
2. Host it: `public/<key>.txt` containing only the key.
3. Hosting env vars: `INDEXNOW_KEY`, `INDEXNOW_HOST` (e.g. `www.example.com`), `INDEXNOW_SECRET` (random 32+ chars).
4. Copy `assets/indexnow-route.js` to `app/api/indexnow/route.js`.
5. Copy `assets/indexnow.yml` to `.github/workflows/indexnow.yml`. Add repo variable `SITE_URL` and repo secret `INDEXNOW_SECRET` (same value as step 3).
6. Deploy, then verify: `node scripts/verify.mjs <url> --indexnow-key=<key>`.

Other frameworks: the route is a plain POST handler, port it. Keep the secret header.

## 4. Owner steps

Hand `references/owner-steps.md` sections to the owner as needed, in this order:
Search Console (10 min), Bing import (5 min), GA4 (10 min), Business Profile
(only for local or service-area businesses; verification takes days, start it first).

## Gotchas that cost real time

- `@vercel/og` (Satori) rejects WOFF2 and can crash on variable fonts. Use static-weight TTF or OTF, bundled in the repo.
- A year-long `Cache-Control` on a dynamic OG route turns one bad render into a year-long problem. Use 302 redirects or `must-revalidate`.
- Share previews are cached by Facebook, LinkedIn and WhatsApp. After a fix, force a re-scrape (Facebook Sharing Debugger, LinkedIn Post Inspector).
- A Search Console Domain property needs a DNS TXT record. If the owner has no DNS access, use a URL-prefix property with the meta tag instead.
