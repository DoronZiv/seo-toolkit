# Bing Webmaster Tools — auto-import from Google Search Console

## Why it matters

Bing's index quietly powers:
- Bing.com
- Microsoft Copilot (Windows + Edge)
- ChatGPT Search (primary backend)
- DuckDuckGo (primary backend)
- Yahoo Search (Bing-powered since 2010)
- Ecosia

A single 5-min import unlocks ALL of these. For an AI-search era, this is
arguably the highest-leverage SEO action available.

## Steps

1. `https://www.bing.com/webmasters` → Sign in with Google (same account
   as GSC)
2. Two big cards on the welcome screen: pick **"Import sites from Google
   Search Console"** (NOT "Add a site manually")
3. Authorise Google permissions (Bing needs read-only access to your GSC
   property list)
4. Tick the GSC properties you want to import → Import
5. Within ~10 seconds: Bing auto-verifies (trusting your GSC ownership),
   imports the sitemap, pulls up to 16 months of historical Google data

## After import — three quick wins

- **Sitemaps** sidebar: if not auto-imported, submit `sitemap.xml` manually
- **IndexNow** sidebar: enable + generate API key (use it in the IndexNow
  step of this skill)
- **AI Performance** tab (BETA) — shows specifically how the site appears
  in Copilot/ChatGPT Search; empty at first, useful over time
