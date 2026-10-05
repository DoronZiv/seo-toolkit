# IndexNow — Next.js endpoint + GitHub Action

## 1. Verification file at /public

```
public/{api-key}.txt
```

Contents: just the API key as plain UTF-8 text. No newline after, or trim.

## 2. API endpoint

`app/api/indexnow/route.js`:

```js
const INDEXNOW_KEY = "PASTE_KEY_HERE";
const HOST = "www.example.com";
const KEY_LOCATION = `https://${HOST}/${INDEXNOW_KEY}.txt`;
const ENDPOINT = "https://api.indexnow.org/IndexNow";

function abs(url) {
  if (url.startsWith("http")) return url;
  return `https://${HOST}${url.startsWith("/") ? url : `/${url}`}`;
}

export async function POST(req) {
  const secret = req.headers.get("x-indexnow-secret");
  if (!process.env.INDEXNOW_SECRET || secret !== process.env.INDEXNOW_SECRET) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  let urls = Array.isArray(body.urls) ? body.urls : ["/", "/sitemap.xml"];
  urls = urls.map(abs);

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: HOST,
      key: INDEXNOW_KEY,
      keyLocation: KEY_LOCATION,
      urlList: urls,
    }),
  });
  return new Response(JSON.stringify({ ok: res.ok, indexnowStatus: res.status, submitted: urls }), {
    status: res.ok ? 200 : 502,
    headers: { "content-type": "application/json" },
  });
}

export async function GET() {
  return new Response("Method Not Allowed", { status: 405 });
}
```

Set env var `INDEXNOW_SECRET` to a random 32+ char string. Use the same
value in the GitHub Action secret below.

## 3. GitHub Action (`.github/workflows/indexnow.yml`)

```yaml
name: IndexNow auto-ping

on:
  push:
    branches: [main]
    paths: ["app/**", "components/**", "lib/**", "public/**"]
  workflow_dispatch:

permissions:
  contents: read

jobs:
  ping:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: Wait for deploy
        run: sleep 120

      - name: Fetch sitemap and extract URLs
        id: urls
        run: |
          curl -sSf -o sitemap.xml https://www.example.com/sitemap.xml
          urls=$(grep -oP '(?<=<loc>)[^<]+' sitemap.xml \
            | jq -R -s -c 'split("\n") | map(select(length > 0))')
          { echo "urls<<EOF"; echo "$urls"; echo "EOF"; } >> "$GITHUB_OUTPUT"

      - name: Ping IndexNow
        env:
          INDEXNOW_SECRET: ${{ secrets.INDEXNOW_SECRET }}
        run: |
          payload=$(jq -n --argjson urls '${{ steps.urls.outputs.urls }}' '{urls: $urls}')
          response=$(curl -sS -X POST https://www.example.com/api/indexnow \
            -H "x-indexnow-secret: $INDEXNOW_SECRET" \
            -H "content-type: application/json" \
            -d "$payload")
          echo "Response: $response"
          ok=$(echo "$response" | jq -r '.ok // false')
          [ "$ok" = "true" ] || { echo "::error::ping failed"; exit 1; }
```

Replace `www.example.com` with actual domain. Set `INDEXNOW_SECRET` repo
secret to the same value used on the hosting platform env var.
