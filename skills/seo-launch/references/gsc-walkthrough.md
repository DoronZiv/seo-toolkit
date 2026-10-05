# Google Search Console — verification + sitemap

## 1. Add property

`https://search.google.com/search-console` → Add property.

| Type | When to pick |
|---|---|
| Domain | You control DNS at the registrar |
| URL prefix | Easier, but covers only that one prefix |

## 2. Domain verification (DNS TXT)

Add TXT record at registrar:
- Type: TXT
- Name: @
- Value: `google-site-verification=...` (copy from GSC)
- TTL: 1 hour

Wait 5-30 min. Back in GSC → Verify.

## 3. URL prefix verification (HTML tag)

GSC shows: `<meta name="google-site-verification" content="...">`. Inject
into root `<head>`. In Next.js:

```js
export const metadata = {
  verification: { google: "..." }
};
```

Deploy. Back in GSC → Verify.

## 4. Submit sitemap

GSC sidebar → Indexing → Sitemaps → enter `sitemap.xml` → Submit.

## 5. Request indexing on priority pages

Top search bar → paste URL → Enter → click "REQUEST INDEXING" button.
Use sparingly (Google rate-limits): homepage(s) + top 3-5 priority pages.

## 6. Coverage report

Indexing → Pages. After 24-48h, shows which URLs Google has indexed,
which had errors, which were skipped. Fix errors before submitting more.
