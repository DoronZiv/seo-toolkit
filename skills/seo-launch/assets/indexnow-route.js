// app/api/indexnow/route.js (Next.js App Router)
// Pings IndexNow (Bing, Yandex, Naver, Seznam, Yep; not Google) with a list of URLs.
// Env: INDEXNOW_KEY (the key you host at /<key>.txt), INDEXNOW_HOST (e.g. www.example.com),
//      INDEXNOW_SECRET (random 32+ chars, same value as the GitHub Action secret).

const ENDPOINT = 'https://api.indexnow.org/IndexNow';
const MAX_URLS = 10000; // IndexNow limit per request

export async function POST(req) {
  const { INDEXNOW_KEY: key, INDEXNOW_HOST: host, INDEXNOW_SECRET: secret } = process.env;
  if (!key || !host || !secret) {
    return Response.json({ error: 'indexnow env not configured' }, { status: 500 });
  }
  if (req.headers.get('x-indexnow-secret') !== secret) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const input = Array.isArray(body.urls) && body.urls.length ? body.urls : ['/'];
  const urlList = input
    .filter((u) => typeof u === 'string')
    .map((u) => (u.startsWith('http') ? u : `https://${host}${u.startsWith('/') ? u : `/${u}`}`))
    .filter((u) => new URL(u).host === host) // IndexNow rejects URLs outside the host
    .slice(0, MAX_URLS);

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host, key, keyLocation: `https://${host}/${key}.txt`, urlList }),
  });

  // 200 and 202 both mean accepted
  return Response.json(
    { ok: res.status === 200 || res.status === 202, indexnowStatus: res.status, submitted: urlList.length },
    { status: res.status === 200 || res.status === 202 ? 200 : 502 },
  );
}

export async function GET() {
  return new Response('Method Not Allowed', { status: 405 });
}
