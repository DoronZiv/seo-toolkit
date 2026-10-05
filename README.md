# SEO Toolkit

A Claude Code skill that audits a live site for the SEO and AI-search basics, fixes what fails, and sets up IndexNow on every deploy.

The part plain Claude cannot do from memory is the verifier: `skills/seo-launch/scripts/verify.mjs`. Zero install, Node 18+, read-only.

```
node skills/seo-launch/scripts/verify.mjs https://www.example.com --indexnow-key=KEY --page=/about
```

It checks, with PASS / WARN / FAIL per check:

| Area | Checks |
|---|---|
| Site | http to https redirect, robots.txt (whole-site block, blocked AI crawlers), sitemap parses and sampled URLs return 200, soft 404, llms.txt, IndexNow key file |
| Page | noindex (meta and header), title, description, canonical, lang, viewport, h1, share tags, og:image reachable and not 0 bytes, JSON-LD valid, Google tag |

Exit code is 1 when any check fails, so it also works in CI.

## What the skill adds

- Fix table: each failing check mapped to its usual cause.
- IndexNow: a tested Next.js route and a GitHub Action that pings after every deploy.
- OG image fallback for the silent 0-byte renderer failure.
- Owner steps (Search Console, Bing import, GA4, Business Profile) as numbered clicks.

## Install

In Claude Code:

```
/plugin marketplace add DoronZiv/seo-toolkit
/plugin install seo-toolkit@seo-toolkit
```

Then ask: "SEO setup for https://your-site.com".

## Test

```
node skills/seo-launch/scripts/verify.test.mjs
```

Runs the verifier against a healthy and a deliberately broken local site.

MIT licensed.
