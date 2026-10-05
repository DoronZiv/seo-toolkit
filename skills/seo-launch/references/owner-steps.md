# Owner steps

Things only the site owner can do, in their own accounts. Give them as numbered
clicks. Run `scripts/verify.mjs` first: sitemap and robots must be clean before you submit anything.

## A. Google Search Console (10 min)

Pick the property type:
- Domain: covers all subdomains and protocols. Needs a DNS TXT record. Preferred.
- URL prefix: one exact prefix. Verifies with an HTML meta tag. Use when there is no DNS access.

Domain property:
1. Open search.google.com/search-console and click Add property.
2. Choose Domain, enter `example.com`, click Continue.
3. Copy the `google-site-verification=...` TXT value.
4. At the domain registrar or DNS host, add a record: Type TXT, Name `@`, Value the copied string, TTL 1 hour.
5. Wait 5 to 30 minutes, go back to Search Console, click Verify.

URL prefix property (meta tag):
1. Add property, choose URL prefix, enter the full URL with `https://` and `www` if used.
2. Choose HTML tag, copy the `content="..."` value, send it to Claude.
3. Claude adds it to the root layout (`metadata.verification.google` in Next.js) and deploys.
4. Click Verify.

Then:
1. Left menu, Indexing, Sitemaps, type `sitemap.xml`, Submit. Status turns to Success within a day or two.
2. Top search bar, paste the homepage URL, press Enter, click Request indexing. Repeat for the 3 to 5 most important pages. Google rate-limits this, do not spam it.
3. After 1 to 2 days: Indexing, Pages. Fix listed errors before submitting more.

## B. Bing Webmaster Tools (5 min, after A)

1. Open bing.com/webmasters and sign in with the same Google account.
2. Choose Import sites from Google Search Console (not Add a site manually).
3. Allow the read-only Google permission, tick the property, click Import. Bing verifies by trusting the Search Console ownership.
4. Left menu, Sitemaps: if `sitemap.xml` is not there, submit it.

This feeds Bing, Copilot, DuckDuckGo, Yahoo and Ecosia. IndexNow itself needs no Bing account (see SKILL.md section 3).

## C. Google Analytics 4 (10 min)

1. Open analytics.google.com, Admin, Create, Property. Name it, set timezone and currency.
2. Choose Web, enter the live URL, leave Enhanced measurement on, click Create stream.
3. Copy the Measurement ID (starts with `G-`) and send it to Claude.

Claude adds it in the root layout, loaded after the page is interactive (Next.js):

```jsx
import Script from "next/script";
const GA_ID = "G-XXXXXXXXXX";
// inside <body>, after {children}:
<Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
<Script id="ga-init" strategy="afterInteractive">{`
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${GA_ID}');
`}</Script>
```

Check: open the live site, then GA4 Reports, Realtime. One user should show within about 30 seconds.
If the site has a cookie banner or serves EU visitors, add consent handling before going live.

## D. Google Business Profile (only if local visibility matters)

Start this first, verification takes days.
1. Open business.google.com, click Manage now, enter business name and category.
2. Enter the address, or the service area if there is no public address.
3. Choose the verification method Google offers: postcard (5 to 14 days) or video (usually 1 to 3 days).

Video verification, one continuous take of 30 to 60 seconds, vertical phone video:
1. Face: say your name, role, business and country.
2. Workspace: pan across the real desk and computer.
3. Website: open the live site, show the URL bar.
4. Business email: show the inbox with the business name.
5. Close: workspace and your face again.

While waiting: fill description, hours, services, logo and photos.
