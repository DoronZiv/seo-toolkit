# Dynamic OG renderer — defensive fallback pattern

Dynamic OG renderers (`@vercel/og` Satori) fail in subtle ways and the
failure mode is silent (HTTP 200 + `image/png` content-type + 0-byte body).
Facebook/LinkedIn cache the broken response for ~7 days.

**Always wrap the renderer in try/catch and redirect to the static
`/og.png`:**

```js
// app/[locale]/opengraph-image.js
import { renderOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const runtime = "edge";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Site preview";

export default async function Image({ params }) {
  try {
    return await renderOgImage({ ... });
  } catch (err) {
    console.error("[og] renderer failed:", err);
    return Response.redirect("https://www.example.com/og.png", 302);
  }
}
```

The 302 is uncached, so each request gets a fresh attempt at the dynamic
render, and any failure cleanly serves the static fallback declared in the
page metadata.

## Font caveats

- WOFF2 → rejected by Satori. Use TTF or OTF.
- Variable TTFs → can crash Satori with "Cannot read properties of
  undefined (reading '258')". Use single-weight static TTFs.
- gstatic URLs rotate without warning. Bundle the font file in the repo.

## Failure prevention checklist

- [ ] Static `/og.png` declared in metadata as fallback
- [ ] Renderer wrapped in try/catch with 302 redirect
- [ ] Font bundled locally (not fetched from CDN at request time)
- [ ] Font is TTF or OTF (not WOFF2)
- [ ] Font is single-weight (not variable)
