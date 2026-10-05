# Dynamic OG image: never serve an empty response

Dynamic OG renderers (`@vercel/og`, Satori) can fail silently: HTTP 200, an
`image/png` content-type, and a 0-byte body. Facebook, LinkedIn and WhatsApp
cache that broken response. `scripts/verify.mjs` flags it as a FAIL on `og-image`.

Wrap the renderer in try/catch and redirect to a static `/og.png` on any error:

```js
// app/[locale]/opengraph-image.js
import { renderOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const runtime = "edge";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Site preview";

export default async function Image({ params }) {
  try {
    return await renderOgImage({ params });
  } catch (err) {
    console.error("[og] renderer failed:", err);
    return Response.redirect("https://www.example.com/og.png", 302);
  }
}
```

The 302 is not cached, so every request retries the dynamic render and any
failure falls back cleanly to the static image.

## Font rules

- WOFF2 is rejected by Satori. Use TTF or OTF.
- Variable TTFs can crash it ("Cannot read properties of undefined (reading '258')"). Use single-weight static files.
- Font URLs on CDNs can change without notice. Bundle the file in the repo.

## Checklist

- [ ] Static `/og.png` exists, 1200x630, under 300KB, declared in page metadata
- [ ] Renderer wrapped in try/catch with a 302 to the static image
- [ ] Font bundled locally, TTF or OTF, single weight
- [ ] No long-lived `Cache-Control` on the dynamic route
- [ ] After a fix, re-scrape: Facebook Sharing Debugger, LinkedIn Post Inspector
